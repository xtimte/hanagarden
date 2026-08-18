# 🌸 番之庭 · Hanagarden

> 个人主题动漫资讯网站 —— 每一季的动画星光，都收进这座小小的庭院。

**🌐 在线访问：**
- Cloudflare Pages（推荐，国内访问快）：**https://hanagarden.pages.dev**
- GitHub Pages（备用）：https://xtimte.github.io/hanagarden/

一个基于 **yuc.wiki（長門番堂）真实数据** 构建的动漫资讯站：新番放送表、新番卫星观测站、剧场版 / OVA / 特别篇、内地院线票房，按季度整理、随时翻阅。

界面参考 [jiejoe.com](https://www.jiejoe.com) 的动态视觉语言（大标题渐变、跑马灯、滚动显现、3D 卡片倾斜、进度返回顶部、鼠标光晕等），将绿色「酷炫风」改为 **蓝粉「柔和动漫风」**：深蓝夜空 + 樱花花瓣 + 星尘光晕 + 玻璃拟态卡片。

---

## ✨ 功能特性

| 模块 | 说明 |
| --- | --- |
| 🌙 本季新番 | 最新季度放送表，按「周一~周日 / 网络放送」分组筛选，支持切换历史季度 |
| 🔭 新番观测站 | 尚未着陆的动画企划（即将着陆 / 预计着陆），含题材类型与档期 |
| 🎬 剧场版·OVA | Movie / OVA / OAD / TV 特别篇，按月归档 |
| 🎫 内地院线 | 引进国内院线的日本动画电影与票房成绩 |
| 📚 历年存档 | 2020 年至今全部季度新番，随时翻阅 |
| 🔍 全库搜索 | 标题 / 放送日 / 题材 即时搜索，跨全部数据 |
| 🗂 详情弹窗 | 中文名 / 日文名 / 放送时间 / 集数 / 题材标签 / 制作阵容 / 配音阵容 / 观看平台直达链接 |
| 🎨 动态视觉 | 星空闪烁、樱花飘落、鼠标光晕、渐变标题、跑马灯、倒计时、数字滚动、卡片 3D 倾斜、滚动显现 |
| 👤 个人一角 | B站空间 / QQ / 邮箱 / 微信（点击复制），弱化个人介绍、突出番剧内容 |

## 📁 项目结构

```
anime-hub/
├── index.html            # 单页站点
├── css/style.css         # 蓝粉柔和风设计系统
├── js/
│   ├── data.js           # 站点数据（由 build_data.py 生成，勿手改）
│   └── app.js            # 渲染与交互逻辑
├── data/
│   ├── quarters.json     # 27 个季度新番（2020.01 ~ 2026.07）
│   ├── new.json          # 新番观测站
│   ├── sp.json           # 剧场版 / OVA / OAD / SP
│   ├── movie.json        # 内地院线
│   ├── covers.json       # 封面图 URL → 本地路径映射
│   └── covers/           # 本地化的封面图（约 1900 张）
└── scripts/
    ├── scrape_yuc.py     # 爬虫：抓取 yuc.wiki 全部数据 + 下载封面
    ├── build_data.py     # 将 JSON 构建为 js/data.js
    └── cdp_qa.mjs        # 无头浏览器交互自检脚本（可选）
```

## 🚀 使用方式

**方式一：直接打开** —— 双击 `index.html` 即可（数据已内嵌，无需服务器）。

**方式二：本地服务器**（推荐，体验最佳）：

```bash
cd anime-hub
python -m http.server 8765
# 浏览器访问 http://127.0.0.1:8765/
```

## 🔄 更新数据（重新爬取）

```bash
# 1. 重新抓取 yuc.wiki 全量数据并下载封面（约 10~20 分钟）
python scripts/scrape_yuc.py

# 2. 重新构建前端数据
python scripts/build_data.py
```

## 🧭 设计说明

- **配色**：深夜蓝紫底（`#070b1f → #1b1242`）+ 蓝（`#7ea6ff`）+ 粉（`#ff9ecd`），渐变贯穿标题 / 按钮 / 徽章 / 高亮；
- **字体**：标题 `ZCOOL KuaiLe`（圆润可爱），正文 `Noto Sans SC`，数字 `Space Grotesk`；
- **动效**：所有动画均支持 `prefers-reduced-motion` 减弱；触屏设备自动关闭 3D 倾斜；
- **无障碍**：卡片支持键盘 Enter/空格打开详情；弹窗支持 Esc 关闭；语义化标签齐全。

## 📜 数据来源与版权

- 全部动画数据（放送表、封面图、平台链接、票房等）整理自 [yuc.wiki · 長門番堂](https://yuc.wiki/)（長門有C），由衷感谢其长期维护；
- 站点内容遵循 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh)；
- 本站为个人学习与兴趣作品，仅供学习交流，请支持正版动画。

## 👤 关于站主

X_Timte —— B站：[space.bilibili.com/277564170](https://space.bilibili.com/277564170) ｜ QQ / 邮箱：1440100057 / 1440100057@qq.com ｜ 微信：xtimte777
