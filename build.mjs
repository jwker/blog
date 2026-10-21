#!/usr/bin/env node
/**
 * 极简 md 博客构建脚本（零框架）
 * 扫描 content/ 下的 .md 文件 → 生成静态站到 dist/
 * 标题取文件名（支持 "YYYY-MM-DD-标题.md" 命名，日期从文件名解析）
 * 模板与微调：template.json 驱动
 * 当前皮肤：Riso 孔版印刷（纸面 + 钴蓝 + 荧光粉）
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const contentDir = path.join(root, 'content');
const distDir = path.join(root, 'dist');
const templatesDir = path.join(root, 'templates');
const imagesDir = path.join(root, 'images');

// ---------- 读取配置 ----------
const config = JSON.parse(fs.readFileSync(path.join(root, 'template.json'), 'utf8'));
const site = config.site || {};
const tplName = config.template || 'minimal';
const tplFile = path.join(templatesDir, `${tplName}.css`);
if (!fs.existsSync(tplFile)) {
  console.error(`模板不存在: ${tplName}（templates/ 目录下可用的：${fs.readdirSync(templatesDir).map(f => f.replace('.css', '')).join(', ')}）`);
  process.exit(1);
}
const tplCss = fs.readFileSync(tplFile, 'utf8');

// 微调参数 → CSS 变量覆盖
const t = config.tweak || {};
const fontStacks = {
  sans: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
  serif: "'Songti SC','Noto Serif SC','SimSun',serif",
  mono: "'SF Mono','JetBrains Mono',Consolas,monospace",
};
const overrides = [];
if (t.accent) overrides.push(`--accent:${t.accent}`);
if (t.bg) overrides.push(`--bg:${t.bg}`);
if (t.text) overrides.push(`--text:${t.text}`);
if (t.font_family && fontStacks[t.font_family]) overrides.push(`--font-family:${fontStacks[t.font_family]}`);
if (t.font_size) overrides.push(`--font-size:${t.font_size}px`);
const tweakCss = overrides.length ? `:root{${overrides.join(';')}}` : '';
const showDate = t.show_date === true;

// ---------- 基础布局 CSS（Riso 孔版） ----------
const baseCss = `
:root{--ink:var(--text);--paper:var(--bg);--pink:#ff4f7e;--cobalt:#2340c8;--sans:'PingFang SC','Hiragino Sans GB','Noto Sans SC','Microsoft YaHei',sans-serif;--serif:'Songti SC','Noto Serif SC','SimSun',serif;--mono:'SF Mono','JetBrains Mono','Menlo','Consolas',monospace;}
*{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--text);font-family:var(--font-family,var(--serif));font-size:var(--font-size);line-height:1.9;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;text-rendering:optimizeLegibility;}
::selection{background:var(--pink);color:var(--ink);}
a{color:inherit;text-decoration:none;}
a:focus-visible,button:focus-visible{outline:3px solid var(--cobalt);outline-offset:3px;}
img{max-width:100%;}
.skip{position:absolute;left:-9999px;top:0;z-index:200;padding:10px 14px;border:2px solid var(--ink);background:var(--pink);color:var(--ink);font-family:var(--mono);font-size:11px;}
.skip:focus{left:12px;top:12px;}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
.page{width:min(calc(100% - 64px),1180px);margin:0 auto;padding-bottom:8px;}

/* 报头 */
.masthead{padding-top:26px;}
.topline{display:flex;align-items:baseline;justify-content:space-between;gap:24px;padding-bottom:14px;border-bottom:2px solid var(--ink);font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--muted);}
.topline nav{display:flex;gap:22px;white-space:nowrap;}
.topline a:hover{color:var(--cobalt);}
.masthead h1{display:inline-block;max-width:100%;margin:30px 0 0;padding:.02em .09em .07em;background:var(--cobalt);color:#fff;box-shadow:8px 8px 0 var(--pink);font-family:var(--sans);font-size:clamp(46px,10.5vw,128px);font-weight:900;line-height:.98;letter-spacing:-.035em;}
.masthead h1 a{color:inherit;}
.subline{display:flex;flex-wrap:wrap;gap:8px 28px;margin-top:22px;padding:10px 0;border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);font-family:var(--mono);font-size:10px;letter-spacing:.08em;}
.subline span::before{content:"■";display:inline-block;margin-right:8px;color:var(--pink);font-size:8px;vertical-align:1px;}
.subline span:nth-child(2n)::before{color:var(--cobalt);}

/* 最新一条 */
.hero{position:relative;margin-top:48px;padding:44px 46px 46px;border:2px solid var(--ink);background:var(--pink);box-shadow:9px 9px 0 var(--ink);overflow:hidden;cursor:pointer;}
.hero::after{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(21,21,23,.5) .7px,transparent .9px);background-size:6px 6px;opacity:.14;pointer-events:none;}
.hero::before{content:"“";position:absolute;top:-34px;right:22px;z-index:0;font-family:Georgia,"Times New Roman",serif;font-size:220px;line-height:1;color:var(--paper);opacity:.55;pointer-events:none;}
.hero>*{position:relative;z-index:1;}
.meta{margin:0 0 18px;font-family:var(--mono);font-size:11px;letter-spacing:.08em;}
.hero-quote{margin:0;max-width:20em;font-family:var(--sans);font-size:clamp(27px,3.4vw,44px);font-weight:800;line-height:1.36;letter-spacing:-.01em;}
.hero-quote p{margin:0 0 .45em;}
.hero-quote p:last-child{margin-bottom:0;}
.hero-quote a{text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:3px;}
.hero .hero-media{margin-top:26px;}

/* 钴蓝面板 / 图文分栏 */
.split{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:44px;align-items:center;margin-top:64px;cursor:pointer;}
.split-solo{grid-template-columns:1fr;}
.cobalt-panel{position:relative;padding:34px 36px 38px;border:2px solid var(--ink);background:var(--cobalt);color:var(--paper);box-shadow:9px 9px 0 var(--pink);}
.cobalt-panel .meta{color:rgba(242,239,228,.8);}
.cobalt-panel .panel-text p{margin:0 0 .8em;font-family:var(--serif);font-size:20px;line-height:1.85;}
.cobalt-panel .panel-text p:last-child{margin-bottom:0;}
.cobalt-panel a{color:#fff;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;}
.icon-card{margin:0;padding:18px 18px 14px;border:2px solid var(--ink);background:var(--paper);box-shadow:8px 8px 0 var(--ink);transform:rotate(-3deg);}
.icon-card img{display:block;width:100%;height:auto;background:#fff;border:1.5px solid var(--ink);}
.icon-card figcaption{margin-top:10px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--muted);}

/* 大图条目 */
.wide-entry{margin-top:82px;cursor:pointer;}
.entry-meta{display:flex;align-items:center;gap:14px;margin-bottom:16px;font-family:var(--mono);font-size:10px;letter-spacing:.08em;}
.entry-meta .tag{padding:4px 8px;border:1.5px solid var(--ink);background:var(--pink);font-size:9px;}
.lede{margin:0 0 26px;max-width:24em;font-family:var(--sans);font-size:clamp(24px,2.6vw,32px);font-weight:800;line-height:1.45;letter-spacing:-.01em;}
.lede p{margin:0 0 .45em;}
.lede p:last-child{margin-bottom:0;}
.diagram-frame{margin:0;padding:10px;border:2px solid var(--ink);background:#fff;box-shadow:10px 10px 0 var(--cobalt);}
.diagram-frame img{display:block;width:100%;height:auto;}
.diagram-frame img+img{margin-top:10px;}

/* 短记 */
.rant{margin-top:78px;padding:4px 0 4px 26px;border-left:6px solid var(--cobalt);max-width:820px;cursor:pointer;}
.rant .entry-meta{margin-bottom:14px;}
.rant-text p{margin:0 0 .8em;font-family:var(--serif);font-size:18px;line-height:2;}
.rant-text p:last-child{margin-bottom:0;}

/* 更早的记录 */
.earlier{margin-top:84px;}
.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding-bottom:12px;border-bottom:2px solid var(--ink);font-family:var(--mono);font-size:11px;letter-spacing:.1em;}
.section-head h2{margin:0;font-family:var(--mono);font-size:11px;font-weight:500;}
.section-head h2::before{content:"";display:inline-block;width:9px;height:9px;margin-right:10px;background:var(--pink);}
.section-head span{color:var(--muted);}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:48px;}
.grid-item{padding:17px 0 21px;border-bottom:1.5px solid var(--ink);cursor:pointer;}
.grid-item time{display:block;margin-bottom:8px;font-family:var(--mono);font-size:10px;letter-spacing:.06em;color:var(--muted);}
.grid-item:hover time{color:var(--cobalt);}
.grid-text p{margin:0;font-size:17px;line-height:1.8;}
.grid-media{margin-top:12px;}

/* 文章 */
.articles{margin-top:78px;display:grid;gap:28px;}
.article-strip{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:22px;padding:26px 28px;border:2px solid var(--ink);background:var(--ink);color:var(--paper);box-shadow:9px 9px 0 var(--pink);transition:transform .15s ease;}
.article-strip:hover{transform:translate(-2px,-2px);}
.article-strip .label{padding:5px 9px;background:var(--pink);color:var(--ink);font-family:var(--mono);font-size:10px;letter-spacing:.08em;}
.article-strip h2{margin:0;font-family:var(--sans);font-size:clamp(19px,2.2vw,27px);font-weight:800;line-height:1.4;letter-spacing:-.01em;}
.article-strip time{font-family:var(--mono);font-size:10px;color:rgba(242,239,228,.62);white-space:nowrap;}

/* 页脚 */
.foot{display:flex;align-items:baseline;justify-content:space-between;gap:24px;margin-top:44px;padding:16px 0 36px;border-top:2px solid var(--ink);font-family:var(--mono);font-size:10px;color:var(--muted);}
.foot a:hover{color:var(--cobalt);}

/* 详情页 */
.masthead-compact .topline{border-bottom-width:2px;}
.post-main{padding-top:54px;}
.post-full{max-width:900px;border-top:2px solid var(--ink);padding-top:26px;padding-bottom:8px;}
.post-full .entry-meta{margin-bottom:30px;}
.md-body{font-size:1em;}
.md-body h1,.md-body h2,.md-body h3{font-family:var(--sans);line-height:1.4;letter-spacing:-.01em;margin:1.6em 0 .6em;}
.md-body h1{font-size:1.65em;}
.md-body h2{font-size:1.35em;}
.md-body h3{font-size:1.15em;}
.md-body p{margin:1em 0;}
.md-body blockquote{margin:1.2em 0;padding:.2em 1em;border-left:6px solid var(--cobalt);color:var(--muted);}
.md-body blockquote p{margin:.6em 0;}
.md-body code{background:rgba(21,21,23,.07);padding:.15em .4em;border:1px solid rgba(21,21,23,.16);font-family:var(--mono);font-size:.86em;}
.md-body pre{background:#fff;border:2px solid var(--ink);padding:14px 16px;box-shadow:6px 6px 0 var(--cobalt);overflow-x:auto;margin:1.2em 0;}
.md-body pre code{background:none;border:none;padding:0;}
.md-body img{max-width:100%;height:auto;border:2px solid var(--ink);background:#fff;padding:5px;box-shadow:7px 7px 0 var(--cobalt);}
.md-body a{color:var(--cobalt);text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;}
.md-body ul,.md-body ol{margin:1em 0;padding-left:1.6em;}
.md-body li{margin:.3em 0;}
.md-body table{border-collapse:collapse;margin:1em 0;}
.md-body th,.md-body td{border:1.5px solid var(--ink);padding:6px 12px;}
.md-body th{background:var(--pink);font-family:var(--sans);}
.md-body hr{border:none;border-top:2px solid var(--ink);margin:2em 0;}
.back{display:inline-block;margin-top:40px;padding:8px 14px;border:2px solid var(--ink);background:var(--paper);font-family:var(--mono);font-size:10px;letter-spacing:.08em;box-shadow:4px 4px 0 var(--pink);}
.back:hover{background:var(--pink);color:var(--ink);}

/* 图片九宫格（朋友圈式：一行最多 3 个；正好 4 张时 2×2；单张显示大图）
   尺寸沿用缩小后的规格：多图网格 50% 宽、单图 30% 宽 */
.img-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:1.2em 0;max-width:50%;}
.img-grid img{width:100%;aspect-ratio:1;object-fit:cover;border:2px solid var(--ink);background:#fff;padding:0;box-shadow:4px 4px 0 var(--cobalt);display:block;}
.img-grid img:nth-child(2n){box-shadow:4px 4px 0 var(--pink);}
.img-grid-4{grid-template-columns:repeat(2,1fr);}
.img-grid-single{grid-template-columns:1fr;max-width:30%;}
.img-grid-single img{aspect-ratio:auto;height:auto;object-fit:contain;box-shadow:6px 6px 0 var(--pink);}
.hero .img-grid-single img{max-height:480px;width:auto;max-width:100%;}
.grid-media{margin:12px 0 0;}

/* 图片灯箱 */
.lb{position:fixed;inset:0;z-index:99;background:rgba(21,21,23,.94);display:none;align-items:center;justify-content:center;}
.lb.open{display:flex;}
.lb img{max-width:92vw;max-height:92vh;border:3px solid var(--paper);background:#fff;box-shadow:10px 10px 0 var(--pink);}
.lb-btn{position:absolute;color:var(--ink);background:var(--pink);border:2px solid var(--ink);border-radius:0;width:44px;height:44px;font-size:22px;line-height:1;cursor:pointer;z-index:2;font-family:var(--mono);}
.lb-btn:active{background:var(--cobalt);color:var(--paper);}
.lb-prev{left:12px;top:50%;transform:translateY(-50%);}
.lb-next{right:12px;top:50%;transform:translateY(-50%);}
.lb-close{right:12px;top:12px;font-size:18px;}

@media (max-width:820px){
  .page{width:min(calc(100% - 40px),700px);}
  .split{grid-template-columns:1fr;gap:36px;}
  .icon-card{width:min(100%,320px);justify-self:center;}
  .grid{grid-template-columns:1fr;}
}
@media (max-width:560px){
  .topline{font-size:9px;}
  .masthead h1{margin-top:22px;box-shadow:4px 4px 0 var(--pink);}
  .hero{margin-top:34px;padding:28px 22px 30px;box-shadow:6px 6px 0 var(--ink);}
  .hero::before{font-size:150px;top:-22px;right:8px;}
  .hero-quote{font-size:26px;}
  .split{margin-top:46px;}
  .cobalt-panel{padding:26px 22px 30px;box-shadow:6px 6px 0 var(--pink);}
  .cobalt-panel .panel-text p{font-size:18px;}
  .wide-entry{margin-top:60px;}
  .rant{margin-top:58px;padding-left:18px;border-left-width:5px;}
  .rant-text p{font-size:16.5px;line-height:1.95;}
  .diagram-frame{box-shadow:6px 6px 0 var(--cobalt);}
  .earlier{margin-top:60px;}
  .article-strip{grid-template-columns:1fr;gap:12px;padding:22px;box-shadow:6px 6px 0 var(--pink);}
  .article-strip .label{justify-self:start;}
  .article-strip time{white-space:normal;}
  .foot{flex-direction:column;gap:8px;}
  .img-grid{max-width:100%;gap:8px;}
  .img-grid-single{max-width:60%;}
  .hero .img-grid-single img{max-height:360px;}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto;}
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;}
}
`;

// ---------- Markdown 渲染 ----------
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

// 列表显示用标题：去掉"随笔"字样（随笔是常态，标题不再重复出现"随笔"）
function displayTitle(title) {
  const t = title.replace(/随笔/g, '').replace(/^[\s·\-—_、，,]+/, '').trim();
  return t || title;
}

// 日期显示：2026-10-16 → 2026.10.16
function dateDot(iso) {
  return (iso || '').slice(0, 10).replace(/-/g, '.');
}

// 去掉标签取纯文本
function textOf(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// 把渲染后的正文拆成「图片」和「文字」两部分，用于列表页的杂志式排版
function splitRendered(rendered) {
  const images = [];
  const textHtml = rendered
    .replace(/<img\b[^>]*>/g, (m) => { images.push(m); return ''; })
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<p>\s*<\/p>/g, '')
    .trim();
  return { images, textHtml, text: textOf(textHtml) };
}

// 图片网格：1 张大图、4 张 2×2、其余 3 列
function mediaGrid(images, extra = '') {
  if (!images.length) return '';
  const cls = images.length === 1 ? 'img-grid img-grid-single' : images.length === 4 ? 'img-grid img-grid-4' : 'img-grid';
  return `<div class="${cls}${extra ? ' ' + extra : ''}">${images.join('')}</div>`;
}

// 整块可点进详情；正文里的链接、图片灯箱不触发跳转
function clickAttrs(href) {
  const js = href.replace(/'/g, '%27');
  return `onclick="if(!event.target.closest('a'))location.href='${js}'" onkeydown="if((event.key==='Enter'||event.key===' ')&&!event.target.closest('a')){event.preventDefault();location.href='${js}'}" role="link" tabindex="0"`;
}

function essayMeta(p) {
  return `<p class="meta">${showDate ? dateDot(p.date) + ' / ' : ''}随笔</p>`;
}

function entryMeta(p) {
  const time = showDate ? `<time datetime="${p.date.slice(0, 10)}">${dateDot(p.date)}</time>` : '';
  return `<div class="entry-meta">${time}<span class="tag">随笔</span></div>`;
}

function renderHero(e) {
  const body = e.textHtml || '<p>（这篇还没有正文）</p>';
  return `<article class="hero" id="essays" aria-label="最新随笔" ${clickAttrs(e.href)}>
  ${essayMeta(e)}
  <div class="hero-quote">${body}</div>
  ${mediaGrid(e.images, 'hero-media')}
</article>`;
}

function renderSplit(e) {
  const panel = `<div class="cobalt-panel">
    ${essayMeta(e)}
    <div class="panel-text">${e.textHtml || '<p>（这篇还没有正文）</p>'}</div>
  </div>`;
  if (!e.images.length) {
    return `<article class="split split-solo" ${clickAttrs(e.href)}>
  ${panel}
</article>`;
  }
  return `<article class="split" ${clickAttrs(e.href)}>
  ${panel}
  <figure class="icon-card">${e.images[0]}<figcaption>附图 / ${dateDot(e.date).slice(5)}</figcaption></figure>
</article>`;
}

function renderWide(e) {
  return `<article class="wide-entry" ${clickAttrs(e.href)}>
  ${entryMeta(e)}
  <div class="lede">${e.textHtml || '<p>（这篇还没有正文）</p>'}</div>
  ${e.images.length ? `<figure class="diagram-frame">${e.images.join('')}</figure>` : ''}
</article>`;
}

function renderRant(e) {
  return `<article class="rant" ${clickAttrs(e.href)}>
  ${entryMeta(e)}
  <div class="rant-text">${e.textHtml || '<p>（这篇还没有正文）</p>'}</div>
</article>`;
}

function renderGrid(items) {
  if (!items.length) return '';
  return `<section class="earlier" aria-labelledby="earlier-title">
  <div class="section-head"><h2 id="earlier-title">更早</h2><span>${String(items.length).padStart(2, '0')}</span></div>
  <div class="grid">
    ${items.map(e => `<article class="grid-item" ${clickAttrs(e.href)}>
      ${showDate ? `<time datetime="${e.date.slice(0, 10)}">${dateDot(e.date)}</time>` : ''}
      ${e.textHtml ? `<div class="grid-text">${e.textHtml}</div>` : ''}
      ${mediaGrid(e.images, 'grid-media')}
    </article>`).join('\n    ')}
  </div>
</section>`;
}

function renderArticles(items) {
  if (!items.length) return '';
  return `<section class="articles" id="articles" aria-label="文章">
    ${items.map(a => `<a class="article-strip" href="posts/${encodeURI(a.slug)}.html">
      <span class="label">文章</span>
      <h2>《${displayTitle(a.title)}》</h2>
      ${showDate ? `<time datetime="${a.date.slice(0, 10)}">${dateDot(a.date)}</time>` : ''}
    </a>`).join('\n    ')}
  </section>`;
}

// ---------- 扫描并解析文章 ----------
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// 取文件最后一次提交的时间（git，完整 ISO 含时分秒），拿不到返回 null
function gitDate(f) {
  try {
    const iso = execSync(`git log -1 --format=%cI -- "${f}"`, { cwd: root, encoding: 'utf8' }).trim();
    return iso || null;
  } catch {
    return null;
  }
}

function parseFile(f) {
  const rel = path.relative(contentDir, f).replace(/\.md$/, '');
  const base = path.basename(f, '.md');
  // 兼容：文件名带日期前缀（YYYY-MM-DD-标题.md）时仍解析
  const m = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (m) return { date: m[1] + 'T00:00:00', title: m[2], slug: rel };
  // 常规：标题 = 文件名，日期 = 该文件最后提交时间
  const g = gitDate(f);
  if (g) return { date: g, title: base, slug: rel };
  // 兜底：未提交过的文件用修改时间
  return { date: fs.statSync(f).mtime.toISOString(), title: base, slug: rel };
}

// ---------- 页面骨架 ----------
// rootPrefix：相对站点根的前缀（列表页 ''，文章页 '../'）
// needsLightbox：随笔页面（列表页/随笔详情页）带图片灯箱，文章页不带
function page(opts) {
  const {
    title,
    body,
    rootPrefix = '',
    needsLightbox = false,
    compact = null,
    home = null,
  } = opts;

  const year = new Date().getFullYear();
  const lightbox = needsLightbox ? `<div class="lb" id="lb">
  <img id="lbImg" src="" alt="">
  <button class="lb-btn lb-prev" onclick="lbNav(-1)">‹</button>
  <button class="lb-btn lb-next" onclick="lbNav(1)">›</button>
  <button class="lb-btn lb-close" onclick="lbClose()">×</button>
</div>
<script>
(function(){
  var imgs = Array.prototype.slice.call(document.querySelectorAll('.img-grid img, .icon-card img, .diagram-frame img'));
  if (!imgs.length) return;
  var lb = document.getElementById('lb'), cur = 0;
  function show(i){ cur = (i + imgs.length) % imgs.length; document.getElementById('lbImg').src = imgs[cur].getAttribute('src'); lb.classList.add('open'); }
  window.lbClose = function(){ lb.classList.remove('open'); };
  window.lbNav = function(d){ show(cur + d); };
  imgs.forEach(function(img, i){
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', function(ev){ ev.stopPropagation(); show(i); });
  });
  lb.addEventListener('click', function(ev){ if (ev.target === lb) lbClose(); });
  document.addEventListener('keydown', function(e){
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') lbClose();
    if (e.key === 'ArrowLeft') lbNav(-1);
    if (e.key === 'ArrowRight') lbNav(1);
  });
})();
<\/script>` : '';

  const header = compact
    ? `<header class="masthead masthead-compact">
  <h1 class="sr-only">${compact.heading}</h1>
  <div class="topline">
    <a href="${rootPrefix}index.html">← ${site.name || '我的博客'}</a>
    <span>${compact.label}</span>
  </div>
</header>`
    : `<header class="masthead">
  <div class="topline">
    <span>个人博客 / ${year}</span>
    <nav aria-label="主导航">
      ${home && home.essayCount ? '<a href="#essays">随笔</a>' : ''}
      ${home && home.articleCount ? '<a href="#articles">文章</a>' : ''}
    </nav>
  </div>
  <h1><a href="${rootPrefix}index.html">${site.name || '我的博客'}</a></h1>
  <div class="subline">
    <span>随笔 ${String(home ? home.essayCount : 0).padStart(2, '0')}</span>
    <span>文章 ${String(home ? home.articleCount : 0).padStart(2, '0')}</span>
    <span>更新至 ${home ? home.updated : dateDot(new Date().toISOString())}</span>
    ${site.subtitle ? `<span>${site.subtitle}</span>` : ''}
  </div>
</header>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${tplCss}
${tweakCss}
${baseCss}
</style>
</head>
<body id="top">
<a class="skip" href="#main">跳到正文</a>
<div class="page">
${header}
  <main id="main">
${body}
  </main>
  <footer class="foot">
    <span>© ${year} ${site.name || ''}</span>
    <a href="#top">回到顶部</a>
  </footer>
</div>
${lightbox}
</body>
</html>`;
}

// ---------- 图片：压缩并拷贝到 dist/images/ ----------
// 规则：jpg/jpeg/webp 压成 jpeg/webp（最长边 1600px、质量 80），png 无损压紧，
//       gif 与其它格式原样拷贝（保留动画等）。文件名保持不变，md 里的引用不用改。
const IMG_MAX_EDGE = 1600;
const IMG_QUALITY = 80;

async function buildImages(srcDir, outDir) {
  if (!fs.existsSync(srcDir)) return 0;
  fs.mkdirSync(outDir, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // 跳过 .gitkeep、.DS_Store 等隐藏文件
    const src = path.join(srcDir, entry.name);
    const out = path.join(outDir, entry.name);
    if (entry.isDirectory()) {
      count += await buildImages(src, out);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    try {
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        const img = sharp(src).rotate().resize({ width: IMG_MAX_EDGE, height: IMG_MAX_EDGE, fit: 'inside', withoutEnlargement: true });
        if (ext === '.png') await img.png({ compressionLevel: 9 }).toFile(out);
        else if (ext === '.webp') await img.webp({ quality: IMG_QUALITY }).toFile(out);
        else await img.jpeg({ quality: IMG_QUALITY, mozjpeg: true }).toFile(out);
      } else {
        fs.copyFileSync(src, out);
      }
      count++;
    } catch (e) {
      console.warn(`  ⚠ 图片处理失败，已原样拷贝: ${path.relative(root, src)}（${e.message}）`);
      fs.copyFileSync(src, out);
      count++;
    }
  }
  return count;
}

// 图片引用路径适配：md 里写 images/xxx.jpg、/images/xxx.jpg 或 ../images/xxx.jpg 都归一
// 列表页在站点根（前缀 ''），文章页在 posts/ 下（前缀 '../'）
function fixImageSrc(html, rootPrefix) {
  return html.replace(/src="(?:\.\.\/)?\/?images\//g, rootPrefix ? `src="${rootPrefix}images/` : 'src="images/');
}

// 随笔图片分组：把连续的图片段落合并成九宫格容器（朋友圈式）
// 兼容两种渲染形态：每张图独立 <p>（图片间有空行）、多张图同处一个 <p>（连续行书写，img 间夹 <br>）
// 正好 4 张 → 2×2；单张 → 大图；其余 3 列往下排
function groupImages(html) {
  // 先把混在文字段落里的图片拆出来，避免详情页出现一张占满全屏的大图
  const separated = html.replace(/<p>([\s\S]*?)<\/p>/g, (m, inner) => {
    if (!/<img\b/.test(inner)) return m;
    const imgs = inner.match(/<img\b[^>]*>/g) || [];
    const text = inner.replace(/<img\b[^>]*>/g, '').replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ').trim();
    return `${text ? `<p>${text}</p>` : ''}${imgs.length ? `<p>${imgs.join('')}</p>` : ''}`;
  });
  const imgBlock = /(<p><img[^>]*><\/p>\s*)+|<p>(?:(?:<img[^>]*>|<br\s*\/?>)+\s*)<\/p>/g;
  return separated.replace(imgBlock, (m) => {
    const inner = m.replace(/<\/?p>|<br\s*\/?>/g, '').trim();
    const count = (inner.match(/<img/g) || []).length;
    if (!count) return m;
    const cls = count === 1 ? 'img-grid img-grid-single' : (count === 4 ? 'img-grid img-grid-4' : 'img-grid');
    return `<div class="${cls}">${inner}</div>`;
  });
}

// ---------- 主流程 ----------
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(path.join(distDir, 'posts'), { recursive: true });
// 图片：压缩并拷贝（顶层 await，构建脚本为 ESM）
const imgCount = await buildImages(imagesDir, path.join(distDir, 'images'));

const files = walk(contentDir).sort();
const posts = files.map(parseFile).sort((a, b) => (a.date === b.date ? 0 : (a.date < b.date ? 1 : -1)));
// 分类：标题含"随笔" → 随笔（列表内联全文），其余 → 文章（列表只显示标题）
for (const p of posts) p.isEssay = p.title.includes('随笔');

const essays = posts.filter(p => p.isEssay).map((p) => {
  const raw = fs.readFileSync(path.join(contentDir, p.slug + '.md'), 'utf8');
  const rendered = fixImageSrc(md.render(raw), '');
  return {
    ...p,
    href: `posts/${encodeURI(p.slug)}.html`,
    ...splitRendered(rendered),
  };
});
const articles = posts.filter(p => !p.isEssay);

// 列表页：最新一条 → 粉色主视觉；第 2～4 条按内容变成钴蓝面板/图文分栏/大图/短记；
// 其余进「更早」双栏；文章单独用黑色横条。
const listBlocks = [];
const gridItems = [];

essays.forEach((e, i) => {
  if (i === 0) {
    listBlocks.push(renderHero(e));
    return;
  }
  if (i === 1) {
    listBlocks.push(e.images.length === 1 || e.images.length === 0 ? renderSplit(e) : renderWide(e));
    return;
  }
  if (i === 2) {
    listBlocks.push(e.images.length ? (e.images.length === 1 ? renderSplit(e) : renderWide(e)) : renderRant(e));
    return;
  }
  if (i === 3 && e.images.length) {
    listBlocks.push(renderWide(e));
    return;
  }
  if (i === 3 && !e.images.length) {
    listBlocks.push(renderRant(e));
    return;
  }
  if (i === 4 && e.images.length) {
    listBlocks.push(renderWide(e));
    return;
  }
  if (i === 5 && e.images.length) {
    listBlocks.push(renderWide(e));
    return;
  }
  gridItems.push(e);
});

const indexBody = [
  ...listBlocks,
  renderGrid(gridItems),
  renderArticles(articles),
].filter(Boolean).join('\n');

const indexHtml = page({
  title: `${site.name || '我的博客'}${site.subtitle ? ' · ' + site.subtitle : ''}`,
  body: indexBody || '<p style="color:var(--muted)">还没有文章。在 content/ 目录新建 .md 文件即可。</p>',
  needsLightbox: true,
  home: {
    essayCount: essays.length,
    articleCount: articles.length,
    updated: dateDot(posts[0] ? posts[0].date : new Date().toISOString()),
  },
});
fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);

// 文章页
for (const p of posts) {
  const raw = fs.readFileSync(path.join(contentDir, p.slug + '.md'), 'utf8');
  const rendered = fixImageSrc(md.render(raw), '../');
  // 随笔详情页：图片九宫格 + 灯箱；文章详情页：自然流展示
  const bodyHtml = p.isEssay ? groupImages(rendered) : rendered;
  const typeLabel = p.isEssay ? '随笔' : '文章';
  // 随笔标题就是文件名（常带日期数字），详情页标题改用类型 + 日期，更干净
  const pageHeading = p.isEssay ? `${typeLabel} · ${dateDot(p.date)}` : displayTitle(p.title);
  const postHtml = `<article class="post-full">
  <div class="entry-meta">${showDate ? `<time datetime="${p.date.slice(0, 10)}">${dateDot(p.date)}</time>` : ''}<span class="tag">${typeLabel}</span></div>
  <div class="md-body">${bodyHtml}</div>
  <a class="back" href="../index.html">← 返回列表</a>
</article>`;
  fs.writeFileSync(path.join(distDir, 'posts', p.slug + '.html'), page({
    title: `${pageHeading} · ${site.name || '我的博客'}`,
    body: postHtml,
    rootPrefix: '../',
    needsLightbox: p.isEssay,
    compact: {
      heading: pageHeading,
      label: showDate ? `${typeLabel} / ${dateDot(p.date)}` : typeLabel,
    },
  }));
}

console.log(`✔ 构建完成：${posts.length} 篇文章 + ${imgCount} 张图片 → dist/（模板：${tplName}）`);
console.log(`  - 列表页：index.html`);
console.log(`  - 文章页：${posts.map(p => 'posts/' + p.slug + '.html').join('、')}`);
