/* ═══════════════════════════════════════════════════════════
   SHOPEE FULFILLMENT — OPERATIONAL DASHBOARD
   script.js — Main Application Logic
═══════════════════════════════════════════════════════════ */

// ─── GOOGLE APPS SCRIPT CONFIGURATION ───
// Substitua pela URL gerada no deploy do seu Apps Script
const WEBAPP_URL = "COLOCAR_URL_DO_GOOGLE_APPS_SCRIPT_AQUI";

// ─── APP STATE ───
const App = {
  currentUser: null,     // { name, email, loginDate, loginTime }
  currentView: 'form',   // 'form' | 'history' | 'dashboard'
  records: [],           // Array de registros salvos
  charts: {},            // Instâncias Chart.js
  historyFilter: 'all',  // Filtro atual do histórico
  modalRecord: null,     // Registro aberto no modal
};

// ─── DOM REFS ───
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ═══════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  loadRecordsFromStorage();
  checkExistingSession();
  initClock();
  bindLoginEvents();
  bindNavEvents();
  bindFormEvents();
  bindHistoryEvents();
  bindModalEvents();
  bindSidebarEvents();
});

// ─── SESSION ───
function checkExistingSession() {
  const session = sessionStorage.getItem('sf_session');
  if (session) {
    try {
      App.currentUser = JSON.parse(session);
      enterApp();
    } catch (_) {
      showScreen('login');
    }
  } else {
    showScreen('login');
  }
}

function showScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`screen-${name}`).classList.add('active');
}

// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════
function bindLoginEvents() {
  $('btn-login').addEventListener('click', handleLogin);
  $('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  $('login-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-email').focus(); });

  // Mostrar data/hora em tempo real na tela de login
  updateLoginMeta();
}

function updateLoginMeta() {
  const now = new Date();
  $('login-meta-info').textContent =
    `${formatDate(now)} · ${formatTime(now)}`;
  setTimeout(updateLoginMeta, 1000);
}

function handleLogin() {
  const name = $('login-name').value.trim();
  const email = $('login-email').value.trim();

  if (!name) { shake($('login-name')); showToast('Informe seu nome completo.', 'error'); return; }
  if (!email || !isValidEmail(email)) { shake($('login-email')); showToast('Informe um e-mail válido.', 'error'); return; }

  const now = new Date();
  App.currentUser = {
    name,
    email,
    loginDate: formatDate(now),
    loginTime: formatTime(now),
  };

  sessionStorage.setItem('sf_session', JSON.stringify(App.currentUser));
  enterApp();
}

function enterApp() {
  const u = App.currentUser;

  // Atualizar UI com dados do usuário
  $('user-name-sidebar').textContent = u.name;
  $('user-email-sidebar').textContent = u.email;

  const initials = getInitials(u.name);
  $('user-avatar-sidebar').textContent = initials;
  $('user-avatar-top').textContent = initials;

  showScreen('app');
  navigateTo('form');
}

$('btn-logout') && $('btn-logout').addEventListener('click', () => {
  sessionStorage.removeItem('sf_session');
  App.currentUser = null;
  // Limpar campos de login
  $('login-name').value = '';
  $('login-email').value = '';
  showScreen('login');
});

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function bindNavEvents() {
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      navigateTo(view);
      closeSidebar();
    });
  });
}

function navigateTo(view) {
  App.currentView = view;

  // Update nav items
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));

  // Update views
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`view-${view}`).classList.add('active');

  // Update topbar title
  const titles = { form: 'Registro de Turno', history: 'Histórico', dashboard: 'Dashboard' };
  $('topbar-title').textContent = titles[view] || '';

  // Init dashboard on navigate
  if (view === 'dashboard') renderDashboard();
  if (view === 'history') renderHistory();
}

// ═══════════════════════════════════════════
// SIDEBAR MOBILE
// ═══════════════════════════════════════════
function bindSidebarEvents() {
  $('hamburger').addEventListener('click', openSidebar);
  $('sidebar-close').addEventListener('click', closeSidebar);
  $('sidebar-overlay').addEventListener('click', closeSidebar);
}

function openSidebar() {
  $('sidebar').classList.add('open');
  $('sidebar-overlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('visible');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════
function initClock() {
  function tick() {
    const now = new Date();
    $('topbar-datetime').innerHTML =
      `${formatDate(now)}<br>${formatTime(now)}`;
  }
  tick();
  setInterval(tick, 1000);
}

// ═══════════════════════════════════════════
// FORMULÁRIO — ÁREA SECTIONS
// ═══════════════════════════════════════════
function bindFormEvents() {
  // Show/hide sections by area
  $('f-area').addEventListener('change', () => {
    const area = $('f-area').value;
    showAreaSection(area);
  });

  // Live indicator bars
  ['ob-net', 'ob-cot', 'ob-abs', 'ob-idle', 'ob-fs', 'ob-sf',
   'ib-ola', 'ib-abs', 'ib-idle',
   'inv-av',
   'qual-rr', 'qual-ola'].forEach(key => {
    const metaEl = $(`${key}-meta`);
    const realEl = $(`${key}-real`);
    if (metaEl) metaEl.addEventListener('input', () => updateBar(key));
    if (realEl) realEl.addEventListener('input', () => updateBar(key));
  });

  // Generate executive summary
  $('btn-generate-exec').addEventListener('click', generateExecutiveSummary);

  // Save
  $('btn-save').addEventListener('click', saveRecord);

  // Clear
  $('btn-clear').addEventListener('click', () => {
    if (confirm('Limpar todos os campos do formulário?')) clearForm();
  });
}

function showAreaSection(area) {
  const sections = { 'Outbound': 'outbound', 'Inbound': 'inbound', 'Inventário': 'inventario', 'Qualidade': 'qualidade' };
  // Hide all
  $$('.area-section').forEach(s => s.classList.add('hidden'));
  // Show selected
  if (sections[area]) {
    $(`section-${sections[area]}`).classList.remove('hidden');
  }
}

function updateBar(key) {
  const meta = parseFloat($(`${key}-meta`)?.value) || 0;
  const real = parseFloat($(`${key}-real`)?.value) || 0;
  const bar = $(`bar-${key}`);
  if (!bar) return;

  const pct = meta > 0 ? Math.min((real / meta) * 100, 100) : 0;
  bar.style.width = `${pct}%`;

  // Color by performance vs meta
  bar.className = 'indicator-bar';
  const ratio = meta > 0 ? real / meta : 0;

  // ABS, Idle, RR, AV: lower is better
  const lowerIsBetter = ['ob-abs', 'ob-idle', 'ib-abs', 'ib-idle', 'qual-rr', 'inv-av'];
  if (lowerIsBetter.includes(key)) {
    if (ratio <= 1) bar.classList.add(''); // green by default
    else if (ratio <= 1.2) bar.classList.add('warn');
    else bar.classList.add('crit');
  } else {
    if (ratio >= 1) bar.classList.add(''); // green
    else if (ratio >= 0.9) bar.classList.add('warn');
    else bar.classList.add('crit');
  }
}

// ═══════════════════════════════════════════
// RESUMO EXECUTIVO AUTOMÁTICO
// ═══════════════════════════════════════════

// Helpers para formatação executiva
function kpi(label, real, meta, lowerIsBetter = false) {
  if (!real && !meta) return null;
  const r = parseFloat(real);
  const m = parseFloat(meta);
  const ok = lowerIsBetter ? r <= m : r >= m;
  const icon = ok ? '✅' : '⚠️';
  if (meta) return `• ${label}: ${real}% / meta ${meta}% ${icon}`;
  return `• ${label}: ${real}%`;
}
function labor(label, start, oficial, realizado) {
  const parts = [];
  if (start)     parts.push(`Start ${start}`);
  if (oficial)   parts.push(`Oficial ${oficial}`);
  if (realizado) parts.push(`Realizado ${realizado}`);
  if (!parts.length) return null;
  return `• ${label}: ${parts.join(' · ')}`;
}

function generateExecutiveSummary() {
  const area  = $('f-area').value;
  const turno = $('f-turno').value;

  if (!area || !turno) {
    showToast('Selecione a Área e o Turno antes de gerar o resumo.', 'error');
    return;
  }

  const now = new Date();
  const lines = [];

  // ── Cabeçalho ──
  lines.push(`Resumo Executivo — ${area} | ${turno} | ${formatDate(now)}`);
  lines.push('');

  if (area === 'Outbound') {
    lines.push(`OUTBOUND — Turno ${turno}`);
    lines.push('');

    // Labor — só números, sem contextualização
    const ck = labor('Checking', $('ob-ck-start').value, $('ob-ck-oficial').value, $('ob-ck-realizado').value);
    const pk = labor('Picking',  $('ob-pk-start').value, $('ob-pk-oficial').value, $('ob-pk-realizado').value);
    if (ck) lines.push(ck);
    if (pk) lines.push(pk);

    if (ck || pk) lines.push('');

    // KPIs
    const net = kpi('NET',          $('ob-net-real').value,  $('ob-net-meta').value);
    const cot = kpi('COT',          $('ob-cot-real').value,  $('ob-cot-meta').value);
    const abs = kpi('ABS',          $('ob-abs-real').value,  $('ob-abs-meta').value,  true);
    const idl = kpi('Idle',         $('ob-idle-real').value, $('ob-idle-meta').value, true);
    const fs  = kpi('Fast Start',   $('ob-fs-real').value,   $('ob-fs-meta').value);
    const sf  = kpi('Strong Finish',$('ob-sf-real').value,   $('ob-sf-meta').value);

    [net, cot, abs, idl, fs, sf].forEach(l => { if (l) lines.push(l); });

  } else if (area === 'Inbound') {
    lines.push(`INBOUND — Turno ${turno}`);
    lines.push('');

    const pt = labor('Putaway', $('ib-pt-start').value, $('ib-pt-oficial').value, $('ib-pt-realizado').value);
    if (pt) { lines.push(pt); lines.push(''); }

    const ola = kpi('OLA',  $('ib-ola-real').value,  $('ib-ola-meta').value);
    const abs = kpi('ABS',  $('ib-abs-real').value,  $('ib-abs-meta').value,  true);
    const idl = kpi('Idle', $('ib-idle-real').value, $('ib-idle-meta').value, true);

    [ola, abs, idl].forEach(l => { if (l) lines.push(l); });

  } else if (area === 'Inventário') {
    lines.push(`INVENTÁRIO — Turno ${turno}`);
    lines.push('');

    const prod = labor('Produtividade', $('inv-prod-start').value, null, $('inv-prod-realizado').value);
    const rts  = labor('RTS',           $('inv-rts-start').value,  null, $('inv-rts-realizado').value);
    if (prod) lines.push(prod);
    if (rts)  lines.push(rts);
    if (prod || rts) lines.push('');

    const av = kpi('AV', $('inv-av-real').value, $('inv-av-meta').value, true);
    if (av) lines.push(av);

  } else if (area === 'Qualidade') {
    lines.push(`QUALIDADE — Turno ${turno}`);
    lines.push('');

    const prod = labor('Produtividade', $('qual-prod-start').value, null, $('qual-prod-realizado').value);
    if (prod) { lines.push(prod); lines.push(''); }

    const rr  = kpi('RR',     $('qual-rr-real').value,  $('qual-rr-meta').value,  true);
    const ola = kpi('OLA RI', $('qual-ola-real').value, $('qual-ola-meta').value);
    [rr, ola].forEach(l => { if (l) lines.push(l); });
  }

  // ── Riscos e próximo turno ──
  const riscos  = $('resumo-riscos').value.trim();
  const proximo = $('resumo-proximo').value.trim();

  lines.push('');
  lines.push(riscos  ? `⚠️ Riscos: ${riscos}` : '⚠️ Riscos: Nenhum risco crítico identificado.');
  if (proximo) lines.push(`🔜 Próximo turno: ${proximo}`);

  lines.push('');
  lines.push(`— ${App.currentUser?.name || 'Usuário'} · ${formatDate(now)} ${formatTime(now)}`);

  $('executive-summary-box').innerHTML =
    `<pre style="white-space:pre-wrap;font-family:var(--font-body);font-size:0.9rem;line-height:1.75;">${lines.join('\n')}</pre>`;
  showToast('Resumo executivo gerado!', 'success');
}

// ═══════════════════════════════════════════
// SAVE RECORD
// ═══════════════════════════════════════════
function saveRecord() {
  const area = $('f-area').value;
  const turno = $('f-turno').value;

  if (!area) { showToast('Selecione a Área antes de salvar.', 'error'); $('f-area').focus(); return; }
  if (!turno) { showToast('Selecione o Turno antes de salvar.', 'error'); $('f-turno').focus(); return; }

  const now = new Date();

  const record = {
    id: `SF_${Date.now()}`,
    data: formatDate(now),
    hora: formatTime(now),
    nome: App.currentUser.name,
    email: App.currentUser.email,
    area,
    turno,
    // Outbound
    ob_ck_start: $('ob-ck-start').value,
    ob_ck_oficial: $('ob-ck-oficial').value,
    ob_ck_realizado: $('ob-ck-realizado').value,
    ob_pk_start: $('ob-pk-start').value,
    ob_pk_oficial: $('ob-pk-oficial').value,
    ob_pk_realizado: $('ob-pk-realizado').value,
    ob_net_meta: $('ob-net-meta').value,
    ob_net_real: $('ob-net-real').value,
    ob_cot_meta: $('ob-cot-meta').value,
    ob_cot_real: $('ob-cot-real').value,
    ob_abs_meta: $('ob-abs-meta').value,
    ob_abs_real: $('ob-abs-real').value,
    ob_idle_meta: $('ob-idle-meta').value,
    ob_idle_real: $('ob-idle-real').value,
    ob_fs_meta: $('ob-fs-meta').value,
    ob_fs_real: $('ob-fs-real').value,
    ob_sf_meta: $('ob-sf-meta').value,
    ob_sf_real: $('ob-sf-real').value,
    // Inbound
    ib_pt_start: $('ib-pt-start').value,
    ib_pt_oficial: $('ib-pt-oficial').value,
    ib_pt_realizado: $('ib-pt-realizado').value,
    ib_ola_meta: $('ib-ola-meta').value,
    ib_ola_real: $('ib-ola-real').value,
    ib_abs_meta: $('ib-abs-meta').value,
    ib_abs_real: $('ib-abs-real').value,
    ib_idle_meta: $('ib-idle-meta').value,
    ib_idle_real: $('ib-idle-real').value,
    // Inventário
    inv_prod_start: $('inv-prod-start').value,
    inv_prod_realizado: $('inv-prod-realizado').value,
    inv_av_meta: $('inv-av-meta').value,
    inv_av_real: $('inv-av-real').value,
    inv_rts_start: $('inv-rts-start').value,
    inv_rts_realizado: $('inv-rts-realizado').value,
    // Qualidade
    qual_prod_start: $('qual-prod-start').value,
    qual_prod_realizado: $('qual-prod-realizado').value,
    qual_rr_meta: $('qual-rr-meta').value,
    qual_rr_real: $('qual-rr-real').value,
    qual_ola_meta: $('qual-ola-meta').value,
    qual_ola_real: $('qual-ola-real').value,
    // Resumo
    resumo_resultados: $('resumo-resultados').value,
    resumo_problemas: $('resumo-problemas').value,
    resumo_acoes: $('resumo-acoes').value,
    resumo_riscos: $('resumo-riscos').value,
    resumo_proximo: $('resumo-proximo').value,
    resumo_executivo: $('executive-summary-box').textContent,
  };

  // Salvar localmente
  App.records.unshift(record);
  saveRecordsToStorage();

  // Feedback visual
  const statusEl = $('save-status');
  statusEl.className = 'save-status success';
  statusEl.textContent = `✅ Registro salvo com sucesso! ID: ${record.id}`;
  statusEl.classList.remove('hidden');

  showToast('Registro salvo com sucesso!', 'success');

  // Enviar para Google Sheets
  sendToGoogleSheets(record);

  // Auto-scroll para o status
  setTimeout(() => statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  setTimeout(() => statusEl.classList.add('hidden'), 6000);
}

// ─── GOOGLE SHEETS INTEGRATION ───
async function sendToGoogleSheets(record) {
  if (WEBAPP_URL === 'COLOCAR_URL_DO_GOOGLE_APPS_SCRIPT_AQUI') {
    console.info('[Shopee Fulfillment] Google Sheets não configurado. Configure WEBAPP_URL em script.js.');
    return;
  }

  try {
    const response = await fetch(WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors', // necessário para Google Apps Script
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    console.info('[Shopee Fulfillment] Dados enviados ao Google Sheets.');
  } catch (error) {
    console.error('[Shopee Fulfillment] Erro ao enviar para Google Sheets:', error);
  }
}

// ─── CLEAR FORM ───
function clearForm() {
  const inputs = $$('#view-form input, #view-form select, #view-form textarea');
  inputs.forEach(el => {
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
  $$('.area-section').forEach(s => s.classList.add('hidden'));
  $$('.indicator-bar').forEach(b => { b.style.width = '0'; b.className = 'indicator-bar'; });
  $('executive-summary-box').innerHTML = '<p class="placeholder-text">Preencha os dados do formulário e clique em <strong>Gerar Resumo</strong> para criar o resumo executivo automaticamente.</p>';
  $('save-status').classList.add('hidden');
  showToast('Formulário limpo.', 'success');
}

// ═══════════════════════════════════════════
// LOCAL STORAGE
// ═══════════════════════════════════════════
function saveRecordsToStorage() {
  localStorage.setItem('sf_records', JSON.stringify(App.records));
}

function loadRecordsFromStorage() {
  try {
    const data = localStorage.getItem('sf_records');
    App.records = data ? JSON.parse(data) : [];
  } catch (_) {
    App.records = [];
  }
}

// ═══════════════════════════════════════════
// HISTÓRICO
// ═══════════════════════════════════════════
function bindHistoryEvents() {
  $('history-search').addEventListener('input', renderHistory);

  $$('#filter-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#filter-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      App.historyFilter = chip.dataset.filter;
      renderHistory();
    });
  });
}

function renderHistory() {
  const search = $('history-search').value.toLowerCase();
  const filter = App.historyFilter;

  let filtered = App.records.filter(r => {
    const matchFilter = filter === 'all' || r.area === filter;
    const matchSearch = !search ||
      r.nome.toLowerCase().includes(search) ||
      r.email.toLowerCase().includes(search) ||
      r.area.toLowerCase().includes(search) ||
      r.turno.toLowerCase().includes(search) ||
      r.data.includes(search);
    return matchFilter && matchSearch;
  });

  $('history-count').textContent = `${filtered.length} registro${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`;

  const tbody = $('history-tbody');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    $('history-table-wrap').querySelector('table').style.display = 'none';
    $('history-empty').classList.remove('hidden');
    return;
  }

  $('history-table-wrap').querySelector('table').style.display = '';
  $('history-empty').classList.add('hidden');

  filtered.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span style="font-family:var(--font-mono);font-size:0.8rem;">${r.data}</span></td>
      <td><span style="font-family:var(--font-mono);font-size:0.8rem;">${r.hora}</span></td>
      <td>
        <div style="font-weight:600;font-size:0.875rem;">${r.nome}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);">${r.email}</div>
      </td>
      <td><span class="badge badge-${r.area.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}">${r.area}</span></td>
      <td><span class="badge badge-${r.turno.toLowerCase()}">${r.turno}</span></td>
      <td><button class="btn-icon" data-id="${r.id}">Ver detalhes →</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Bind detail buttons
  $$('#history-tbody .btn-icon').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });
}

// ═══════════════════════════════════════════
// MODAL DE DETALHES
// ═══════════════════════════════════════════
function bindModalEvents() {
  $('modal-close').addEventListener('click', closeModal);
  $('modal-close-btn').addEventListener('click', closeModal);
  $('modal-overlay').addEventListener('click', e => { if (e.target === $('modal-overlay')) closeModal(); });
  $('modal-delete').addEventListener('click', () => {
    if (App.modalRecord && confirm('Excluir este registro permanentemente?')) {
      deleteRecord(App.modalRecord.id);
      closeModal();
    }
  });
}

function openModal(id) {
  const record = App.records.find(r => r.id === id);
  if (!record) return;
  App.modalRecord = record;

  $('modal-title').textContent = `${record.area} — Turno ${record.turno} · ${record.data}`;

  let html = '';

  // Identificação
  html += `<div class="detail-section">
    <div class="detail-title">Identificação</div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-item-label">Data</div><div class="detail-item-value">${record.data}</div></div>
      <div class="detail-item"><div class="detail-item-label">Hora</div><div class="detail-item-value">${record.hora}</div></div>
      <div class="detail-item"><div class="detail-item-label">Usuário</div><div class="detail-item-value">${record.nome}</div></div>
      <div class="detail-item"><div class="detail-item-label">E-mail</div><div class="detail-item-value">${record.email}</div></div>
      <div class="detail-item"><div class="detail-item-label">Área</div><div class="detail-item-value">${record.area}</div></div>
      <div class="detail-item"><div class="detail-item-label">Turno</div><div class="detail-item-value">${record.turno}</div></div>
    </div>
  </div>`;

  // Indicadores por área
  if (record.area === 'Outbound') {
    html += `<div class="detail-section">
      <div class="detail-title">Outbound — Checking</div>
      <div class="detail-grid">
        ${detailItem('Labor Start', record.ob_ck_start)}
        ${detailItem('Labor Oficial', record.ob_ck_oficial)}
        ${detailItem('Labor Realizado', record.ob_ck_realizado)}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-title">Outbound — Picking</div>
      <div class="detail-grid">
        ${detailItem('Labor Start', record.ob_pk_start)}
        ${detailItem('Labor Oficial', record.ob_pk_oficial)}
        ${detailItem('Labor Realizado', record.ob_pk_realizado)}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-title">Indicadores Outbound</div>
      <div class="detail-grid">
        ${detailIndicator('NET', record.ob_net_meta, record.ob_net_real)}
        ${detailIndicator('COT', record.ob_cot_meta, record.ob_cot_real)}
        ${detailIndicator('ABS', record.ob_abs_meta, record.ob_abs_real)}
        ${detailIndicator('Idle', record.ob_idle_meta, record.ob_idle_real)}
        ${detailIndicator('Fast Start', record.ob_fs_meta, record.ob_fs_real)}
        ${detailIndicator('Strong Finish', record.ob_sf_meta, record.ob_sf_real)}
      </div>
    </div>`;
  }

  if (record.area === 'Inbound') {
    html += `<div class="detail-section">
      <div class="detail-title">Inbound — Putaway</div>
      <div class="detail-grid">
        ${detailItem('Labor Start', record.ib_pt_start)}
        ${detailItem('Labor Oficial', record.ib_pt_oficial)}
        ${detailItem('Labor Realizado', record.ib_pt_realizado)}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-title">Indicadores Inbound</div>
      <div class="detail-grid">
        ${detailIndicator('OLA', record.ib_ola_meta, record.ib_ola_real)}
        ${detailIndicator('ABS', record.ib_abs_meta, record.ib_abs_real)}
        ${detailIndicator('Idle', record.ib_idle_meta, record.ib_idle_real)}
      </div>
    </div>`;
  }

  if (record.area === 'Inventário') {
    html += `<div class="detail-section">
      <div class="detail-title">Inventário — Produtividade</div>
      <div class="detail-grid">
        ${detailItem('Labor Start', record.inv_prod_start)}
        ${detailItem('Labor Realizado', record.inv_prod_realizado)}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-title">Inventário — AV e RTS</div>
      <div class="detail-grid">
        ${detailIndicator('AV', record.inv_av_meta, record.inv_av_real)}
        ${detailItem('RTS Start', record.inv_rts_start)}
        ${detailItem('RTS Realizado', record.inv_rts_realizado)}
      </div>
    </div>`;
  }

  if (record.area === 'Qualidade') {
    html += `<div class="detail-section">
      <div class="detail-title">Qualidade — Produtividade</div>
      <div class="detail-grid">
        ${detailItem('Labor Start', record.qual_prod_start)}
        ${detailItem('Labor Realizado', record.qual_prod_realizado)}
      </div>
    </div>
    <div class="detail-section">
      <div class="detail-title">Indicadores Qualidade</div>
      <div class="detail-grid">
        ${detailIndicator('RR', record.qual_rr_meta, record.qual_rr_real)}
        ${detailIndicator('OLA RI', record.qual_ola_meta, record.qual_ola_real)}
      </div>
    </div>`;
  }

  // Resumo operacional
  if (record.resumo_resultados || record.resumo_problemas || record.resumo_acoes) {
    html += `<div class="detail-section"><div class="detail-title">Resumo Operacional</div>`;
    if (record.resumo_resultados) html += `<p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Resultados</p><div class="detail-text" style="margin-bottom:0.75rem">${record.resumo_resultados}</div>`;
    if (record.resumo_problemas) html += `<p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Problemas</p><div class="detail-text" style="margin-bottom:0.75rem">${record.resumo_problemas}</div>`;
    if (record.resumo_acoes) html += `<p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Ações</p><div class="detail-text" style="margin-bottom:0.75rem">${record.resumo_acoes}</div>`;
    if (record.resumo_riscos) html += `<p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Riscos</p><div class="detail-text" style="margin-bottom:0.75rem">${record.resumo_riscos}</div>`;
    if (record.resumo_proximo) html += `<p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;">Próximo Turno</p><div class="detail-text">${record.resumo_proximo}</div>`;
    html += `</div>`;
  }

  // Resumo executivo
  if (record.resumo_executivo) {
    html += `<div class="detail-section">
      <div class="detail-title">Resumo Executivo</div>
      <div class="detail-text">${record.resumo_executivo}</div>
    </div>`;
  }

  $('modal-body').innerHTML = html;
  $('modal-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  $('modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  App.modalRecord = null;
}

function deleteRecord(id) {
  App.records = App.records.filter(r => r.id !== id);
  saveRecordsToStorage();
  renderHistory();
  if (App.currentView === 'dashboard') renderDashboard();
  showToast('Registro excluído.', 'success');
}

function detailItem(label, value) {
  return `<div class="detail-item">
    <div class="detail-item-label">${label}</div>
    <div class="detail-item-value">${value || '—'}</div>
  </div>`;
}

function detailIndicator(label, meta, real) {
  const m = parseFloat(meta);
  const r = parseFloat(real);
  let status = '—';
  if (!isNaN(m) && !isNaN(r)) {
    const ok = r >= m;
    status = `<span style="color:${ok ? 'var(--green)' : 'var(--red)'};">${real}%</span> / <span style="color:var(--text-muted)">meta ${meta}%</span>`;
  }
  return `<div class="detail-item">
    <div class="detail-item-label">${label}</div>
    <div class="detail-item-value">${status}</div>
  </div>`;
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
function renderDashboard() {
  const records = App.records;

  // KPIs
  $('kpi-total').textContent = records.length;
  $('kpi-outbound').textContent = records.filter(r => r.area === 'Outbound').length;
  $('kpi-inbound').textContent = records.filter(r => r.area === 'Inbound').length;
  $('kpi-inventario').textContent = records.filter(r => r.area === 'Inventário').length;
  $('kpi-qualidade').textContent = records.filter(r => r.area === 'Qualidade').length;

  // Destroy existing charts
  Object.values(App.charts).forEach(c => { try { c.destroy(); } catch(_) {} });
  App.charts = {};

  // Chart defaults
  Chart.defaults.color = '#8892A4';
  Chart.defaults.font.family = "'DM Sans', sans-serif";

  const palette = ['#EE4D2D', '#34D399', '#A78BFA', '#FBBF24', '#60A5FA'];

  // ─── Chart: Por Área ───
  const areaCounts = ['Outbound', 'Inbound', 'Inventário', 'Qualidade'].map(a => records.filter(r => r.area === a).length);
  App.charts.area = new Chart($('chart-area'), {
    type: 'doughnut',
    data: {
      labels: ['Outbound', 'Inbound', 'Inventário', 'Qualidade'],
      datasets: [{ data: areaCounts, backgroundColor: palette, borderWidth: 0, hoverOffset: 8 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8 } },
      },
      cutout: '68%',
    },
  });

  // ─── Chart: Por Turno ───
  const turnoCounts = ['T1', 'T2', 'T3'].map(t => records.filter(r => r.turno === t).length);
  App.charts.turno = new Chart($('chart-turno'), {
    type: 'bar',
    data: {
      labels: ['T1 — Manhã', 'T2 — Tarde', 'T3 — Noite'],
      datasets: [{
        data: turnoCounts,
        backgroundColor: ['rgba(96,165,250,0.7)', 'rgba(167,139,250,0.7)', 'rgba(251,191,36,0.7)'],
        borderColor: ['#60A5FA', '#A78BFA', '#FBBF24'],
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { stepSize: 1 }, beginAtZero: true },
        x: { grid: { display: false } },
      },
    },
  });

  // ─── Chart: Indicadores Outbound ───
  const obRecords = records.filter(r => r.area === 'Outbound');
  const avg = (arr, key) => {
    const vals = arr.map(r => parseFloat(r[key])).filter(v => !isNaN(v));
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0;
  };
  const obLabels = ['NET', 'COT', 'ABS', 'Idle', 'Fast Start', 'Str. Finish'];
  const obMetas = [
    avg(obRecords, 'ob_net_meta'), avg(obRecords, 'ob_cot_meta'),
    avg(obRecords, 'ob_abs_meta'), avg(obRecords, 'ob_idle_meta'),
    avg(obRecords, 'ob_fs_meta'), avg(obRecords, 'ob_sf_meta'),
  ];
  const obReais = [
    avg(obRecords, 'ob_net_real'), avg(obRecords, 'ob_cot_real'),
    avg(obRecords, 'ob_abs_real'), avg(obRecords, 'ob_idle_real'),
    avg(obRecords, 'ob_fs_real'), avg(obRecords, 'ob_sf_real'),
  ];

  App.charts.ob = new Chart($('chart-outbound-indicators'), {
    type: 'bar',
    data: {
      labels: obLabels,
      datasets: [
        {
          label: 'Meta',
          data: obMetas,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderColor: 'rgba(255,255,255,0.3)',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Real',
          data: obReais,
          backgroundColor: 'rgba(238,77,45,0.65)',
          borderColor: '#EE4D2D',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { padding: 16, usePointStyle: true } } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true, max: 110 },
        x: { grid: { display: false } },
      },
    },
  });

  // ─── Chart: Indicadores Inbound ───
  const ibRecords = records.filter(r => r.area === 'Inbound');
  const ibLabels = ['OLA', 'ABS', 'Idle'];
  const ibMetas = [avg(ibRecords,'ib_ola_meta'), avg(ibRecords,'ib_abs_meta'), avg(ibRecords,'ib_idle_meta')];
  const ibReais = [avg(ibRecords,'ib_ola_real'), avg(ibRecords,'ib_abs_real'), avg(ibRecords,'ib_idle_real')];

  App.charts.ib = new Chart($('chart-inbound-indicators'), {
    type: 'radar',
    data: {
      labels: ibLabels,
      datasets: [
        {
          label: 'Meta',
          data: ibMetas,
          borderColor: 'rgba(255,255,255,0.3)',
          backgroundColor: 'rgba(255,255,255,0.05)',
          pointBackgroundColor: 'rgba(255,255,255,0.3)',
        },
        {
          label: 'Real',
          data: ibReais,
          borderColor: '#34D399',
          backgroundColor: 'rgba(52,211,153,0.15)',
          pointBackgroundColor: '#34D399',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          grid: { color: 'rgba(255,255,255,0.07)' },
          pointLabels: { font: { size: 12 } },
          ticks: { display: false },
          beginAtZero: true,
        },
      },
      plugins: { legend: { position: 'top', labels: { padding: 12, usePointStyle: true } } },
    },
  });

  // ─── Timeline ───
  const timeline = $('timeline');
  timeline.innerHTML = '';
  const last10 = records.slice(0, 10);

  if (last10.length === 0) {
    timeline.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem;">Nenhum registro ainda.</p>';
    return;
  }

  last10.forEach(r => {
    const dot = `<div class="timeline-dot" style="background:${areaColor(r.area)}"></div>`;
    timeline.innerHTML += `
      <div class="timeline-item">
        ${dot}
        <div class="timeline-content">
          <div class="timeline-meta">
            <span class="timeline-date">${r.data} ${r.hora}</span>
            <span class="badge badge-${r.area.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}">${r.area}</span>
            <span class="badge badge-${r.turno.toLowerCase()}">${r.turno}</span>
          </div>
          <div class="timeline-user">${r.nome} <span style="color:var(--text-muted);font-weight:400;">&lt;${r.email}&gt;</span></div>
        </div>
      </div>
    `;
  });
}

function areaColor(area) {
  const map = { 'Outbound': '#EE4D2D', 'Inbound': '#34D399', 'Inventário': '#A78BFA', 'Qualidade': '#FBBF24' };
  return map[area] || '#8892A4';
}

// ═══════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════
function formatDate(d) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(d) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => { el.style.animation = ''; }, 400);
}

function showToast(message, type = 'success') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ─── Inject shake keyframe ───
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
`;
document.head.appendChild(style);

// ═══════════════════════════════════════════
// IMPRIMIR / SALVAR PDF
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  $('btn-print-pdf') && $('btn-print-pdf').addEventListener('click', printExecutivePDF);
  $('btn-whatsapp')  && $('btn-whatsapp').addEventListener('click', openWhatsModal);
  $('whats-close')   && $('whats-close').addEventListener('click', closeWhatsModal);
  $('modal-whats')   && $('modal-whats').addEventListener('click', e => {
    if (e.target === $('modal-whats')) closeWhatsModal();
  });
  $('whats-download')  && $('whats-download').addEventListener('click', downloadWhatsCard);
  $('whats-canvas')    && $('whats-canvas').addEventListener('click', downloadWhatsCard);
  $('whats-send-web')  && $('whats-send-web').addEventListener('click', sendWhatsWeb);
  $('whats-send-app')  && $('whats-send-app').addEventListener('click', sendWhatsApp);
});

function getExecutiveText() {
  return $('executive-summary-box').innerText || $('executive-summary-box').textContent || '';
}

function hasExecutiveSummary() {
  const text = getExecutiveText().trim();
  return text.length > 10 && !text.includes('Preencha os dados');
}

// ─── PDF via janela de impressão ───
function printExecutivePDF() {
  if (!hasExecutiveSummary()) {
    showToast('Gere o resumo executivo antes de imprimir.', 'error');
    return;
  }

  const area = $('f-area').value || '—';
  const turno = $('f-turno').value || '—';
  const user = App.currentUser?.name || '—';
  const now = new Date();
  const dateStr = formatDate(now);
  const text = getExecutiveText();

  // Constrói HTML para impressão
  const printHTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Resumo Executivo — ${area} ${turno} — ${dateStr}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #fff;
      color: #111;
      padding: 2.5cm 2cm;
      font-size: 11pt;
      line-height: 1.7;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 3px solid #EE4D2D;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-box {
      width: 40px; height: 40px;
      background: #EE4D2D;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 18px; font-weight: 900;
    }
    .logo-name { font-size: 14pt; font-weight: 800; color: #EE4D2D; }
    .logo-sub { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 0.1em; }
    .meta-block { text-align: right; font-size: 9pt; color: #555; line-height: 1.6; }
    .tag {
      display: inline-block;
      background: #EE4D2D;
      color: white;
      font-size: 8pt;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    h1 {
      font-size: 16pt;
      font-weight: 800;
      color: #111;
      margin-bottom: 6px;
      letter-spacing: -0.01em;
    }
    .subtitle {
      font-size: 10pt;
      color: #666;
      margin-bottom: 24px;
    }
    .summary-box {
      background: #f9f9f9;
      border: 1px solid #e5e5e5;
      border-left: 4px solid #EE4D2D;
      border-radius: 6px;
      padding: 20px 24px;
      white-space: pre-wrap;
      font-size: 10.5pt;
      line-height: 1.8;
      color: #222;
    }
    .footer {
      margin-top: 36px;
      padding-top: 14px;
      border-top: 1px solid #ddd;
      font-size: 8.5pt;
      color: #888;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body { padding: 1.5cm 1.5cm; }
      @page { margin: 1.5cm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <div class="logo-box">S</div>
      <div>
        <div class="logo-name">Shopee</div>
        <div class="logo-sub">Fulfillment</div>
      </div>
    </div>
    <div class="meta-block">
      <div><strong>Data:</strong> ${dateStr}</div>
      <div><strong>Responsável:</strong> ${user}</div>
      <div><strong>Área:</strong> ${area} &nbsp;|&nbsp; <strong>Turno:</strong> ${turno}</div>
    </div>
  </div>

  <div class="tag">Resumo Executivo</div>
  <h1>${area} — Turno ${turno}</h1>
  <p class="subtitle">Gerado automaticamente pelo Painel Operacional Shopee Fulfillment</p>

  <div class="summary-box">${escapeHtml(text)}</div>

  <div class="footer">
    <span>Shopee Fulfillment — Painel Operacional</span>
    <span>${dateStr} &nbsp;·&nbsp; ${user}</span>
  </div>

  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const frame = $('print-frame');
  frame.contentDocument.open();
  frame.contentDocument.write(printHTML);
  frame.contentDocument.close();
  showToast('Abrindo janela de impressão / salvar PDF…', 'success');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════
// WHATSAPP — CARD VISUAL (Canvas)
// ═══════════════════════════════════════════
function openWhatsModal() {
  if (!hasExecutiveSummary()) {
    showToast('Gere o resumo executivo antes de compartilhar.', 'error');
    return;
  }
  buildWhatsCard();
  $('modal-whats').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeWhatsModal() {
  $('modal-whats').classList.add('hidden');
  document.body.style.overflow = '';
}

// ─── Coleta todos os dados do formulário para o card ───
function collectCardData() {
  const area  = $('f-area').value  || '—';
  const turno = $('f-turno').value || '—';
  const now   = new Date();
  const user  = App.currentUser?.name || '—';

  // Mapa de linhas por área: [ { label, value, meta, lowerIsBetter, isSection, isLabor } ]
  const rows = [];

  if (area === 'Outbound') {
    // Labor
    const ckS=$('ob-ck-start').value, ckO=$('ob-ck-oficial').value, ckR=$('ob-ck-realizado').value;
    const pkS=$('ob-pk-start').value, pkO=$('ob-pk-oficial').value, pkR=$('ob-pk-realizado').value;

    if (ckS||ckO||ckR) rows.push({ isLabor:true, label:'Checking', start:ckS, oficial:ckO, realizado:ckR });
    if (pkS||pkO||pkR) rows.push({ isLabor:true, label:'Picking',  start:pkS, oficial:pkO, realizado:pkR });

    // KPIs
    const kpis = [
      { label:'NET',          val:$('ob-net-real').value,  meta:$('ob-net-meta').value },
      { label:'COT',          val:$('ob-cot-real').value,  meta:$('ob-cot-meta').value },
      { label:'ABS',          val:$('ob-abs-real').value,  meta:$('ob-abs-meta').value,  low:true },
      { label:'Idle',         val:$('ob-idle-real').value, meta:$('ob-idle-meta').value, low:true },
      { label:'Fast Start',   val:$('ob-fs-real').value,   meta:$('ob-fs-meta').value },
      { label:'Strong Finish',val:$('ob-sf-real').value,   meta:$('ob-sf-meta').value },
    ];
    kpis.forEach(k => { if (k.val) rows.push({ label:k.label, value:k.val+'%', meta:k.meta?k.meta+'%':'', low:k.low||false }); });

  } else if (area === 'Inbound') {
    const ptS=$('ib-pt-start').value, ptO=$('ib-pt-oficial').value, ptR=$('ib-pt-realizado').value;
    if (ptS||ptO||ptR) rows.push({ isLabor:true, label:'Putaway', start:ptS, oficial:ptO, realizado:ptR });

    const kpis = [
      { label:'OLA',  val:$('ib-ola-real').value,  meta:$('ib-ola-meta').value },
      { label:'ABS',  val:$('ib-abs-real').value,  meta:$('ib-abs-meta').value,  low:true },
      { label:'Idle', val:$('ib-idle-real').value, meta:$('ib-idle-meta').value, low:true },
    ];
    kpis.forEach(k => { if (k.val) rows.push({ label:k.label, value:k.val+'%', meta:k.meta?k.meta+'%':'', low:k.low||false }); });

  } else if (area === 'Inventário') {
    const pS=$('inv-prod-start').value, pR=$('inv-prod-realizado').value;
    const rS=$('inv-rts-start').value,  rR=$('inv-rts-realizado').value;
    if (pS||pR) rows.push({ isLabor:true, label:'Produtividade', start:pS, oficial:'', realizado:pR });
    if (rS||rR) rows.push({ isLabor:true, label:'RTS',           start:rS, oficial:'', realizado:rR });
    const av = $('inv-av-real').value;
    if (av) rows.push({ label:'AV', value:av+'%', meta:$('inv-av-meta').value?$('inv-av-meta').value+'%':'', low:true });

  } else if (area === 'Qualidade') {
    const pS=$('qual-prod-start').value, pR=$('qual-prod-realizado').value;
    if (pS||pR) rows.push({ isLabor:true, label:'Produtividade', start:pS, oficial:'', realizado:pR });
    const kpis = [
      { label:'RR',     val:$('qual-rr-real').value,  meta:$('qual-rr-meta').value,  low:true },
      { label:'OLA RI', val:$('qual-ola-real').value, meta:$('qual-ola-meta').value },
    ];
    kpis.forEach(k => { if (k.val) rows.push({ label:k.label, value:k.val+'%', meta:k.meta?k.meta+'%':'', low:k.low||false }); });
  }

  const riscos  = $('resumo-riscos').value.trim();
  const proximo = $('resumo-proximo').value.trim();

  return { area, turno, user, now, rows, riscos, proximo };
}

// ─── Renderiza o card no Canvas ───
function buildWhatsCard() {
  const d = collectCardData();
  const canvas = $('whats-canvas');
  const ctx = canvas.getContext('2d');

  // Dimensões — formato "card de chat" igual ao print
  const W = 360;
  const PAD = 20;
  const ROW_H = 34;
  const SECTION_H = 26;

  // ── calcular altura total dinamicamente ──
  let estimatedH = 90; // header
  estimatedH += SECTION_H; // título área
  d.rows.forEach(r => { estimatedH += r.isLabor ? 46 : ROW_H; });
  if (d.riscos)  estimatedH += ROW_H + 8;
  if (d.proximo) estimatedH += ROW_H + 4;
  estimatedH += 48; // footer

  canvas.width  = W * 2;   // retina
  canvas.height = (estimatedH + 24) * 2;
  canvas.style.width  = W + 'px';
  canvas.style.height = (estimatedH + 24) + 'px';
  ctx.scale(2, 2);

  // ── Paleta ──
  const C = {
    bg:       '#0E1117',
    card:     '#141921',
    border:   'rgba(255,255,255,0.07)',
    orange:   '#EE4D2D',
    green:    '#34D399',
    red:      '#F87171',
    yellow:   '#FBBF24',
    muted:    '#4A5568',
    sub:      '#8892A4',
    text:     '#F0F2F5',
    divider:  'rgba(255,255,255,0.06)',
    labelBg:  'rgba(238,77,45,0.12)',
  };

  const H = estimatedH + 24;

  // ── Fundo ──
  roundRect(ctx, 0, 0, W, H, 14, C.card);

  // Borda sutil
  ctx.strokeStyle = 'rgba(238,77,45,0.18)';
  ctx.lineWidth = 1;
  roundRectStroke(ctx, 0.5, 0.5, W-1, H-1, 14);

  // Linha topo laranja
  ctx.fillStyle = C.orange;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, 3, [14, 14, 0, 0]);
  ctx.fill();

  let y = 14;

  // ── Header ──
  // Dia da semana + data
  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const diaSemana = dias[d.now.getDay()];
  const dateStr = `${diaSemana} ${formatDate(d.now).replace(/\//g, '/')}`;

  ctx.font = 'bold 13px -apple-system,sans-serif';
  ctx.fillStyle = C.orange;
  ctx.fillText(dateStr, PAD, y + 16);

  // Fechar X (decorativo)
  ctx.font = '12px -apple-system,sans-serif';
  ctx.fillStyle = C.muted;
  ctx.fillText('✕', W - PAD - 10, y + 16);

  y += 28;

  // Área + turno
  ctx.font = 'bold 11px -apple-system,sans-serif';
  ctx.fillStyle = C.sub;
  ctx.fillText(`${d.area.toUpperCase()}  |  ${d.turno}`, PAD, y + 13);
  y += 22;

  // Usuário
  ctx.font = '11px -apple-system,sans-serif';
  ctx.fillStyle = C.sub;
  ctx.fillText('👤  ' + d.user, PAD, y + 12);
  y += 20;

  // Divider
  dividerLine(ctx, PAD, y, W - PAD*2, C.divider);
  y += 14;

  // ── Título seção ──
  ctx.font = 'bold 10px -apple-system,sans-serif';
  ctx.fillStyle = C.muted;
  ctx.fillText('INDICADORES', PAD, y + 10);
  y += 20;

  // ── Linhas de dados ──
  d.rows.forEach((row, i) => {
    // Divider entre itens
    if (i > 0) {
      dividerLine(ctx, PAD, y, W - PAD*2, C.divider);
      y += 1;
    }

    if (row.isLabor) {
      // Labor row — compacto
      ctx.font = 'bold 11px -apple-system,sans-serif';
      ctx.fillStyle = C.sub;
      ctx.fillText(row.label.toUpperCase(), PAD, y + 12);
      y += 16;

      // Sub-linha com valores
      const parts = [];
      if (row.start)    parts.push({ k:'Start',    v: row.start });
      if (row.oficial)  parts.push({ k:'Oficial',  v: row.oficial });
      if (row.realizado)parts.push({ k:'Real',     v: row.realizado });

      let lx = PAD;
      parts.forEach(p => {
        ctx.font = '10px -apple-system,sans-serif';
        ctx.fillStyle = C.sub;
        const kw = ctx.measureText(p.k + '  ').width;
        ctx.fillText(p.k, lx, y + 12);
        ctx.font = 'bold 11px -apple-system,sans-serif';
        ctx.fillStyle = C.text;
        ctx.fillText(p.v, lx + kw, y + 12);
        lx += kw + ctx.measureText(p.v).width + 18;
      });
      y += 24;

    } else {
      // KPI row
      const real = parseFloat(row.value);
      const meta = parseFloat(row.meta);
      const hasCompare = !isNaN(real) && !isNaN(meta) && row.meta;
      const ok = hasCompare ? (row.low ? real <= meta : real >= meta) : true;
      const statusColor = hasCompare ? (ok ? C.green : C.red) : C.text;

      // Label esquerda
      ctx.font = '12px -apple-system,sans-serif';
      ctx.fillStyle = C.sub;
      ctx.fillText(row.label, PAD + 18, y + ROW_H/2 + 4);

      // Valor direita — bold, colorido
      ctx.font = 'bold 14px -apple-system,sans-serif';
      ctx.fillStyle = C.text;
      const valW = ctx.measureText(row.value).width;
      ctx.fillText(row.value, W - PAD - valW - (hasCompare ? 52 : 0), y + ROW_H/2 + 4);

      // Badge meta / status
      if (hasCompare) {
        const diff = row.low
          ? (real <= meta ? '+' : '') + (meta - real).toFixed(1) + 'pp'
          : (real >= meta ? '+' : '') + (real - meta).toFixed(1) + 'pp';
        const bw = 46;
        roundRect(ctx, W - PAD - bw, y + ROW_H/2 - 9, bw, 18, 4, ok ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)');
        ctx.font = 'bold 10px -apple-system,sans-serif';
        ctx.fillStyle = statusColor;
        ctx.textAlign = 'center';
        ctx.fillText(diff, W - PAD - bw/2, y + ROW_H/2 + 4);
        ctx.textAlign = 'left';
      }

      // Ícone colorido esquerdo
      ctx.font = '11px -apple-system,sans-serif';
      ctx.fillStyle = statusColor;
      ctx.fillText(ok ? '●' : '●', PAD, y + ROW_H/2 + 4);

      y += ROW_H;
    }
  });

  // ── Riscos / próximo turno ──
  if (d.riscos || d.proximo) {
    y += 4;
    dividerLine(ctx, PAD, y, W - PAD*2, C.divider);
    y += 10;

    ctx.font = 'bold 10px -apple-system,sans-serif';
    ctx.fillStyle = C.muted;
    ctx.fillText('OBSERVAÇÕES', PAD, y + 10);
    y += 18;

    if (d.riscos) {
      ctx.font = '10px -apple-system,sans-serif';
      ctx.fillStyle = C.yellow;
      ctx.fillText('⚠ ', PAD, y + 12);
      ctx.fillStyle = C.sub;
      wrapText(ctx, d.riscos, PAD + 16, y + 12, W - PAD*2 - 16, 14);
      y += 24 + Math.max(0, (Math.ceil(d.riscos.length / 38) - 1) * 14);
    }

    if (d.proximo) {
      ctx.font = '10px -apple-system,sans-serif';
      ctx.fillStyle = C.green;
      ctx.fillText('→ ', PAD, y + 12);
      ctx.fillStyle = C.sub;
      wrapText(ctx, d.proximo, PAD + 14, y + 12, W - PAD*2 - 14, 14);
      y += 20;
    }
  }

  // ── Footer ──
  y = H - 36;
  dividerLine(ctx, PAD, y, W - PAD*2, C.divider);
  y += 10;
  ctx.font = '9px -apple-system,sans-serif';
  ctx.fillStyle = C.muted;
  ctx.fillText('Gerado via Painel Operacional · Shopee Fulfillment', PAD, y + 10);
  ctx.fillText(`${formatDate(d.now)} ${formatTime(d.now)}`, PAD, y + 22);
}

// ─── Helpers de desenho ───
function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRectStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

function dividerLine(ctx, x, y, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  words.forEach((word, i) => {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxW && i > 0) {
      ctx.fillText(line.trim(), x, cy);
      line = word + ' ';
      cy += lineH;
    } else {
      line = test;
    }
  });
  ctx.fillText(line.trim(), x, cy);
}

// ─── Download da imagem ───
function downloadWhatsCard() {
  const canvas = $('whats-canvas');
  const link = document.createElement('a');
  const area  = $('f-area').value  || 'turno';
  const turno = $('f-turno').value || '';
  const now   = new Date();
  link.download = `shopee_${area}_${turno}_${formatDate(now).replace(/\//g,'-')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Imagem salva! Compartilhe no WhatsApp.', 'success');
}

function sendWhatsWeb() {
  window.open('https://web.whatsapp.com', '_blank');
  downloadWhatsCard();
  closeWhatsModal();
}

function sendWhatsApp() {
  window.open('whatsapp://', '_blank');
  downloadWhatsCard();
  closeWhatsModal();
}
