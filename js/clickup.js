// =====================================================
// CLICKUP API INTEGRATION
// =====================================================
const CU_BASE = 'https://api.clickup.com/api/v2';

async function cuFetch(endpoint) {
  const cfg = getClickUpCfg();
  if (!cfg.token) throw new Error('Token não configurado');
  const res = await fetch(CU_BASE + endpoint, {
    headers: { 'Authorization': cfg.token, 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.err || `HTTP ${res.status}`);
  }
  return res.json();
}

async function cuPost(endpoint, body) {
  const cfg = getClickUpCfg();
  if (!cfg.token) throw new Error('Token não configurado');
  const res = await fetch(CU_BASE + endpoint, {
    method: 'POST',
    headers: { 'Authorization': cfg.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.err || `HTTP ${res.status}`);
  }
  return res.json();
}

async function cuPut(endpoint, body) {
  const cfg = getClickUpCfg();
  if (!cfg.token) throw new Error('Token não configurado');
  const res = await fetch(CU_BASE + endpoint, {
    method: 'PUT',
    headers: { 'Authorization': cfg.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.err || `HTTP ${res.status}`);
  }
  return res.json();
}

async function cuDeleteReq(endpoint) {
  const cfg = getClickUpCfg();
  if (!cfg.token) throw new Error('Token não configurado');
  const res = await fetch(CU_BASE + endpoint, {
    method: 'DELETE',
    headers: { 'Authorization': cfg.token, 'Content-Type': 'application/json' }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.err || `HTTP ${res.status}`);
  }
  return res.status === 204 ? {} : res.json().catch(() => ({}));
}

async function cuGetWorkspaceMembers(workspaceId) {
  const data = await cuFetch(`/team/${workspaceId}`);
  return (data.team?.members || []).map(m => m.user);
}

async function cuGetWorkspaces() {
  const data = await cuFetch('/team');
  return data.teams || [];
}

async function cuGetSpaces(workspaceId) {
  const data = await cuFetch(`/team/${workspaceId}/space?archived=false`);
  return data.spaces || [];
}

async function cuGetFolders(spaceId) {
  const data = await cuFetch(`/space/${spaceId}/folder?archived=false`);
  return data.folders || [];
}

async function cuGetFolderlessLists(spaceId) {
  const data = await cuFetch(`/space/${spaceId}/list?archived=false`);
  return data.lists || [];
}

async function cuGetFolderLists(folderId) {
  const data = await cuFetch(`/folder/${folderId}/list?archived=false`);
  return data.lists || [];
}

async function cuGetAllLists(spaceId) {
  const [folders, folderless] = await Promise.all([
    cuGetFolders(spaceId),
    cuGetFolderlessLists(spaceId)
  ]);
  const fromFolders = (await Promise.all(folders.map(f => cuGetFolderLists(f.id)))).flat();
  return [...folderless, ...fromFolders];
}

async function cuGetTasks(listId, fromDateMs) {
  const all = [];
  let page = 0;
  const dateFilter = fromDateMs ? `&due_date_gt=${fromDateMs}` : '';
  while (true) {
    const data = await cuFetch(`/list/${listId}/task?include_closed=true&subtasks=true&order_by=due_date&page=${page}${dateFilter}`);
    const batch = data.tasks || [];
    all.push(...batch);
    if (batch.length < 100) break; // last page
    page++;
  }
  return all;
}

// Map ClickUp status string ? internal status
// Status reais deste workspace: pendente | copywriter | design | edição | aprovação | concluídos
function cuMapStatus(cuStatus) {
  if (!cuStatus) return 'pendente';
  const s = cuStatus.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // concluído
  if (/conclu|done|complet|feito|entregue/.test(s)) return 'concluido';
  // aprovado (já aprovado, não aguardando)
  if (/^aprovad|^approved/.test(s)) return 'aprovado';
  // reprovada
  if (/reprov/.test(s)) return 'reprovado';
  if (/descart/.test(s)) return 'descartado';
  // aguardando aprovação do cliente (distinto de revisão interna)
  if (/aprovac|aprovacao|aguard/.test(s)) return 'aprovacao';
  // em revisão interna
  if (/review|revis/.test(s)) return 'revisao';
  // em andamento - etapas ativas de produção
  if (/copywriter|design|edicao|edicao|gravac|progress|andamento|doing|fazendo/.test(s)) return 'em_andamento';
  return 'pendente';
}

// Infer task type from name + tags
function cuInferTipo(name, tags) {
  const text = (name + ' ' + (tags || []).map(t => t.name || '').join(' ')).toLowerCase();
  if (/copy|legenda|texto|caption/.test(text)) return 'copy';
  if (/design|arte|feed|layout|banner/.test(text)) return 'design';
  if (/video|vídeo|reels|reel|edit|montag/.test(text)) return 'video';
  if (/revis|review/.test(text)) return 'revisao';
  if (/post|publ/.test(text)) return 'postagem';
  return 'outro';
}

// Mapeamento explícito: username ClickUp ? id interno
// (baseado nos nomes reais encontrados no workspace)
const CU_ASSIGNEE_MAP = {
  'victor turati':        'cd',
  'isa caruso':           'isa',
  'fernanda naya':        'fernanda',
  'luis lobao':           'luis',
  'yasmin maranesi':      'yasmin',
  'daiane marques':       'dai',
  'thais leal':           'thais',
  'pedro victor melo nonato': 'pedro',
  'ana maruju':           'maruju',
};

function cuMapAssignee(assignees) {
  if (!assignees || !assignees.length) return '';
  for (const a of assignees) {
    const key = (a.username || '').toLowerCase().trim();
    if (CU_ASSIGNEE_MAP[key]) return CU_ASSIGNEE_MAP[key];
    // fallback: busca parcial no nome
    const team = getTeam();
    const firstName = key.split(' ')[0];
    const match = team.find(m => m.nome.toLowerCase().includes(firstName));
    if (match) return match.id;
  }
  return '';
}

// Convert a ClickUp task to internal task format
// existingTask: previous local version of this task (used to preserve/increment revision count)
function cuMapTask(cuTask, clientId, existingTask) {
  const newStatus = cuMapStatus(cuTask.status?.status);
  const prevStatus = existingTask?.status;
  const isRevStatus = s => s === 'revisao' || s === 'reprovado';

  // Increment revision count when status transitions into revisao/reprovado from a non-revision state
  let revisoes = existingTask?.revisoes || 0;
  if (isRevStatus(newStatus) && prevStatus && !isRevStatus(prevStatus)) {
    revisoes++;
  }

  return {
    id: existingTask?.id || ('cu_' + cuTask.id),
    source: 'clickup',
    clickupId: cuTask.id,
    clickupUrl: cuTask.url,
    cliente: clientId,
    nome: cuTask.name,
    tipo: cuInferTipo(cuTask.name, cuTask.tags),
    subtipo: existingTask?.subtipo || 'geral',
    responsavel: cuMapAssignee(cuTask.assignees),
    status: newStatus,
    prazo: cuTask.due_date ? new Date(+cuTask.due_date).toISOString().split('T')[0] : '',
    postagem: existingTask?.postagem || '',
    revisoes,
    motivosRevisao: existingTask?.motivosRevisao || [],
    obs: cuTask.description || '',
    updatedAt: new Date().toISOString(),
    createdAt: cuTask.date_created ? new Date(+cuTask.date_created).toISOString() : new Date().toISOString()
  };
}

// Main sync: fetch all configured lists, merge into local tasks
async function cuSync(fromDateMs) {
  const cfg = getClickUpCfg();
  if (!cfg.token || !cfg.mappings || !cfg.mappings.length) {
    throw new Error('Configure o token e mapeamentos antes de sincronizar');
  }

  const allExisting = getTasks();
  // For date-filtered sync, keep existing clickup tasks outside the filter range
  let tasks = allExisting.filter(t => {
    if (t.source !== 'clickup') return true; // always keep manual tasks
    if (!fromDateMs) return false;           // global: drop all clickup tasks
    // keep clickup tasks with prazo BEFORE the filter date (they won't come back)
    const prazoMs = t.prazo ? new Date(t.prazo + 'T00:00:00').getTime() : 0;
    return prazoMs < fromDateMs;
  });
  let synced = 0;
  const errors = [];

  for (const mapping of cfg.mappings) {
    if (!mapping.listId || !mapping.clientId) continue;
    try {
      const cuTasks = await cuGetTasks(mapping.listId, fromDateMs);
      for (const ct of cuTasks) {
        const existing = allExisting.find(t => t.clickupId === ct.id);
        tasks.push(cuMapTask(ct, mapping.clientId, existing));
        synced++;
      }
    } catch (e) {
      errors.push(`Lista ${mapping.listId}: ${e.message}`);
    }
  }

  saveTasks(tasks);
  const syncMeta = { lastSync: new Date().toISOString(), count: synced, errors };
  localStorage.setItem('cd_clickup_sync', JSON.stringify(syncMeta));
  return syncMeta;
}

function cuGetLastSync() {
  return JSON.parse(localStorage.getItem('cd_clickup_sync') || 'null');
}

async function cuTestConnection() {
  const workspaces = await cuGetWorkspaces();
  return workspaces.length > 0;
}

// =====================================================
// AUTO-SYNC (polling)
// =====================================================
let _autoSyncTimer = null;

// Returns a lightweight fingerprint of the tasks list to detect changes
function _cuTasksHash(tasks) {
  return tasks.map(t => t.id + ':' + (t.status?.status || '') + ':' + (t.due_date || '') + ':' + (t.date_updated || '')).join('|');
}

// Silently check if any mapped list changed and sync if so
async function cuAutoSyncCheck() {
  const cfg = getClickUpCfg();
  if (!cfg.token || !cfg.mappings || !cfg.mappings.length) return;

  let changed = false;
  for (const mapping of cfg.mappings) {
    if (!mapping.listId) continue;
    try {
      const fresh = await cuGetTasks(mapping.listId);
      const prevKey = 'cd_cu_hash_' + mapping.listId;
      const prevHash = localStorage.getItem(prevKey) || '';
      const newHash  = _cuTasksHash(fresh);
      if (newHash !== prevHash) {
        changed = true;
        localStorage.setItem(prevKey, newHash);
      }
    } catch(e) { /* silent - network errors shouldn't break auto-sync */ }
  }

  if (changed) {
    try {
      const result = await cuSync();
      // notify UI if currently on a visible page
      if (typeof renderPage === 'function' && typeof currentPage !== 'undefined') {
        renderPage(currentPage);
      }
      if (typeof showToast === 'function') {
        showToast(`ClickUp: ${result.count} tarefas atualizadas`);
      }
    } catch(e) { /* silent */ }
  }
}

// Start polling at the given interval in minutes (default 5)
function cuStartAutoSync(intervalMinutes) {
  const ms = (intervalMinutes || 5) * 60 * 1000;
  cuStopAutoSync();
  _autoSyncTimer = setInterval(cuAutoSyncCheck, ms);
  localStorage.setItem('cd_autosync_interval', String(intervalMinutes || 5));
}

function cuStopAutoSync() {
  if (_autoSyncTimer) { clearInterval(_autoSyncTimer); _autoSyncTimer = null; }
}

function cuAutoSyncRunning() { return _autoSyncTimer !== null; }
function cuAutoSyncInterval() { return parseInt(localStorage.getItem('cd_autosync_interval') || '5'); }

// =====================================================
// CRIAÇÃO DE DEMANDAS NO CLICKUP (via Gerador)
// =====================================================
// Mapa: ID interno ? ID numérico do ClickUp
const CU_USER_ID = {
  cd:       100014023,
  isa:      112035853,
  fernanda: 100014042,
  luis:     100014041,
  yasmin:   248617546,
  dai:      100004956,
  thais:    236586854,
  pedro:    55186776,
  maruju:   112114228
};

async function cuCriarDemandas(preview) {
  const cfg = getClickUpCfg();
  if (!cfg.token || !cfg.mappings?.length) return { ok: 0, errs: 1, msg: 'ClickUp não configurado' };

  const ts      = d => d ? new Date(d + 'T23:59:00-03:00').getTime() : undefined;
  const cuIds   = ids => (Array.isArray(ids) ? ids : [ids]).map(id => CU_USER_ID[id]).filter(Boolean);
  const getList = clientId => {
    const m = cfg.mappings.find(m => m.clientId === clientId && /produ/i.test(m.label || ''))
           || cfg.mappings.find(m => m.clientId === clientId);
    return m?.listId;
  };

  const postTask = async (listId, body) => {
    const r = await fetch(`${CU_BASE}/list/${listId}/task`, {
      method: 'POST',
      headers: { Authorization: cfg.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.err || `HTTP ${r.status}`);
    return data;
  };

  // Agrupa subtarefas por (cliente, postagem, pieceKey) ? gera 1 tarefa pai por grupo
  const groups = {};
  for (const t of preview) {
    const key = `${t.cliente}||${t.postagem}||${t.pieceKey || t.tipo}`;
    if (!groups[key]) groups[key] = { ...t, subs: [] };
    groups[key].subs.push(t);
  }

  let ok = 0, errs = 0;
  for (const g of Object.values(groups)) {
    const listId = getList(g.cliente);
    if (!listId) { errs++; continue; }

    const clients    = getClients();
    const c          = clients.find(cl => cl.id === g.cliente);
    const clienteNome = c?.nome || g.cliente;
    const aloc       = ALOCACAO[g.cliente] || {};

    try {
      const paiBody = {
        name:      geradorNomePai(g.pieceKey || g.tipo, clienteNome, g.postagem),
        due_date:  ts(g.postagem),
        assignees: cuIds(aloc.pai || 'cd')
      };
      if (g.descricaoPai) paiBody.description = g.descricaoPai;

      const pai = await postTask(listId, paiBody);
      ok++;

      for (const sub of g.subs) {
        try {
          await postTask(listId, {
            name:      geradorNomeSub(sub.tipo, sub.subtipo, clienteNome, sub.prazo),
            due_date:  ts(sub.prazo),
            assignees: cuIds(sub.responsavel),
            parent:    pai.id
          });
        } catch (e) { errs++; }
      }
    } catch (e) { errs++; }
  }

  return { ok, errs };
}

// =====================================================
// WRITE-BACK: update / delete tasks in ClickUp
// =====================================================
function cuStatusToClickUp(s) {
  switch (s) {
    case 'concluido':    return 'concluídos';
    case 'aprovado':     return 'aprovado';
    case 'aprovacao':    return 'aprovação';
    case 'revisao':      return 'revisão';
    case 'reprovado':    return 'reprovada';
    case 'descartado':   return 'descartado';
    case 'em_andamento': return 'copywriter';
    default:             return 'pendente';
  }
}

// Push a local task's editable fields to ClickUp (only if it has a clickupId)
async function cuUpdateTask(task) {
  const cfg = getClickUpCfg();
  if (!cfg.token || !task?.clickupId) return;
  const ts  = d => d ? new Date(d + 'T23:59:00-03:00').getTime() : null;
  const body = { status: cuStatusToClickUp(task.status) };
  if (task.nome)        body.name     = task.nome;
  if (task.prazo !== undefined) body.due_date = ts(task.prazo) || undefined;
  if (task.responsavel) {
    const uid = CU_USER_ID[task.responsavel];
    if (uid) body.assignees = { add: [uid], rem: [] };
  }
  await cuPut(`/task/${task.clickupId}`, body);
}

// Delete a task in ClickUp by its clickupId
async function cuDeleteTask(clickupId) {
  const cfg = getClickUpCfg();
  if (!cfg.token || !clickupId) return;
  await cuDeleteReq(`/task/${clickupId}`);
}
