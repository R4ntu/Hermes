/* ═══════════════════════════════════════════════════════════
   SHOPEE FULFILLMENT — OPERATIONAL DASHBOARD
   script.js — Main Application Logic
═══════════════════════════════════════════════════════════ */

// ─── GOOGLE APPS SCRIPT CONFIGURATION ───
// Substitua pela URL gerada no deploy do seu Apps Script
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbyOidyphJDQe3OEscxcmZGyXJNJ91S_Ku8E3eTPd6Zjadgn-SmOf1c0F8LR8lls7Z6L/exec";

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

  // ABS, Idle, RR: lower is better
  const lowerIsBetter = ['ob-abs', 'ob-idle', 'ib-abs', 'ib-idle', 'qual-rr'];
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
function generateExecutiveSummary() {
  const area = $('f-area').value;
  const turno = $('f-turno').value;

  if (!area || !turno) {
    showToast('Selecione a Área e o Turno antes de gerar o resumo.', 'error');
    return;
  }

  let parts = [];
  const areaLabel = area;
  const now = new Date();

  parts.push(`📋 Resumo Executivo — ${areaLabel} | ${turno} | ${formatDate(now)}`);
  parts.push('');

  if (area === 'Outbound') {
    const ckStart = $('ob-ck-start').value;
    const ckOficial = $('ob-ck-oficial').value;
    const ckReal = $('ob-ck-realizado').value;
    const pkStart = $('ob-pk-start').value;
    const pkOficial = $('ob-pk-oficial').value;
    const pkReal = $('ob-pk-realizado').value;

    const netMeta = $('ob-net-meta').value;
    const netReal = $('ob-net-real').value;
    const cotMeta = $('ob-cot-meta').value;
    const cotReal = $('ob-cot-real').value;
    const absMeta = $('ob-abs-meta').value;
    const absReal = $('ob-abs-real').value;
    const idleMeta = $('ob-idle-meta').value;
    const idleReal = $('ob-idle-real').value;
    const fsMeta = $('ob-fs-meta').value;
    const fsReal = $('ob-fs-real').value;
    const sfMeta = $('ob-sf-meta').value;
    const sfReal = $('ob-sf-real').value;

    parts.push(`🏭 OUTBOUND — Turno ${turno}`);
    parts.push('');

    if (pkOficial && pkReal) {
      const pkPct = pkOficial > 0 ? Math.round((pkReal / pkOficial) * 100) : 0;
      parts.push(`• Picking: ${pkReal} colaboradores realizados de um quadro oficial de ${pkOficial} (${pkPct}% do estrutural). Labor Start: ${pkStart || 'não informado'}.`);
    }

    if (ckOficial && ckReal) {
      parts.push(`• Checking: ${ckReal} colaboradores realizados, estrutura oficial de ${ckOficial}.`);
    }

    if (netMeta && netReal) {
      const netStatus = parseFloat(netReal) >= parseFloat(netMeta) ? '✅ dentro do esperado' : '⚠️ abaixo da meta';
      parts.push(`• NET: ${netReal}% realizado frente à meta de ${netMeta}% — ${netStatus}.`);
    }

    if (cotMeta && cotReal) {
      const cotStatus = parseFloat(cotReal) >= parseFloat(cotMeta) ? '✅ dentro do esperado' : '⚠️ abaixo da meta';
      parts.push(`• COT: ${cotReal}% realizado frente à meta de ${cotMeta}% — ${cotStatus}.`);
    }

    if (absMeta && absReal) {
      const absStatus = parseFloat(absReal) <= parseFloat(absMeta) ? '✅ controlado' : '⚠️ acima do limite';
      parts.push(`• Absenteísmo (ABS): ${absReal}% (meta ≤ ${absMeta}%) — ${absStatus}.`);
    }

    if (idleMeta && idleReal) {
      const idleStatus = parseFloat(idleReal) <= parseFloat(idleMeta) ? '✅ controlado' : '⚠️ acima do limite';
      parts.push(`• Ociosidade (Idle): ${idleReal}% (meta ≤ ${idleMeta}%) — ${idleStatus}.`);
    }

    if (fsMeta && fsReal) {
      const fsStatus = parseFloat(fsReal) >= parseFloat(fsMeta) ? '✅ atingido' : '⚠️ não atingido';
      parts.push(`• Fast Start: ${fsReal}% (meta ${fsMeta}%) — ${fsStatus}.`);
    }

    if (sfMeta && sfReal) {
      const sfStatus = parseFloat(sfReal) >= parseFloat(sfMeta) ? '✅ atingido' : '⚠️ não atingido';
      parts.push(`• Strong Finish: ${sfReal}% (meta ${sfMeta}%) — ${sfStatus}.`);
    }

  } else if (area === 'Inbound') {
    const ptOficial = $('ib-pt-oficial').value;
    const ptReal = $('ib-pt-realizado').value;
    const olaMeta = $('ib-ola-meta').value;
    const olaReal = $('ib-ola-real').value;
    const absMeta = $('ib-abs-meta').value;
    const absReal = $('ib-abs-real').value;
    const idleMeta = $('ib-idle-meta').value;
    const idleReal = $('ib-idle-real').value;

    parts.push(`📥 INBOUND — Turno ${turno}`);
    parts.push('');

    if (ptOficial && ptReal) {
      parts.push(`• Putaway: ${ptReal} colaboradores realizados de ${ptOficial} oficiais.`);
    }

    if (olaMeta && olaReal) {
      const olaStatus = parseFloat(olaReal) >= parseFloat(olaMeta) ? '✅ dentro do SLA' : '⚠️ abaixo do SLA';
      parts.push(`• OLA: ${olaReal}% (meta ${olaMeta}%) — ${olaStatus}.`);
    }

    if (absMeta && absReal) {
      const absStatus = parseFloat(absReal) <= parseFloat(absMeta) ? '✅ controlado' : '⚠️ acima do limite';
      parts.push(`• ABS: ${absReal}% (meta ≤ ${absMeta}%) — ${absStatus}.`);
    }

    if (idleMeta && idleReal) {
      const idleStatus = parseFloat(idleReal) <= parseFloat(idleMeta) ? '✅ controlado' : '⚠️ acima do limite';
      parts.push(`• Idle: ${idleReal}% (meta ≤ ${idleMeta}%) — ${idleStatus}.`);
    }

  } else if (area === 'Inventário') {
    const prodStart = $('inv-prod-start').value;
    const prodReal = $('inv-prod-realizado').value;
    const rtsStart = $('inv-rts-start').value;
    const rtsReal = $('inv-rts-realizado').value;
    const avMeta = $('inv-av-meta').value;
    const avReal = $('inv-av-real').value;

    parts.push(`📦 INVENTÁRIO — Turno ${turno}`);
    parts.push('');

    if (prodReal) parts.push(`• Produtividade: ${prodReal} colaboradores realizados (start: ${prodStart || 'n/i'}).`);
    if (rtsReal) parts.push(`• RTS: ${rtsReal} colaboradores realizados (start: ${rtsStart || 'n/i'}).`);

    if (avMeta && avReal) {
      const avStatus = parseFloat(avReal) >= parseFloat(avMeta) ? '✅ dentro do esperado' : '⚠️ abaixo da meta';
      parts.push(`• AV (Acurácia): ${avReal}% (meta ${avMeta}%) — ${avStatus}.`);
    }

  } else if (area === 'Qualidade') {
    const prodStart = $('qual-prod-start').value;
    const prodReal = $('qual-prod-realizado').value;
    const rrMeta = $('qual-rr-meta').value;
    const rrReal = $('qual-rr-real').value;
    const olaMeta = $('qual-ola-meta').value;
    const olaReal = $('qual-ola-real').value;

    parts.push(`✅ QUALIDADE — Turno ${turno}`);
    parts.push('');

    if (prodReal) parts.push(`• Produtividade: ${prodReal} colaboradores realizados (start: ${prodStart || 'n/i'}).`);

    if (rrMeta && rrReal) {
      const rrStatus = parseFloat(rrReal) <= parseFloat(rrMeta) ? '✅ controlado' : '⚠️ acima do limite';
      parts.push(`• Rework Rate (RR): ${rrReal}% (meta ≤ ${rrMeta}%) — ${rrStatus}.`);
    }

    if (olaMeta && olaReal) {
      const olaStatus = parseFloat(olaReal) >= parseFloat(olaMeta) ? '✅ dentro do SLA' : '⚠️ abaixo do SLA';
      parts.push(`• OLA RI: ${olaReal}% (meta ${olaMeta}%) — ${olaStatus}.`);
    }
  }

  // Contexto operacional
  const riscos = $('resumo-riscos').value.trim();
  const proximo = $('resumo-proximo').value.trim();

  parts.push('');
  if (riscos) parts.push(`⚠️ Riscos: ${riscos}`);
  else parts.push('⚠️ Riscos: Nenhum risco crítico identificado para o próximo turno.');

  if (proximo) parts.push(`🔜 Próximo turno: ${proximo}`);

  parts.push('');
  parts.push(`— Gerado automaticamente · ${App.currentUser?.name || 'Usuário'} · ${formatDate(now)} ${formatTime(now)}`);

  $('executive-summary-box').innerHTML = `<pre style="white-space:pre-wrap;font-family:var(--font-body);font-size:0.9rem;line-height:1.75;">${parts.join('\n')}</pre>`;
  showToast('Resumo executivo gerado com sucesso!', 'success');
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
