// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function today() { return new Date().toISOString().split('T')[0]; }

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function fmtDateLong(s) {
  if (!s) return '—';
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' });
}
function fmtDateTime(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' })
    + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

function isOverdue(dateStr, status) {
  if (!dateStr || status === 'concluido' || status === 'aprovado' || status === 'aprovacao' || status === 'reprovado' || status === 'descartado' || status === 'travado') return false;
  return dateStr < today();
}

function getWeekDates(offset) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function statusTag(s) {
  const map = {
    pendente:     ['tag-gray',   'Pendente'],
    em_andamento: ['tag-blue',   'Em Andamento'],
    revisao:      ['tag-yellow', 'Em Revisão'],
    aprovacao:    ['tag-purple', 'Aguard. Aprovação'],
    reprovado:    ['tag-red',    'Reprovado'],
    descartado:   ['tag-gray',   'Descartado'],
    aprovado:     ['tag-green',  'Aprovado'],
    concluido:    ['tag-green',  'Concluído'],
    travado:      ['tag-orange', 'Travado'],
    atrasado:     ['tag-red',    'Atrasado']
  };
  const [cls, label] = map[s] || ['tag-gray', s];
  return `<span class="tag ${cls}">${label}</span>`;
}

function revisaoSeveridade(motivos) {
  if (!motivos || !motivos.length) return null;
  const total = motivos.reduce((sum, id) => {
    const m = MOTIVOS_REVISAO.find(x => x.id === id);
    return sum + (m ? m.pontos : 0);
  }, 0);
  if (total >= 4) return { nivel: 'Grave',    cls: 'tag-red',    pontos: total };
  if (total >= 3) return { nivel: 'Atenção',  cls: 'tag-orange', pontos: total };
  return              { nivel: 'Esperado', cls: 'tag-gray',   pontos: total };
}

function severidadeTag(motivos) {
  const s = revisaoSeveridade(motivos);
  if (!s) return '';
  return `<span class="tag ${s.cls}" title="${s.pontos} pontos">${s.nivel}</span>`;
}

function tipoTag(t) {
  const map = {
    copy:     ['tag-purple', 'Copy'],
    design:   ['tag-blue',   'Design'],
    video:    ['tag-orange', 'Vídeo'],
    dark:     ['tag-orange', 'Dark Post'],
    revisao:  ['tag-yellow', 'Revisão'],
    postagem: ['tag-green',  'Postagem'],
    outro:    ['tag-gray',   'Outro']
  };
  const [cls, label] = map[t] || ['tag-gray', t];
  return `<span class="tag ${cls}">${label}</span>`;
}

function statusLabel(s) {
  return { pendente:'Pendente', em_andamento:'Em Andamento', revisao:'Em Revisão', aprovacao:'Aguard. Aprovação',
           reprovado:'Reprovado', descartado:'Descartado', aprovado:'Aprovado', concluido:'Concluído',
           travado:'Travado', atrasado:'Atrasado' }[s] || s;
}

function tipoLabel(t) {
  return { copy:'Copy', design:'Design', video:'Vídeo', dark:'Dark Post',
           revisao:'Revisão', postagem:'Postagem', outro:'Outro' }[t] || t;
}

function prazoSemaforo(dateStr, status) {
  if (!dateStr || status === 'concluido' || status === 'aprovado' || status === 'aprovacao' || status === 'reprovado' || status === 'descartado' || status === 'travado')
    return `<span class="text-muted">${fmtDate(dateStr)}</span>`;
  const diff = Math.floor((new Date(dateStr) - new Date(today())) / 86400000);
  if (diff < 0)  return `<span style="color:var(--red);font-weight:700">${fmtDate(dateStr)} (${Math.abs(diff)}d atraso)</span>`;
  if (diff <= 2) return `<span style="color:var(--red)">${fmtDate(dateStr)}</span>`;
  if (diff <= 7) return `<span style="color:var(--yellow)">${fmtDate(dateStr)}</span>`;
  return `<span style="color:var(--green)">${fmtDate(dateStr)}</span>`;
}

function papelLabel(p) {
  return {
    pai:'Responsável', copy:'Copy', assistCopy:'Assist. Copy',
    revisao:'Revisão', design:'Design', edicao:'Edição de Vídeo', trafego:'Tráfego',
    copyDark:'Copy Dark', designDark:'Design Dark', relatorioResp:'Relatório'
  }[p] || p;
}

function memberName(id) {
  const m = memberById(id);
  return m ? m.nome : (id || '—');
}

function memberLabel(id) {
  const m = memberById(id);
  if (!m) return id || '—';
  return m.email ? `${m.nome} — ${m.email}` : m.nome;
}

// =====================================================
// NOMENCLATURA GERADOR (padrão ClickUp)
// =====================================================
function geradorPieceLabel(pieceKey, pieceNome) {
  const map = { feed1:'Design', feed2:'Design', video:'Vídeo', dark:'Dark', email:'E-mail Marketing' };
  return map[pieceKey] || pieceNome || 'Demanda';
}

function geradorSubtipoLabel(tipo, subtipo) {
  if (subtipo === 'copy-capa')    return 'Copy da capa';
  if (subtipo === 'capa-video')   return 'Design de capa de vídeo';
  if (subtipo === 'copy-dark')    return 'Copy';
  if (subtipo === 'design-dark')  return 'Design';
  if (subtipo === 'legenda')      return 'Legenda';
  if (subtipo === 'revisao-ter')  return 'Revisão Terça';
  if (subtipo === 'revisao-qui')  return 'Revisão Quinta';
  if (subtipo === 'edição de vídeo' || tipo === 'edicao') return 'Edição de Vídeo';
  if (tipo === 'copy')            return 'Copy';
  if (tipo === 'revisao')         return 'Revisão';
  if (tipo === 'design')          return 'Design';
  if (tipo === 'video')           return 'Edição';
  if (tipo === 'relatorio')       return 'Relatório Semanal';
  return tipo;
}

// Nome da tarefa pai — com padrão especial para relatório
function geradorNomePai(pieceKey, clienteNome, dataPost, pieceNome) {
  if (pieceKey === 'relatorio')
    return `Relatório Semanal — ${clienteNome} | Semana ${fmtDate(dataPost)}: `;
  return `${geradorPieceLabel(pieceKey, pieceNome)} — ${clienteNome} | Postagem ${fmtDate(dataPost)}: `;
}

// Nome da subtarefa — com padrão especial para revisões do relatório
function geradorNomeSub(tipo, subtipo, clienteNome, prazo) {
  if (subtipo === 'revisao-ter' || subtipo === 'revisao-qui')
    return `Relatório Semanal — ${clienteNome} | Revisão de ${fmtDate(prazo)}: `;
  return `${geradorSubtipoLabel(tipo, subtipo)} — ${clienteNome} | Entrega ${fmtDate(prazo)}: `;
}

// == Sort state (multi-nível) =================================
// _taskSort: array de { col, dir } em ordem de prioridade
let _taskSort    = [];
let _taskTableEl   = null;
let _taskTableData = [];

function _colVal(t, col) {
  if (col === 'cliente') return t.cliente  || '';
  if (col === 'tipo')    return t.tipo     || '';
  if (col === 'titulo')  return _tarefaTitulo(t);
  if (col === 'resp')    return memberName(t.responsavel);
  if (col === 'prazo')   return t.prazo    || '';
  if (col === 'post')    return t.postagem || '';
  if (col === 'status')  return t.status   || '';
  if (col === 'rev')     return t.revisoes  || 0;
  if (col === 'criacao') return t.createdAt || '';
  return '';
}

function _applyTaskSort(tasks) {
  if (!_taskSort.length) return tasks;
  return [...tasks].sort((a, b) => {
    for (const { col, dir } of _taskSort) {
      const va = _colVal(a, col);
      const vb = _colVal(b, col);
      if (va < vb) return -dir;
      if (va > vb) return  dir;
    }
    return 0;
  });
}

// Ciclo: ausente →' asc →' desc →' remove
function sortTasks(col) {
  const idx = _taskSort.findIndex(s => s.col === col);
  if (idx === -1) {
    _taskSort.push({ col, dir: 1 });        // adiciona como próximo nível
  } else if (_taskSort[idx].dir === 1) {
    _taskSort[idx].dir = -1;               // inverte
  } else {
    _taskSort.splice(idx, 1);              // remove; renumera automaticamente
  }
  if (_taskTableEl) renderTaskTable(_taskTableEl, _taskTableData, true);
}

function _sortIcon(col) {
  const idx = _taskSort.findIndex(s => s.col === col);
  if (idx === -1) return '<span style="opacity:.25;font-size:10px"> ↕</span>';
  const num   = _taskSort.length > 1 ? `<sup style="font-size:9px">${idx + 1}</sup>` : '';
  const arrow = _taskSort[idx].dir === 1 ? '↑' : '↓';
  return `<span style="font-size:10px;color:var(--accent)"> ${arrow}${num}</span>`;
}

function _th(label, col) {
  return `<th onclick="sortTasks('${col}')" style="cursor:pointer;user-select:none;white-space:nowrap">${label}${_sortIcon(col)}</th>`;
}

let _yearVisible      = {}; // yr        →' false=hidden (default open)
let _monthVisible     = {}; // yr_mo     →' false=hidden (default open)
let _completedVisible  = {}; // done_yr_mo→ true=visible (default closed)
let _reprovadoVisible  = {}; // rep_yr_mo → true=visible (default closed)
let _descartadoVisible = {}; // des_yr_mo → true=visible (default closed)
let _selectedTasks     = new Set();

function resetTaskTableView() {
  _yearVisible = {}; _monthVisible = {}; _pieceVisible = {};
  _completedVisible = {}; _reprovadoVisible = {}; _descartadoVisible = {};
}

let _pieceVisible = {}; // cl_post_piece -> false=hidden (default open)

function togglePiece(key) {
  _pieceVisible[key] = _pieceVisible[key] !== false ? false : true;
  if (_taskTableEl) renderTaskTable(_taskTableEl, _taskTableData, true);
}

function _pieceLabel(pieceKey, clienteId, subs) {
  if (pieceKey) {
    const fluxo = FLUXO_SEMANAL[clienteId];
    if (fluxo) { const p = fluxo.pieces.find(x => x.key === pieceKey); if (p) return p.nome; }
    const map = { feed1: 'Design 1', feed2: 'Design 2', video: 'Vídeo', dark: 'Dark Post' };
    return map[pieceKey] || pieceKey;
  }
  if ((subs||[]).some(t => t.tipo === 'video'))  return 'Vídeo';
  if ((subs||[]).some(t => t.tipo === 'dark'))   return 'Dark Post';
  if ((subs||[]).some(t => t.tipo === 'design')) return 'Design';
  return 'Conteúdo';
}

function toggleYear(yr) {
  _yearVisible[yr] = _yearVisible[yr] !== false ? false : true;
  if (_taskTableEl) renderTaskTable(_taskTableEl, _taskTableData, true);
}

function toggleMonth(key) {
  _monthVisible[key] = _monthVisible[key] !== false ? false : true;
  if (_taskTableEl) renderTaskTable(_taskTableEl, _taskTableData, true);
}

function toggleCompleted(key) {
  _completedVisible[key] = !_completedVisible[key];
  if (_taskTableEl) renderTaskTable(_taskTableEl, _taskTableData, true);
}

function toggleReprovado(key) {
  _reprovadoVisible[key] = !_reprovadoVisible[key];
  if (_taskTableEl) renderTaskTable(_taskTableEl, _taskTableData, true);
}

function toggleDescartado(key) {
  _descartadoVisible[key] = !_descartadoVisible[key];
  if (_taskTableEl) renderTaskTable(_taskTableEl, _taskTableData, true);
}

// ── Justificativa tooltip ──────────────────────────────
let _tooltipEl = null;
function showJustTooltip(e, text) {
  if (!_tooltipEl) {
    _tooltipEl = document.createElement('div');
    _tooltipEl.style.cssText = 'position:fixed;z-index:9999;max-width:260px;padding:8px 12px;border-radius:8px;background:var(--bg1);border:1px solid var(--border);box-shadow:0 4px 16px rgba(0,0,0,.18);font-size:12px;color:var(--text);line-height:1.5;pointer-events:none;transition:opacity .15s';
    document.body.appendChild(_tooltipEl);
  }
  _tooltipEl.textContent = text;
  _tooltipEl.style.opacity = '0';
  _tooltipEl.style.display = 'block';
  const r = e.target.getBoundingClientRect();
  const tw = _tooltipEl.offsetWidth;
  let left = r.left + r.width / 2 - tw / 2;
  if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
  if (left < 8) left = 8;
  _tooltipEl.style.left = left + 'px';
  _tooltipEl.style.top  = (r.top - _tooltipEl.offsetHeight - 8) + 'px';
  _tooltipEl.style.opacity = '1';
}
function hideJustTooltip() {
  if (_tooltipEl) _tooltipEl.style.opacity = '0';
}

function copyOverdueByPerson(memberId) {
  const tasks   = getTasks();
  const team    = getTeam();
  const clients = getClients();
  const m       = team.find(x => x.id === memberId);
  if (!m) return;
  const over  = tasks.filter(t => isOverdue(t.prazo, t.status) && t.responsavel === memberId);
  if (!over.length) return;

  const clientNome = id => { const c = clients.find(x => x.id === id); return c ? c.nome : id; };

  // Agrupar por cliente (usar nome completo como chave de exibição)
  const byClient = {};
  over.forEach(t => {
    const c = clientNome(t.cliente) || 'Sem cliente';
    if (!byClient[c]) byClient[c] = [];
    byClient[c].push(t);
  });

  const lines = [`Demandas atrasadas — ${m.nome}`, ''];
  Object.keys(byClient).sort().forEach(cli => {
    lines.push(`📌 ${cli}`);
    byClient[cli].forEach(t => {
      const d   = Math.floor((new Date(today()) - new Date(t.prazo)) / 86400000);
      const dt  = fmtDate(t.prazo);
      const lbl  = tipoLabel(t.tipo);
      const link = t.clickupUrl ? ` ${t.clickupUrl}` : '';
      lines.push(`  • ${lbl} — prazo: ${dt} (${d}d atrasado)${link}`);
    });
    lines.push('');
  });

  const text = lines.join('\n').trimEnd();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-overdue-' + memberId);
    if (btn) { btn.textContent = 'Copiado!'; setTimeout(() => { btn.textContent = 'Copiar'; }, 2000); }
  });
}

function _isDone(t) {
  return t.status === 'concluido' || t.status === 'aprovado';
}

function _tarefaTitulo(t) {
  if (t.nome) return t.nome;
  const label = geradorSubtipoLabel(t.tipo, t.subtipo);
  return label && label !== t.tipo ? label : (tipoLabel(t.tipo) || t.tipo);
}

function _taskRow(t) {
  const c    = clientById(t.cliente);
  const over = isOverdue(t.prazo, t.status);
  const src  = t.source === 'clickup' ? '<span class="tag tag-clickup" style="font-size:10px">CU</span> ' : '';
  const sel  = _selectedTasks.has(t.id);
  return `<tr
    data-id="${t.id}"
    style="cursor:pointer;user-select:none${over ? ';background:rgba(168,52,40,0.10)' : ''}${sel ? ';background:rgba(107,72,200,0.09);outline:1px solid rgba(107,72,200,0.35);outline-offset:-1px' : ''}"
    onclick="_rowClick(event,'${t.id}')">
    <td style="width:40px;text-align:center;padding:0 8px">
      <input type="checkbox" class="task-check" data-id="${t.id}"
        ${sel ? 'checked' : ''}
        onclick="_checkClick(event,'${t.id}')"
        style="cursor:pointer;width:18px;height:18px;accent-color:var(--purple);pointer-events:none">
    </td>
    <td><span style="color:${c ? c.cor : '#999'};font-weight:700">${t.cliente}</span></td>
    <td>${src}${tipoTag(t.tipo)}</td>
    <td class="text-sm">${_tarefaTitulo(t)}</td>
    <td class="text-muted">${memberName(t.responsavel)}</td>
    <td>${prazoSemaforo(t.prazo, t.status)}</td>
    <td class="text-muted">${fmtDate(t.postagem)}</td>
    <td>${statusTag(t.status)}${t.revisaoJustificativa ? `<span class="just-dot" onmouseenter="showJustTooltip(event,\`${t.revisaoJustificativa.replace(/`/g,"'")}\`)" onmouseleave="hideJustTooltip()" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--text3);margin-left:5px;vertical-align:middle;cursor:default"></span>` : ''}</td>
    <td class="text-muted">${t.revisoes || 0}</td>
    <td class="text-faint" style="font-size:11px;white-space:nowrap">${fmtDateTime(t.createdAt)}</td>
    <td><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openTaskDetail('${t.id}')">Ver</button></td>
  </tr>`;
}

/* == Bulk selection helpers =============================== */
let _lastSelectedId = null;

// Clique na linha: Shift = range, qualquer outro = toggle. "Ver" usa stopPropagation.
function _rowClick(e, id) {
  e.preventDefault();
  if (e.shiftKey && _lastSelectedId && _lastSelectedId !== id) {
    // Range: aplica o estado oposto ao do item clicado
    const newState = !_selectedTasks.has(id);
    const boxes    = [...document.querySelectorAll('.task-check')];
    const fromI    = boxes.findIndex(b => b.dataset.id === _lastSelectedId);
    const toI      = boxes.findIndex(b => b.dataset.id === id);
    const [lo, hi] = fromI < toI ? [fromI, toI] : [toI, fromI];
    boxes.slice(lo, hi + 1).forEach(b => {
      b.checked = newState;
      newState ? _selectedTasks.add(b.dataset.id) : _selectedTasks.delete(b.dataset.id);
    });
  } else {
    // Toggle simples
    const newState = !_selectedTasks.has(id);
    const box = document.querySelector(`.task-check[data-id="${id}"]`);
    if (box) box.checked = newState;
    newState ? _selectedTasks.add(id) : _selectedTasks.delete(id);
  }
  _lastSelectedId = id;
  _syncBulkBar();
}

// Checkbox tem pointer-events:none — clique propagado capturado pelo _rowClick
function _checkClick(e, id) { e.stopPropagation(); }

function _toggleTaskSel(id, checked) {
  checked ? _selectedTasks.add(id) : _selectedTasks.delete(id);
  _syncBulkBar();
}

function _syncBulkBar() {
  const bar = document.getElementById('bulk-bar');
  if (!bar) return;
  const n = _selectedTasks.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  const cnt = document.getElementById('bulk-count');
  if (cnt) cnt.textContent = `${n} tarefa${n !== 1 ? 's' : ''} selecionada${n !== 1 ? 's' : ''}`;
  const all = document.getElementById('bulk-select-all');
  if (all) {
    const boxes = document.querySelectorAll('.task-check');
    all.checked = boxes.length > 0 && [...boxes].every(b => b.checked);
    all.indeterminate = !all.checked && n > 0;
  }
}

function bulkSelectAll(checked) {
  document.querySelectorAll('.task-check').forEach(b => {
    b.checked = checked;
    if (checked) _selectedTasks.add(b.dataset.id); else _selectedTasks.delete(b.dataset.id);
  });
  _syncBulkBar();
}

function bulkClearSel() {
  _selectedTasks.clear();
  document.querySelectorAll('.task-check').forEach(b => b.checked = false);
  _syncBulkBar();
}

async function bulkStatus(status) {
  if (!_selectedTasks.size) return;
  const n   = _selectedTasks.size;
  const now = new Date().toISOString();
  const isRevStatus = status === 'revisao' || status === 'reprovado' || status === 'descartado';
  const all = getTasks().map(t => {
    if (!_selectedTasks.has(t.id)) return t;
    const wasRev = t.status === 'revisao' || t.status === 'reprovado' || t.status === 'descartado';
    return { ...t, status, updatedAt: now,
      revisoes: (isRevStatus && !wasRev) ? (t.revisoes || 0) + 1 : (t.revisoes || 0) };
  });
  saveTasks(all);
  const toSync = all.filter(t => _selectedTasks.has(t.id) && t.clickupId);
  _selectedTasks.clear();
  if (_taskTableEl) renderTaskTable(_taskTableEl, all, true);
  showToast(`${n} tarefa${n !== 1 ? 's' : ''} → ${status}`);
  for (const t of toSync) {
    try { await cuUpdateTask(t); } catch(e) { console.warn('ClickUp bulk status falhou:', e.message); }
  }
}

async function bulkDelete() {
  const n = _selectedTasks.size;
  if (!n) return;
  if (!confirm(`Deletar ${n} tarefa${n !== 1 ? 's' : ''}? Esta ação não pode ser desfeita.`)) return;
  const all   = getTasks();
  const toDelete = all.filter(t => _selectedTasks.has(t.id));
  const tasks = all.filter(t => !_selectedTasks.has(t.id));
  saveTasks(tasks);
  _selectedTasks.clear();
  if (_taskTableEl) renderTaskTable(_taskTableEl, tasks, true);
  showToast(`${n} tarefa${n !== 1 ? 's' : ''} deletada${n !== 1 ? 's' : ''}`);
  for (const t of toDelete) {
    if (t.clickupId) {
      try { await cuDeleteTask(t.clickupId); } catch(e) { console.warn('ClickUp bulk delete falhou:', e.message); }
    }
  }
}

function renderTaskTable(el, tasks, sortable = false) {
  if (sortable) { _taskTableEl = el; _taskTableData = tasks; }
  const rows = sortable ? _applyTaskSort(tasks) : tasks;
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">Nenhuma tarefa encontrada</div>';
    return;
  }

  const chkTh = `<th style="width:40px;text-align:center"><input type="checkbox" id="bulk-select-all" onchange="bulkSelectAll(this.checked)" style="cursor:pointer;width:18px;height:18px;accent-color:var(--purple)"></th>`;
  const ths = sortable
    ? `${chkTh}${_th('Cliente','cliente')}${_th('Tipo','tipo')}${_th('Título','titulo')}${_th('Responsável','resp')}${_th('Prazo','prazo')}${_th('Postagem','post')}${_th('Status','status')}${_th('Rev.','rev')}${_th('Criação','criacao')}<th></th>`
    : `<th></th><th>Cliente</th><th>Tipo</th><th>Título</th><th>Responsável</th><th>Prazo</th><th>Postagem</th><th>Status</th><th>Rev.</th><th>Criação</th><th></th>`;

  if (!sortable) {
    el.innerHTML = `<table><thead><tr>${ths}</tr></thead><tbody>${rows.map(_taskRow).join('')}</tbody></table>`;
    return;
  }

  // Bulk action bar — renderiza no container externo (sticky fora da tabela)
  const bulkBarHTML = `<div id="bulk-bar" style="display:none;align-items:center;gap:8px;flex-wrap:wrap;
      background:var(--bg-card);border:1px solid var(--purple);border-radius:8px;
      padding:10px 16px;margin-bottom:8px;box-shadow:0 2px 12px rgba(42,31,14,0.12)">
    <span id="bulk-count" style="font-size:13px;font-weight:600;color:var(--purple);margin-right:4px"></span>
    <button class="btn btn-xs" style="background:#99999922;color:var(--text-muted);border:1px solid var(--border)"
      onclick="bulkStatus('pendente')">○ Pendente</button>
    <button class="btn btn-xs" style="background:rgba(46,94,138,0.12);color:var(--blue);border:1px solid rgba(46,94,138,0.3)"
      onclick="bulkStatus('em_andamento')">▶ Em andamento</button>
    <button class="btn btn-xs" style="background:rgba(160,104,24,0.12);color:var(--yellow);border:1px solid rgba(160,104,24,0.3)"
      onclick="bulkStatus('revisao')">↩ Revisão</button>
    <button class="btn btn-xs" style="background:rgba(107,72,200,0.10);color:var(--accent);border:1px solid rgba(107,72,200,0.3)"
      onclick="bulkStatus('aprovacao')">⏳ Aguard. Aprovação</button>
    <button class="btn btn-xs" style="background:rgba(107,72,200,0.10);color:var(--accent);border:1px solid rgba(107,72,200,0.3)"
      onclick="bulkStatus('aprovado')">★ Aprovado</button>
    <button class="btn btn-xs" style="background:rgba(58,122,40,0.12);color:var(--green);border:1px solid rgba(58,122,40,0.3)"
      onclick="bulkStatus('concluido')">✓ Concluído</button>
    <button class="btn btn-xs" style="background:rgba(168,52,40,0.10);color:var(--red);border:1px solid rgba(168,52,40,0.3)"
      onclick="bulkStatus('reprovado')">✕ Reprovado</button>
    <button class="btn btn-xs" style="background:#99999922;color:var(--text3);border:1px solid var(--border)"
      onclick="bulkStatus('descartado')">— Descartado</button>
    <div style="flex:1"></div>
    <button class="btn btn-xs" style="background:rgba(168,52,40,0.12);color:var(--red);border:1px solid rgba(168,52,40,0.3)"
      onclick="bulkDelete()">🗑 Deletar</button>
    <button class="btn btn-xs btn-ghost" onclick="bulkClearSel()">✕ Limpar</button>
  </div>`;
  const bulkContainer = document.getElementById('bulk-bar-container');
  if (bulkContainer && !document.getElementById('bulk-bar')) {
    bulkContainer.innerHTML = bulkBarHTML;
  }

  // Group by year ? month (based on postagem, fallback to prazo)
  const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const byYear = {};
  rows.forEach(t => {
    const dateStr = t.postagem || t.prazo || '';
    const yr = dateStr.slice(0, 4) || '-';
    const mo = dateStr.slice(5, 7) || '00';
    if (!byYear[yr])     byYear[yr]     = {};
    if (!byYear[yr][mo]) byYear[yr][mo] = [];
    byYear[yr][mo].push(t);
  });
  const years = Object.keys(byYear).sort().reverse();

  const COLS = 11;
  let tbody = '';
  years.forEach(yr => {
    const yrVisible  = _yearVisible[yr] === true;
    const months     = Object.keys(byYear[yr]).sort();
    const allYrCount = months.reduce((a, mo) => a + byYear[yr][mo].length, 0);
    const yrIcon     = yrVisible ? '▾' : '▸';

    tbody += `<tr style="background:var(--bg3);cursor:pointer" onclick="toggleYear('${yr}')">
      <td colspan="${COLS}" style="padding:8px 14px;font-weight:700;font-size:13px;color:var(--text);letter-spacing:.4px;border-top:2px solid var(--border)">
        ${yrIcon} ${yr} <span style="font-weight:400;font-size:11px;color:var(--text2);margin-left:8px">${allYrCount} tarefa${allYrCount !== 1 ? 's' : ''}</span>
      </td>
    </tr>`;

    if (yrVisible) {
      months.forEach(mo => {
        const monthKey  = yr + '_' + mo;
        const moVisible = _monthVisible[monthKey] === true;
        const allMonth  = byYear[yr][mo];
        const active    = allMonth.filter(t => !_isDone(t));
        const done      = allMonth.filter(t =>  _isDone(t));
        const moLabel   = mo === '00' ? 'Sem data' : (MESES_PT[parseInt(mo, 10) - 1] || mo);
        const moIcon    = moVisible ? '▾' : '▸';

        tbody += `<tr style="background:var(--bg2);cursor:pointer" onclick="toggleMonth('${monthKey}')">
          <td colspan="${COLS}" style="padding:6px 28px;font-size:12px;font-weight:600;color:var(--text2);border-top:1px dashed var(--border)">
            ${moIcon} ${moLabel} <span style="font-weight:400;font-size:11px;color:var(--text3);margin-left:6px">${allMonth.length} tarefa${allMonth.length !== 1 ? 's' : ''}</span>
          </td>
        </tr>`;

        if (moVisible) {
          const pieces = {};
          const standalone = [];
          allMonth.forEach(t => {
            if (t.postagem) {
              const k = t.cliente + '_' + t.postagem + (t.pieceKey ? '_' + t.pieceKey : '');
              if (!pieces[k]) pieces[k] = { k, cliente: t.cliente, postagem: t.postagem, pieceKey: t.pieceKey||null, subs: [] };
              pieces[k].subs.push(t);
            } else { standalone.push(t); }
          });

          Object.values(pieces).forEach(g => {
            const pVisible  = _pieceVisible[g.k] !== false;
            const pIcon     = pVisible ? '▾' : '▸';
            const pLabel    = _pieceLabel(g.pieceKey, g.cliente, g.subs);
            const c         = clientById(g.cliente);
            const nActive   = g.subs.filter(t => !_isDone(t) && t.status !== 'reprovado' && t.status !== 'descartado').length;
            const nDone     = g.subs.filter(t => _isDone(t)).length;
            const nRep      = g.subs.filter(t => t.status === 'reprovado').length;
            const nDes      = g.subs.filter(t => t.status === 'descartado').length;
            const statusTxt = nActive === 0 && nRep === 0 && nDes === 0 ? '✓ Tudo concluído'
              : nActive + ' ativas' + (nDone ? ', ' + nDone + ' conc.' : '') + (nRep ? ', ' + nRep + ' reprov.' : '') + (nDes ? ', ' + nDes + ' desc.' : '');
            const statusCol = nActive === 0 ? 'var(--green)' : 'var(--text2)';
            tbody += `<tr style="cursor:pointer;background:var(--bg3)" onclick="togglePiece('${g.k}')">
              <td style="width:40px;padding:0 8px"></td>
              <td colspan="2" style="padding:7px 10px">
                <span style="color:${c ? c.cor : '#999'};font-weight:700">${g.cliente}</span>
                <span class="text-xs text-faint" style="margin-left:6px">${pLabel}</span>
              </td>
              <td colspan="4" style="padding:7px 4px">
                <span class="text-xs text-faint">postagem ${fmtDate(g.postagem)} · ${g.subs.length} subtarefa${g.subs.length !== 1 ? 's' : ''}</span>
              </td>
              <td colspan="3" style="padding:7px 4px">
                <span style="color:${statusCol};font-size:11px">${statusTxt}</span>
              </td>
              <td style="padding:7px 10px;text-align:right;color:var(--text3);font-size:13px">${pIcon}</td>
            </tr>`;
            if (pVisible) tbody += g.subs.map(_taskRow).join('');
          });

          const activeStd   = standalone.filter(t => !_isDone(t) && t.status !== 'reprovado' && t.status !== 'descartado');
          const doneStd     = standalone.filter(t =>  _isDone(t));
          const reprovStd   = standalone.filter(t => t.status === 'reprovado');
          const descStd     = standalone.filter(t => t.status === 'descartado');
          tbody += activeStd.map(_taskRow).join('');
          if (doneStd.length) {
            const doneKey  = 'done_' + monthKey;
            const doneVis  = !!_completedVisible[doneKey];
            const doneIcon = doneVis ? '▾' : '▸';
            tbody += `<tr style="cursor:pointer;opacity:.65" onclick="event.stopPropagation();toggleCompleted('${doneKey}')">
              <td colspan="${COLS}" style="padding:4px 42px;font-size:11px;color:var(--text3);border-top:1px dashed var(--border)">
                ${doneIcon} Concluídas <span style="margin-left:4px">${doneStd.length} tarefa${doneStd.length !== 1 ? 's' : ''}</span>
              </td>
            </tr>`;
            if (doneVis) tbody += doneStd.map(_taskRow).join('');
          }
          if (reprovStd.length) {
            const repKey  = 'rep_' + monthKey;
            const repVis  = !!_reprovadoVisible[repKey];
            const repIcon = repVis ? '▾' : '▸';
            tbody += `<tr style="cursor:pointer;opacity:.75" onclick="event.stopPropagation();toggleReprovado('${repKey}')">
              <td colspan="${COLS}" style="padding:4px 42px;font-size:11px;color:var(--red);border-top:1px dashed var(--border)">
                ${repIcon} Reprovados <span style="margin-left:4px;color:var(--text3)">${reprovStd.length} tarefa${reprovStd.length !== 1 ? 's' : ''}</span>
              </td>
            </tr>`;
            if (repVis) tbody += reprovStd.map(_taskRow).join('');
          }
          if (descStd.length) {
            const desKey  = 'des_' + monthKey;
            const desVis  = !!_descartadoVisible[desKey];
            const desIcon = desVis ? '▾' : '▸';
            tbody += `<tr style="cursor:pointer;opacity:.65" onclick="event.stopPropagation();toggleDescartado('${desKey}')">
              <td colspan="${COLS}" style="padding:4px 42px;font-size:11px;color:var(--text3);border-top:1px dashed var(--border)">
                ${desIcon} Descartados <span style="margin-left:4px">${descStd.length} tarefa${descStd.length !== 1 ? 's' : ''}</span>
              </td>
            </tr>`;
            if (desVis) tbody += descStd.map(_taskRow).join('');
          }
        }
      });
    }
  });

  el.innerHTML = `<table><thead><tr>${ths}</tr></thead><tbody>${tbody}</tbody></table>`;
  _syncBulkBar();

  // Listener único: clique fora das linhas e do bulk bar →' limpa seleção
  if (!window._bulkOutsideListenerAdded) {
    window._bulkOutsideListenerAdded = true;
    document.addEventListener('click', function(e) {
      if (!_selectedTasks.size) return;
      if (e.target.closest('tr[data-id]'))        return; // linha de tarefa
      if (e.target.closest('#bulk-bar'))           return; // barra de ações
      if (e.target.closest('#bulk-bar-container')) return; // container sticky
      bulkClearSel();
    });
  }
}

// =====================================================
// HEALTH SCORE — utils
// =====================================================

function getISOWeekRef(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7;       // 1=Mon … 7=Sun
  d.setDate(d.getDate() + 4 - day);  // shift to Thursday (ISO rule)
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function isoWeekToDateRange(weekRef) {
  if (!weekRef || typeof weekRef !== 'string' || !weekRef.includes('-W')) return { start: new Date(), end: new Date() };
  const [yearStr, weekPart] = weekRef.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekPart);
  if (isNaN(year) || isNaN(week) || week < 1 || week > 53) return { start: new Date(), end: new Date() };
  // Jan 4th is always in week 1 (ISO 8601)
  const jan4 = new Date(year, 0, 4);
  const day  = jan4.getDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - day + 1);
  const start = new Date(week1Mon);
  start.setDate(week1Mon.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function parseAreaFromSubtaskName(name) {
  const n = (name || '').toLowerCase().trim();
  if (n.startsWith('edição') || n.startsWith('edicao') || n.startsWith('vídeo') || n.startsWith('video')) return 'video';
  if (n.startsWith('design')) return 'design';
  if (n.startsWith('copy') || n.startsWith('copywriter')) return 'copy';
  return 'general';
}

// delivery  : { postsCompleted, postsExpected }
// feedback  : 'positive' | 'neutral' | 'negative'
// revisions : { errorPoints, rejection: 'none'|'partial'|'total' }
// recording : 'done' | 'pending' | 'na'
function calculateClientScore(delivery, feedback, revisions, recording) {
  let deliveryPts = 0;
  const pc = delivery.postsCompleted || 0;
  if (pc >= 3) deliveryPts = 40;
  else if (pc === 2) deliveryPts = 20;
  else deliveryPts = 0;

  const feedbackPts = { positive: 30, neutral: 15, negative: 0, none: 15 }[feedback] ?? 0;

  const ep = revisions.errorPoints || 0;
  let revisionPts = 0;
  if (ep === 0)       revisionPts = 20;
  else if (ep <= 2)   revisionPts = 15;
  else if (ep <= 4)   revisionPts = 8;
  else                revisionPts = 0;

  let recordingPts = 0;
  let maxScore = 90;
  if (recording === 'done') { recordingPts = 10; maxScore = 100; }

  const total = Math.min(deliveryPts + feedbackPts + revisionPts + recordingPts, maxScore);

  let finalStatus = total >= 76 ? 'green' : total >= 51 ? 'yellow' : 'red';
  let overrideActive = false;
  let overrideReason = 'none';

  if (revisions.rejection === 'total') {
    finalStatus = 'red'; overrideActive = true; overrideReason = 'total_rejection';
  } else if (revisions.rejection === 'partial' && finalStatus === 'green') {
    finalStatus = 'yellow'; overrideActive = true; overrideReason = 'partial_rejection';
  }

  return {
    totalScore: total, maxScore, finalStatus, overrideActive, overrideReason,
    breakdown: { delivery: deliveryPts, feedback: feedbackPts, revisions: revisionPts, recording: recordingPts }
  };
}

// ── Tráfego scoring ──────────────────────────────────
// Score = (% Meta / 100) × 5  →  max 5 pts
// Verde ≥ 4 (≥80% meta) | Amarelo 2.5-3.9 (50-79%) | Vermelho < 2.5 (<50%)
function calculateTrafegoScore(metaPct) {
  const pct   = Math.max(0, parseFloat(metaPct) || 0);
  const score = Math.min(Math.round((pct / 100) * 5 * 10) / 10, 5);
  const status = score >= 4 ? 'green' : score >= 2.5 ? 'yellow' : 'red';
  return { score, maxScore: 5, status, metaPct: pct };
}

// ── CX scoring ────────────────────────────────────────
// Nota manual 1–5 | Verde ≥ 4 | Amarelo 3 | Vermelho ≤ 2
function calculateCXScore(rating) {
  const r = Math.max(1, Math.min(5, parseInt(rating) || 1));
  const status = r >= 4 ? 'green' : r >= 3 ? 'yellow' : 'red';
  return { score: r, maxScore: 5, status };
}

// ── Score Geral (DC + Tráfego + CX normalizados) ─────
// dcRecord:     { totalScore } from confirmarFechamento
// trafegoRecord:{ score }     saved in record.trafego (null = sem tráfego)
// cxRecord:     { score }     saved in record.cx      (null = sem CX)
function calculateConsolidatedScore(dcRecord, trafegoRecord, cxRecord) {
  const dcScore  = (dcRecord != null && dcRecord.totalScore != null) ? dcRecord.totalScore : null;
  // Guard: old 0-10 trafego records — normalize correctly
  const trafScore = trafegoRecord ? trafegoRecord.score : null;
  const trafNorm  = trafScore != null ? Math.min(Math.round((trafScore / 5) * 100), 100) : null;
  const cxScore   = cxRecord ? cxRecord.score : null;
  const cxNorm    = cxScore  != null ? Math.min(Math.round((cxScore  / 5) * 100), 100) : null;
  const areas = [dcScore, trafNorm, cxNorm].filter(v => v !== null);
  if (areas.length === 0) return null;
  const score  = Math.round(areas.reduce((a, b) => a + b, 0) / areas.length);
  const status = score >= 76 ? 'green' : score >= 51 ? 'yellow' : 'red';
  return { score, status };
}

// tasks: { total, completed, revised, rejected, delayed, errorPoints }
function calculateMemberScore(tasks) {
  const c = tasks.completed || 0;
  if (c === 0) return {
    scores: { rejections: 40, errors: 35, delays: 25, total: 100 },
    proportions: { rejectionRate: 0, errorRate: 0, delayRate: 0 },
    status: 'healthy'
  };

  const rejRate = (tasks.rejected   || 0) / c;
  const errRate = (tasks.errorPoints || 0) / c;
  const delRate = (tasks.delayed    || 0) / c;

  const rejPts = rejRate === 0 ? 40 : rejRate < 0.01 ? 28 : rejRate < 0.03 ? 12 : 0;
  const errPts = errRate === 0 ? 35 : errRate < 0.02 ? 25 : errRate < 0.05 ? 10 : 0;
  const delPts = delRate === 0 ? 25 : delRate < 0.03 ? 18 : delRate < 0.08 ?  8 : 0;
  const total  = rejPts + errPts + delPts;

  return {
    scores: { rejections: rejPts, errors: errPts, delays: delPts, total },
    proportions: { rejectionRate: rejRate, errorRate: errRate, delayRate: delRate },
    status: total >= 76 ? 'healthy' : total >= 51 ? 'attention' : 'critical'
  };
}
