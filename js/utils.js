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

function isOverdue(dateStr, status) {
  if (!dateStr || status === 'concluido' || status === 'aprovado') return false;
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
    aprovado:     ['tag-green',  'Aprovado'],
    concluido:    ['tag-green',  'Concluído'],
    atrasado:     ['tag-red',    'Atrasado']
  };
  const [cls, label] = map[s] || ['tag-gray', s];
  return `<span class="tag ${cls}">${label}</span>`;
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
  return { pendente:'Pendente', em_andamento:'Em Andamento', revisao:'Em Revisão',
           aprovado:'Aprovado', concluido:'Concluído', atrasado:'Atrasado' }[s] || s;
}

function tipoLabel(t) {
  return { copy:'Copy', design:'Design', video:'Vídeo', dark:'Dark Post',
           revisao:'Revisão', postagem:'Postagem', outro:'Outro' }[t] || t;
}

function prazoSemaforo(dateStr, status) {
  if (!dateStr || status === 'concluido' || status === 'aprovado')
    return `<span class="text-muted">${fmtDate(dateStr)}</span>`;
  const diff = Math.floor((new Date(dateStr) - new Date(today())) / 86400000);
  if (diff < 0)  return `<span style="color:var(--red);font-weight:700">⚫ ${fmtDate(dateStr)} (${Math.abs(diff)}d atraso)</span>`;
  if (diff <= 2) return `<span style="color:var(--red)">🔴 ${fmtDate(dateStr)}</span>`;
  if (diff <= 7) return `<span style="color:var(--yellow)">🟡 ${fmtDate(dateStr)}</span>`;
  return `<span style="color:var(--green)">🟢 ${fmtDate(dateStr)}</span>`;
}

function papelLabel(p) {
  return { copy:'Copy', assistCopy:'Assist. Copy', design:'Design',
           edicao:'Edição', trafego:'Tráfego' }[p] || p;
}

function memberName(id) {
  const m = memberById(id);
  return m ? m.nome : (id || '—');
}

// =====================================================
// NOMENCLATURA GERADOR (padrão ClickUp)
// =====================================================
function geradorPieceLabel(pieceKey) {
  return { feed1:'Design', feed2:'Design', video:'Vídeo', dark:'Dark' }[pieceKey] || 'Design';
}

function geradorSubtipoLabel(tipo, subtipo) {
  if (subtipo === 'copy-capa')    return 'Copy da capa';
  if (subtipo === 'capa-video')   return 'Design de capa de vídeo';
  if (subtipo === 'copy-dark')    return 'Copy';
  if (subtipo === 'design-dark')  return 'Design';
  if (subtipo === 'legenda')      return 'Legenda';
  if (subtipo === 'revisao-ter')  return 'Revisão Terça';
  if (subtipo === 'revisao-qui')  return 'Revisão Quinta';
  if (tipo === 'copy')            return 'Copy';
  if (tipo === 'revisao')         return 'Revisão';
  if (tipo === 'design')          return 'Design';
  if (tipo === 'video')           return 'Edição';
  if (tipo === 'relatorio')       return 'Relatório Semanal';
  return tipo;
}

// Nome da tarefa pai — com padrão especial para relatório
function geradorNomePai(pieceKey, clienteNome, dataPost) {
  if (pieceKey === 'relatorio')
    return `Relatório Semanal — ${clienteNome} | Semana ${fmtDate(dataPost)}: `;
  return `${geradorPieceLabel(pieceKey)} — ${clienteNome} | Postagem ${fmtDate(dataPost)}: `;
}

// Nome da subtarefa — com padrão especial para revisões do relatório
function geradorNomeSub(tipo, subtipo, clienteNome, prazo) {
  if (subtipo === 'revisao-ter' || subtipo === 'revisao-qui')
    return `Relatório Semanal — ${clienteNome} | Revisão de ${fmtDate(prazo)}: `;
  return `${geradorSubtipoLabel(tipo, subtipo)} — ${clienteNome} | Entrega ${fmtDate(prazo)}: `;
}

// ── Sort state (multi-nível) ─────────────────────────────────
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
  if (col === 'rev')     return t.revisoes || 0;
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

// Ciclo: ausente → asc → desc → remove
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

let _yearVisible      = {}; // yr → true=visible
let _completedVisible = {}; // yr → true=visible (default false)

function toggleYear(yr) {
  _yearVisible[yr] = !_yearVisible[yr];
  if (_taskTableEl) renderTaskTable(_taskTableEl, _taskTableData, true);
}

function toggleCompleted(yr) {
  _completedVisible[yr] = !_completedVisible[yr];
  if (_taskTableEl) renderTaskTable(_taskTableEl, _taskTableData, true);
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
  const c = clientById(t.cliente);
  const over = isOverdue(t.prazo, t.status);
  const src = t.source === 'clickup' ? '<span class="tag tag-clickup" style="font-size:10px">CU</span> ' : '';
  return `<tr style="cursor:pointer${over ? ';background:#1a0000' : ''}" onclick="openTaskDetail('${t.id}')">
    <td><span style="color:${c ? c.cor : '#999'};font-weight:700">${t.cliente}</span></td>
    <td>${src}${tipoTag(t.tipo)}</td>
    <td class="text-sm">${_tarefaTitulo(t)}</td>
    <td class="text-muted">${memberName(t.responsavel)}</td>
    <td>${prazoSemaforo(t.prazo, t.status)}</td>
    <td class="text-muted">${fmtDate(t.postagem)}</td>
    <td>${statusTag(t.status)}</td>
    <td class="text-muted">${t.revisoes || 0}</td>
    <td><button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openTaskDetail('${t.id}')">Ver</button></td>
  </tr>`;
}

function renderTaskTable(el, tasks, sortable = false) {
  if (sortable) { _taskTableEl = el; _taskTableData = tasks; }
  const rows = sortable ? _applyTaskSort(tasks) : tasks;
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">Nenhuma tarefa encontrada</div>';
    return;
  }
  const ths = sortable
    ? `${_th('Cliente','cliente')}${_th('Tipo','tipo')}${_th('Título','titulo')}${_th('Responsável','resp')}${_th('Prazo','prazo')}${_th('Postagem','post')}${_th('Status','status')}${_th('Rev.','rev')}<th></th>`
    : `<th>Cliente</th><th>Tipo</th><th>Título</th><th>Responsável</th><th>Prazo</th><th>Postagem</th><th>Status</th><th>Rev.</th><th></th>`;

  if (!sortable) {
    el.innerHTML = `<table><thead><tr>${ths}</tr></thead><tbody>${rows.map(_taskRow).join('')}</tbody></table>`;
    return;
  }

  // Group by year (based on postagem, fallback to prazo)
  const byYear = {};
  rows.forEach(t => {
    const yr = (t.postagem || t.prazo || '').slice(0, 4) || '—';
    if (!byYear[yr]) byYear[yr] = [];
    byYear[yr].push(t);
  });
  const years = Object.keys(byYear).sort();

  // Default: all years visible on first render
  years.forEach(yr => { if (_yearVisible[yr] === undefined) _yearVisible[yr] = true; });

  const COLS = 9;
  let tbody = '';
  years.forEach(yr => {
    const visible  = _yearVisible[yr];
    const allTasks = byYear[yr];
    const active   = allTasks.filter(t => !_isDone(t));
    const done     = allTasks.filter(t =>  _isDone(t));
    const icon     = visible ? '▾' : '▸';
    const count    = allTasks.length;

    tbody += `<tr style="background:var(--bg-card);cursor:pointer" onclick="toggleYear('${yr}')">
      <td colspan="${COLS}" style="padding:8px 12px;font-weight:700;font-size:13px;color:var(--text-muted);letter-spacing:.5px;border-top:1px solid var(--border)">
        ${icon} ${yr} <span style="font-weight:400;font-size:11px;margin-left:6px">${count} tarefa${count !== 1 ? 's' : ''}</span>
      </td>
    </tr>`;

    if (visible) {
      tbody += active.map(_taskRow).join('');

      if (done.length) {
        const doneVis  = !!_completedVisible[yr];
        const doneIcon = doneVis ? '▾' : '▸';
        tbody += `<tr style="background:var(--bg-card);cursor:pointer;opacity:.7" onclick="event.stopPropagation();toggleCompleted('${yr}')">
          <td colspan="${COLS}" style="padding:6px 20px;font-size:12px;color:var(--text-faint);border-top:1px solid var(--border)">
            ${doneIcon} Concluídas <span style="font-weight:400;margin-left:4px">${done.length} tarefa${done.length !== 1 ? 's' : ''}</span>
          </td>
        </tr>`;
        if (doneVis) tbody += done.map(_taskRow).join('');
      }
    }
  });

  el.innerHTML = `<table><thead><tr>${ths}</tr></thead><tbody>${tbody}</tbody></table>`;
}
