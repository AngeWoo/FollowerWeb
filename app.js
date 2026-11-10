const TABS = ['notice', 'calendar', 'download'];
const fmt = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function show(tab) {
  if (!TABS.includes(tab)) tab = 'notice';
  TABS.forEach(t => {
    document.getElementById(t).classList.toggle('on', t === tab);
    document.querySelector(`nav a[data-tab=${t}]`).classList.toggle('on', t === tab);
  });
  document.getElementById('crumb').textContent = document.querySelector(`nav a[data-tab=${tab}]`).textContent.replace(/\s/g, '');
}
const hashParts = () => { const h = decodeURIComponent(location.hash.slice(1)), i = h.indexOf('/');
  return i < 0 ? [h, ''] : [h.slice(0, i), h.slice(i + 1)]; };
window.addEventListener('hashchange', () => { const [t, f] = hashParts(); show(t); if (f) openByHash(); else closeModal(); });

function render(sec, items) {
  const ul = document.querySelector(`#${sec} .list`);
  if (items === null) { ul.innerHTML = '<li class="empty">無法讀取檔案清單<br><small>' + esc(ERRS[sec] || '') + '</small><br><small>請確認伺服器已開啟 DOC 目錄瀏覽，或已上傳 DOC/manifest.json</small></li>'; return; }
  if (!items.length) { ul.innerHTML = '<li class="empty">目前沒有檔案</li>'; return; }
  ul.innerHTML = items.map(i => `<li>
    <a class="pv" href="${i.path}" data-p="${esc(i.path)}" data-f="${esc(i.file)}" data-s="${sec}">${esc(i.name)}</a>
    <span class="btns"><a class="dl" href="${i.path}" download="${esc(i.file)}">下載 ${i.ext === 'pdf' ? 'PDF' : 'Word'}</a></span></li>`).join('');
}

// 讀取 DOC/<區>/ 的目錄瀏覽清單（IIS Directory Browsing / Nginx autoindex 皆可）
const EXTS = ['pdf', 'doc', 'docx'];
const pad = n => String(n).padStart(2, '0');
async function listDir(sec, root) {
  const base = `${root}${sec}/`;
  const res = await fetch(base + '?_=' + Date.now() + Math.random(), { cache: 'no-store' });   // 強制不用快取
  if (!res.ok) throw new Error(base + ' 回應 HTTP ' + res.status);
  const html = await res.text();
  const items = [], re = /([^<>]*?)<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[2];
    if (/\/$/.test(href) || href.startsWith('?')) continue;          // 略過子資料夾、排序連結
    const file = decodeURIComponent(new URL(href, new URL(base, location.href)).pathname.split('/').pop());
    const ext = (file.split('.').pop() || '').toLowerCase();
    if (!EXTS.includes(ext) || file.startsWith('.')) continue;
    const meta = m[1].match(/(.+?\d{1,2}:\d{2}\s*[AP]M)\s+(\d+)?\s*$/i);   // IIS: 日期 時間 大小
    let date = '', size = meta && meta[2] ? +meta[2] : 0;
    if (meta) { const d = new Date(meta[1].trim()); if (!isNaN(d)) date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    const f = file.match(/^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);       // 檔名開頭 20261110 優先
    if (f) date = `${f[1]}-${f[2]}-${f[3]}`;
    items.push({ name: file.replace(/\.[^.]+$/, ''), file, ext, size, date,
                 path: base + encodeURIComponent(file) });
  }
  items.sort((a, b) => (b.date + b.file).localeCompare(a.date + a.file, 'zh-Hant'));
  return items;
}
// 讀取 JSON 格式清單（優先使用 IIS 動態掃描 list.ashx，備援使用靜態 DOC/manifest.json）
const MANS = {};
async function fromJson(url, sec, root) {
  const man = MANS[url] = MANS[url] || await fetch(url + '?_=' + Date.now() + Math.random(), { cache: 'no-store' }).then(async r => {
    if (!r.ok) throw new Error(url + ' 回應 HTTP ' + r.status);
    try { return await r.json(); } catch (_) { throw new Error(url + ' 非 JSON 回應'); }
  });
  const list = man[sec] || man[sec === 'calendar' ? 'calender' : sec] || [];
  let dir = `${root}${sec}/`;
  if (sec === 'calendar' && list.length) {
    try {
      const r = await fetch(dir + encodeURIComponent(list[0].file), { method: 'HEAD' });
      if (!r.ok) {
        const alt = `${root}calender/`;
        const r2 = await fetch(alt + encodeURIComponent(list[0].file), { method: 'HEAD' });
        if (r2.ok) dir = alt;
      }
    } catch (_) {}
  }
  return list.map(i => {
    const f = i.file.match(/^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);
    return { ...i, date: f ? `${f[1]}-${f[2]}-${f[3]}` : i.date, path: dir + encodeURIComponent(i.file) };
  }).sort((a, b) => (b.date + b.file).localeCompare(a.date + a.file, 'zh-Hant'));
}
// DOC 可能在頁面所在資料夾（DOC/），也可能在網站根目錄（/DOC/），依序嘗試
const ROOTS = ['DOC/', '/DOC/'];
const ERRS = {};
async function load(sec) {
  const errs = [];
  try { return await fromJson('list.ashx', sec, 'DOC/'); } catch (e) { errs.push(e.message); }
  for (const root of ROOTS) {
    for (const dirName of (sec === 'calendar' ? ['calendar', 'calender'] : [sec])) {
      try { const x = await listDir(dirName, root); if (x.length) return x; errs.push(root + dirName + '/ 可讀取，但找不到 pdf/doc/docx 檔'); }
      catch (e) { errs.push(e.message); }
    }
    try { return await fromJson(root + 'manifest.json', sec, root); } catch (e) { errs.push(e.message); }
  }
  ERRS[sec] = [...new Set(errs)].join('；'); return null;
}
const LISTS = {};
Promise.all(TABS.map(t => load(t).then(items => { LISTS[t] = items || []; render(t, items); })))
  .then(() => openByHash());
function openByHash() {
  const [t, f] = hashParts(); if (!f) return;
  const it = (LISTS[t] || []).find(i => i.file === f);
  if (it) preview(it.path, false);
}

show(hashParts()[0]);

// ---- 預覽 ----
const modal = document.getElementById('modal'), mbody = document.getElementById('mbody');
function closeModal() {
  modal.hidden = true; mbody.innerHTML = '';
  if (hashParts()[1]) history.replaceState(null, '', '#' + hashParts()[0]);
}
document.getElementById('mclose').onclick = closeModal;
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

async function preview(path, setHash = true, sec = '', file = '') {
  if (setHash && sec) history.replaceState(null, '', '#' + sec + '/' + file);
  const url = path, ext = path.split('.').pop().toLowerCase();
  const fname = file || decodeURIComponent(path.split('/').pop());
  document.getElementById('mtitle').textContent = fname;
  const dl = document.getElementById('mdl'); dl.href = url; dl.download = fname;
  mbody.innerHTML = '<div class="msg">載入中…</div>';
  modal.hidden = false;
  if (ext === 'pdf') {
    mbody.innerHTML = `<iframe src="${url}"></iframe>`;
  } else if (ext === 'docx' && window.docx) {
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      mbody.innerHTML = '';
      await docx.renderAsync(buf, mbody);
    } catch (err) { mbody.innerHTML = '<div class="msg">預覽失敗，請改用下載。</div>'; }
  } else {
    mbody.innerHTML = '<div class="msg">舊版 .doc 格式無法在網頁預覽，請按右上角「下載」。<br>（另存成 .docx 或 PDF 即可預覽）</div>';
  }
}
document.addEventListener('click', e => {
  const a = e.target.closest('a.pv');
  if (a) { e.preventDefault(); preview(a.dataset.p, true, a.dataset.s, a.dataset.f); }
});
