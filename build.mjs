#!/usr/bin/env node
/**
 * 极简 md 博客构建脚本（零框架）
 * 扫描 content/ 下的 .md 文件 → 生成静态站到 dist/
 * 标题取文件名（支持 "YYYY-MM-DD-标题.md" 命名，日期从文件名解析）
 * 样式：单列阅读流（白底 + 墨色 + 发丝线），写在 build.mjs 里
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
  sans: "'PingFang SC','Hiragino Sans GB','Noto Sans SC','Microsoft YaHei',sans-serif",
  serif: "'Songti SC','Noto Serif SC','Source Han Serif SC','SimSun',serif",
  mono: "'SF Mono','JetBrains Mono','Menlo','Consolas',monospace",
};
const overrides = [];
if (t.bg) overrides.push(`--bg:${t.bg}`);
if (t.text) overrides.push(`--text:${t.text}`);
if (t.font_family && fontStacks[t.font_family]) overrides.push(`--font-family:${fontStacks[t.font_family]}`);
if (t.font_size) overrides.push(`--font-size:${t.font_size}px`);
const tweakCss = overrides.length ? `:root{${overrides.join(';')}}` : '';
const showDate = t.show_date === true;

// ---------- 基础布局 CSS（单列阅读流） ----------
const baseCss = `
:root{--bg:#FFFFFF;--text:#171717;--muted:#8C8C8C;--line:#E8E8E8;--surface:#FAFAFA;--font-family:'PingFang SC','Hiragino Sans GB','Noto Sans SC','Microsoft YaHei',sans-serif;--font-size:16.5px;--sans:'PingFang SC','Hiragino Sans GB','Noto Sans SC','Microsoft YaHei',sans-serif;--serif:'Songti SC','Noto Serif SC','Source Han Serif SC','SimSun',serif;--mono:'SF Mono','JetBrains Mono','Menlo','Consolas',monospace;}
*{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--text);font-family:var(--font-family);font-size:var(--font-size);line-height:1.95;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;text-rendering:optimizeLegibility;}
::selection{background:var(--text);color:var(--bg);}
a{color:inherit;text-decoration:none;}
a:focus-visible,button:focus-visible,.entry:focus-visible{outline:2px solid var(--text);outline-offset:3px;}
img{max-width:100%;}
.skip{position:absolute;left:-9999px;top:0;z-index:200;padding:9px 13px;background:var(--text);color:var(--bg);font-family:var(--mono);font-size:10px;letter-spacing:.08em;}
.skip:focus{left:12px;top:12px;}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}

/* 页面骨架 */
.site{max-width:680px;margin:0 auto;padding:0 24px 40px;}
.site-top{position:sticky;top:0;z-index:20;margin:0 -24px;padding:16px 24px 13px;background:var(--bg);background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);}
.site-top-home{display:flex;flex-direction:column;align-items:flex-start;gap:7px;}
.site-top-compact{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:19px 24px;}
.site-name{font-size:14px;font-weight:500;line-height:1.4;letter-spacing:.01em;white-space:nowrap;}
.site-nav{display:flex;flex-wrap:wrap;width:100%;gap:6px 18px;font-family:var(--sans);font-size:12px;line-height:1.4;letter-spacing:.02em;color:var(--text);}
.site-nav button{font:inherit;letter-spacing:inherit;color:inherit;opacity:.6;background:none;border:0;padding:0;cursor:pointer;white-space:nowrap;transition:opacity .15s ease;}
.site-nav button:hover,.site-nav button.on{opacity:1;}
.site-meta{font-family:var(--mono);font-size:9px;letter-spacing:.11em;color:var(--muted);white-space:nowrap;}

/* 首页单列流 */
.feed{margin-top:6px;}
.entry{padding:42px 0 44px;border-bottom:1px solid var(--line);cursor:pointer;}
.entry:first-child{padding-top:38px;}
.entry-meta{display:flex;align-items:baseline;justify-content:space-between;gap:24px;margin-bottom:17px;font-family:var(--mono);font-size:9px;letter-spacing:.13em;color:var(--muted);}
.entry-meta .cat{color:var(--text);}
.entry-body{max-width:36em;font-size:1em;line-height:1.95;}
.entry:first-child .entry-body{font-size:1.06em;}
.entry-body p{margin:0 0 .9em;}
.entry-body p:last-child{margin-bottom:0;}
.entry h2{margin-bottom:10px;font-size:clamp(22px,3vw,27px);font-weight:600;line-height:1.45;letter-spacing:-.02em;}
.entry .excerpt{max-width:36em;font-size:.91em;line-height:1.85;color:var(--muted);}
.entry .more{display:inline-block;margin-top:16px;font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:var(--text);}
.entry:hover h2{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px;}
.entry .img-grid{margin-top:26px;}
.empty{padding:80px 0;text-align:center;color:var(--muted);font-size:.91em;}

/* 图片网格 */
.img-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.img-grid img{display:block;width:100%;aspect-ratio:1;object-fit:cover;}
.img-grid-4{grid-template-columns:repeat(2,1fr);}
.img-grid-single{grid-template-columns:1fr;justify-items:start;}
.img-grid-single img{width:auto;max-width:100%;height:auto;max-height:480px;object-fit:contain;}

/* 页脚 */
.site-foot{display:flex;justify-content:space-between;gap:24px;padding:28px 0 0;font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--muted);}
.site-foot a:hover{color:var(--text);}

/* 详情页 */
.read{padding:56px 0 8px;}
.read-meta{margin-bottom:26px;font-family:var(--mono);font-size:9px;letter-spacing:.13em;color:var(--muted);}
.post-title{margin:0 0 28px;font-size:clamp(28px,4vw,36px);font-weight:600;line-height:1.35;letter-spacing:-.03em;}
.md-body{font-size:1em;line-height:1.95;}
.md-body h1,.md-body h2,.md-body h3{font-family:var(--sans);font-weight:600;line-height:1.4;letter-spacing:-.02em;margin:1.6em 0 .6em;}
.md-body h1{font-size:1.6em;}
.md-body h2{font-size:1.32em;}
.md-body h3{font-size:1.14em;}
.md-body p{margin:1em 0;}
.md-body blockquote{margin:1.6em 0;padding-left:22px;border-left:1px solid var(--text);color:var(--muted);}
.md-body blockquote p{margin:.6em 0;}
.md-body code{padding:.12em .35em;background:var(--surface);border:1px solid var(--line);font-family:var(--mono);font-size:.86em;}
.md-body pre{margin:1.2em 0;padding:14px 16px;background:var(--surface);border:1px solid var(--line);overflow-x:auto;}
.md-body pre code{padding:0;background:none;border:0;}
.md-body img{max-width:100%;height:auto;margin:1.4em 0;}
.md-body a{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;}
.md-body ul,.md-body ol{margin:1em 0;padding-left:1.6em;}
.md-body li{margin:.3em 0;}
.md-body table{width:100%;border-collapse:collapse;margin:1.4em 0;font-size:.95em;}
.md-body th,.md-body td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;}
.md-body th{font-weight:600;border-bottom-color:var(--text);}
.md-body hr{border:0;border-top:1px solid var(--line);margin:2.2em 0;}
.md-body .img-grid{margin:1.6em 0;}
.md-body .img-grid img{margin:0;aspect-ratio:1;object-fit:cover;}
.md-body .img-grid-single img{margin:0;width:auto;max-width:100%;height:auto;max-height:480px;object-fit:contain;}
.back-link{display:block;width:100%;margin-top:48px;padding-top:18px;border-top:1px solid var(--line);font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:var(--muted);}
.back-link:hover{color:var(--text);}

/* 图片灯箱 */
.lb{position:fixed;inset:0;z-index:99;display:none;align-items:center;justify-content:center;background:rgba(17,17,17,.96);}
.lb.open{display:flex;}
.lb img{width:auto;height:auto;max-width:92vw;max-height:92vh;object-fit:contain;}
.lb-btn{position:absolute;display:flex;align-items:center;justify-content:center;width:42px;height:42px;border:1px solid rgba(255,255,255,.35);background:none;color:#fff;font:300 20px/1 var(--mono);cursor:pointer;}
.lb-btn:hover{background:rgba(255,255,255,.12);}
.lb-btn:active{background:#fff;color:#111;}
.lb-prev{left:14px;top:50%;transform:translateY(-50%);}
.lb-next{right:14px;top:50%;transform:translateY(-50%);}
.lb-close{right:14px;top:14px;font-size:16px;}

@media (max-width:600px){
  .site{padding:0 20px 32px;}
  .site-top{margin:0 -20px;padding:14px 20px 12px;}
  .site-top-compact{padding:16px 20px;}
  .site-name{font-size:13px;}
  .site-nav{width:100%;gap:5px 16px;font-size:12px;letter-spacing:.01em;}
  .site-meta{font-size:8px;}
  .entry{padding:34px 0 36px;}
  .entry:first-child{padding-top:30px;}
  .entry-meta{font-size:8px;gap:16px;}
  .entry:first-child .entry-body{font-size:1em;}
  .entry h2{font-size:21px;}
  .img-grid-single img{max-height:360px;}
  .read{padding:44px 0 8px;}
  .post-title{font-size:26px;}
}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto;}
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;}
}
`;

// ---------- Markdown 渲染 ----------
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

// 把渲染后的正文拆成「图片」和「文字」两部分，用于列表页的排版
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

// 条目右侧的日期；show_date 为 false 时不显示
function entryTime(p) {
  if (!showDate) return '';
  const d = p.date.slice(0, 10);
  return `<time datetime="${d}">${dateDot(p.date)}</time>`;
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

// 分类筛选条：全部 + 各分类（只显示有内容的分类）
function renderCatBar(categories) {
  const buttons = categories
    .map((c, i) => {
      const cat = c.name === '全部' ? '*' : c.name;
      return `<button type="button" data-cat="${esc(cat)}" aria-pressed="${i === 0 ? 'true' : 'false'}"${i === 0 ? ' class="on"' : ''}>${esc(c.name)}</button>`;
    })
    .join('\n      ');
  return `<nav class="site-nav" id="catbar" aria-label="分类筛选">
      ${buttons}
    </nav>`;
}

// 随笔：无标题，正文直接铺开
function renderEssayEntry(e) {
  return `<article class="entry" data-type="essay" data-cat="${esc(e.category)}" ${clickAttrs(e.href)}>
  <div class="entry-meta"><span class="cat">随笔</span>${entryTime(e)}</div>
  <div class="entry-body">${e.textHtml || '<p>（这篇还没有正文）</p>'}</div>
  ${mediaGrid(e.images)}
</article>`;
}

// 文章：分类 + 日期、标题、摘要、阅读全文
function renderArticleEntry(a) {
  return `<article class="entry" data-type="article" data-cat="${esc(a.category)}" ${clickAttrs(`posts/${encodeURI(a.slug)}.html`)}>
  <div class="entry-meta"><span class="cat">${esc(a.category)} · 文章</span>${entryTime(a)}</div>
  <h2>《${esc(displayTitle(a.title))}》</h2>
  ${a.excerpt ? `<p class="excerpt">${esc(a.excerpt)}</p>` : ''}
  <span class="more">阅读全文 →</span>
</article>`;
}

// 列表页：随笔与文章按时间倒序混排成一条流
function renderTimeline(list, essayByFile) {
  const entries = list.map((p) => {
    if (p.isEssay) return renderEssayEntry(essayByFile.get(p.file));
    const raw = fs.readFileSync(p.file, 'utf8');
    return renderArticleEntry({ ...p, excerpt: excerptFromRaw(raw) });
  });
  return `<div class="feed">\n${entries.join('\n')}\n</div>`;
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

// 改名记录：旧路径 → 新路径（取最近一次改名）
// 用于给改过名的文章生成旧地址跳转页
function renameMap() {
  const map = new Map();
  try {
    const log = execSync('git -c core.quotePath=false log --diff-filter=R --name-status --format= -M -- content/', { cwd: root, encoding: 'utf8' });
    for (const line of log.split('\n')) {
      const m = line.match(/^R\d+\t(.+)\t(.+)$/);
      if (m) map.set(m[2].trim(), m[1].trim());
    }
  } catch {
    // 没有 git 历史时忽略
  }
  return map;
}

// 文件名（含路径）→ 站点里的 slug（扁平，只有文件名）
function slugOfPath(p) {
  return path.basename(p).replace(/\.md$/, '');
}

// ---------- 页面骨架 ----------
// rootPrefix：相对站点根的前缀（列表页 ''，文章页 '../'）
// needsLightbox：带图片灯箱（列表页 / 随笔详情页）
// catbar：列表页顶部的分类筛选（放进吸顶栏）
function page(opts) {
  const {
    title,
    body,
    rootPrefix = '',
    needsLightbox = false,
    compact = null,
    catbar = '',
    footRight = '',
  } = opts;

  const year = new Date().getFullYear();
  const siteName = esc(site.name || '我的博客');
  const lightbox = needsLightbox ? `<div class="lb" id="lb">
  <img id="lbImg" src="" alt="">
  <button class="lb-btn lb-prev" type="button" onclick="lbNav(-1)" aria-label="上一张">‹</button>
  <button class="lb-btn lb-next" type="button" onclick="lbNav(1)" aria-label="下一张">›</button>
  <button class="lb-btn lb-close" type="button" onclick="lbClose()" aria-label="关闭">×</button>
</div>
<script>
(function(){
  var imgs = Array.prototype.slice.call(document.querySelectorAll('.entry .img-grid img, .md-body img'));
  if (!imgs.length) return;
  var lb = document.getElementById('lb'), cur = 0;
  function show(i){
    cur = (i + imgs.length) % imgs.length;
    var img = document.getElementById('lbImg');
    img.src = imgs[cur].getAttribute('src');
    img.alt = imgs[cur].getAttribute('alt') || '';
    lb.classList.add('open');
  }
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
  const catFilter = catbar ? `<script>
(function(){
  var bar = document.getElementById('catbar');
  if (!bar) return;
  var entries = Array.prototype.slice.call(document.querySelectorAll('.entry'));

  bar.addEventListener('click', function(ev){
    var btn = ev.target.closest('button');
    if (!btn) return;
    var cat = btn.getAttribute('data-cat');
    Array.prototype.forEach.call(bar.querySelectorAll('button'), function(b){
      var on = b === btn;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    entries.forEach(function(e){
      e.style.display = (cat === '*' || e.getAttribute('data-cat') === cat) ? '' : 'none';
    });
  });
})();
<\/script>` : '';

  const header = compact
    ? `<header class="site-top site-top-compact">
  <h1 class="sr-only">${esc(compact.heading)}</h1>
  <a class="site-name" href="${rootPrefix}index.html">← ${siteName}</a>
  <span class="site-meta">${esc(compact.label)}</span>
</header>`
    : `<header class="site-top site-top-home">
  <a class="site-name" href="${rootPrefix}index.html">${siteName}</a>
  ${catbar}
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
<div class="site">
${header}
  <main id="main">
${body}
  </main>
  <footer class="site-foot">
    <span>© ${year} ${siteName}</span>
    <span>${footRight || '<a href="#top">回到顶部</a>'}</span>
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
// 分类：所在目录就是分类，「随笔」是保留分类（首页展开全文，其余分类走文章条目）
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

const essayByFile = new Map(essays.map((e) => [e.file, e]));

// 分类统计：全部 + 各分类（按条目数从多到少，只保留有内容的分类）
const catCounts = new Map();
for (const p of posts) catCounts.set(p.category, (catCounts.get(p.category) || 0) + 1);
const categories = [
  { name: '全部', count: posts.length },
  ...[...catCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
    .map(([name, count]) => ({ name, count })),
];

const indexBody = renderTimeline(posts, essayByFile);
const indexHtml = page({
  title: `${esc(site.name || '我的博客')}${site.subtitle ? ' · ' + esc(site.subtitle) : ''}`,
  body: indexBody || '<p class="empty">还没有文章。在 content/ 目录新建 .md 文件即可。</p>',
  needsLightbox: true,
  catbar: categories.length > 1 ? renderCatBar(categories) : '',
  footRight: `共 ${posts.length} 篇`,
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
    titleHtml = `<h1 class="post-title">《${esc(pageHeading)}》</h1>`;
  }
  const postHtml = `<article class="read">
  <div class="read-meta">${showDate ? `${esc(catLabel)} / ${dateDot(p.date)}` : esc(catLabel)}</div>
  ${titleHtml}
  <div class="md-body">${bodyHtml}</div>
  <a class="back-link" href="../index.html">← 返回列表</a>
</article>`;
  fs.writeFileSync(path.join(distDir, 'posts', p.slug + '.html'), page({
    title: `${esc(pageHeading)} · ${esc(site.name || '我的博客')}`,
    body: postHtml,
    rootPrefix: '../',
    needsLightbox: p.isEssay,
    compact: {
      heading: pageHeading,
      label: showDate ? `${catLabel} / ${dateDot(p.date)}` : catLabel,
    },
  }));
}

// 旧地址跳转：文件改过名时，给旧 slug 生成一个跳转页（沿改名链回溯所有旧路径）
const renames = renameMap();
let redirectCount = 0;
for (const p of posts) {
  let rel = path.relative(root, p.file);
  while (renames.has(rel)) {
    const oldPath = renames.get(rel);
    const oldSlug = slugOfPath(oldPath);
    if (oldSlug && oldSlug !== p.slug) {
      const target = `${encodeURI(p.slug)}.html`;
      fs.writeFileSync(path.join(distDir, 'posts', `${oldSlug}.html`), `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>页面已移动</title>
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${target}">
</head>
<body>
<p>这篇文章已移动到 <a href="${target}">新地址</a>。</p>
</body>
</html>
`);
      redirectCount++;
    }
    rel = oldPath;
  }
}

console.log(`✔ 构建完成：${posts.length} 篇文章 + ${imgCount} 张图片 → dist/`);
console.log(`  - 列表页：index.html`);
if (redirectCount) console.log(`  - 旧地址跳转页：${redirectCount} 个`);
console.log(`  - 文章页：${posts.map(p => 'posts/' + p.slug + '.html').join('、')}`);
