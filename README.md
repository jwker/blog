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
- **标题取文件名**：`雨天读书记.md` → 标题「雨天读书记」
- **分类 = 所在文件夹**：`content/技术/xxx.md` 就是「技术」分类，建个新文件夹就是新建一个分类。「随笔」是保留分类，放进去的文章在首页展开全文
- **首页一条时间轴**：所有内容按最后提交时间**混排成一条流**，不分块。顶部一行分类标签，点击在前端过滤
- **详情页**：随笔直接是完整正文，文章有标题 + 完整正文
- **样式只有一套**：Riso 孔版印刷（纸面 + 钴蓝 + 荧光粉），配色和字体在 `build.mjs` 顶部的 CSS 变量里改
- **发布免费免备案**：GitHub Actions 自动构建 → 推到 gh-pages 分支 → GitHub Pages 出站

## 目录结构

```
blog/
├── content/            # 你的文章（.md 文件），按分类放在子文件夹里
│   ├── 随笔/           # 保留分类：首页展开全文
│   ├── 技术/
│   └── 读书/
├── template.json       # 站点配置（站名、副标题、微调开关）
├── build.mjs           # 构建脚本（唯一的核心代码，样式也在这里）
├── package.json        # 依赖：markdown-it + sharp
└── .github/workflows/  # GitHub Actions：构建 + 发布
```

## 写文章（日常操作）

1. 想写随笔，就把 `.md` 放进 `content/随笔/`；想写别的分类，就放进 `content/分类名/`，分类名随便起
2. 文件名就是标题，直接写正文，**不用写任何头部信息**
3. 日期自动取该文件最后一次改内容的提交时间

```
content/
├── 随笔/
│   ├── 下班路上的夏夜.md    ← 随笔：首页直接展开全文
│   └── 今天午饭吃什么.md
├── 技术/
│   └── 用一周时间读懂 V8.md ← 普通文章：首页是黑卡，点击进详情页
└── 读书/
    └── 重读《文艺复兴时代的开发者们.md
```

**分类规则**：分类名就是 `content/` 下一级文件夹名，直接放在 `content/` 根目录的算「未分类」。首页顶部会出现一行分类标签（全部 + 各分类 + 篇数），点一下就在前端过滤，不生成额外页面。「随笔」是保留分类，首页上直接展开全文、详情页不显示标题；其它分类都是黑卡 + 详情页有标题。

> 首页顺序 = 文章最后提交时间倒序（新写的在前），各分类混排在一起。

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

首页默认用 `timeline` 排版：所有内容按最后提交时间倒序排成一条流，各分类混在一起。

- **随笔**（`content/随笔/` 下的文件）：不显示标题，只有一行时间和正文。
- **其它分类**：黑色卡片，左边是分类标签和时间，中间是大标题 + 正文首段摘要，右边是「▸ 阅读全文」。
- **分类筛选**：页面顶部一行标签（全部 + 各分类 + 篇数），点击在前端过滤条目。
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
- 图片放在 `images/` 目录，文章里用相对路径引用（如 `![](images/xx.png)`）
