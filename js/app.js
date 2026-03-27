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

function saveTask() {
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
      data.createdAt  = prev.createdAt  || data.updatedAt;
      // preserve ClickUp origin fields so the link isn't lost after edit
      if (prev.source)    data.source    = prev.source;
      if (prev.clickupId) data.clickupId = prev.clickupId;
      if (prev.clickupUrl)data.clickupUrl= prev.clickupUrl;
      tasks[idx] = data;
    }
  } else {
    data.createdAt = data.updatedAt;
    tasks.push(data);
  }
  saveTasks(tasks);
  closeModal('task');
  closeModal('task-detail');
  renderPage(currentPage);
  showToast('Tarefa salva!');
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
        <div><div class="text-xs text-faint mb-4">Revisões</div><div class="text-sm font-bold" style="color:${(+t.revisoes||0)>1.5?'var(--red)':'var(--text)'}">${t.revisoes||0}</div></div>
        <div><div class="text-xs text-faint mb-4">Fonte</div><div class="text-sm">${t.source==='clickup'?'<span class="tag tag-clickup">ClickUp</span>':'Manual'}</div></div>
      </div>
      ${t.obs?`<div><div class="text-xs text-faint mb-4">Observações</div><div class="text-sm text-muted" style="white-space:pre-wrap">${t.obs}</div></div>`:''}
      <div class="divider"></div>
      <div>
        <div class="text-xs text-faint mb-8">Atualizar Status</div>
        <div class="flex-center gap-4 flex-wrap">
          ${['pendente','em_andamento','revisao','aprovado','concluido'].map(s=>
            `<button class="btn btn-ghost btn-xs${t.status===s?' btn-primary':''}" onclick="quickStatus('${id}','${s}')">${statusLabel(s)}</button>`
          ).join('')}
        </div>
      </div>
    </div>`;

  document.getElementById('task-detail-edit').onclick   = () => { closeModal('task-detail'); openEditTask(id); };
  document.getElementById('task-detail-delete').onclick = () => deleteTask(id);
  document.getElementById('modal-task-detail').classList.add('open');
}

function quickStatus(id, status) {
  const tasks = getTasks();
  const t = tasks.find(x=>x.id===id);
  if (t) { t.status = status; t.updatedAt = new Date().toISOString(); }
  saveTasks(tasks);
  closeModal('task-detail');
  renderPage(currentPage);
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

function savePrioridades() {
  const vals = [0,1,2].map(i => (document.getElementById('prior-'+i)||{value:''}).value || '');
  localStorage.setItem('cd_prioridades_' + today(), JSON.stringify(vals));
}

function deleteTask(id) {
  if (!confirm('Excluir esta tarefa?')) return;
  saveTasks(getTasks().filter(t=>t.id!==id));
  closeModal('task-detail');
  renderPage(currentPage);
  showToast('Tarefa excluída');
}

// =====================================================
// INIT
// =====================================================
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target===el) el.classList.remove('open'); });
});

function init() {
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
