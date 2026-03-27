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

async function cuGetTasks(listId) {
  const all = [];
  let page = 0;
  while (true) {
    const data = await cuFetch(`/list/${listId}/task?include_closed=true&subtasks=true&order_by=due_date&page=${page}`);
    const batch = data.tasks || [];
    all.push(...batch);
    if (batch.length < 100) break; // last page
    page++;
  }
  return all;
}

// Map ClickUp status string → internal status
// Status reais deste workspace: pendente | copywriter | design | edição | aprovação | concluídos
function cuMapStatus(cuStatus) {
  if (!cuStatus) return 'pendente';
  const s = cuStatus.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // concluído
  if (/conclu|done|complet|feito|entregue/.test(s)) return 'concluido';
  // aprovado (já aprovado, não aguardando)
  if (/^aprovad|^approved/.test(s)) return 'aprovado';
  // em revisão / aguardando aprovação
  if (/aprovac|aprovação|review|revis|aguard/.test(s)) return 'revisao';
  // em andamento — etapas ativas de produção
  if (/copywriter|design|edicao|edição|gravac|progress|andamento|doing|fazendo/.test(s)) return 'em_andamento';
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

// Mapeamento explícito: username ClickUp → id interno
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
function cuMapTask(cuTask, clientId) {
  return {
    id: 'cu_' + cuTask.id,
    source: 'clickup',
    clickupId: cuTask.id,
    clickupUrl: cuTask.url,
    cliente: clientId,
    nome: cuTask.name,
    tipo: cuInferTipo(cuTask.name, cuTask.tags),
    subtipo: 'geral',
    responsavel: cuMapAssignee(cuTask.assignees),
    status: cuMapStatus(cuTask.status?.status),
    prazo: cuTask.due_date ? new Date(+cuTask.due_date).toISOString().split('T')[0] : '',
    postagem: '',
    revisoes: 0,
    obs: cuTask.description || '',
    updatedAt: new Date().toISOString(),
    createdAt: cuTask.date_created ? new Date(+cuTask.date_created).toISOString() : new Date().toISOString()
  };
}

// Main sync: fetch all configured lists, merge into local tasks
async function cuSync() {
  const cfg = getClickUpCfg();
  if (!cfg.token || !cfg.mappings || !cfg.mappings.length) {
    throw new Error('Configure o token e mapeamentos antes de sincronizar');
  }

  let tasks = getTasks().filter(t => t.source !== 'clickup'); // keep only manual tasks
  let synced = 0;
  const errors = [];

  for (const mapping of cfg.mappings) {
    if (!mapping.listId || !mapping.clientId) continue;
    try {
      const cuTasks = await cuGetTasks(mapping.listId);
      for (const ct of cuTasks) {
        tasks.push(cuMapTask(ct, mapping.clientId));
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
    } catch(e) { /* silent — network errors shouldn't break auto-sync */ }
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
