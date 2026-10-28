import { auth } from "@/auth";
import { syncRows } from "@/lib/mongo";
import { isSyncKey, MAX_VALUE_BYTES } from "@/lib/sync-keys";

const noStore = { "Cache-Control": "no-store" };

/** All of the signed-in user's stored values: { data: { [key]: jsonText } }. */
export async function GET() {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return Response.json({ error: "Sign in first" }, { status: 401, headers: noStore });
  try {
    const rows = await (await syncRows()).find({ uid }).toArray();
    return Response.json(
      { data: Object.fromEntries(rows.map((r) => [r.key, r.value])) },
      { headers: noStore },
    );
  } catch (e) {
    console.error("sync GET failed", e);
    return Response.json({ error: "Storage unavailable" }, { status: 503, headers: noStore });
  }
}

/** Save one store: body { key, value } where value is the JSON text, or null to remove it. */
export async function PUT(req: Request) {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return Response.json({ error: "Sign in first" }, { status: 401, headers: noStore });

  let body: { key?: unknown; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400, headers: noStore });
  }
  const { key, value } = body;
  if (!isSyncKey(key)) return Response.json({ error: "Unknown key" }, { status: 400, headers: noStore });
  if (value !== null && typeof value !== "string")
    return Response.json({ error: "Value must be text or null" }, { status: 400, headers: noStore });
  if (typeof value === "string") {
    if (value.length > MAX_VALUE_BYTES)
      return Response.json({ error: "Too large to sync" }, { status: 413, headers: noStore });
    try {
      JSON.parse(value);
    } catch {
      return Response.json({ error: "Value is not JSON" }, { status: 400, headers: noStore });
    }
  }
  try {
    const col = await syncRows();
    if (value === null) await col.deleteOne({ uid, key });
    else {
      const set: { value: string; updated: number; email?: string } = { value, updated: Date.now() };
      // The reminder cron emails the account address, so it comes from the session, not from the stored value.
      if (key === "csplan.striver" && session?.user?.email) set.email = session.user.email;
      await col.updateOne({ uid, key }, { $set: set }, { upsert: true });
    }
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("sync PUT failed", e);
    return Response.json({ error: "Storage unavailable" }, { status: 503, headers: noStore });
  }
}
