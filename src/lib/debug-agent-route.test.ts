import { beforeEach, describe, expect, it, vi } from "vitest";
import { getScenario } from "@/lib/debug";
import { newRound } from "@/lib/debug-round";
import { LLM_LIMITS } from "@/lib/llm-limits";

const limits = {
  reserveMessage: vi.fn(),
  refundMessage: vi.fn(),
  tokensToday: vi.fn(),
  addTokens: vi.fn(),
  withinLimit: vi.fn(),
};
vi.mock("@/lib/agent-limits", async (orig) => ({ ...(await orig<object>()), ...limits }));

const SECRET = "test-secret";
const SID = "clamp-swapped-min-max";
const scenario = getScenario(SID)!;
const upstream = vi.fn();

const token = () => newRound(SID, SECRET).token;
const base = () => ({
  token: token(),
  phase: "explore" as const,
  messages: [{ role: "user" as const, content: "Why does clamp(5, 0, 10) return 0?" }],
  files: scenario.files,
  testOutput: "FAIL: test_inside_range",
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/debug/agent", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function run(req: Request) {
  const { POST } = await import("@/app/api/debug/agent/route");
  return POST(req);
}

const modelReply = (content: string, total_tokens = 321) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens } }), {
    status: 200,
  });

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", SECRET);
  vi.stubEnv("TOKEN_API_KEY", "sk-test-key");
  vi.stubEnv("TOKEN_BASE_URL", "https://llm.example.test/v1");
  vi.stubEnv("TOKEN_MODEL", "test-model");
  Object.values(limits).forEach((m) => m.mockReset());
  limits.withinLimit.mockResolvedValue(true);
  limits.tokensToday.mockResolvedValue(0);
  limits.reserveMessage.mockResolvedValue(3);
  limits.addTokens.mockResolvedValue(undefined);
  limits.refundMessage.mockResolvedValue(undefined);
  upstream.mockReset().mockResolvedValue(modelReply("Look at the nesting of min and max."));
  vi.stubGlobal("fetch", upstream);
});

describe("POST /api/debug/agent", () => {
  it("answers, counts the message and reports what is left", async () => {
    const res = await run(post(base()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      reply: "Look at the nesting of min and max.",
      truncated: false,
      used: 3,
      cap: 12,
      remaining: 9,
    });
    expect(limits.addTokens).toHaveBeenCalledWith(expect.any(String), 321);
  });

  it("sends the key and model upstream, and never the answer key", async () => {
    await run(post(base()));
    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe("https://llm.example.test/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test-key");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("test-model");
    const prompt = JSON.stringify(sent.messages);
    expect(prompt).not.toContain(scenario.rootCause);
    expect(prompt).not.toContain(scenario.correctFix["util.py"]);
    expect(prompt).toContain("test_inside_range");
  });

  it("sends a fixed output cap that the page cannot change", async () => {
    await run(post({ ...base(), max_tokens: 99999, maxTokens: 99999 }));
    expect(JSON.parse(upstream.mock.calls[0][1].body).max_tokens).toBe(LLM_LIMITS.chatTokens);
  });

  it("cuts a reply that is longer than the cap, even if the gateway ignored it", async () => {
    upstream.mockResolvedValue(modelReply("a".repeat(LLM_LIMITS.chatChars + 500)));
    const data = await (await run(post(base()))).json();
    expect(data.truncated).toBe(true);
    expect(data.reply.length).toBeLessThan(LLM_LIMITS.chatChars + 100);
    expect(data.reply).toContain("cut off at the length limit");
  });

  it("marks a reply the model stopped for length", async () => {
    upstream.mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "The bug is" }, finish_reason: "length" }] }),
        { status: 200 },
      ),
    );
    const data = await (await run(post(base()))).json();
    expect(data.truncated).toBe(true);
    expect(data.reply).toContain("cut off at the length limit");
  });

  it("rejects a forged or expired token", async () => {
    expect((await run(post({ ...base(), token: "forged.token" }))).status).toBe(401);
    const expired = newRound(SID, SECRET, Date.now() - 3_600_000 * 2).token;
    expect((await run(post({ ...base(), token: expired }))).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("enforces the message cap on the server", async () => {
    limits.reserveMessage.mockResolvedValue(null);
    const res = await run(post(base()));
    expect(res.status).toBe(429);
    expect((await res.json()).remaining).toBe(0);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("refuses a patch request without a real hypothesis", async () => {
    const res = await run(post({ ...base(), phase: "fix", hypothesis: "bug" }));
    expect(res.status).toBe(400);
    expect(limits.reserveMessage).not.toHaveBeenCalled();
  });

  it("includes the hypothesis when asked for a patch", async () => {
    const hypothesis = "min and max are nested the wrong way round";
    await run(post({ ...base(), phase: "fix", hypothesis }));
    expect(upstream.mock.calls[0][1].body).toContain(hypothesis);
  });

  it("never lets a patch through, with or without a hypothesis", async () => {
    upstream.mockResolvedValue(modelReply("Here:\n```python path=util.py\nreturn x\n```"));
    const { reply } = await (await run(post(base()))).json();
    expect(reply).toContain("Code withheld");
    expect(reply).not.toContain("return x");
  });

  it("stops at the daily token budget", async () => {
    vi.stubEnv("DEBUG_DAILY_TOKEN_BUDGET", "1000");
    limits.tokensToday.mockResolvedValue(1000);
    const res = await run(post(base()));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/tomorrow/);
    expect(limits.reserveMessage).not.toHaveBeenCalled();
  });

  it("throttles one address", async () => {
    limits.withinLimit.mockResolvedValue(false);
    expect((await run(post(base()))).status).toBe(429);
  });

  it("gives the message back when the model call fails", async () => {
    upstream.mockResolvedValue(new Response("nope", { status: 500 }));
    const res = await run(post(base()));
    expect(res.status).toBe(502);
    expect(limits.refundMessage).toHaveBeenCalledTimes(1);
  });

  it("says the assistant is unavailable, and refunds, when the gateway account is out of credit", async () => {
    upstream.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "balance_zero" } }), { status: 402 }),
    );
    const res = await run(post(base()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/unavailable/);
    expect(limits.refundMessage).toHaveBeenCalledTimes(1);
  });

  it("is unavailable, not broken, without a key", async () => {
    vi.stubEnv("TOKEN_API_KEY", "");
    expect((await run(post(base()))).status).toBe(503);
  });

  it("rejects oversized and malformed requests", async () => {
    expect((await run(post("x".repeat(130_000)))).status).toBe(413);
    expect((await run(post("not json"))).status).toBe(400);
    expect((await run(post({ ...base(), files: { "evil.py": "x" } }))).status).toBe(400);
    expect((await run(post({ ...base(), messages: [{ role: "assistant", content: "hi" }] }))).status).toBe(
      400,
    );
  });

  it("ignores cross-site calls", async () => {
    expect((await run(post(base(), { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });
});
