#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scraper for https://yuc.wiki/ (長門番堂 / Yuc's Anime List)
Crawls quarterly anime lineups plus /new/ (announcements), /sp/ (Movie/OVA/OAD/SP)
and /movie/ (theatrical releases in mainland China) pages, then downloads
cover images locally.

Output:
  data/quarters.json   - every published quarter lineup
  data/new.json        - upcoming announcements
  data/sp.json         - Movie/OVA/OAD/SP releases
  data/movie.json      - theatrical releases
  data/covers.json     - mapping { url -> local relative path }
  data/covers/...      - downloaded cover images
"""
import html
import json
import os
import re
import ssl
import sys
import time
from urllib.request import urlopen, Request
from urllib.parse import urlparse

BASE = "https://yuc.wiki"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
COVER_DIR = os.path.join(OUT_DIR, "covers")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

_CTX = ssl.create_default_context()
_CTX.check_hostname = True


def fetch(url: str, tries: int = 3) -> str:
    last = None
    for i in range(tries):
        try:
            req = Request(url, headers={"User-Agent": UA, "Referer": BASE + "/"})
            with urlopen(req, timeout=40, context=_CTX) as resp:
                return resp.read().decode("utf-8", errors="ignore")
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"fetch failed for {url}: {last}")


def clean_text(text: str, br_to_space: bool = True) -> str:
    if not text:
        return ""
    if br_to_space:
        text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = text.replace("\xa0", " ").replace("\u3000", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_multiline(text: str) -> str:
    """Like clean_text but turns <br> into newlines (for staff/cast lists)."""
    if not text:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = text.replace("\xa0", " ").replace("\u3000", " ")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.split("\n")]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines)


def norm_url(u: str) -> str:
    u = html.unescape(u or "").strip()
    u = re.sub(r"^http://", "https://", u)
    return u


# ---------------------------------------------------------------- quarters
def discover_quarters(home_html: str) -> list:
    quarters = sorted(
        {
            m
            for m in re.findall(r"/(20\d{4})/", home_html)
            if re.fullmatch(r"20\d{2}(01|04|07|10)", m)
        }
    )
    return quarters


def norm_title(t: str) -> str:
    """Normalize a title for fuzzy matching between new/legacy formats."""
    t = clean_text(t)
    t = re.sub(r"[\s\u3000·•・~～\-—–（）()【】\[\]「」『』<>＜＞]", "", t)
    return t.lower()


def parse_legacy_items(section_html: str):
    """Parse the legacy 'title_main' format (used on pre-2022 pages and the
    staff/cast detail section that follows the lineup on newer pages).

    Two class variants exist:
      - old:  title_main / title_cn / title_jp / type_a / staff / cast / link_a / link_b / broadcast
      - new:  title_main_r / title_cn_r / title_jp_r / type_a_r / staff_r1 / cast_r /
              link_a_r / link_b_r / broadcast_r / broadcast_ex_r / type_tag_r1
    """
    def cls(name):
        return f"{name}(?:_r1?)?"
    pattern = (
        r'<div style="float:left"><img[^>]*data-src="([^"]+)"[^>]*></div>\s*'
        r'<div><table[^>]*>(.*?)</table>\s*(?:</div>|<div style="clear:both">)'
    )
    items = []
    for em in re.finditer(pattern, section_html, flags=re.S):
        cover_url, table_html = em.groups()

        tm = re.search(rf'<td[^>]*class="{cls("title_main")}"[^>]*>(.*?)</td>', table_html, flags=re.S)
        if not tm:
            continue
        inner = tm.group(1)
        title_cn = ""
        m_cn = re.search(rf'<p class="{cls("title_cn")}">(.*?)</p>', inner, flags=re.S)
        if m_cn:
            title_cn = clean_text(m_cn.group(1), br_to_space=True)
        if not title_cn:
            title_cn = clean_text(inner, br_to_space=True)
        if not title_cn:
            continue
        m_jp = re.search(rf'<p class="{cls("title_jp")}">(.*?)</p>', inner, flags=re.S)
        title_jp = clean_text(m_jp.group(1), br_to_space=True) if m_jp else ""

        m_type = re.search(rf'<td[^>]*class="{cls("type_a")}"[^>]*>(.*?)</td>', table_html, flags=re.S)
        type_a = clean_text(m_type.group(1)) if m_type else ""

        m_tag = re.search(rf'<td[^>]*class="{cls("type_tag")}_?"[^>]*>(.*?)</td>', table_html, flags=re.S)
        genre = clean_text(m_tag.group(1)) if m_tag else ""

        m_staff = re.search(rf'<td[^>]*class="{cls("staff")}"[^>]*>(.*?)</td>', table_html, flags=re.S)
        staff = clean_multiline(m_staff.group(1)) if m_staff else ""

        m_cast = re.search(rf'<td[^>]*class="{cls("cast")}"[^>]*>(.*?)</td>', table_html, flags=re.S)
        cast = clean_multiline(m_cast.group(1)) if m_cast else ""

        m_la = re.search(rf'<td[^>]*class="{cls("link_a")}"[^>]*>(.*?)</td>', table_html, flags=re.S)
        broadcast = ""
        episode_note = ""
        links = []
        if m_la:
            la_html = m_la.group(1)
            m_bc = re.search(rf'<p class="{cls("broadcast")}">(.*?)</p>', la_html, flags=re.S)
            broadcast = clean_text(m_bc.group(1), br_to_space=True) if m_bc else ""
            m_bex = re.search(rf'<p class="{cls("broadcast_ex")}">(.*?)</p>', la_html, flags=re.S)
            episode_note = clean_text(m_bex.group(1), br_to_space=True) if m_bex else ""
            seen = set()
            for am in re.finditer(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', la_html, flags=re.S):
                url, inner2 = am.groups()
                name = clean_text(inner2, br_to_space=True)
                if not name:
                    name = "官网"
                url = norm_url(url)
                if (name, url) in seen or not url:
                    continue
                seen.add((name, url))
                links.append({"name": name, "url": url})

        m_lb = re.search(rf'<td[^>]*class="{cls("link_b")}"[^>]*>(.*?)</td>', table_html, flags=re.S)
        if m_lb:
            lb_html = m_lb.group(1)
            for am in re.finditer(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', lb_html, flags=re.S):
                url, inner2 = am.groups()
                inner2 = inner2.replace("<br>", " ").replace("<br/>", " ")
                name = clean_text(inner2, br_to_space=True)
                if not name or name == "img":
                    m_img = re.search(r'<img[^>]*alt="([^"]+)"', inner2)
                    name = clean_text(m_img.group(1)) if m_img else ""
                if not name:
                    host = urlparse(url).netloc.replace("www.", "").split(".")[0]
                    name = host or "平台"
                url = norm_url(url)
                if (name, url) in seen or not url:
                    continue
                seen.add((name, url))
                links.append({"name": name, "url": url})

        def guess_group(bc: str) -> str:
            m = re.search(r"(周[一二三四五六日])", bc or "")
            if m:
                return m.group(1)
            if "网络" in (bc or ""):
                return "网络放送 & 其他"
            return "放送未定"

        items.append(
            {
                "title": title_cn,
                "title_jp": title_jp,
                "type": type_a,
                "genre": genre,
                "broadcast": broadcast,
                "episode_note": episode_note,
                "staff": staff,
                "cast": cast,
                "cover_url": norm_url(cover_url),
                "platforms": links,
                "group": guess_group(broadcast),
            }
        )
    return items


def parse_quarter(quarter_code: str, page_html: str) -> dict:
    m_title = re.search(r'<meta\s+property="og:title"\s+content="([^"]+)"', page_html)
    if not m_title:
        m_title = re.search(r'<h1 class="post-title"[^>]*>(.*?)</h1>', page_html, flags=re.S)
    quarter_title = clean_text(m_title.group(1)) if m_title else ""

    # legacy detail section marker (literal mojibake inside the site's HTML);
    # some hybrid quarters lack the marker, so fall back to the whole body
    end = page_html.find("新番介绍部分")
    if end == -1:
        end = page_html.find("鏂扮暺浠嬬粛閮ㄥ垎")
    if end == -1:
        end = page_html.find("new-intro")
    body_start = page_html.find('<div class="post-body"')
    if body_start == -1:
        body_start = 0
    legacy_html = page_html[end:] if end != -1 else page_html[body_start:]

    # ---- new format (weekday grouped) ----
    date_class = "date2"
    start = page_html.find('<td class="date2">')
    if start == -1:
        date_class = "date"  # 202207 used plain class="date" weekday headers
        start = page_html.find('<td class="date">')
    new_items = []
    legacy_items = []
    if start != -1:
        section = page_html[start:end] if end != -1 and start < end else page_html[start:]
        headers = list(re.finditer(rf'<td class="{date_class}">(.*?)</td>', section, flags=re.S))
        for idx, hm in enumerate(headers):
            group = clean_text(hm.group(1))
            chunk_start = hm.end()
            chunk_end = headers[idx + 1].start() if idx + 1 < len(headers) else len(section)
            chunk = section[chunk_start:chunk_end]

            pattern = (
                r'<div style="float:left[^"]*">\s*'
                r'<div class="div_date[^"]*"\s*>(.*?)</div>\s*'
                r"<div><table[^>]*>(.*?)</table></div></div>"
            )
            for em in re.finditer(pattern, chunk, flags=re.S):
                meta_html, table_html = em.groups()

                tm = re.search(r'<td[^>]*class="date_title[^"]*"[^>]*>(.*?)</td>', table_html, flags=re.S)
                if not tm:
                    continue
                title = clean_text(tm.group(1), br_to_space=True)
                if not title:
                    continue

                p_texts = [
                    clean_text(x, br_to_space=True)
                    for x in re.findall(r"<p[^>]*>(.*?)</p>", meta_html, flags=re.S)
                ]
                p_texts = [x for x in p_texts if x]

                extra_note = ""
                ex_p_texts = []
                ex = re.search(r'<tr class="tr_area_ex"[^>]*><td[^>]*>(.*?)</td>\s*</tr>', table_html, flags=re.S)
                if ex:
                    ex_inner = ex.group(1)
                    extra_note = clean_text(ex_inner, br_to_space=True)
                    ex_p_texts = [
                        clean_text(x, br_to_space=True)
                        for x in re.findall(r"<p[^>]*>(.*?)</p>", ex_inner, flags=re.S)
                    ]
                    ex_p_texts = [x for x in ex_p_texts if x]

                status_or_time = p_texts[0] if len(p_texts) >= 1 else (ex_p_texts[0] if ex_p_texts else "")
                episode_note = p_texts[1] if len(p_texts) >= 2 else (ex_p_texts[1] if len(ex_p_texts) >= 2 else "")

                m_cover = re.search(r'<img[^>]*data-src="([^"]+)"', meta_html, flags=re.S)
                if not m_cover:
                    m_cover = re.search(r'<img[^>]*src="([^"]+)"', meta_html, flags=re.S)
                cover_url = norm_url(m_cover.group(1)) if m_cover else ""

                platforms = []
                seen_pf = set()
                for row in re.findall(r'<tr class="tr_area">(.*?)</tr>', table_html, flags=re.S):
                    for am in re.finditer(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', row, flags=re.S):
                        url, inner = am.groups()
                        nm = re.search(r'<p[^>]*class="(?:area|area_c|area_ex)"[^>]*>(.*?)</p>', inner, flags=re.S)
                        name = clean_text(nm.group(1)) if nm else clean_text(inner)
                        url = norm_url(url)
                        key = (name, url)
                        if not url or key in seen_pf:
                            continue
                        seen_pf.add(key)
                        platforms.append({"name": name, "url": url})

                new_items.append(
                    {
                        "title": title,
                        "group": group,
                        "status_or_time": status_or_time,
                        "episode_note": episode_note,
                        "cover_url": cover_url,
                        "platforms": platforms,
                        "extra_note": extra_note,
                    }
                )

        legacy_items = parse_legacy_items(legacy_html)
    else:
        # pure legacy quarter (pre-2022): the whole post body uses the old format
        legacy_items = parse_legacy_items(page_html[body_start:])
    legacy_by_title = {}
    for li in legacy_items:
        key = norm_title(li["title"])
        legacy_by_title.setdefault(key, li)

    merged = []
    seen = set()
    for item in new_items:
        key = (item["title"], item["group"])
        if key in seen:
            continue
        seen.add(key)
        rec = dict(item)
        lrec = legacy_by_title.get(norm_title(item["title"]))
        if lrec:
            rec["title_jp"] = lrec["title_jp"]
            rec["type"] = lrec["type"]
            rec["genre"] = lrec["genre"]
            rec["staff"] = lrec["staff"]
            rec["cast"] = lrec["cast"]
            if not rec["episode_note"] and lrec["episode_note"]:
                rec["episode_note"] = lrec["episode_note"]
        merged.append(rec)

    if not merged:
        # pure legacy quarter (pre-2022): use legacy items directly
        for li in legacy_items:
            key = (li["title"], li["group"])
            if key in seen:
                continue
            seen.add(key)
            rec = {
                "title": li["title"],
                "group": li["group"],
                "status_or_time": li["broadcast"],
                "episode_note": li["episode_note"],
                "cover_url": li["cover_url"],
                "platforms": li["platforms"],
                "extra_note": "",
                "title_jp": li["title_jp"],
                "type": li["type"],
                "genre": li["genre"],
                "staff": li["staff"],
                "cast": li["cast"],
            }
            merged.append(rec)

    return {
        "source": f"{BASE}/{quarter_code}/",
        "quarter_code": quarter_code,
        "quarter_title": quarter_title,
        "items": merged,
    }


# ---------------------------------------------------------------- /new/
def parse_new(page_html: str) -> dict:
    body = page_html[page_html.find('<div class="post-body"'):]
    result = {"source": f"{BASE}/new/", "title": "新番卫星观测站", "sections": []}

    intro_pat = re.compile(r'<p class="future_intro"><b>(.*?)</b></p>', flags=re.S)
    item_pat = re.compile(
        r'<div style="float:left"><div class="future_div">(.*?)</div><div><table class="future_table">'
        r'(.*?)</table></div></div>',
        flags=re.S,
    )
    intros = list(intro_pat.finditer(body))
    for idx, im in enumerate(intros):
        section_title = clean_text(im.group(1))
        chunk_start = im.end()
        chunk_end = intros[idx + 1].start() if idx + 1 < len(intros) else len(body)
        chunk = body[chunk_start:chunk_end]

        items = []
        for em in item_pat.finditer(chunk):
            meta_html, table_html = em.groups()
            type_a = re.search(r'<p class="future_type_a">(.*?)</p>', meta_html, flags=re.S)
            fdate = re.search(r'<p class="future_date">(.*?)</p>', meta_html, flags=re.S)
            img = re.search(r'<img[^>]*data-src="([^"]+)"', meta_html, flags=re.S) or re.search(
                r'<img[^>]*src="([^"]+)"', meta_html, flags=re.S
            )
            tm = re.search(r'<td class="future_title[^"]*"[^>]*>(.*?)</td>', table_html, flags=re.S)
            title = clean_text(tm.group(1), br_to_space=True) if tm else ""

            # extra rows inside future table (e.g. studio / date / note)
            notes = []
            for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table_html, flags=re.S):
                t = clean_text(row, br_to_space=True)
                if t and t not in notes:
                    notes.append(t)

            items.append(
                {
                    "title": title,
                    "type": clean_text(type_a.group(1)) if type_a else "",
                    "season": clean_text(fdate.group(1)) if fdate else "",
                    "cover_url": norm_url(img.group(1)) if img else "",
                    "table": notes,
                }
            )

        if items:
            result["sections"].append({"title": section_title, "items": items})

    return result


# ---------------------------------------------------------------- /sp/
def parse_sp(page_html: str) -> dict:
    body = page_html[page_html.find('<div class="post-body"'):]
    result = {"source": f"{BASE}/sp/", "title": "Movie / OVA / OAD / SP etc.", "sections": []}

    intro_pat = re.compile(r'<p class="intro_sp"><b>(.*?)</b></p>', flags=re.S)
    item_pat = re.compile(
        r'<div class="div_sp"\s*><img[^>]*data-src="([^"]+)"[^>]*></div>\s*'
        r"<div><table[^>]*>(.*?)</table></div>",
        flags=re.S,
    )
    intros = list(intro_pat.finditer(body))
    for idx, im in enumerate(intros):
        section_title = clean_text(im.group(1))
        chunk_start = im.end()
        chunk_end = intros[idx + 1].start() if idx + 1 < len(intros) else len(body)
        chunk = body[chunk_start:chunk_end]

        items = []
        for em in item_pat.finditer(chunk):
            cover_url, table_html = em.groups()
            tm = re.search(r'<td[^>]*class="sp_title[^"]*"[^>]*>(.*?)</td>', table_html, flags=re.S)
            title = clean_text(tm.group(1), br_to_space=True) if tm else ""
            if not title or title in ("海报", "标题", "类型", "时间", "上映时间", "Movie"):
                continue
            typ = re.search(r'<td class="type-[^"]*">(.*?)</td>', table_html, flags=re.S)
            rel = re.search(r'<td class="sp_release">(.*?)</td>', table_html, flags=re.S)
            items.append(
                {
                    "title": title,
                    "type": clean_text(typ.group(1)) if typ else "",
                    "release": clean_text(rel.group(1)) if rel else "",
                    "cover_url": norm_url(cover_url),
                }
            )

        if items:
            result["sections"].append({"title": section_title, "items": items})

    return result


# ---------------------------------------------------------------- /movie/
def parse_movie(page_html: str) -> dict:
    body = page_html[page_html.find('<div class="post-body"'):]
    result = {"source": f"{BASE}/movie/", "title": "日本动画电影 · 内地院线档期", "sections": []}

    intro_pat = re.compile(r'<p class="movie_intro"><b>(.*?)</b></p>', flags=re.S)
    item_pat = re.compile(
        r'<div class="div_sp"[^>]*><img[^>]*data-src="([^"]+)"[^>]*></div>\s*'
        r"<div><table[^>]*>(.*?)</table>",
        flags=re.S,
    )
    intros = list(intro_pat.finditer(body))
    for idx, im in enumerate(intros):
        section_title = clean_text(im.group(1))
        chunk_start = im.end()
        chunk_end = intros[idx + 1].start() if idx + 1 < len(intros) else len(body)
        chunk = body[chunk_start:chunk_end]

        items = []
        for em in item_pat.finditer(chunk):
            cover_url, table_html = em.groups()
            tm = re.search(r'<td[^>]*class="movie_title[^"]*"[^>]*>(.*?)</td>', table_html, flags=re.S)
            title = clean_text(tm.group(1), br_to_space=True) if tm else ""
            if not title or title in ("海报", "标题", "上映时间", "Movie"):
                continue
            typ = re.search(r'<td class="type-[^"]*">(.*?)</td>', table_html, flags=re.S)
            rel = re.search(r'<td class="movie_release">(.*?)</td>', table_html, flags=re.S)
            box = re.search(r'<td[^>]*class="movie_box"[^>]*>(.*?)</td>', table_html, flags=re.S)
            items.append(
                {
                    "title": title,
                    "type": clean_text(typ.group(1)) if typ else "",
                    "release": clean_text(rel.group(1)) if rel else "",
                    "box_office": clean_text(box.group(1)) if box else "",
                    "cover_url": norm_url(cover_url),
                }
            )

        if items:
            result["sections"].append({"title": section_title, "items": items})

    return result


# ---------------------------------------------------------------- covers
def download_covers(entries, covers_map, label: str, workers: int = 8):
    """entries: list of dicts containing cover_url. Fill covers_map[url] = relpath.
    NOTE: bilibili CDN 403s requests carrying a yuc.wiki Referer, so covers are
    fetched WITHOUT a Referer (the site itself uses referrerPolicy=no-referrer)."""
    if not os.path.isdir(COVER_DIR):
        os.makedirs(COVER_DIR)
    total = len(set(c["cover_url"] for c in entries if c.get("cover_url")))
    done = 0
    seen_urls = set()
    tasks = []
    for c in entries:
        u = c.get("cover_url")
        if not u or u in seen_urls:
            continue
        seen_urls.add(u)
        tasks.append(u)
    tasks = [t for t in tasks if t not in covers_map]  # resume: skip already-mapped

    import concurrent.futures

    def grab(u: str) -> tuple:
        ext = os.path.splitext(urlparse(u).path)[1] or ".jpg"
        ext = ext[:8] if ext.lower() in (".jpg", ".jpeg", ".png", ".webp", ".gif") else ".jpg"
        name = hashlib_short(u) + ext
        dest = os.path.join(COVER_DIR, name)
        rel = f"covers/{name}"
        ok = False
        for i in range(3):
            try:
                req = Request(u, headers={"User-Agent": UA})
                with urlopen(req, timeout=40, context=_CTX) as resp:
                    data = resp.read()
                if len(data) > 2000:
                    with open(dest, "wb") as f:
                        f.write(data)
                    ok = True
                break
            except Exception:  # noqa: BLE001
                time.sleep(1.2 * (i + 1))
        return u, rel if ok else ""

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        for u, rel in ex.map(grab, tasks):
            covers_map[u] = rel
            done += 1
            if done % 100 == 0 or done == total:
                print(f"  [covers {label}] {done}/{total}", flush=True)
    return total


def hashlib_short(url: str) -> str:
    import hashlib

    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:14]


# ---------------------------------------------------------------- main
def main():
    covers_only = "--covers-only" in sys.argv
    os.makedirs(OUT_DIR, exist_ok=True)

    if covers_only:
        print(">> covers-only mode: loading existing JSON ...", flush=True)
        all_quarters = json.load(open(os.path.join(OUT_DIR, "quarters.json"), encoding="utf-8"))
        new_data = json.load(open(os.path.join(OUT_DIR, "new.json"), encoding="utf-8"))
        sp_data = json.load(open(os.path.join(OUT_DIR, "sp.json"), encoding="utf-8"))
        movie_data = json.load(open(os.path.join(OUT_DIR, "movie.json"), encoding="utf-8"))
    else:
        print(">> fetching homepage ...", flush=True)
        home = fetch(f"{BASE}/")
        quarters = discover_quarters(home)
        print(f">> discovered {len(quarters)} quarters: {quarters[0]}..{quarters[-1]}", flush=True)

        all_quarters = []
        for q in quarters:
            print(f">> scraping quarter {q} ...", flush=True)
            page = fetch(f"{BASE}/{q}/")
            parsed = parse_quarter(q, page)
            n = len(parsed["items"])
            print(f"   {q}: {n} items | {parsed['quarter_title']}", flush=True)
            all_quarters.append(parsed)
            time.sleep(0.4)

        with open(os.path.join(OUT_DIR, "quarters.json"), "w", encoding="utf-8") as f:
            json.dump(all_quarters, f, ensure_ascii=False, indent=1)

        print(">> scraping /new/ ...", flush=True)
        new_data = parse_new(fetch(f"{BASE}/new/"))
        with open(os.path.join(OUT_DIR, "new.json"), "w", encoding="utf-8") as f:
            json.dump(new_data, f, ensure_ascii=False, indent=1)

        print(">> scraping /sp/ ...", flush=True)
        sp_data = parse_sp(fetch(f"{BASE}/sp/"))
        with open(os.path.join(OUT_DIR, "sp.json"), "w", encoding="utf-8") as f:
            json.dump(sp_data, f, ensure_ascii=False, indent=1)

        print(">> scraping /movie/ ...", flush=True)
        movie_data = parse_movie(fetch(f"{BASE}/movie/"))
        with open(os.path.join(OUT_DIR, "movie.json"), "w", encoding="utf-8") as f:
            json.dump(movie_data, f, ensure_ascii=False, indent=1)

    # cover download (dedupe across all datasets)
    covers_map = {}
    if os.path.exists(os.path.join(OUT_DIR, "covers.json")):
        try:
            covers_map = json.load(open(os.path.join(OUT_DIR, "covers.json"), encoding="utf-8"))
            print(f">> resuming with {len(covers_map)} covers already mapped", flush=True)
        except Exception:  # noqa: BLE001
            covers_map = {}
    if not os.path.isdir(COVER_DIR):
        os.makedirs(COVER_DIR)
    all_entries = []
    for q in all_quarters:
        all_entries.extend(q["items"])
    for s in new_data["sections"]:
        all_entries.extend(s["items"])
    for s in sp_data["sections"]:
        all_entries.extend(s["items"])
    for s in movie_data["sections"]:
        all_entries.extend(s["items"])
    todo = len(set(e["cover_url"] for e in all_entries if e.get("cover_url")) - set(covers_map))
    print(f">> downloading covers (todo: {todo}) ...", flush=True)
    download_covers(all_entries, covers_map, "all")

    with open(os.path.join(OUT_DIR, "covers.json"), "w", encoding="utf-8") as f:
        json.dump(covers_map, f, ensure_ascii=False, indent=1)

    print(">> done.", flush=True)


if __name__ == "__main__":
    sys.exit(main())
