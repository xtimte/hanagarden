# -*- coding: utf-8 -*-
"""分批推送脚本：重建干净历史 -> 推送主代码 -> 分批推送封面图（带重试）"""
import subprocess
import sys
import time
import os
import shutil

REPO = r"D:\deepseek harness\model tow\anime-hub"
COVERS = os.path.join(REPO, "data", "covers")
BATCH_SIZE = 60  # 每批文件数（约 16MB），网络不稳可调小
LOG = os.path.join(REPO, "data", "push_log.txt")

def run(args, timeout=900):
    p = subprocess.run(args, cwd=REPO, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=timeout)
    return p.returncode, (p.stdout or "") + (p.stderr or "")

def log(msg):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def push_with_retry(tag, tries=6, force=False):
    for t in range(1, tries + 1):
        cmd = ["git", "push"] + (["--force"] if force else []) + ["origin", "main"]
        code, out = run(cmd)
        if code == 0:
            log(f"PUSH OK ({tag})")
            return True
        log(f"PUSH FAIL ({tag}) try {t}/{tries}: {out[-160:]}")
        time.sleep(12 * t)
    return False

def main():
    # 1. 重建干净历史
    git_dir = os.path.join(REPO, ".git")
    if os.path.exists(git_dir):
        shutil.rmtree(git_dir)
    run(["git", "init", "-b", "main"])
    run(["git", "config", "user.name", "xtimte"])
    run(["git", "config", "user.email", "3131338158@qq.com"])
    run(["git", "config", "http.postBuffer", "524288000"])
    run(["git", "config", "http.version", "HTTP/1.1"])
    run(["git", "remote", "add", "origin", "git@github.com:xtimte/hanagarden.git"])

    # 2. 推送主代码（不含封面）
    code, out = run(["git", "add", "-A", ".", ":(exclude)data/covers"])
    log(f"add main: {out[-80:] if code else 'ok'}")
    code, out = run(["git", "commit", "-m",
                     "feat: 番之庭 Hanagarden — 蓝粉柔和风动漫资讯站\n\n"
                     "- 27 季度新番放送表(2020.01~2026.07, 1568部) + 剧场版/OVA 348 + 内地院线 76\n"
                     "- 数据管道: scrape_yuc.py(爬虫) / build_data.py(构建, 支持 --remote 热链)\n"
                     "- 前端原生 HTML/CSS/JS, 参考 jiejoe.com 动态视觉, 蓝粉柔和主题\n"
                     "- 含反爬虫 Nginx 配置(nginx.conf.example)与部署指南(DEPLOY.md)"])
    log(f"commit main: {out[-120:] if code else 'ok'}")
    if not push_with_retry("main-code", force=True):
        log("FATAL: main code push failed")
        sys.exit(1)

    # 3. 分批推送封面
    files = sorted(os.listdir(COVERS))
    total = len(files)
    n_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
    log(f"covers: {total} files, {n_batches} batches x{BATCH_SIZE}")
    for b in range(n_batches):
        chunk = files[b * BATCH_SIZE:(b + 1) * BATCH_SIZE]
        paths = [os.path.join("data", "covers", f) for f in chunk]
        code, out = run(["git", "add", "--"] + paths)
        if code != 0:
            log(f"add batch {b+1} FAILED: {out[-120:]}")
            sys.exit(1)
        code, out = run(["git", "commit", "-m", f"chore: 封面图入库 {b+1}/{n_batches}"])
        log(f"commit batch {b+1}/{n_batches}: {out[-80:] if code else 'ok'}")
        if not push_with_retry(f"batch {b+1}/{n_batches}"):
            log(f"FATAL: batch {b+1} failed after retries")
            sys.exit(1)

    log(f"DONE: all {total} covers pushed in {n_batches} batches")

if __name__ == "__main__":
    main()
