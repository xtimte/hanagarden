/* ============================================================
   番之庭 · Hanagarden — 前端逻辑
   数据：window.DATA（由 js/data.js 提供，源自 yuc.wiki）
   ============================================================ */
(() => {
  "use strict";

  const DATA = window.DATA || null;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- 工具 ---------- */
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const GRP_ORDER = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const groupKey = (g) => {
    const m = (g || "").match(/(周[一二三四五六日])/);
    if (m) return m[1];
    return "网络放送 & 其他";
  };
  const groupSort = (a, b) => {
    const ka = groupKey(a.group), kb = groupKey(b.group);
    const ia = GRP_ORDER.indexOf(ka), ib = GRP_ORDER.indexOf(kb);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return (a.group || "").localeCompare(b.group || "");
  };
  const timeSort = (a, b) => String(a.status_or_time || "").localeCompare(String(b.status_or_time || ""));

  const coverOf = (item) => item.cover || "";

  /* ---------- 背景元素 ---------- */
  function buildStars() {
    const wrap = $("#bgStars");
    if (!wrap) return;
    const n = 130;
    let html = "";
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 100, y = Math.random() * 100;
      const s = 1 + Math.random() * 2.2;
      const tw = 2.6 + Math.random() * 5;
      const td = Math.random() * 6;
      html += `<i class="star" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;width:${s.toFixed(2)}px;height:${s.toFixed(2)}px;--tw:${tw.toFixed(2)}s;--td:${td.toFixed(2)}s"></i>`;
    }
    wrap.innerHTML = html;
  }

  function buildPetals() {
    const wrap = $("#petals");
    if (!wrap) return;
    const n = 16;
    let html = "";
    for (let i = 0; i < n; i++) {
      const left = Math.random() * 100;
      const size = 9 + Math.random() * 9;
      const dur = 11 + Math.random() * 14;
      const delay = Math.random() * 16;
      const sway = (Math.random() * 40 - 20).toFixed(0);
      const spin = (300 + Math.random() * 500).toFixed(0);
      const op = (0.35 + Math.random() * 0.5).toFixed(2);
      html += `<i class="petal" style="left:${left.toFixed(1)}%;width:${size.toFixed(1)}px;height:${(size * 0.86).toFixed(1)}px;--dur:${dur.toFixed(1)}s;--delay:${delay.toFixed(1)}s;--sway:${sway}vw;--spin:${spin}deg;--op:${op}"></i>`;
    }
    wrap.innerHTML = html;
  }

  /* 鼠标光晕 */
  function initCursorGlow() {
    const glow = $("#cursorGlow");
    if (!glow) return;
    let tx = innerWidth / 2, ty = innerHeight / 3, x = tx, y = ty, raf = null;
    addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; if (!raf) loop(); }, { passive: true });
    function loop() {
      x += (tx - x) * 0.08; y += (ty - y) * 0.08;
      glow.style.transform = `translate(${x - 210}px, ${y - 210}px)`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) < 0.4 ? null : requestAnimationFrame(loop);
    }
  }

  /* ---------- 问候 ---------- */
  function initGreeting() {
    const el = $("#greet");
    if (!el) return;
    const h = new Date().getHours();
    const greet = h >= 5 && h < 11 ? "おはよう" : h >= 11 && h < 18 ? "こんにちは" : "こんばんは";
    el.textContent = `${greet}、欢迎来到番之庭`;
  }

  /* ---------- 旋转词条 ---------- */
  function initRotator() {
    const el = $("#rotator");
    if (!el) return;
    const words = ["恋爱日常", "热血战斗", "治愈慢节奏", "悬疑烧脑", "奇幻冒险", "科幻未来"];
    el.innerHTML = words.map((w) => `<i>${esc(w)}</i>`).join("");
  }

  /* ---------- 下季度倒计时 ---------- */
  function initCountdown() {
    const wrap = $("#heroCountdown");
    const seasonEl = $("#cdSeason");
    const timeEl = $("#cdTime");
    if (!wrap || !DATA || !DATA.quarters.length) return;
    const latest = DATA.quarters[DATA.quarters.length - 1];
    const m = String(latest.code).match(/^(\d{4})(\d{2})$/);
    if (!m) return;
    let year = Number(m[1]), month = Number(m[2]);
    const months = { 1: "1月", 4: "4月", 7: "7月", 10: "10月" };
    let nextMonth = month + 3;
    let nextYear = year;
    if (nextMonth > 10) { nextMonth = 1; nextYear += 1; }
    const target = new Date(nextYear, nextMonth - 1, 1, 0, 0, 0, 0);
    seasonEl.textContent = `${nextYear}年${months[nextMonth]}新番季`;
    wrap.hidden = false;
    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        timeEl.textContent = "进行中 ✨";
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const min = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const pad = (n) => String(n).padStart(2, "0");
      timeEl.textContent = d > 0 ? `${d}天 ${pad(h)}:${pad(min)}:${pad(s)}` : `${pad(h)}:${pad(min)}:${pad(s)}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Hero 视差 ---------- */
  function initParallax() {
    const hero = $(".hero");
    const inner = $(".hero-inner");
    if (!hero || !inner || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    addEventListener("scroll", () => {
      const y = scrollY;
      if (y < innerHeight) {
        inner.style.transform = `translateY(${y * 0.22}px)`;
        inner.style.opacity = String(Math.max(0, 1 - y / (innerHeight * 0.85)));
      }
    }, { passive: true });
  }

  /* ---------- 卡片 3D 倾斜 ---------- */
  function initTilt() {
    if (matchMedia("(hover: none)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = null;
    document.addEventListener("mouseover", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      card.classList.add("is-tilting");
      const move = (ev) => {
        if (!raf) raf = requestAnimationFrame(() => {
          raf = null;
          const r = card.getBoundingClientRect();
          const px = (ev.clientX - r.left) / r.width - 0.5;
          const py = (ev.clientY - r.top) / r.height - 0.5;
          card.style.setProperty("--ry", `${(px * 9).toFixed(2)}deg`);
          card.style.setProperty("--rx", `${(-py * 9).toFixed(2)}deg`);
        });
      };
      const leave = () => {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
        card.classList.remove("is-tilting");
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseleave", leave);
      };
      document.addEventListener("mousemove", move, { passive: true });
      document.addEventListener("mouseleave", leave);
    }, { passive: true });
  }

  /* ---------- 统计数字动画 ---------- */
  function initStats() {
    if (!DATA) return;
    const counts = DATA.meta?.counts || {};
    const targets = { 0: counts.quarters || 0, 1: counts.anime || 0, 2: counts.sp || 0, 3: counts.theater || 0 };
    const nums = $$("#heroStats .num");
    nums.forEach((el, i) => {
      const target = targets[i];
      const dur = 1400 + i * 180;
      const t0 = performance.now();
      (function tick(t) {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  /* ---------- 跑马灯 ---------- */
  function initMarquee() {
    const track = $("#marqueeTrack");
    if (!track || !DATA) return;
    const q = DATA.quarters?.[DATA.quarters.length - 1];
    const titles = q ? q.items.map((it) => it.t).slice(0, 14) : [];
    const season = q ? q.title : "新番放送表";
    const items = [season, ...titles];
    const half = items.map((t) => {
      const spark = ["✦", "✧", "❀", "✿", "✦"][Math.floor(Math.random() * 5)];
      return `<span class="marquee-item"><span class="spark">${spark}</span><b>${esc(t)}</b><em>HANAGARDEN</em></span>`;
    }).join("");
    track.innerHTML = half + half;
  }

  /* ---------- 卡片渲染 ---------- */
  function platChips(pf, limit = 3) {
    if (!pf || !pf.length) return "";
    const list = pf.slice(0, limit);
    const more = pf.length - limit;
    return list.map((p) => `<span class="card-plat ${/B站|bili/i.test(p[0]) ? "pink" : ""}">${esc(p[0])}</span>`).join("")
      + (more > 0 ? `<span class="card-plat">+${more}</span>` : "");
  }

  const FALLBACK_EMOJI = ["🌸", "⭐", "🌙", "🎐", "💫", "🎀", "✨", "🌷"];

  function renderCard(item, opts = {}) {
    const { showGroup = false, seasonLabel = "" } = opts;
    const cover = coverOf(item);
    const badges = [];
    if (item.time) badges.push(`<span class="badge badge-time">${esc(item.time)}</span>`);
    if (item.ep) badges.push(`<span class="badge badge-ep">${esc(item.ep)}</span>`);
    if (seasonLabel) badges.unshift(`<span class="badge badge-season">${esc(seasonLabel)}</span>`);
    if (item.type) badges.push(`<span class="badge badge-type">${esc(item.type)}</span>`);
    const badgeHtml = badges.length ? `<div class="card-badges">${badges.join("")}</div>` : "";

    const coverHtml = cover
      ? `<img src="${esc(cover)}" alt="${esc(item.t)}" loading="lazy" referrerpolicy="no-referrer" onload="this.classList.add('loaded')" onerror="this.outerHTML='&lt;div class=&quot;cover-fallback&quot;&gt;${FALLBACK_EMOJI[Math.floor(Math.random() * FALLBACK_EMOJI.length)]}&lt;/div&gt;'">`
      : `<div class="cover-fallback">${FALLBACK_EMOJI[Math.floor(Math.random() * FALLBACK_EMOJI.length)]}</div>`;

    return `<article class="card" data-idx="${esc(item._idx)}" role="button" tabindex="0" aria-label="${esc(item.t)}">
      <div class="card-cover">${coverHtml}${badgeHtml}</div>
      <div class="card-info">
        <h3 class="card-title">${esc(item.t)}</h3>
        <div class="card-meta">
          ${showGroup && item.g ? `<span class="card-plat">${esc(item.g)}</span>` : ""}
          ${platChips(item.pf)}
          <span class="card-hint">查看 ›</span>
        </div>
        ${item.box ? `<div class="card-box">💰 ${esc(item.box)}</div>` : ""}
        ${item.genre ? `<div class="card-genre">${esc(item.genre)}</div>` : ""}
        ${item.sub ? `<div class="card-sub">${esc(item.sub)}</div>` : ""}
        ${item.extra ? `<div class="card-extra">${esc(item.extra)}</div>` : ""}
      </div>
    </article>`;
  }

  /* ---------- 季度数据 ---------- */
  function quarterById(code) {
    return (DATA.quarters || []).find((q) => q.code === code);
  }
  const latestQuarter = () => DATA.quarters?.[DATA.quarters.length - 1] || null;

  /* ============ 本季新番 ============ */
  function renderSeason() {
    const chipsEl = $("#quarterChips");
    const tabsEl = $("#weekdayTabs");
    const gridEl = $("#seasonGrid");
    const emptyEl = $("#seasonEmpty");
    if (!chipsEl || !DATA) return;

    const quarters = DATA.quarters || [];
    chipsEl.innerHTML = quarters.map((q, i) => {
      const latest = i === quarters.length - 1;
      return `<button class="chip ${latest ? "active" : ""}" data-code="${q.code}">${esc(q.short)}${latest ? `<span class="chip-note">本季</span>` : ""}</button>`;
    }).join("");

    const state = { code: quarters[quarters.length - 1].code, group: "全部" };
    const groupsOf = (code) => {
      const q = quarterById(code);
      if (!q) return [];
      const set = [];
      q.items.forEach((it) => { const k = groupKey(it.g); if (!set.includes(k)) set.push(k); });
      return set;
    };

    function renderTabs() {
      const groups = groupsOf(state.code);
      const tabs = ["全部", ...groups];
      tabsEl.innerHTML = tabs.map((t) =>
        `<button class="chip ${t === state.group ? "active" : ""}" data-group="${esc(t)}">${esc(t)}</button>`).join("");
    }

    function renderGrid() {
      const q = quarterById(state.code);
      if (!q) return;
      let items = q.items.slice();
      if (state.group !== "全部") items = items.filter((it) => groupKey(it.g) === state.group);
      items.sort((a, b) => { const g = groupSort(a, b); return g !== 0 ? g : timeSort(a, b); });
      gridEl.innerHTML = items.map((it) => {
        const copy = { ...it, _idx: it._idx };
        return renderCard(copy, { seasonLabel: groupKey(it.g) });
      }).join("");
      emptyEl.hidden = items.length > 0;
      gridEl.style.display = items.length ? "" : "none";
      attachCardEvents(gridEl);
      restagger(gridEl);
    }

    chipsEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip[data-code]");
      if (!chip) return;
      state.code = chip.dataset.code;
      state.group = "全部";
      $$(".chip", chipsEl).forEach((c) => c.classList.toggle("active", c === chip));
      renderTabs();
      renderGrid();
    });
    tabsEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip[data-group]");
      if (!chip) return;
      state.group = chip.dataset.group;
      $$(".chip", tabsEl).forEach((c) => c.classList.toggle("active", c === chip));
      renderGrid();
    });

    renderTabs();
    renderGrid();
  }

  /* ============ 通用“分组 tab + 网格”渲染 ============ */
  function renderSections(containerId, tabsId, gridId, sections, cardOptsFn, tabLabel) {
    const container = $("#" + containerId);
    const tabsEl = $("#" + tabsId);
    const gridEl = $("#" + gridId);
    if (!container || !sections || !sections.length) {
      if (container) container.style.display = "none";
      return;
    }
    let activeIdx = 0;
    tabsEl.innerHTML = sections.map((s, i) =>
      `<button class="chip ${i === 0 ? "active" : ""}" data-i="${i}">${esc(tabLabel(s, i))}<span class="chip-note">${s.items.length}</span></button>`).join("");

    function render() {
      const s = sections[activeIdx];
      gridEl.innerHTML = s.items.map((it, i) => renderCard(cardOptsFn(it, s))).join("");
      attachCardEvents(gridEl);
      restagger(gridEl);
    }
    tabsEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip[data-i]");
      if (!chip) return;
      activeIdx = Number(chip.dataset.i);
      $$(".chip", tabsEl).forEach((c) => c.classList.toggle("active", c === chip));
      render();
    });
    render();
  }

  /* ---------- 新番观测站 ---------- */
  function renderUpcoming() {
    const d = DATA?.upcoming;
    if (!d) return;
    renderSections("upcoming", "upcomingTabs", "upcomingGrid", d.sections, (it, s) => ({
      t: it.t, type: it.type, cover: it.cover, sub: it.season, _idx: it._idx,
    }), (s) => s.title.replace(/[【】\[\]]/g, "").split(" ")[0]);
  }

  /* ---------- 剧场版·OVA ---------- */
  function renderSp() {
    const d = DATA?.sp;
    if (!d) return;
    renderSections("movies", "spTabs", "spGrid", d.sections, (it, s) => ({
      t: it.t, type: it.type, cover: it.cover, sub: it.release, _idx: it._idx,
    }), (s) => s.title.replace(/-+/g, "").trim());
  }

  /* ---------- 内地院线 ---------- */
  function renderTheater() {
    const d = DATA?.movie;
    if (!d) return;
    renderSections("theater", "theaterTabs", "theaterGrid", d.sections, (it, s) => ({
      t: it.t, type: it.type, cover: it.cover, sub: it.release, box: it.box, _idx: it._idx,
    }), (s) => s.title.replace(/[:：]/g, "").trim());
  }

  /* ============ 历年存档 ============ */
  function renderArchive() {
    const chipsEl = $("#archiveChips");
    const gridEl = $("#archiveGrid");
    const emptyEl = $("#archiveEmpty");
    if (!chipsEl || !DATA) return;
    const quarters = DATA.quarters || [];

    chipsEl.innerHTML = quarters.map((q, i) =>
      `<button class="chip ${i === quarters.length - 1 ? "active" : ""}" data-code="${q.code}">${esc(q.short)}</button>`).join("");

    let code = quarters[quarters.length - 1]?.code || null;
    function render() {
      const q = quarterById(code);
      if (!q) { emptyEl.hidden = false; gridEl.style.display = "none"; return; }
      const items = q.items.slice().sort((a, b) => { const g = groupSort(a, b); return g !== 0 ? g : timeSort(a, b); });
      gridEl.innerHTML = items.map((it) => renderCard({ ...it, _idx: it._idx }, { showGroup: true, seasonLabel: groupKey(it.g) })).join("");
      emptyEl.hidden = true;
      gridEl.style.display = "";
      attachCardEvents(gridEl);
      restagger(gridEl);
    }
    chipsEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip[data-code]");
      if (!chip) return;
      code = chip.dataset.code;
      $$(".chip", chipsEl).forEach((c) => c.classList.toggle("active", c === chip));
      render();
    });
    render();
  }

  /* ---------- 搜索结果 ---------- */
  function initSearch() {
    const input = $("#searchInput");
    const clearBtn = $("#searchClear");
    const results = $("#searchResults");
    const grid = $("#searchGrid");
    const countEl = $("#searchResultCount");
    const searchBar = $("#searchBar");
    if (!input || !DATA) return;

    const allItems = [];
    DATA.quarters.forEach((q) => q.items.forEach((it) => allItems.push({ ...it, src: `${q.short} · 本季新番`, _idx: it._idx })));
    DATA.upcoming.sections.forEach((s) => s.items.forEach((it) => allItems.push({ ...it, src: `新番观测 · ${it.season || ""}`, _idx: it._idx })));
    DATA.sp.sections.forEach((s) => s.items.forEach((it) => allItems.push({ ...it, src: "剧场版·OVA", _idx: it._idx })));
    DATA.movie.sections.forEach((s) => s.items.forEach((it) => allItems.push({ ...it, src: "内地院线", _idx: it._idx })));

    function run() {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.hidden = true; return; }
      const hits = allItems.filter((it) => (it.t || "").toLowerCase().includes(q) || (it.g || "").includes(q) || (it.type || "").includes(q));
      countEl.textContent = hits.length ? `· ${hits.length} 部` : "";
      grid.innerHTML = hits.map((it) => renderCard({ ...it, sub: it.sub || it.src, _idx: it._idx }, { seasonLabel: it.src })).join("");
      results.hidden = false;
      attachCardEvents(grid);
      restagger(grid);
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    input.addEventListener("input", run);
    clearBtn.addEventListener("click", () => { input.value = ""; results.hidden = true; searchBar.classList.remove("open"); });
  }

  /* ============ 详情弹窗 ============ */
  function collectItems() {
    const list = [];
    (DATA.quarters || []).forEach((q) => q.items.forEach((it) => list.push({ ...it, kind: "新番", season: q.short, _idx: it._idx })));
    (DATA.upcoming?.sections || []).forEach((s) => s.items.forEach((it) => list.push({ ...it, kind: "新番观测", season: it.season, _idx: it._idx })));
    (DATA.sp?.sections || []).forEach((s) => s.items.forEach((it) => list.push({ ...it, kind: "剧场版·OVA", _idx: it._idx })));
    (DATA.movie?.sections || []).forEach((s) => s.items.forEach((it) => list.push({ ...it, kind: "内地院线", _idx: it._idx })));
    return list;
  }

  function attachCardEvents(container) {
    $$(".card", container).forEach((card) => {
      card.addEventListener("click", () => openModal(card.dataset.idx));
      card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(card.dataset.idx); } });
    });
  }

  let ITEMS = [];
  function openModal(idx) {
    if (!ITEMS.length) ITEMS = collectItems();
    const item = ITEMS.find((it) => it._idx === idx) || ITEMS[Number(idx)];
    if (!item) return;
    const modal = $("#modal");
    const body = $("#modalBody");
    if (!modal) return;

    const tags = [];
    if (item.kind) tags.push(`<span class="tag pink">${esc(item.kind)}</span>`);
    if (item.g) tags.push(`<span class="tag">${esc(item.g)}</span>`);
    if (item.time) tags.push(`<span class="tag">${esc(item.time)}</span>`);
    if (item.ep) tags.push(`<span class="tag pink">${esc(item.ep)}</span>`);
    if (item.type) tags.push(`<span class="tag">${esc(item.type)}</span>`);
    if (item.genre) tags.push(`<span class="tag pink">${esc(item.genre)}</span>`);
    if (item.season) tags.push(`<span class="tag">${esc(item.season)}</span>`);
    if (item.release) tags.push(`<span class="tag">${esc(item.release)}</span>`);

    const cover = coverOf(item);
    const coverHtml = cover
      ? `<img src="${esc(cover)}" alt="${esc(item.t)}">`
      : `<div class="cover-fallback" style="aspect-ratio:2/2.85;display:grid;place-items:center;font-size:52px">🌸</div>`;

    const platforms = (item.pf || []).map((p) =>
      `<a class="plat-link" href="${esc(p[1])}" target="_blank" rel="noopener">▶ ${esc(p[0])}</a>`).join("");

    const jpTitle = item.jp ? `<p class="modal-jp">${esc(item.jp)}</p>` : "";

    body.innerHTML = `
      <div class="modal-hero">
        <div class="modal-cover">${coverHtml}</div>
        <div>
          <h3 class="modal-title">${esc(item.t)}</h3>
          ${jpTitle}
          <div class="modal-tags">${tags.join("")}</div>
          ${item.box ? `<div class="card-box" style="margin-top:12px">💰 ${esc(item.box)}</div>` : ""}
        </div>
      </div>
      ${platforms ? `<div class="modal-platforms"><div class="modal-h">观看平台 / 放送渠道</div><div class="plat-list">${platforms}</div></div>` : ""}
      ${item.staff ? `<div class="modal-detail"><div class="modal-h">制作阵容</div><p class="modal-pre">${esc(item.staff)}</p></div>` : ""}
      ${item.cast ? `<div class="modal-detail"><div class="modal-h">配音阵容</div><p class="modal-pre">${esc(item.cast)}</p></div>` : ""}
      ${item.extra ? `<div class="modal-note">${esc(item.extra)}</div>` : `<div class="modal-empty">该条目暂未收录更多详情，可前往 <a href="https://yuc.wiki/" target="_blank" rel="noopener" style="color:var(--blue-soft)">yuc.wiki</a> 查看原站。</div>`}
    `;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    const modal = $("#modal");
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
  }

  /* ---------- 顶栏 / 返回顶部 ---------- */
  function initNav() {
    const nav = $("#nav");
    const burger = $("#navBurger");
    const links = $("#navLinks");
    const searchToggle = $("#searchToggle");
    const searchBar = $("#searchBar");
    const backTop = $("#backTop");
    const pctEl = $("#backTopPct");

    addEventListener("scroll", () => {
      const y = scrollY;
      nav.classList.toggle("scrolled", y > 24);
      const total = document.documentElement.scrollHeight - innerHeight;
      const pct = total > 0 ? Math.min(100, Math.round((y / total) * 100)) : 0;
      backTop.classList.toggle("show", y > 480);
      if (pctEl) pctEl.textContent = pct + "%";
    }, { passive: true });

    burger.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      burger.classList.toggle("open", open);
    });
    $$("a", links).forEach((a) => a.addEventListener("click", () => { links.classList.remove("open"); burger.classList.remove("open"); }));

    searchToggle.addEventListener("click", () => {
      searchBar.classList.toggle("open");
      if (searchBar.classList.contains("open")) setTimeout(() => $("#searchInput")?.focus(), 120);
    });
    addEventListener("click", (e) => {
      if (searchBar.classList.contains("open") && !searchBar.contains(e.target) && !searchToggle.contains(e.target)) {
        searchBar.classList.remove("open");
      }
    });
    addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); searchBar.classList.remove("open"); } });

    backTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

    /* 滚动高亮当前区块 */
    const sections = $$("main section[id]");
    const navAnchors = $$(".nav-links a");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const id = en.target.id;
          navAnchors.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    sections.forEach((s) => io.observe(s));

    /* 平滑滚动（保留锚点） */
    $$("a[data-scroll]").forEach((a) => a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (href && href.startsWith("#")) {
        e.preventDefault();
        const target = $(href);
        if (target) target.scrollIntoView({ behavior: "smooth" });
      }
    }));
  }

  /* ---------- 显现动画 & 卡片错峰 ---------- */
  function initReveal() {
    const els = $$(".reveal");
    const hasIO = "IntersectionObserver" in window;
    const revealAll = location.search.includes("revealall=1");

    const reveal = (el) => { el.classList.add("visible"); if (hasIO) io.unobserve(el); };
    const inView = (el) => {
      const r = el.getBoundingClientRect();
      return r.top < innerHeight * 0.95 && r.bottom > 0;
    };

    if (revealAll) {
      els.forEach((el) => el.classList.add("visible"));
      return;
    }

    let io = null;
    if (hasIO) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) reveal(en.target); });
      }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    }

    els.forEach((el) => {
      if (inView(el)) reveal(el);
      else if (io) io.observe(el);
    });

    /* fallback: scroll / resize 时检查视口内元素 */
    const onScrollCheck = () => els.forEach((el) => { if (!el.classList.contains("visible") && inView(el)) reveal(el); });
    addEventListener("scroll", onScrollCheck, { passive: true });
    addEventListener("resize", onScrollCheck, { passive: true });

    /* safety: IO 不可用或异常时，周期性兜底显现 */
    const safety = setInterval(() => {
      let changed = false;
      els.forEach((el) => { if (!el.classList.contains("visible") && inView(el)) { reveal(el); changed = true; } });
      if (!changed) clearInterval(safety);
    }, 800);
  }

  function restagger(container) {
    $$(".card", container).forEach((card, i) => {
      card.style.setProperty("--delay", `${Math.min(i * 0.045, 0.6)}s`);
      card.style.animation = "none";
      void card.offsetWidth;
      card.style.animation = "";
    });
  }

  /* ---------- 关于我：复制交互 ---------- */
  function initAbout() {
    const toast = $("#toast");
    if (!toast) return;
    let timer = null;
    function showToast(msg) {
      toast.textContent = msg;
      toast.hidden = false;
      requestAnimationFrame(() => toast.classList.add("show"));
      clearTimeout(timer);
      timer = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => { toast.hidden = true; }, 400);
      }, 2400);
    }
    $$("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const v = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(v);
          showToast(`已复制「${v}」✨`);
        } catch {
          showToast(`我的联系方式：${v}`);
        }
      });
    });
  }

  /* ---------- 页脚 ---------- */
  function initFooter() {
    const dateEl = $("#footerDate");
    const coversEl = $("#footerCovers");
    if (dateEl && DATA?.meta?.fetched) dateEl.textContent = DATA.meta.fetched;
    if (coversEl && DATA?.meta) coversEl.textContent = (DATA.meta.covers || 0).toLocaleString();
  }

  /* ---------- 启动 ---------- */
  function boot() {
    if (!DATA) {
      document.body.insertAdjacentHTML("afterbegin",
        `<div style="padding:120px 20px;text-align:center;color:#ff9ecd;font-size:15px">数据未加载：请确认 <code>js/data.js</code> 存在。</div>`);
      return;
    }
    buildStars();
    buildPetals();
    initCursorGlow();
    initGreeting();
    initRotator();
    initCountdown();
    initParallax();
    initStats();
    initMarquee();
    renderSeason();
    renderUpcoming();
    renderSp();
    renderTheater();
    renderArchive();
    initSearch();
    initNav();
    initReveal();
    initTilt();
    initAbout();
    initFooter();

    $("#modalBackdrop")?.addEventListener("click", closeModal);
    $("#modalClose")?.addEventListener("click", closeModal);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
