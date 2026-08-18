// Capture console errors on the live Pages site
import { spawn } from "node:child_process";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9341;
const URL = "https://xtimte.github.io/hanagarden/";

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
  "--window-size=1440,1000", `--remote-debugging-port=${PORT}`,
  "--user-data-dir=C:/Users/14401/AppData/Local/Temp/edge-cdp-err",
  "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch { /* retry */ }
    await sleep(300);
  }
  if (!wsUrl) throw new Error("no target");
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  const pending = new Map();
  const events = [];
  let id = 0;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === "Runtime.exceptionThrown") {
      events.push("EXCEPTION: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    } else if (m.method === "Runtime.consoleAPICalled") {
      events.push("CONSOLE[" + m.params.type + "]: " + m.params.args.map(a => a.value ?? a.description ?? "").join(" "));
    } else if (m.method === "Log.entryAdded") {
      events.push("LOG[" + m.params.entry.level + "]: " + m.params.entry.text);
    } else if (m.method === "Network.loadingFailed") {
      events.push("NET FAIL: " + (m.params.blockedReason || m.params.errorText) + " " + m.params.requestId);
    }
  };
  const send = (method, params = {}) => {
    const i = ++id;
    ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((resolve) => pending.set(i, resolve));
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: URL });
  await sleep(8000);

  const report = {};
  report.dataLoaded = await (async () => {
    const m = await send("Runtime.evaluate", { expression: "!!window.DATA", returnByValue: true });
    return m.result?.result?.value;
  })();
  report.scripts = await (async () => {
    const m = await send("Runtime.evaluate", { expression: "[...document.scripts].map(s => s.src)", returnByValue: true });
    return m.result?.result?.value;
  })();
  report.htmlLen = await (async () => {
    const m = await send("Runtime.evaluate", { expression: "document.documentElement.outerHTML.length", returnByValue: true });
    return m.result?.result?.value;
  })();
  report.events = events;
  console.log(JSON.stringify(report, null, 2));
  ws.close();
  edge.kill();
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e.message); try { edge.kill(); } catch {} process.exit(1); });
