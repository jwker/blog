#!/usr/bin/env node
/**
 * 极简 md 博客构建脚本（零框架）
 * 扫描 content/ 下的 .md 文件 → 生成静态站到 dist/
 * 标题取文件名（支持 "YYYY-MM-DD-标题.md" 命名，日期从文件名解析）
 * 样式：Riso 孔版印刷（纸面 + 钴蓝 + 荧光粉），写在 build.mjs 里
 * 微调：template.json 驱动（站点信息 + 少量开关）
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
const imagesDir = path.join(root, 'images');

// ---------- 读取配置 ----------
const config = JSON.parse(fs.readFileSync(path.join(root, 'template.json'), 'utf8'));
const site = config.site || {};

// 微调参数 → CSS 变量覆盖
const t = config.tweak || {};
const fontStacks = {
  sans: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
  serif: "'Songti SC','Noto Serif SC','SimSun',serif",
  mono: "'SF Mono','JetBrains Mono',Consolas,monospace",
};
const overrides = [];
if (t.bg) overrides.push(`--bg:${t.bg}`);
if (t.text) overrides.push(`--text:${t.text}`);
if (t.font_family && fontStacks[t.font_family]) overrides.push(`--font-family:${fontStacks[t.font_family]}`);
if (t.font_size) overrides.push(`--font-size:${t.font_size}px`);
const tweakCss = overrides.length ? `:root{${overrides.join(';')}}` : '';
const showDate = t.show_date === true;

// ---------- 基础布局 CSS（Riso 孔版） ----------
const baseCss = `
:root{--bg:#f2efe4;--text:#151517;--muted:#5d5b53;--ink:var(--text);--paper:var(--bg);--pink:#ff4f7e;--cobalt:#2340c8;--card-bg:#151517;--card-fg:#f2efe4;--font-family:'Songti SC','Noto Serif SC','SimSun',serif;--font-size:17px;--sans:'PingFang SC','Hiragino Sans GB','Noto Sans SC','Microsoft YaHei',sans-serif;--serif:'Songti SC','Noto Serif SC','SimSun',serif;--mono:'SF Mono','JetBrains Mono','Menlo','Consolas',monospace;}
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
.hero{position:relative;margin-top:48px;padding:44px 46px 46px;border:2px solid var(--ink);background:var(--pink);color:#151517;box-shadow:9px 9px 0 var(--ink);overflow:hidden;cursor:pointer;}
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
.cobalt-panel{position:relative;padding:34px 36px 38px;border:2px solid var(--ink);background:var(--cobalt);color:#f2efe4;box-shadow:9px 9px 0 var(--pink);}
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
.article-strip{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:22px;padding:26px 28px;border:2px solid var(--ink);background:var(--card-bg);color:var(--card-fg);box-shadow:9px 9px 0 var(--pink);transition:transform .15s ease;}
.article-strip:hover{transform:translate(-2px,-2px);}
.article-strip .label{padding:5px 9px;background:var(--pink);color:var(--ink);font-family:var(--mono);font-size:10px;letter-spacing:.08em;}
.article-strip h2{margin:0;font-family:var(--sans);font-size:clamp(19px,2.2vw,27px);font-weight:800;line-height:1.4;letter-spacing:-.01em;}
.article-strip time{font-family:var(--mono);font-size:10px;color:rgba(242,239,228,.62);white-space:nowrap;}

/* 分类筛选条 */
.catbar{display:flex;flex-wrap:wrap;gap:10px;margin-top:38px;padding-bottom:18px;border-bottom:2px solid var(--ink);}
.catbar button{font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--muted);background:none;border:1.5px solid var(--ink);padding:5px 11px;cursor:pointer;}
.catbar button span{opacity:.55;}
.catbar button:hover{color:var(--cobalt);}
.catbar button.on{background:var(--pink);color:var(--ink);}

/* 首页时间轴：随笔与文章按时间顺序混排 */
.timeline{margin-top:30px;}
.entry{margin-bottom:30px;}
.entry .date{font-family:var(--mono);font-size:10px;letter-spacing:.06em;color:var(--muted);}
.essay{display:block;padding:4px 0 6px 22px;border-left:4px solid var(--pink);}
.essay .meta{display:flex;align-items:center;gap:12px;margin-bottom:8px;}
.essay .tag{display:inline-block;padding:1px 7px;border:1.5px solid var(--pink);color:var(--cobalt);font-family:var(--mono);font-size:9px;letter-spacing:.1em;}
.essay:hover .tag{background:var(--pink);color:var(--ink);}
.essay .body p{margin:0 0 .8em;max-width:44em;font-size:17px;line-height:1.85;}
.essay .body p:last-child{margin-bottom:0;}
.essay .body a{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;}
.essay .img-grid-single img{max-height:420px;width:auto;max-width:100%;}
.article{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:22px;padding:26px 28px;border:2px solid var(--ink);background:var(--card-bg);color:var(--card-fg);box-shadow:9px 9px 0 var(--cobalt);transition:transform .15s ease;}
.article:hover{transform:translate(-2px,-2px);}
.article .lead{display:flex;flex-direction:column;align-items:flex-start;gap:7px;}
.article .lead .date{color:rgba(242,239,228,.55);}
.article .tag{padding:5px 9px;background:var(--pink);color:var(--ink);font-family:var(--mono);font-size:9px;letter-spacing:.1em;}
.article .main{display:flex;flex-direction:column;gap:8px;min-width:0;}
.article .title{font-family:var(--sans);font-size:clamp(20px,2.3vw,28px);font-weight:800;line-height:1.35;letter-spacing:-.01em;}
.article .excerpt{display:block;font-size:15px;line-height:1.7;color:rgba(242,239,228,.7);}
.article .more{font-family:var(--mono);font-size:10px;letter-spacing:.08em;white-space:nowrap;color:var(--pink);}
.article .more::before{content:"▸";margin-right:6px;}

/* 页脚 */
.foot{display:flex;align-items:baseline;justify-content:space-between;gap:24px;margin-top:44px;padding:16px 0 36px;border-top:2px solid var(--ink);font-family:var(--mono);font-size:10px;color:var(--muted);}
.foot a:hover{color:var(--cobalt);}

/* 详情页 */
.masthead-compact .topline{border-bottom-width:2px;}
.post-main{padding-top:54px;}
.post-full{max-width:900px;border-top:2px solid var(--ink);padding-top:26px;padding-bottom:8px;}
.post-full .entry-meta{margin-bottom:30px;}
.post-full .post-title{margin:0 0 26px;font-family:var(--sans);font-size:clamp(28px,4vw,42px);font-weight:900;line-height:1.25;letter-spacing:-.02em;}
.post-full .post-title + .md-body > h1:first-child{margin-top:0;}
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
  .article{grid-template-columns:1fr;gap:12px;align-items:start;}
  .essay{padding-left:16px;}
  .img-grid{max-width:100%;}
  .img-grid-single{max-width:60%;}
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

// 正则元字符转义（拼正则时用）
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// 取文件最后一次改内容的提交时间（git，完整 ISO 含时分秒），拿不到返回 null
// --follow 追踪改名，--diff-filter=AM 跳过纯改名提交，文件移目录后日期不变
function gitDate(f) {
  try {
    const iso = execSync(`git log -1 --follow --diff-filter=AM --format=%cI -- "${f}"`, { cwd: root, encoding: 'utf8' }).trim();
    return iso || null;
  } catch {
    return null;
  }
}

function parseFile(f) {
  const rel = path.relative(contentDir, f).replace(/\.md$/, '');
  const base = path.basename(f, '.md');
  // 分类 = 文件所在的一级目录；直接放在 content/ 根目录的归入「未分类」
  const parts = rel.split('/');
  const category = parts.length > 1 ? parts[0] : '未分类';
  // 兼容：文件名带日期前缀（YYYY-MM-DD-标题.md）时仍解析
  const m = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  if (m) return { date: m[1] + 'T00:00:00', title: m[2], slug: base, category, file: f };
  // 常规：标题 = 文件名，日期 = 该文件最后改内容的提交时间
  const g = gitDate(f);
  if (g) return { date: g, title: base, slug: base, category, file: f };
  // 兜底：未提交过的文件用修改时间
  return { date: fs.statSync(f).mtime.toISOString(), title: base, slug: base, category, file: f };
}

// 首页布局：timeline（默认，按时间顺序混排随笔与文章）/ classic（旧版分块排版）
const homeLayout = t.home_layout === 'classic' ? 'classic' : 'timeline';

// ---------- 首页：时间轴 ----------
// 条目右侧的时间戳；show_date 为 false 时不显示
function entryTime(p) {
  if (!showDate) return '';
  const d = p.date.slice(0, 10);
  const hm = p.date.slice(11, 16);
  return `<time class="date" datetime="${d}T${hm}">${dateDot(p.date)} ${hm}</time>`;
}

// 文章摘要：取正文第一段（跳过标题、图片、代码块），过长截断
function excerptFromRaw(raw, max = 78) {
  for (const block of raw.split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t || t.startsWith('#') || t.startsWith('![') || t.startsWith('```')) continue;
    const clean = t
      .replace(/^[-*+>\s]+/, '')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`>#]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (clean.length > 4) return clean.length > max ? clean.slice(0, max) + '…' : clean;
  }
  return '';
}

// 随笔：无标题，正文直接铺在页面里
function renderEssayEntry(e) {
  const body = e.textHtml || '<p>（这篇还没有正文）</p>';
  return `<article class="entry" data-type="essay" data-cat="${e.category}">
  <a class="essay" href="${e.href}">
    <span class="meta"><span class="tag">随笔</span>${entryTime(e)}</span>
    <div class="body">${body}</div>
    ${mediaGrid(e.images)}
  </a>
</article>`;
}

// 文章：黑卡，标题 + 摘要 + 阅读全文
function renderArticleEntry(a) {
  return `<article class="entry" data-type="article" data-cat="${a.category}">
  <a class="article" href="posts/${encodeURI(a.slug)}.html">
    <span class="lead"><span class="tag">文章</span>${entryTime(a)}</span>
    <span class="main">
      <span class="title">《${displayTitle(a.title)}》</span>
      ${a.excerpt ? `<span class="excerpt">${a.excerpt}</span>` : ''}
    </span>
    <span class="more">阅读全文</span>
  </a>
</article>`;
}

// 分类筛选条：全部 + 每个分类，点击在前端过滤条目
function renderCatBar(categories) {
  if (categories.length <= 1) return '';
  const buttons = categories
    .map((c) => `<button type="button" data-cat="${c.name === '全部' ? '*' : c.name}"${c.name === '全部' ? ' class="on"' : ''}>${c.name} <span>${c.count}</span></button>`)
    .join('\n      ');
  return `<nav class="catbar" id="catbar" aria-label="分类筛选">
      ${buttons}
    </nav>`;
}

// 列表页：随笔与文章按时间倒序混排成一条流
function renderTimeline(list, essayByFile) {
  const entries = list.map((p) => {
    if (p.isEssay) return renderEssayEntry(essayByFile.get(p.file));
    const raw = fs.readFileSync(p.file, 'utf8');
    return renderArticleEntry({ ...p, excerpt: excerptFromRaw(raw) });
  });
  return `<div class="timeline">\n${entries.join('\n')}\n</div>`;
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
    img.addEventListener('click', function(ev){ ev.stopPropagation(); ev.preventDefault(); show(i); });
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

  // 分类筛选：点分类按钮过滤首页条目（纯前端，不生成额外页面）
  const catFilter = home && home.hasCatBar ? `<script>
(function(){
  var bar = document.getElementById('catbar');
  if (!bar) return;
  var entries = Array.prototype.slice.call(document.querySelectorAll('.entry'));
  bar.addEventListener('click', function(ev){
    var btn = ev.target.closest('button');
    if (!btn) return;
    var cat = btn.getAttribute('data-cat');
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function(b){
      b.classList.toggle('on', b === btn);
    });
    entries.forEach(function(e){
      e.style.display = (cat === '*' || e.getAttribute('data-cat') === cat) ? '' : 'none';
    });
  });
})();
<\/script>` : '';

  // 顶部导航：旧版分块排版才需要「随笔 / 文章」两个锚点
  const navHtml = home && home.layout === 'classic'
    ? `${home.essayCount ? '<a href="#essays">随笔</a>' : ''}${home.articleCount ? '<a href="#articles">文章</a>' : ''}`
    : '';

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
    ${navHtml ? `<nav aria-label="主导航">${navHtml}</nav>` : ''}
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
${baseCss}
${tweakCss}
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
${catFilter}
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
  return html.replace(/src="(?:\.\.\/)*\/?images\//g, rootPrefix ? `src="${rootPrefix}images/` : 'src="images/');
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
// 分类：所在目录就是分类，「随笔」是保留分类（首页展开全文，其余分类走黑卡）
for (const p of posts) p.isEssay = p.category === '随笔';
// slug 重名时（如不同分类下同名文件）用分类名做前缀
const usedSlugs = new Map();
for (const p of posts) {
  if (usedSlugs.has(p.slug)) p.slug = `${p.category}-${p.slug}`;
  usedSlugs.set(p.slug, p);
}

const essays = posts.filter(p => p.isEssay).map((p) => {
  const raw = fs.readFileSync(p.file, 'utf8');
  const rendered = fixImageSrc(md.render(raw), '');
  return {
    ...p,
    href: `posts/${encodeURI(p.slug)}.html`,
    ...splitRendered(rendered),
  };
});
const articles = posts.filter(p => !p.isEssay);

// 列表页：默认按时间顺序混排（timeline）；classic 走旧的杂志式分块排版
const listBlocks = [];
const gridItems = [];

if (homeLayout === 'classic') {
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
}

const essayByFile = new Map(essays.map((e) => [e.file, e]));

// 分类统计：全部 + 每个分类（按条目数从多到少）
const catCounts = new Map();
for (const p of posts) catCounts.set(p.category, (catCounts.get(p.category) || 0) + 1);
const categories = [
  { name: '全部', count: posts.length },
  ...[...catCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .map(([name, count]) => ({ name, count })),
];

const indexBody = homeLayout === 'classic'
  ? [...listBlocks, renderGrid(gridItems), renderArticles(articles)].filter(Boolean).join('\n')
  : [renderCatBar(categories), renderTimeline(posts, essayByFile)].filter(Boolean).join('\n');

const indexHtml = page({
  title: `${site.name || '我的博客'}${site.subtitle ? ' · ' + site.subtitle : ''}`,
  body: indexBody || '<p style="color:var(--muted)">还没有文章。在 content/ 目录新建 .md 文件即可。</p>',
  needsLightbox: true,
  home: {
    layout: homeLayout,
    hasCatBar: homeLayout === 'timeline' && categories.length > 1,
    essayCount: essays.length,
    articleCount: articles.length,
    updated: dateDot(posts[0] ? posts[0].date : new Date().toISOString()),
  },
});
fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);

// 文章页
for (const p of posts) {
  const raw = fs.readFileSync(p.file, 'utf8');
  const rendered = fixImageSrc(md.render(raw), '../');
  // 随笔详情页：图片九宫格 + 灯箱；文章详情页：自然流展示
  let bodyHtml = p.isEssay ? groupImages(rendered) : rendered;
  // 详情页标签：随笔显示「随笔」，其他分类显示分类名
  const typeLabel = p.isEssay ? '随笔' : '文章';
  const catLabel = p.isEssay ? '随笔' : p.category;
  // 随笔标题就是文件名（常带日期数字），详情页标题改用类型 + 日期，更干净
  const pageHeading = p.isEssay ? `${typeLabel} · ${dateDot(p.date)}` : displayTitle(p.title);
  // 文章详情页：正文前加标题；若正文开头有一级标题且与标题相同则去掉，避免重复
  let titleHtml = '';
  if (!p.isEssay) {
    bodyHtml = bodyHtml.replace(new RegExp(`^<h1>${escapeRegExp(pageHeading)}</h1>\\s*`), '');
    titleHtml = `<h1 class="post-title">《${pageHeading}》</h1>`;
  }
  const postHtml = `<article class="post-full">
  <div class="entry-meta">${showDate ? `<time datetime="${p.date.slice(0, 10)}">${dateDot(p.date)}</time>` : ''}<span class="tag">${catLabel}</span></div>
  ${titleHtml}
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
      label: showDate ? `${catLabel} / ${dateDot(p.date)}` : catLabel,
    },
  }));
}

console.log(`✔ 构建完成：${posts.length} 篇文章 + ${imgCount} 张图片 → dist/`);
console.log(`  - 列表页：index.html`);
console.log(`  - 文章页：${posts.map(p => 'posts/' + p.slug + '.html').join('、')}`);
