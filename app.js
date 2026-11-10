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
    <span class="btns"><a class="dl" href="${i.path}" download>下載 ${i.ext === 'pdf' ? 'PDF' : 'Word'}</a></span></li>`).join('');
}

// 讀取 DOC/<區>/ 的目錄瀏覽清單（IIS Directory Browsing / Nginx autoindex 皆可）
const EXTS = ['pdf', 'doc', 'docx'];
const pad = n => String(n).padStart(2, '0');
async function listDir(sec) {
  const base = `DOC/${sec}/`;
  const res = await fetch(base + '?' + Date.now());
  if (!res.ok) throw new Error('目錄 ' + base + ' 回應 HTTP ' + res.status);
  const html = await res.text();
  const items = [], re = /([^<>]*?)<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[2];
    if (/\/$/.test(href) || href.startsWith('?')) continue;          // 略過子資料夾、排序連結
    const file = decodeURIComponent(new URL(href, location.origin + '/' + base).pathname.split('/').pop());
    const ext = (file.split('.').pop() || '').toLowerCase();
    if (!EXTS.includes(ext) || file.startsWith('.')) continue;
    const meta = m[1].match(/(.+?\d{1,2}:\d{2}\s*[AP]M)\s+(\d+)?\s*$/i);   // IIS: 日期 時間 大小
    let date = '', size = meta && meta[2] ? +meta[2] : 0;
    if (meta) { const d = new Date(meta[1].trim()); if (!isNaN(d)) date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    const f = file.match(/^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);       // 檔名開頭 20261110 優先
    if (f) date = `${f[1]}-${f[2]}-${f[3]}`;
    items.push({ name: file.replace(/\.[^.]+$/, ''), file, ext, size, date,
                 path: base + file.replace(/[%#?]/g, encodeURIComponent) });
  }
  items.sort((a, b) => (b.date + b.file).localeCompare(a.date + a.file, 'zh-Hant'));
  return items;
}
// 備援清單：DOC/manifest.json（在本機執行「更新清單.command」產生，連同檔案一起上傳）
let MAN;
async function fromManifest(sec) {
  MAN = MAN || await fetch('DOC/manifest.json?' + Date.now()).then(r => { if (!r.ok) throw new Error('manifest.json 回應 HTTP ' + r.status); return r.json(); });
  return (MAN[sec] || []).map(i => {
    const f = i.file.match(/^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);
    return { ...i, date: f ? `${f[1]}-${f[2]}-${f[3]}` : i.date, path: `DOC/${sec}/` + i.file.replace(/[%#?]/g, encodeURIComponent) };
  }).sort((a, b) => (b.date + b.file).localeCompare(a.date + a.file, 'zh-Hant'));
}
// 每次載入/重新整理都重新讀目錄；目錄瀏覽不可用時才退回 manifest.json
const ERRS = {};
const load = sec => listDir(sec)
  .then(x => x.length ? x : Promise.reject(new Error('目錄可讀取，但找不到 pdf/doc/docx 檔')))
  .catch(e1 => fromManifest(sec).catch(e2 => { ERRS[sec] = e1.message + '；' + e2.message; return null; }));
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

async function preview(path, setHash = true) {
  if (setHash) { const p = path.split('/'); history.replaceState(null, '', '#' + p[1] + '/' + decodeURIComponent(p.slice(2).join('/'))); }
  const url = path, ext = path.split('.').pop().toLowerCase();
  document.getElementById('mtitle').textContent = decodeURIComponent(path.split('/').pop());
  const dl = document.getElementById('mdl'); dl.href = url;
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
  if (a) { e.preventDefault(); preview(a.dataset.p); }
});
