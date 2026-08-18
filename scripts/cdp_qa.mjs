// CDP QA driver for the anime site (Node 24 native WebSocket)
// Usage: node cdp_qa.mjs <url> <outpng>
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9333;
const url = process.argv[2] || "http://127.0.0.1:8765/?revealall=1";
const outPng = process.argv[3] || "C:/Users/14401/AppData/Local/Temp/cdp_shot.png";

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
  "--window-size=1440,1000", `--remote-debugging-port=${PORT}`,
  "--user-data-dir=C:/Users/14401/AppData/Local/Temp/edge-cdp-profile",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* retry */ }
    await sleep(300);
  }
  throw new Error("no CDP target");
}

let msgId = 0;

async function main() {
  const wsUrl = await getTarget();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  const send = (method, params = {}) => {
    const id = ++msgId;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve) => pending.set(id, resolve));
  };

  const evalJs = async (expression) => {
    const msg = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (msg.result?.exceptionDetails) throw new Error("JS ERROR: " + JSON.stringify(msg.result.exceptionDetails.exception?.description || msg.result.exceptionDetails.text));
    return msg.result?.result?.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url });
  await sleep(4000);

  const report = {};

  report.heroVisible = await evalJs(`!!document.querySelector('.hero-inner.visible')`);
  report.cardCount = await evalJs(`document.querySelectorAll('.card').length`);
  report.loadedImgs = await evalJs(`document.querySelectorAll('img.loaded').length`);
  report.totalImgs = await evalJs(`document.querySelectorAll('img').length`);

  report.modalHiddenBefore = await evalJs(`document.getElementById('modal').hidden`);
  await evalJs(`document.querySelector('#seasonGrid .card').click()`);
  await sleep(600);
  report.modalHiddenAfter = await evalJs(`document.getElementById('modal').hidden`);
  report.modalTitle = await evalJs(`document.querySelector('#modalBody .modal-title')?.textContent`);
  report.modalPlatLinks = await evalJs(`document.querySelectorAll('#modalBody .plat-link').length`);
  report.bodyOverflow = await evalJs(`document.body.style.overflow`);
  await evalJs(`document.getElementById('modalClose').click()`);
  await sleep(300);
  report.modalHiddenAfterClose = await evalJs(`document.getElementById('modal').hidden`);

  await evalJs(`document.getElementById('searchInput').value = '恋爱'; document.getElementById('searchInput').dispatchEvent(new Event('input'))`);
  await sleep(500);
  report.searchResultsHidden = await evalJs(`document.getElementById('searchResults').hidden`);
  report.searchResultCards = await evalJs(`document.querySelectorAll('#searchGrid .card').length`);
  await evalJs(`document.getElementById('searchClear').click()`);

  report.weekdayTabCount = await evalJs(`document.querySelectorAll('#weekdayTabs .chip').length`);
  await evalJs(`document.querySelectorAll('#weekdayTabs .chip')[1]?.click()`);
  await sleep(400);
  report.seasonCardsAfterTab = await evalJs(`document.querySelectorAll('#seasonGrid .card').length`);

  await evalJs(`document.querySelectorAll('#quarterChips .chip')[0]?.click()`);
  await sleep(400);
  report.quarter0Code = await evalJs(`document.querySelector('#quarterChips .chip.active')?.dataset.code`);

  await evalJs(`document.querySelectorAll('#archiveChips .chip')[1]?.click()`);
  await sleep(400);
  report.archiveCards = await evalJs(`document.querySelectorAll('#archiveGrid .card').length`);

  report.countdownText = await evalJs(`document.getElementById('cdTime')?.textContent`);

  const shotMsg = await send("Page.captureScreenshot", { format: "png" });
  if (shotMsg.result?.data) {
    writeFileSync(outPng, Buffer.from(shotMsg.result.data, "base64"));
    report.screenshot = outPng;
  }

  console.log(JSON.stringify(report, null, 2));
  ws.close();
  edge.kill();
  process.exit(0);
}

main().catch((e) => { console.error("QA FAILED:", e.message); try { edge.kill(); } catch {} process.exit(1); });
