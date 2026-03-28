// =====================================================
// ROUTING
// =====================================================
let currentPage = 'dashboard';

function setPage(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('nav button[data-page]').forEach(el => el.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  const btn = document.querySelector(`nav button[data-page="${p}"]`);
  if (btn) btn.classList.add('active');
  currentPage = p;
  if (typeof bulkClearSel === 'function') bulkClearSel();
  renderPage(p);
}

function renderPage(p) {
  if      (p==='dashboard')  renderDashboard();
  else if (p==='tarefas')    renderTarefas();
  else if (p==='calendario') renderCalendario();
  else if (p==='equipe')     renderEquipe();
  else if (p==='clientes')   renderClientes();
  else if (p==='framework')  renderFramework();
  else if (p==='gerador')    renderGerador();
  else if (p==='integracao') renderIntegracao();
}

// =====================================================
// MODALS
// =====================================================
let editingTaskId = null;

function openModal(type) {
  document.getElementById('modal-'+type).classList.add('open');
  if (type === 'task') {
    editingTaskId = null;
    document.getElementById('modal-task-title').textContent = 'Nova Tarefa';
    populateTaskForm();
    clearTaskForm();
  }
}

function closeModal(type) {
  document.getElementById('modal-'+type).classList.remove('open');
}

function autoResponsavel() {
  if (editingTaskId) return;
  const clienteId = document.getElementById('t-cliente').value;
  const tipo      = document.getElementById('t-tipo').value;
  const aloc      = ALOCACAO[clienteId];
  if (!aloc) return;
  let resp = '';
  if (tipo === 'copy' || tipo === 'dark') resp = aloc.copy;
  else if (tipo === 'design')             resp = aloc.design;
  else if (tipo === 'video')              resp = aloc.edicao;
  if (resp) document.getElementById('t-responsavel').value = resp;
}

function populateTaskForm() {
  const clients = getClients();
  const team    = getTeam();
  document.getElementById('t-cliente').innerHTML    = clients.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  document.getElementById('t-responsavel').innerHTML = team.map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  document.getElementById('t-cliente').addEventListener('change', autoResponsavel);
  document.getElementById('t-tipo').addEventListener('change', autoResponsavel);
}

function clearTaskForm() {
  document.getElementById('t-nome').value             = '';
  document.getElementById('t-tipo').selectedIndex     = 0;
  document.getElementById('t-subtipo').selectedIndex  = 0;
  document.getElementById('t-status').selectedIndex   = 0;
  document.getElementById('t-revisoes').value         = '0';
  document.getElementById('t-prazo').value            = '';
  document.getElementById('t-postagem').value         = '';
  document.getElementById('t-obs').value              = '';
}

async function saveTask() {
  const data = {
    id:          editingTaskId || uid(),
    nome:        document.getElementById('t-nome').value.trim(),
    cliente:     document.getElementById('t-cliente').value,
    tipo:        document.getElementById('t-tipo').value,
    subtipo:     document.getElementById('t-subtipo').value,
    responsavel: document.getElementById('t-responsavel').value,
    status:      document.getElementById('t-status').value,
    prazo:       document.getElementById('t-prazo').value,
    postagem:    document.getElementById('t-postagem').value,
    revisoes:    parseInt(document.getElementById('t-revisoes').value)||0,
    obs:         document.getElementById('t-obs').value,
    updatedAt:   new Date().toISOString()
  };

  const tasks = getTasks();
  if (editingTaskId) {
    const idx = tasks.findIndex(t=>t.id===editingTaskId);
    if (idx>=0) {
      const prev = tasks[idx];
      data.createdAt   = prev.createdAt  || data.updatedAt;
      // preserve ClickUp origin fields so the link isn't lost after edit
      if (prev.source)    data.source    = prev.source;
      if (prev.clickupId) data.clickupId = prev.clickupId;
      if (prev.clickupUrl)data.clickupUrl= prev.clickupUrl;
      // preserve existing revision reasons (will be updated via modal if needed)
      data.motivosRevisao = prev.motivosRevisao || [];
      // if status changed to revisao/reprovado from a non-rev status, open reasons modal after save
      const wasRev = prev.status === 'revisao' || prev.status === 'reprovado';
      const isRev  = data.status === 'revisao'  || data.status === 'reprovado';
      if (isRev && !wasRev) data.revisoes = (data.revisoes || 0) + 1;
      tasks[idx] = data;
    }
  } else {
    data.createdAt = data.updatedAt;
    data.motivosRevisao = [];
    tasks.push(data);
  }
  saveTasks(tasks);
  closeModal('task');
  closeModal('task-detail');

  const newStatus = data.status;
  const isRevStatus = newStatus === 'revisao' || newStatus === 'reprovado';
  if (isRevStatus) {
    openRevisaoModal(data.id, newStatus);
  } else {
    renderPage(currentPage);
    showToast('Tarefa salva!');
  }

  if (data.clickupId) {
    try { await cuUpdateTask(data); } catch(e) { console.warn('ClickUp update falhou:', e.message); }
  }
}

function saveClient() {
  const nome  = document.getElementById('c-nome').value.trim();
  const sigla = document.getElementById('c-sigla').value.trim().toUpperCase();
  const nicho = document.getElementById('c-nicho').value.trim();
  if (!nome || !sigla) { showToast('Preencha nome e sigla', true); return; }
  const clients = getClients();
  if (clients.find(c=>c.id===sigla)) { showToast('Sigla já em uso', true); return; }
  const colors = ['#7c6af7','#22c55e','#f97316','#3b82f6','#eab308','#ec4899','#06b6d4','#a855f7'];
  clients.push({ id:sigla, nome, nicho, cor: colors[clients.length%colors.length] });
  saveClients(clients);
  document.getElementById('c-nome').value = '';
  document.getElementById('c-sigla').value = '';
  document.getElementById('c-nicho').value = '';
  closeModal('client');
  renderPage(currentPage);
  showToast('Cliente adicionado!');
}

// =====================================================
// TASK DETAIL
// =====================================================
function openTaskDetail(id) {
  const tasks = getTasks();
  const t = tasks.find(x=>x.id===id);
  if (!t) return;
  const c = clientById(t.cliente);
  const cuLink = t.clickupUrl ? `<a href="${t.clickupUrl}" target="_blank" class="tag tag-clickup" style="text-decoration:none">Abrir no ClickUp ↗</a>` : '';

  document.getElementById('task-detail-content').innerHTML = `
    <div style="display:grid;gap:10px">
      <div class="flex-center gap-8">
        <span style="width:10px;height:10px;border-radius:50%;background:${c?c.cor:'#666'}"></span>
        <span class="font-bold" style="font-size:15px">${c?c.nome:t.cliente}</span>
        ${tipoTag(t.tipo)}
        <span class="text-xs text-faint">${t.subtipo||''}</span>
        ${cuLink}
      </div>
      <div class="divider"></div>
      <div class="grid grid-2 gap-8">
        <div><div class="text-xs text-faint mb-4">Responsável</div><div class="text-sm font-bold">${memberName(t.responsavel)}</div></div>
        <div><div class="text-xs text-faint mb-4">Status</div>${statusTag(t.status)}</div>
        <div><div class="text-xs text-faint mb-4">Prazo de entrega</div><div class="text-sm">${fmtDateLong(t.prazo)}</div></div>
        <div><div class="text-xs text-faint mb-4">Data de postagem</div><div class="text-sm">${fmtDateLong(t.postagem)}</div></div>
        <div><div class="text-xs text-faint mb-4">Revisões</div><div class="text-sm font-bold" style="color:${(+t.revisoes||0)>1.5?'var(--red)':'var(--text)'}">${t.revisoes||0} ${severidadeTag(t.motivosRevisao)}</div></div>
        <div><div class="text-xs text-faint mb-4">Fonte</div><div class="text-sm">${t.source==='clickup'?'<span class="tag tag-clickup">ClickUp</span>':'Manual'}</div></div>
      </div>
      ${(t.motivosRevisao&&t.motivosRevisao.length)?`<div><div class="text-xs text-faint mb-6">Motivos da revisão</div><div class="flex-center gap-4 flex-wrap">${t.motivosRevisao.map(id=>{const m=MOTIVOS_REVISAO.find(x=>x.id===id);return m?`<span class="tag tag-yellow">${m.label} (${m.pontos}pt)</span>`:''}).join('')}</div>${t.revisaoJustificativa?`<div class="text-xs text-muted mt-6" style="font-style:italic">"${t.revisaoJustificativa}"</div>`:''}</div>`:''}
      ${t.obs?`<div><div class="text-xs text-faint mb-4">Observações</div><div class="text-sm text-muted" style="white-space:pre-wrap">${t.obs}</div></div>`:''}
      <div class="divider"></div>
      <div>
        <div class="text-xs text-faint mb-8">Atualizar Status</div>
        <div class="flex-center gap-4 flex-wrap">
          ${['pendente','em_andamento','revisao','reprovado','aprovado','concluido'].map(s=>
            `<button class="btn btn-ghost btn-xs${t.status===s?' btn-primary':''}" onclick="quickStatus('${id}','${s}')">${statusLabel(s)}</button>`
          ).join('')}
        </div>
      </div>
    </div>`;

  document.getElementById('task-detail-edit').onclick   = () => { closeModal('task-detail'); openEditTask(id); };
  document.getElementById('task-detail-delete').onclick = () => deleteTask(id);
  document.getElementById('modal-task-detail').classList.add('open');
}

async function quickStatus(id, status) {
  if (status === 'revisao' || status === 'reprovado' || status === 'descartado') {
    openRevisaoModal(id, status);
    return;
  }
  const tasks = getTasks();
  const t = tasks.find(x=>x.id===id);
  if (t) { t.status = status; t.updatedAt = new Date().toISOString(); }
  saveTasks(tasks);
  closeModal('task-detail');
  renderPage(currentPage);
  if (t?.clickupId) {
    try { await cuUpdateTask(t); } catch(e) { console.warn('ClickUp status falhou:', e.message); }
  }
}

function openEditTask(id) {
  const tasks = getTasks();
  const t = tasks.find(x=>x.id===id);
  if (!t) return;
  editingTaskId = id;
  document.getElementById('modal-task-title').textContent = 'Editar Tarefa';
  populateTaskForm();
  document.getElementById('t-nome').value       = t.nome||'';
  document.getElementById('t-cliente').value    = t.cliente;
  document.getElementById('t-tipo').value       = t.tipo;
  document.getElementById('t-subtipo').value    = t.subtipo||'geral';
  document.getElementById('t-responsavel').value= t.responsavel||'';
  document.getElementById('t-status').value     = t.status;
  document.getElementById('t-prazo').value      = t.prazo||'';
  document.getElementById('t-postagem').value   = t.postagem||'';
  document.getElementById('t-revisoes').value   = t.revisoes||0;
  document.getElementById('t-obs').value        = t.obs||'';
  document.getElementById('modal-task').classList.add('open');
}

// =====================================================
// MODAL DE MOTIVOS DE REVISÃO
// =====================================================
let _revisaoCtx = null; // { taskId, newStatus, prevStatus }

function openRevisaoModal(taskId, newStatus) {
  const tasks = getTasks();
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;

  _revisaoCtx = { taskId, newStatus, prevStatus: t.status };

  const isDesc = newStatus === 'descartado';
  const isReq  = newStatus === 'reprovado' || isDesc;
  const titles = { reprovado: 'Motivos da Reprovação', descartado: 'Motivo do Descarte', revisao: 'Motivos da Revisão' };
  document.getElementById('modal-revisao-title').textContent = titles[newStatus] || 'Motivos da Revisão';

  // Hide motivos section for "descartado" (only justificativa needed)
  const motivosList  = document.getElementById('revisao-motivos-list');
  const scoreBar     = document.getElementById('revisao-score-bar');
  motivosList.style.display  = isDesc ? 'none' : '';
  scoreBar.style.display     = isDesc ? 'none' : '';

  const existing = t.motivosRevisao || [];
  motivosList.innerHTML = MOTIVOS_REVISAO.map(m => `
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 12px;border-radius:8px;background:var(--bg3);user-select:none">
      <input type="checkbox" value="${m.id}" ${existing.includes(m.id)?'checked':''} onchange="revisaoUpdateScore()" style="width:16px;height:16px;accent-color:var(--accent)">
      <span class="text-sm" style="flex:1">${m.label}</span>
      <span class="tag tag-gray" style="font-size:11px">${m.pontos}pt</span>
    </label>`).join('');

  const justLabel = document.querySelector('#modal-revisao label[for="revisao-justificativa"], #modal-revisao .form-group label');
  if (justLabel) justLabel.innerHTML = `Justificativa ${isReq ? '<span style="color:var(--red)">*</span>' : '<span class="text-faint">(opcional)</span>'}`;

  document.getElementById('revisao-justificativa').value = t.revisaoJustificativa || '';
  revisaoUpdateScore();
  document.getElementById('modal-revisao').classList.add('open');
}

function revisaoUpdateScore() {
  const checked = [...document.querySelectorAll('#revisao-motivos-list input:checked')].map(el => el.value);
  const total = checked.reduce((sum, id) => {
    const m = MOTIVOS_REVISAO.find(x => x.id === id);
    return sum + (m ? m.pontos : 0);
  }, 0);
  let nivel = 'Esperado', color = 'var(--text-faint)';
  if (total >= 4) { nivel = 'Grave';   color = 'var(--red)'; }
  else if (total >= 3) { nivel = 'Atenção'; color = 'var(--yellow)'; }
  const bar = document.getElementById('revisao-score-bar');
  bar.style.color = color;
  bar.textContent = checked.length ? `${total} ponto${total!==1?'s':''} — ${nivel}` : 'Nenhum motivo selecionado';
}

async function revisaoModalConfirmar() {
  if (!_revisaoCtx) return;
  const { taskId, newStatus, prevStatus } = _revisaoCtx;
  const motivos = [...document.querySelectorAll('#revisao-motivos-list input:checked')].map(el => el.value);
  const justificativa = document.getElementById('revisao-justificativa').value.trim();

  const isRequired = newStatus === 'reprovado' || newStatus === 'descartado';
  if (isRequired && !justificativa) {
    const el = document.getElementById('revisao-justificativa');
    el.style.borderColor = 'var(--red)';
    el.focus();
    el.placeholder = 'Justificativa obrigatória para este status';
    setTimeout(() => { el.style.borderColor = ''; }, 2000);
    return;
  }

  const tasks = getTasks();
  const t = tasks.find(x => x.id === taskId);
  if (t) {
    const wasRevStatus = prevStatus === 'revisao' || prevStatus === 'reprovado' || prevStatus === 'descartado';
    t.status              = newStatus;
    t.motivosRevisao      = motivos;
    t.revisaoJustificativa = justificativa || '';
    if (!wasRevStatus) t.revisoes = (t.revisoes || 0) + 1;
    t.updatedAt     = new Date().toISOString();
  }
  saveTasks(tasks);
  document.getElementById('modal-revisao').classList.remove('open');
  closeModal('task-detail');
  renderPage(currentPage);
  showToast('Status atualizado');
  if (t?.clickupId) {
    try { await cuUpdateTask(t); } catch(e) { console.warn('ClickUp status falhou:', e.message); }
  }
  _revisaoCtx = null;
}

function revisaoModalCancelar() {
  document.getElementById('modal-revisao').classList.remove('open');
  _revisaoCtx = null;
}

function savePrioridades() {
  const vals = [0,1,2].map(i => (document.getElementById('prior-'+i)||{value:''}).value || '');
  localStorage.setItem('cd_prioridades_' + today(), JSON.stringify(vals));
}

async function deleteTask(id) {
  if (!confirm('Excluir esta tarefa?')) return;
  const tasks = getTasks();
  const t = tasks.find(x => x.id === id);
  saveTasks(tasks.filter(t=>t.id!==id));
  closeModal('task-detail');
  renderPage(currentPage);
  showToast('Tarefa excluída');
  if (t?.clickupId) {
    try { await cuDeleteTask(t.clickupId); } catch(e) { console.warn('ClickUp delete falhou:', e.message); }
  }
}

// =====================================================
// INIT
// =====================================================
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target===el) el.classList.remove('open'); });
});

function init() {
  // Close client dropdowns when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.client-drop-panel') && !e.target.closest('[onclick*="toggleClientDropdown"]')) {
      document.querySelectorAll('.client-drop-panel').forEach(p => { p.style.display = 'none'; });
    }
  });

  // Aplica overrides salvos sobre as constantes globais
  const savedAloc  = JSON.parse(localStorage.getItem('cd_alocacao')  || 'null');
  const savedFluxo = JSON.parse(localStorage.getItem('cd_fluxo')     || 'null');
  if (savedAloc)  Object.assign(ALOCACAO,       savedAloc);
  if (savedFluxo) Object.assign(FLUXO_SEMANAL,  savedFluxo);

  renderDashboard();
  renderFwSemana();
  renderFwRegras();

  // Restore auto-sync if it was active before page reload
  const cfg = getClickUpCfg();
  if (cfg.token && cfg.mappings && cfg.mappings.length) {
    const savedInterval = parseInt(localStorage.getItem('cd_autosync_interval') || '0');
    if (savedInterval > 0) {
      cuStartAutoSync(savedInterval);
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
