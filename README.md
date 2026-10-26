---
title: blog 极简本地博客
created: 2026-09-09
modified: 2026-10-26
author: doubao
tags: 博客, Markdown, GitHub Pages, 极简
category: 项目
summary: 零框架自研的极简 md 博客：内容即 Markdown 文件，构建脚本生成静态站，GitHub Actions 自动发布到 GitHub Pages。
word_count: 1191
---

# blog · 极简本地博客

不用任何博客框架（Astro / Hexo / Hugo），一个 `build.mjs` 脚本 + 一个 `template.json` 配置，搞定一个极简静态博客。

- **内容 = Markdown 文件**：在 `content/` 新建 `.md` 就是写文章，不需要写 frontmatter
- **标题取文件名**：`雨天读书记.md` → 标题「雨天读书记」；文件名和页面都不显示日期，列表就是纯标题
- **首页一条时间轴**：随笔和文章按最后提交时间**混排成一条流**，不再分成两块。随笔是纸面文字（粉色竖线 + 衬线正文），文章是黑色卡片（标题 + 摘要 + 「阅读全文」），两类内容版式不同，扫一眼就能分清
- **详情页**：随笔直接是完整正文，文章有标题 + 完整正文
- **无标签、无分类**：就是一张文章列表，按日期倒序
- **样式只有一套**：Riso 孔版印刷（纸面 + 钴蓝 + 荧光粉），配色和字体在 `build.mjs` 顶部的 CSS 变量里改
- **发布免费免备案**：GitHub Actions 自动构建 → 推到 gh-pages 分支 → GitHub Pages 出站

## 目录结构

```
blog/
├── content/            # 你的文章（.md 文件），放这里就行
├── template.json       # 站点配置（站名、副标题、微调开关）
├── build.mjs           # 构建脚本（唯一的核心代码，样式也在这里）
├── package.json        # 依赖：markdown-it + sharp
└── .github/workflows/  # GitHub Actions：构建 + 发布
```

## 写文章（日常操作）

1. 在 `content/` 新建一个文件，命名就是标题：`标题.md`
2. 直接写正文，**不用写任何头部信息**（标题取文件名，日期自动取该文件最后提交的时间）

```
content/
├── 雨天读书记.md          ← 文章：列表只显示标题
├── 随笔.md                ← 随笔：列表直接展开全文
└── 一碗深夜的面.md
```

**随笔 / 文章怎么区分**：看标题里有没有「随笔」两个字——有就是随笔，首页上直接展开全文；没有就是文章，首页上是一张黑卡（标题 + 摘要 + 阅读全文）。两种点进去都是完整正文。

> 首页顺序 = 文章最后提交时间倒序（新写的在前），两类内容混排在一起。每条旁边的时间取自该文件最后一次提交的时间。

## 本地预览

```bash
cd blog
npm install
npm run build      # 生成 dist/
npm run preview    # 打开 http://localhost:8080
```

## 部署到 GitHub Pages

1. GitHub 上新建一个仓库（如 `blog`），本地执行：

```bash
cd blog
git init
git add .
git commit -m "init"
git remote add origin https://github.com/你的用户名/blog.git
git push -u origin main
```

2. 等 Actions 跑完（约 1 分钟），去仓库 **Settings → Pages**：
   - Source 选 **Deploy from a branch**
   - Branch 选 **gh-pages** + `/ (root)` → Save

3. 访问 `https://你的用户名.github.io/blog/`

之后每次 `git push`，站点自动重新构建发布，无需任何手动操作。

## 站点配置（template.json）

```json
{
  "site": { "name": "JJ 的笔记", "subtitle": "记录日常，写下想法" },
  "tweak": {
    "home_layout": "timeline",
    "show_date": true
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `site.name` | 站点名（页面头部 + 页脚） |
| `site.subtitle` | 副标题，留空不显示 |
| `tweak.home_layout` | 首页排版：`timeline`（默认，按时间顺序混排随笔与文章）/ `classic`（旧版：随笔区 + 文章区分块排版） |
| `tweak.show_date` | 是否显示日期（默认 `false`，不显示） |
| `tweak.bg` / `tweak.text` | 背景色 / 文字色，覆盖默认的纸面 + 墨色 |
| `tweak.font_family` | 字体：`sans`（黑体）/ `serif`（宋体）/ `mono`（等宽） |
| `tweak.font_size` | 正文字号（px） |

样式只有一套，代码在 `build.mjs` 顶部的 `baseCss` 里。改配色直接改那里的 CSS 变量：`--bg`（纸面）、`--text`（墨色）、`--muted`（次要文字）、`--pink`（荧光粉）、`--cobalt`（钴蓝）、`--card-bg` / `--card-fg`（黑卡底色与文字色）。

## 首页排版

首页默认用 `timeline` 排版：所有内容按最后提交时间倒序排成一条流，随笔和文章混在一起。

- **随笔**（标题含「随笔」的文件）：不显示标题，只有一行时间和正文。随笔文件名去掉「随笔」前缀后剩下的就是日期串（`2026101601`），当标题没有意义，所以正文直接铺在页面里。
- **文章**（其余文件）：黑色卡片，左边是「文章」标签和时间，中间是大标题 + 正文首段摘要，右边是「▸ 阅读全文」。
- **图片**：随笔正文里的图片按张数分三种排法 —— 1 张是单列大图，4 张是 2×2，其余是 3 列方格。点图开灯箱，方向键左右切换，Esc 关闭。

想回到旧的分块排版，把 `template.json` 里的 `tweak.home_layout` 改成 `classic` 即可：

```json
{
  "tweak": {
    "home_layout": "classic"
  }
}
```

## 技术说明

- 依赖只有两个：`markdown-it`（Markdown 渲染）+ `sharp`（图片压缩）
- 构建脚本纯 Node，无框架、无编译；样式内联在 `build.mjs` 里，不依赖任何 CSS 框架
- 支持文章正文的常用 Markdown：标题、引用、代码块、表格、图片、链接等
- 图片放在 `content/` 同级目录，文章里用相对路径引用（如 `![](images/xx.png)`）
