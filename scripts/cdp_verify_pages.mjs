// Verify live GitHub Pages site renders correctly
import { spawn } from "node:child_process";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9340;
const URL = "https://xtimte.github.io/hanagarden/?revealall=1";

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
  "--window-size=1440,1000", `--remote-debugging-port=${PORT}`,
  "--user-data-dir=C:/Users/14401/AppData/Local/Temp/edge-cdp-pages",
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
  let id = 0;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => {
    const i = ++id;
    ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise((resolve) => pending.set(i, resolve));
  };
  const evalJs = async (expression) => {
    const m = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (m.result?.exceptionDetails) throw new Error("JS ERR: " + (m.result.exceptionDetails.exception?.description || m.result.exceptionDetails.text));
    return m.result?.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: URL });
  await sleep(7000);

  const report = {};
  report.title = await evalJs("document.title");
  report.dataLoaded = await evalJs("!!window.DATA && window.DATA.quarters.length");
  report.heroVisible = await evalJs("!!document.querySelector('.hero-inner.visible')");
  report.cardCount = await evalJs("document.querySelectorAll('.card').length");
  report.imgSrc = await evalJs("document.querySelector('#seasonGrid img')?.src?.slice(0, 90) || null");
  report.imgLoaded = await evalJs("!!document.querySelector('#seasonGrid img.loaded')");
  report.countdown = await evalJs("document.getElementById('cdTime')?.textContent || null");
  report.stats = await evalJs("[...document.querySelectorAll('#heroStats .num')].map(n => n.textContent).join('/')");

  await evalJs("document.querySelector('#seasonGrid .card')?.click()");
  await sleep(800);
  report.modalOpened = await evalJs("!document.getElementById('modal').hidden");
  report.modalTitle = await evalJs("document.querySelector('#modalBody .modal-title')?.textContent || null");
  await evalJs("document.getElementById('modalClose')?.click()");

  console.log(JSON.stringify(report, null, 2));
  ws.close();
  edge.kill();
  process.exit(0);
}
main().catch((e) => { console.error("FAIL:", e.message); try { edge.kill(); } catch {} process.exit(1); });
