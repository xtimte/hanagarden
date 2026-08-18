#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build js/data.js from scraped data/*.json + covers.json.

- Resolves cover_url -> local relative path (fallback: keep remote URL)
- Assigns a global _idx to every item (used by the modal lookup)
- Compacts field names to keep data.js small
- Writes window.DATA = {...}
"""
import json
import os
import re
import sys
import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
JS_DIR = os.path.join(ROOT, "js")


def load(name):
    with open(os.path.join(DATA_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def main():
    quarters = load("quarters.json")
    new_data = load("new.json")
    sp_data = load("sp.json")
    movie_data = load("movie.json")
    covers_map = load("covers.json")

    remote = "--remote" in sys.argv
    out_file = os.path.join(JS_DIR, "data.remote.js") if remote else os.path.join(JS_DIR, "data.js")

    idx = 0

    def cover_of(url):
        if not url:
            return ""
        if remote:
            return url  # hotlink the original CDN covers (lightweight deploy)
        local = covers_map.get(url)
        if local:
            return "data/" + local
        return url

    def q_short(title, code):
        m = re.search(r"20\d{2}年\d{1,2}月", title)
        if m:
            return m.group(0)
        return f"{code[:4]}年{int(code[4:])}月"

    out_quarters = []
    for q in quarters:
        items = []
        for it in q["items"]:
            entry = {
                "t": it["title"],
                "g": it["group"],
                "time": it.get("status_or_time") or "",
                "ep": it.get("episode_note") or "",
                "cover": cover_of(it.get("cover_url") or ""),
                "extra": it.get("extra_note") or "",
                "pf": [[p["name"], p["url"]] for p in it.get("platforms") or []],
                "_idx": idx,
            }
            for key, jkey in (("title_jp", "jp"), ("type", "type"), ("genre", "genre"), ("staff", "staff"), ("cast", "cast")):
                v = it.get(key)
                if v:
                    entry[jkey] = v
            items.append(entry)
            idx += 1
        out_quarters.append(
            {"code": q["quarter_code"], "title": q["quarter_title"], "short": q_short(q["quarter_title"], q["quarter_code"]), "items": items}
        )

    def sections(src):
        nonlocal idx
        out = []
        for s in src.get("sections") or []:
            items = []
            for it in s["items"]:
                entry = {"_idx": idx}
                idx += 1
                for key, jkey in (("title", "t"), ("type", "type"), ("season", "season"), ("release", "release"), ("box_office", "box")):
                    v = it.get(key)
                    if v:
                        entry[jkey] = v
                entry["cover"] = cover_of(it.get("cover_url") or "")
                items.append(entry)
            out.append({"title": s["title"], "items": items})
        return out

    total_anime = sum(len(q["items"]) for q in out_quarters)
    total_sp = sum(len(s["items"]) for s in sections(sp_data))
    total_movie = sum(len(s["items"]) for s in sections(movie_data))

    data = {
        "meta": {
            "source": "https://yuc.wiki/",
            "fetched": datetime.date.today().strftime("%Y-%m-%d"),
            "covers": sum(1 for v in covers_map.values() if v) if not remote else -1,
            "counts": {
                "quarters": len(out_quarters),
                "anime": total_anime,
                "sp": total_sp,
                "theater": total_movie,
            },
        },
        "quarters": out_quarters,
        "upcoming": {"sections": sections(new_data)},
        "sp": {"sections": sections(sp_data)},
        "movie": {"sections": sections(movie_data)},
    }

    js = "/* 番之庭 · Hanagarden 数据（自动生成，来自 https://yuc.wiki/ 長門番堂） */\n"
    js += "window.DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    js = js.replace("</", "<\\/")
    js += ";\n"

    os.makedirs(JS_DIR, exist_ok=True)
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(js)

    mode = "remote-hotlink" if remote else "local"
    print(f"{os.path.basename(out_file)} written ({mode}): {len(js)} bytes")
    print(f"  quarters: {len(out_quarters)} | anime items: {total_anime} | sp: {total_sp} | movie: {total_movie} | covers: {data['meta']['covers'] if not remote else 'N/A (hotlink)'}")


if __name__ == "__main__":
    main()
