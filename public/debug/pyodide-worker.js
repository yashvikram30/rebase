// Runs a scenario's code in Pyodide, off the main thread.
// Requests:
//   { id, files, suite: "test_failing" | "test_regression" }   run a unittest suite
//   { id, kind: "exec", files, code }                          run a snippet with the project importable
// Response: { id, ok, output }  (plus a one-off { ready: true } once Pyodide has loaded)
// The page kills this worker with terminate() if a run takes too long, then starts a new one.
importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js");

const ready = loadPyodide();

const RUNNER = `
import ast, contextlib, io, sys, traceback, unittest

def _enter(workdir, modules):
    sys.path.insert(0, workdir)
    for name in modules:
        sys.modules.pop(name, None)

def _leave(workdir, modules):
    sys.path.remove(workdir)
    for name in modules:
        sys.modules.pop(name, None)

def run_suite(workdir, suite, modules):
    _enter(workdir, modules)
    buf = io.StringIO()
    try:
        loaded = unittest.TestLoader().loadTestsFromName(suite)
        result = unittest.TextTestRunner(stream=buf, verbosity=2).run(loaded)
        ok = result.wasSuccessful()
    except BaseException as e:
        buf.write("%s: %s\\n" % (type(e).__name__, e))
        ok = False
    finally:
        _leave(workdir, modules)
    return ok, buf.getvalue()

_session = {"key": None, "ns": None}

def run_code(workdir, code, modules, key):
    _enter(workdir, modules)
    buf = io.StringIO()
    ok = True
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            if _session["key"] != key:
                # The code changed (or this is the first command): start a fresh session with it imported.
                fresh = {"__name__": "__main__"}
                for name in modules:
                    if not name.startswith("test_"):
                        try:
                            exec("from %s import *" % name, fresh)
                        except BaseException as e:
                            print("Could not import %s: %s: %s" % (name, type(e).__name__, e))
                _session["key"] = key
                _session["ns"] = fresh
            ns = _session["ns"]
            try:
                tree = ast.parse(code, "<terminal>", "exec")
            except SyntaxError as e:
                ok = False
                print("".join(traceback.format_exception_only(type(e), e)), end="")
                tree = None
            if tree is not None:
                # Like a REPL: a final expression prints its value.
                last = ast.Expression(tree.body.pop().value) if tree.body and isinstance(tree.body[-1], ast.Expr) else None
                exec(compile(tree, "<terminal>", "exec"), ns)
                if last is not None:
                    value = eval(compile(last, "<terminal>", "eval"), ns)
                    if value is not None:
                        print(repr(value))
    except BaseException as e:
        ok = False
        # Skip this runner's own frame so the traceback starts at the user's code.
        buf.write("".join(traceback.format_exception(type(e), e, e.__traceback__.tb_next if e.__traceback__ else None)))
    finally:
        _leave(workdir, modules)
    return ok, buf.getvalue()
`;

let runSuite;
let runCode;

self.onmessage = async (e) => {
  const { id, kind, files, suite, code } = e.data;
  try {
    const py = await ready;
    if (!runSuite) {
      py.runPython(RUNNER);
      runSuite = py.globals.get("run_suite");
      runCode = py.globals.get("run_code");
      self.postMessage({ ready: true });
    }
    const dir = `/work/${id}`;
    py.FS.mkdirTree(dir);
    for (const [name, source] of Object.entries(files)) py.FS.writeFile(`${dir}/${name}`, source);
    const modules = Object.keys(files).map((n) => n.replace(/\.py$/, ""));
    const result =
      kind === "exec" ? runCode(dir, code, modules, JSON.stringify(files)) : runSuite(dir, suite, modules);
    const [ok, output] = result.toJs();
    result.destroy();
    for (const name of Object.keys(files)) py.FS.unlink(`${dir}/${name}`);
    py.FS.rmdir(dir);
    self.postMessage({ id, ok, output });
  } catch (err) {
    self.postMessage({ id, ok: false, output: String(err) });
  }
};
