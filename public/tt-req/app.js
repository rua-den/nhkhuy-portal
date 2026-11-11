/* tt-req frontend — vanilla js, no build step */
'use strict';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const ASSERT_OPS = ['equals', 'not_equals', 'contains', 'not_contains', 'regex', 'gt', 'lt', 'empty', 'not_empty'];
const EXTRACT_FROM = ['body', 'status', 'time'];

let draft = null;      // job being edited
let runCache = new Map(); // jobId -> runs
let expanded = new Set(); // expanded job cards
let monitorLast = { jobs: [] };
let csrfToken = '';
let importPayload = null;

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(method, url, body) {
  await ready;
  const res = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json', ...(method === 'GET' ? {} : { 'X-CSRF-Token': csrfToken }) },
    body: body != null ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { if (res.status === 401) location.href = '/login.html'; throw Error(data?.error || `Request failed: ${res.status}`); }
  return data;
}

const ready = fetch('/api/auth/me', { cache: 'no-store' }).then(async res => {
  if (!res.ok) throw Error('Authentication required.');
  const data = await res.json();
  csrfToken = data.csrfToken || '';
  if (!csrfToken) throw Error('Authentication required.');
}).catch(() => { location.href = '/login.html'; throw Error('Authentication required.'); });

function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#191920;border:1px solid var(--accent-dim);color:var(--text);padding:8px 18px;border-radius:4px;z-index:999;font-size:12.5px;box-shadow:0 4px 20px rgba(0,0,0,.5)';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 2200);
  t.style.transition = 'none';
}

function ago(ts) {
  if (!ts) return '—';
  const d = Math.floor(Date.now() / 1000 - ts / 1000);
  if (d < 5) return 'vừa xong';
  if (d < 60) return `${d}s trước`;
  if (d < 3600) return `${Math.floor(d / 60)}m trước`;
  if (d < 86400) return `${Math.floor(d / 3600)}h trước`;
  return `${Math.floor(d / 86400)}d trước`;
}
const fmt = (ts) => ts ? new Date(ts).toLocaleString('vi-VN') : '';

// decode \uXXXX (PHP json_encode style) để đọc tiếng Việt: parse lại JSON rồi pretty
function prettySnippet(raw) {
  try {
    const j = JSON.parse(raw);
    return JSON.stringify(j, null, 2);
  } catch (_) {
    return raw;
  }
}

/* ..................... tabs ..................... */
$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.toggle('active', x === t));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === `tab-${t.dataset.tab}`));
  refresh();
}));
$('#btn-new-job').addEventListener('click', () => openEditor(null));

/* ..................... row builders ..................... */
function headerRow(k = '', v = '') {
  return `<div class="h-line">
    <input class="input st-h-k tiny" value="${esc(k)}" placeholder="Header-Name" style="max-width:220px">
    <input class="input st-h-v tiny grow" value="${esc(v)}" placeholder="value">
    <button class="icon-btn" data-del-row>✕</button>
  </div>`;
}
function fieldRow(k = '', v = '') {
  return `<div class="ff-line">
    <input class="input tiny st-ff-k" value="${esc(k)}" placeholder="field_name" style="max-width:220px">
    <input class="input tiny st-ff-v grow" value="${esc(v)}" placeholder="field value">
    <button class="icon-btn" data-del-row>✕</button>
  </div>`;
}
function assertRow(a = {}) {
  return `<div class="a-line">
    <select class="input tiny st-a-target" style="max-width:110px">
      ${['status', 'body', 'time'].map(o => `<option value="${o}" ${a.target === o ? 'selected' : ''}>${o}</option>`).join('')}
    </select>
    <select class="input tiny st-a-op" style="max-width:130px">
      ${ASSERT_OPS.map(o => `<option value="${o}" ${a.op === o ? 'selected' : ''}>${o}</option>`).join('')}
    </select>
    <input class="input tiny st-a-val grow" value="${esc(a.value ?? '')}" placeholder="value / regex / ms…">
    <button class="icon-btn" data-del-row>✕</button>
  </div>`;
}
function extractRow(ex = {}) {
  return `<div class="x-line">
    <input class="input tiny st-x-name" value="${esc(ex.name ?? '')}" placeholder="var={{name}}" style="max-width:140px">
    <select class="input tiny st-x-from" style="max-width:90px">
      ${EXTRACT_FROM.map(o => `<option value="${o}" ${ex.from === o ? 'selected' : ''}>${o}</option>`).join('')}
    </select>
    <input class="input tiny st-x-path grow" value="${esc(ex.path ?? '')}" placeholder="json dot path (data.token)">
    <input class="input tiny st-x-regex" value="${esc(ex.regex ?? '')}" placeholder="regex (optional)" style="max-width:170px">
    <button class="icon-btn" data-del-row>✕</button>
  </div>`;
}

/* generic add-row listeners via data-* (quick send side) */
document.addEventListener('click', (e) => {
  const del = e.target.closest('[data-del-row]');
  if (del) { del.closest('.h-line,.a-line,.x-line,.v-line,.ff-line')?.remove(); return; }
  const t = e.target.closest('[data-add-header],[data-add-assert],[data-add-extract],[data-add-field]');
  if (!t) return;
  if (t.hasAttribute('data-add-header')) {
    $('#q-headers').insertAdjacentHTML('beforeend', headerRow());
  } else if (t.hasAttribute('data-add-assert')) {
    $('#q-asserts').insertAdjacentHTML('beforeend', assertRow());
  } else if (t.hasAttribute('data-add-extract')) {
    $('#q-extract').insertAdjacentHTML('beforeend', extractRow());
  } else if (t.hasAttribute('data-add-field')) {
    $('#q-fields').insertAdjacentHTML('beforeend', fieldRow());
  }
});

/* ..................... collect from DOM ..................... */
function collectRequest(root) {
  const headers = $$('.h-line', root).map(l => ({
    k: $('.st-h-k', l).value.trim(), v: $('.st-h-v', l).value,
  })).filter(h => h.k);
  const formFields = $$('.ff-line', root).map(l => ({
    k: $('.st-ff-k', l).value.trim(), v: $('.st-ff-v', l).value,
  })).filter(f => f.k);
  const asserts = $$('.a-line', root).map(l => ({
    target: $('.st-a-target', l).value,
    op: $('.st-a-op', l).value,
    value: $('.st-a-val', l).value,
  }));
  const extracts = $$('.x-line', root).map(l => ({
    name: $('.st-x-name', l).value.trim(),
    from: $('.st-x-from', l).value,
    path: $('.st-x-path', l).value.trim(),
    regex: $('.st-x-regex', l).value.trim(),
  })).filter(e => e.name && (e.path || e.regex || e.from !== 'body'));
  return { headers, formFields, asserts, extracts };
}

function collectQuick() {
  return {
    method: $('#q-method').value,
    url: $('#q-url').value.trim(),
    body: $('#q-body').value,
    ...collectWraps(),
  };
}
function collectWraps() {
  const asserts = $$('#q-asserts .a-line').map(l => ({
    target: $('.st-a-target', l).value, op: $('.st-a-op', l).value, value: $('.st-a-val', l).value,
  }));
  const headers = $$('#q-headers .h-line').map(l => ({ k: $('.st-h-k', l).value.trim(), v: $('.st-h-v', l).value })).filter(h => h.k);
  const formFields = $$('#q-fields .ff-line').map(l => ({ k: $('.st-ff-k', l).value.trim(), v: $('.st-ff-v', l).value })).filter(f => f.k);
  const extracts = $$('#q-extract .x-line').map(l => ({
    name: $('.st-x-name', l).value.trim(), from: $('.st-x-from', l).value, path: $('.st-x-path', l).value.trim(), regex: $('.st-x-regex', l).value.trim(),
  })).filter(e => e.name && (e.path || e.regex || e.from !== 'body'));
  return { headers, formFields, asserts, extracts };
}

/* ..................... quick send ..................... */
$('#q-method').innerHTML = METHODS.map(m => `<option value="${m}" class="m-${m.toLowerCase()}">${m}</option>`).join('');
$('#q-headers').innerHTML = headerRow('Content-Type', 'application/json');

$('#btn-parse-curl').addEventListener('click', async () => {
  const curl = $('#curl-input').value.trim();
  if (!curl) return toast('⚠ chưa có curl để parse');
  try {
    const out = await api('POST', '/api/tt-req/parse-curl', { curl });
    applyToQuickSend(out.request);
    toast('✓ parsed: ' + out.request.method + ' ' + out.request.url);
  } catch (e) { toast('⚠ ' + e.message); }
});

function fillHeaderRows(host, headers) {
  host.innerHTML = '';
  for (const h of headers || []) host.insertAdjacentHTML('beforeend', headerRow(h.k, h.v));
}
function fillAssertRows(host, asserts) {
  host.innerHTML = '';
  for (const a of asserts || []) host.insertAdjacentHTML('beforeend', assertRow(a));
}
function fillExtractRows(host, extracts) {
  host.innerHTML = '';
  for (const e of extracts || []) host.insertAdjacentHTML('beforeend', extractRow(e));
}
function fillFieldRows(host, fields) {
  host.innerHTML = '';
  for (const f of fields || []) host.insertAdjacentHTML('beforeend', fieldRow(f.k, f.v));
}

function applyToQuickSend(req) {
  $('#q-method').value = req.method || 'GET';
  $('#q-url').value = req.url || '';
  $('#q-body').value = req.body || '';
  fillHeaderRows($('#q-headers'), req.headers?.length ? req.headers : [{ k: 'Content-Type', v: 'application/json' }]);
  fillFieldRows($('#q-fields'), req.formFields);
}

$('#btn-send').addEventListener('click', async () => {
  const req = collectQuick();
  if (!req.url) return toast('⚠ thiếu URL');
  const btn = $('#btn-send');
  btn.disabled = true; btn.textContent = '…sending';
  const box = $('#send-result');
  box.classList.remove('muted-empty');
  box.innerHTML = '<span class="muted">…</span>';
  try {
    const out = await api('POST', '/api/tt-req/send', req);
    if (out.result) EXTRACT_VARS = out.vars || {};
    box.innerHTML = renderResponse(out.result, out.vars);
  } catch (e) { box.textContent = e.message; toast('⚠ ' + e.message); }
  finally { btn.disabled = false; btn.textContent = '▶ SEND'; }
});

let EXTRACT_VARS = {};
function renderResponse(r, vars) {
  if (!r) return 'no result';
  const classS = r.ok ? 's-ok' : 's-err';
  let html = `<div class="resp-statusline">
    <span class="status-badge ${classS}">● ${r.error ? 'ERR ' + r.error : r.status + ' ' + (r.ms + 'ms')}</span>
    <span class="pill ${r.ok ? 'ok' : 'err'}">${r.ok ? 'PASS' : 'FAIL'}</span>
  </div>`;
  for (const a of r.asserts || []) {
    html += `<div class="${a.pass ? 'a-pass' : 'a-fail'}">${a.pass ? '✓' : '✗'} ${esc(assertLabel(a))}</div>`;
  }
  if (Object.keys(vars || {}).length) {
    html += `<div class="resp-section"><h4>extracted</h4>`;
    for (const [k, v] of Object.entries(vars)) html += `<div><span class="json-key">{{${esc(k)}}}</span> = <span class="json-str">${esc(v)}</span></div>`;
    html += `</div>`;
  }
  try {
    const j = JSON.parse(r.body);
    html += `<div class="resp-section"><h4>body (json)</h4><div class="snip">${esc(JSON.stringify(j, null, 2))}</div></div>`;
  } catch (_) {
    if (r.body) html += `<div class="resp-section"><h4>body</h4><div class="snip">${esc(String(r.body).slice(0, 8000))}</div></div>`;
  }
  return html;
}
function assertLabel(a) { return `${a.target || 'value'} ${a.op || ''} ${a.value ?? ''}`.trim(); }

/* ..................... render job cards ..................... */
function firstStepUrl(job) {
  const s = job.steps?.[0];
  return s ? s.url : '';
}

function stepIcon(steps) {
  return (steps || []).map(s => (s.method || 'GET').toLowerCase()).join(' → ');
}

function renderJobCard(job, stats, mode) {
  const last = stats.lastRun;
  const dotCls = !last ? 'never' : last.ok ? 'ok' : 'err';
  const lastPill = last ? `<span class="pill ${last.ok ? 'ok' : 'err'}">${last.ok ? 'OK' : 'FAIL'} ${last.ms}ms</span>` : '<span class="pill idle">chưa chạy</span>';
  const sched = job.enabled && job.intervalSec > 0
    ? `<span>⏱ every <b>${job.intervalSec}s</b></span>`
    : `<span>⏱ manual</span>`;
  const next = job.enabled && job.intervalSec > 0 && job._nextRunAt
    ? `<span>next in <b>${Math.max(0, Math.ceil((job._nextRunAt - Date.now()) / 1000))}s</b></span>` : '';

  const runs = runCache.get(job.id)?.slice(0, 12) || [];
  const runsHtml = expanded.has(job.id) ? `
    <div class="runs-list" data-runs-for="${job.id}">
      ${runs.length ? runs.map(runLineHtml).join('') : '<div class="muted">…</div>'}
    </div>` : '';

  return `<div class="job-card" data-job="${job.id}" data-mode="${mode}">
    <div class="job-card-head" data-toggle-runs>
      <span class="dot ${dotCls}"></span>
      <span class="name">${esc(job.name)}</span>
      ${lastPill}
      ${job.enabled && job.intervalSec > 0 ? '<span class="pill acc">scheduled</span>' : '<span class="pill idle">paused</span>'}
      <span class="muted">▾</span>
    </div>
    <div class="job-card-body">
      <div class="job-url m-code">→ ${esc((job.steps?.[0]?.method || '').toUpperCase())} ${esc(firstStepUrl(job))}</div>
      <div class="job-meta">
        <span>steps: <b>${job.steps?.length || 0}</b> (${esc(stepIcon(job.steps))})</span>
        ${sched}
        ${next}
        <span>ok-rate <b>${stats.okRate == null ? '—' : stats.okRate + '%'}</b></span>
        <span>last: <b>${ago(stats.lastRun?.ts)}</b></span>
      </div>
      ${runsHtml}
    </div>
    <div class="job-foot">
      <button class="btn sm btn-ok" data-act="run">▶ run now</button>
      <button class="btn sm" data-act="toggle">${job.enabled ? '⏸ pause sched' : '⏵ enable sched'}</button>
      <button class="btn sm" data-act="edit">✎ edit</button>
      <button class="btn sm btn-danger" data-act="del">🗑 del</button>
    </div>
  </div>`;
}

function runLineHtml(r) {
  const nsteps = (r.steps || []).length;
  const stMap = (r.steps || []).map(s => `<span class="${s.ok ? 'a-pass' : 'a-fail'}">${s.ok ? '✓' : '✗'}${s.status ?? ''}</span>`).join(' ');
  return `<div class="run-line" data-run-ts="${r.ts}">
    <span class="t">${esc(new Date(r.ts).toLocaleTimeString('vi-VN'))}</span>
    <span class="pill ${r.ok ? 'ok' : 'err'}">${r.ok ? 'OK' : 'FAIL'}</span>
    <!--STEPS-->
    ${stMap}
    <span class="ms">${r.ms}ms · ${nsteps} step · ${r.trigger}</span>
  </div>`;
}

/* remove placeholder comment kept by runLineHtml template */

async function loadRuns(jobId) {
  const out = await api('GET', `/api/tt-req/jobs/${jobId}/runs`);
  runCache.set(jobId, out.runs || []);
}

async function refresh() {
  const jobs = await api('GET', '/api/tt-req/jobs');
  monitorLast.jobs = jobs;
  const monitorHost = $('#monitor-list');
  const joblistHost = $('#joblist');

  const ok = jobs.filter(j => j.stats.lastRun?.ok).length;
  const fail = jobs.filter(j => j.stats.lastRun && !j.stats.lastRun.ok).length;
  $('#monitor-summary').textContent = jobs.length ? `${jobs.length} jobs · ${ok} up · ${fail} down` : '—';
  $('#joblist-summary').textContent = `${jobs.length} job(s)`;

  const html = jobs.map(j => renderJobCard(j, j.stats, 'monitor')).join('');
  monitorHost.innerHTML = html || `<div class="panel muted">trống. bấm <b>+ new job</b> hoặc import curl ở tab <b>send</b></div>`;
  joblistHost.innerHTML = jobs.map(j => renderJobCard(j, j.stats, 'jobs')).join('') || `<div class="panel muted">chưa có job nào</div>`;

  for (const id of expanded) {
    await loadRuns(id);
    const host = $(`[data-runs-for="${id}"]`);
    if (host) host.innerHTML = (runCache.get(id) || []).slice(0, 12).map(runLineHtml).join('') || '<div class="muted">{"chưa": "có run"}</div>';
  }
}

const importFile = $('#job-import-file');
const importResult = $('#job-import-result');
const importConfirm = $('#job-import-confirm');
$('#job-import-preview').addEventListener('click', async () => {
  try {
    const file = importFile.files?.[0];
    if (!file) throw Error('Choose a JSON file first.');
    if (file.size > 32768) throw Error('File exceeds 32 KiB.');
    importPayload = JSON.parse(await file.text());
    const p = await api('POST', '/api/tt-req/import/preview', importPayload);
    importResult.classList.remove('hidden', 'muted-empty');
    importResult.innerHTML = `<b>PREVIEW</b><p>${p.accepted.length} accepted · ${p.skipped.length} skipped · imported jobs start paused.</p>`
      + (p.accepted.length ? `<ul>${p.accepted.map(j => `<li>${esc(j.name)} · ${j.steps} steps</li>`).join('')}</ul>` : '')
      + (p.skipped.length ? `<details><summary>Skipped jobs</summary><ul>${p.skipped.map(j => `<li>${esc(j.name)}: ${esc(j.reason)}</li>`).join('')}</ul></details>` : '');
    importConfirm.disabled = !p.canImport;
  } catch (e) {
    importPayload = null; importConfirm.disabled = true;
    importResult.classList.remove('hidden'); importResult.textContent = e.message;
  }
});
importConfirm.addEventListener('click', async () => {
  if (!importPayload) return;
  try {
    const out = await api('POST', '/api/tt-req/import', importPayload);
    toast(`${out.imported} jobs imported as paused`);
    importPayload = null; importConfirm.disabled = true; importResult.classList.add('hidden'); importFile.value = '';
    await refresh();
  } catch (e) { toast('⚠ ' + e.message); }
});

/* job card interactions */
document.addEventListener('click', async (e) => {
  const card = e.target.closest('.job-card');
  if (!card) return;
  const id = card.dataset.job;
  const act = e.target.closest('[data-act]')?.dataset.act;

  if (act) {
    e.stopPropagation();
    if (act === 'run') {
      toast('… running');
      await api('POST', `/api/tt-req/jobs/${id}/run`);
      loadRuns(id).then(() => { expanded.add(id); refresh(); });
      toast('✓ done — xem history trong card');
    } else if (act === 'toggle') {
      await api('POST', `/api/tt-req/jobs/${id}/toggle`);
      refresh();
    } else if (act === 'edit') {
      const job = monitorLast.jobs.find(j => j.id === id);
      openEditor(job);
    } else if (act === 'del') {
      if (confirm('Xóa job này luôn?')) {
        await api('DELETE', `/api/tt-req/jobs/${id}`);
        refresh();
      }
    }
    return;
  }
  if (e.target.closest('[data-toggle-runs]')) {
    if (expanded.has(id)) { expanded.delete(id); card.querySelector('.runs-list')?.remove(); }
    else {
      expanded.add(id);
      await loadRuns(id);
      const body = card.querySelector('.job-card-body');
      body.insertAdjacentHTML('beforeend', `<div class="runs-list" data-runs-for="${id}">…</div>`);
      const host = $(`[data-runs-for="${id}"]`, card);
      if (host) host.innerHTML = (runCache.get(id) || []).slice(0, 12).map(runLineHtml).join('') || '<div class="muted">chưa có run nào</div>';
    }
    return;
  }
  const rl = e.target.closest('.run-line');
  if (rl) {
    const run = runCache.get(id)?.find(r => String(r.ts) === rl.dataset.runTs);
    if (run) showRunDetail(run);
  }
});

/* auto refresh */
$('#auto-refresh').addEventListener('change', refresh);
setInterval(() => { if ($('#auto-refresh').checked) refresh(); }, 3000);

/* ..................... run detail modal ..................... */
$('#run-close').addEventListener('click', () => $('#run-overlay').classList.add('hidden'));
$('#run-overlay').addEventListener('click', (e) => { if (e.target.id === 'run-overlay') $('#run-overlay').classList.add('hidden'); });

function showRunDetail(run) {
  let html = `<div class="resp-statusline">
      <span class="status-badge ${run.ok ? 's-ok' : 's-err'}">● ${run.ok ? 'OK' : 'FAIL'}</span>
      <span>${fmt(run.ts)}</span><span>${run.ms}ms</span><span class="pill">${run.trigger}</span>
    </div>`;
  (run.steps || []).forEach((s, i) => {
    html += `<div class="step-res">
      <div class="step-res-head">
        <span class="idx" style="color:var(--accent)">step ${i + 1}</span>
        <span class="flex1 ellip"><b>${esc(s.name)}</b> <span class="m-code">${esc(s.method)}</span></span>
        <span class="${s.ok ? 'a-pass' : 'a-fail'}">${s.ok ? '✓' : '✗'}</span>
        ${s.error ? `<span class="pill err">ERR</span>` : `<span class="pill">${s.status}</span>`}
        <span class="muted">${s.ms}ms</span>
      </div>
      ${s.url ? `<div class="muted job-url" style="margin-top:4px">${esc(s.url)}</div>` : ''}
      ${s.error ? `<div class="err-text">✗ ${esc(s.error)}</div>` : ''}
      ${(s.asserts || []).map(a => `<div class="${a.pass ? 'a-pass' : 'a-fail'}">${a.pass ? '✓' : '✗'} ${esc(assertLabel(a))}</div>`).join('')}
      ${s.snippet ? `<div class="snip">${esc(prettySnippet(s.snippet))}</div>` : ''}
    </div>`;
  });
  $('#run-body').innerHTML = html;
  $('#run-overlay').classList.remove('hidden');
}

/* ..................... job editor ..................... */
$('#editor-close').addEventListener('click', closeEditor);
$('#editor-cancel').addEventListener('click', closeEditor);
$('#editor-overlay').addEventListener('click', (e) => { if (e.target.id === 'editor-overlay') closeEditor(); });
$('#e-add-var').addEventListener('click', () => {
  $('#e-variables').insertAdjacentHTML('beforeend', varRow());
});
$('#e-add-step').addEventListener('click', () => {
  const n = $$('#e-steps .step-card').length;
  $('#e-steps').insertAdjacentHTML('beforeend', stepCardHtml({ index: n }));
});
$('#editor-save').addEventListener('click', saveEditor);

function varRow(k = '', v = '') {
  return `<div class="v-line">
    <input class="input tiny e-v-k" value="${esc(k)}" placeholder="token" style="max-width:140px">
    <input class="input tiny e-v-v grow" value="${esc(v)}" placeholder="value">
    <button class="icon-btn" data-del-row>✕</button>
  </div>`;
}

function stepCardHtml({ index, step = {} }) {
  const hdrs = (step.headers?.length ? step.headers : [{ k: 'Content-Type', v: 'application/json' }]);
  return `<div class="step-card" data-step="${index}">
    <div class="step-head">
      <span class="idx">${index + 1}.</span>
      <input class="stepname" value="${esc(step.name || '')}" placeholder="step name…">
      <button class="btn sm btn-ghost" data-curl-step>curl ↷</button>
      <button class="btn sm btn-danger" data-del-step>✕ del</button>
    </div>
    <div class="step-body">
      <div class="row gap">
        <select class="input select tiny st-method">${METHODS.map(m => `<option value="${m}" class="m-${m.toLowerCase()}" ${step.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <input class="input tiny mono st-url grow" value="${esc(step.url || '')}" placeholder="https://…/api (hỗ trợ {{var}})">
      </div>
      <div class="sub-panel">
        <div class="sub-head">headers <button class="btn sm btn-ghost" data-add-header-step>+</button></div>
        <div class="sb-headers">${hdrs.map(h => headerRow(h.k, h.v)).join('')}</div>
      </div>
      <div class="sub-panel">
        <div class="sub-head">body</div>
        <textarea class="input tiny mono st-body" rows="5">${esc(step.body || '')}</textarea>
      </div>
      <div class="sub-panel">
        <div class="sub-head">form-data fields <span style="color:var(--faint)">(-F; text values)</span> <button class="btn sm btn-ghost" data-add-field-step>+</button></div>
        <div class="sb-fields">${(step.formFields || []).map(f => fieldRow(f.k, f.v)).join('')}</div>
      </div>
      <div class="sub-panel">
        <div class="sub-head">assert / checks <button class="btn sm btn-ghost" data-add-assert-step>+</button></div>
        <div class="sb-asserts">${(step.asserts || []).map(assertRow).join('')}</div>
      </div>
      <div class="sub-panel">
        <div class="sub-head">extract → biến cho step sau (dùng <code>{{name}}</code>) <button class="btn sm btn-ghost" data-add-extract-step>+</button></div>
        <div class="sb-extracts">${(step.extract || []).map(extractRow).join('')}</div>
      </div>
    </div>
  </div>`;
}

/* editor delegation */
document.addEventListener('click', async (e) => {
  const sc = e.target.closest('.step-card');
  if (!sc) return;
  if (e.target.closest('[data-del-step]')) {
    e.target.closest('[data-del-step]').closest('.step-card').remove();
    renumberSteps();
    return;
  }
  if (e.target.closest('[data-add-header-step]')) {
    sc.querySelector('.sb-headers').insertAdjacentHTML('beforeend', headerRow());
  } else if (e.target.closest('[data-add-assert-step]')) {
    sc.querySelector('.sb-asserts').insertAdjacentHTML('beforeend', assertRow());
  } else if (e.target.closest('[data-add-extract-step]')) {
    sc.querySelector('.sb-extracts').insertAdjacentHTML('beforeend', extractRow());
  } else if (e.target.closest('[data-add-field-step]')) {
    sc.querySelector('.sb-fields').insertAdjacentHTML('beforeend', fieldRow());
  } else if (e.target.closest('[data-curl-step]')) {
    const curl = prompt('Dán lệnh curl vào đây:');
    if (!curl) return;
    const out = await api('POST', '/api/tt-req/parse-curl', { curl });
    const r = out.request;
    sc.querySelector('.st-method').value = r.method;
    sc.querySelector('.st-url').value = r.url || '';
    sc.querySelector('.st-body').value = r.body || '';
    fillHeaderRows(sc.querySelector('.sb-headers'), r.headers?.length ? r.headers : [{ k: 'Content-Type', v: 'application/json' }]);
    fillFieldRows(sc.querySelector('.sb-fields'), r.formFields);
    fillAssertRows(sc.querySelector('.sb-asserts'), [{ target: 'status', op: 'equals', value: '200' }]);
    toast('✓ curl parsed vào step này');
  }
});

function renumberSteps() {
  $$('#e-steps .step-card').forEach((c, i) => {
    c.querySelector('.idx').textContent = `${i + 1}.`;
  });
}

function openEditor(job) {
  draft = job ? {
    id: job.id,
    name: job.name, enabled: job.enabled, intervalSec: job.intervalSec,
    stopOnFail: job.stopOnFail, variables: job.variables || {},
    steps: job.steps || [],
    lastRunAt: job.lastRunAt, stats: job.stats,
  } : {
    name: '', enabled: true, intervalSec: 60, stopOnFail: true,
    variables: {}, steps: [{ name: '', method: 'GET', url: '', headers: [{ k: 'Content-Type', v: 'application/json' }], body: '', asserts: [{ target: 'status', op: 'equals', value: '200' }], extract: [] }],
  };
  $('#e-name').value = draft.name;
  $('#e-interval').value = draft.intervalSec;
  $('#e-enabled').checked = draft.enabled;
  $('#e-stoponfail').checked = draft.stopOnFail;
  $('#e-variables').innerHTML = Object.entries(draft.variables).map(([k, v]) => varRow(k, v)).join('');
  $('#e-steps').innerHTML = draft.steps.map((s, i) => stepCardHtml({ index: i, step: s })).join('');
  $('#e-meta').textContent = job ? `id: ${job.id} · last run: ${fmt(job.lastRunAt)} · ok-rate: ${job.stats?.okRate ?? '—'}%` : 'job mới — chưa lưu';
  $('#editor-overlay').classList.remove('hidden');
}

function closeEditor() { $('#editor-overlay').classList.add('hidden'); }

async function saveEditor() {
  const steps = $$('#e-steps .step-card').map((c, i) => {
    const { headers, asserts, extracts, formFields } = collectRequest(c);
    return {
      name: c.querySelector('.stepname').value.trim() || `step ${i + 1}`,
      method: c.querySelector('.st-method').value,
      url: c.querySelector('.st-url').value.trim(),
      body: c.querySelector('.st-body').value,
      headers, formFields, asserts, extract: extracts,
    };
  });
  const variables = {};
  $$('#e-variables .v-line').forEach(l => {
    const k = $('.e-v-k', l).value.trim();
    if (k) variables[k] = $('.e-v-v', l).value;
  });
  const body = {
    name: $('#e-name').value.trim() || 'Untitled job',
    enabled: $('#e-enabled').checked,
    intervalSec: Number($('#e-interval').value) || 0,
    stopOnFail: $('#e-stoponfail').checked,
    variables,
    steps,
  };
  if (draft?.id) await api('PUT', `/api/tt-req/jobs/${draft.id}`, body);
  else await api('POST', '/api/tt-req/jobs', body);
  closeEditor();
  toast('💾 saved');
  refresh();
}

/* ..................... boot ..................... */
refresh();
