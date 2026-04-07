// =====================================================
// DASHBOARD
// =====================================================
function renderDashboard() {
  const now = new Date();
  document.getElementById('dash-date').textContent =
    now.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const tasks = getTasks();
  const total = tasks.length;
  const done  = tasks.filter(t => t.status==='concluido'||t.status==='aprovado'||t.status==='reprovado').length;
  const over  = tasks.filter(t => isOverdue(t.prazo, t.status)).length;
  const inProg= tasks.filter(t => t.status==='em_andamento'||t.status==='revisao').length;
  const avgRev= total ? (tasks.reduce((a,t)=>a+(+t.revisoes||0),0)/total).toFixed(1) : '0.0';

  // Seção HOJE
  const todayTasks   = tasks.filter(t => t.prazo === today() && t.status !== 'concluido' && t.status !== 'aprovado' && t.status !== 'reprovado' && t.status !== 'travado');
  const overdueTasks = tasks.filter(t => isOverdue(t.prazo, t.status));
  const blocked      = tasks.filter(t => t.status === 'revisao');
  const priorKey     = 'cd_prioridades_' + today();
  const priors       = JSON.parse(localStorage.getItem(priorKey) || '["","",""]');
  const criticos     = [...overdueTasks, ...todayTasks.filter(t => !overdueTasks.includes(t))].slice(0, 5);

  document.getElementById('dash-hoje').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      <div class="card" style="border-left:3px solid var(--red)">
        <div class="flex-between mb-10">
          <h3 style="color:var(--red);margin:0">🔴 Crítico Hoje</h3>
          <span class="tag tag-red">${criticos.length}</span>
        </div>
        ${criticos.length ? criticos.map(t => {
          const c = clientById(t.cliente);
          const dias = Math.floor((new Date(today()) - new Date(t.prazo)) / 86400000);
          return `<div class="alert-row danger mb-4 gap-6" style="cursor:pointer;padding:7px 10px" onclick="openTaskDetail('${t.id}')">
            <span style="width:7px;height:7px;border-radius:50%;background:${c?c.cor:'#666'};flex-shrink:0;margin-top:4px"></span>
            <div style="flex:1;min-width:0">
              <div class="font-bold text-xs" style="color:var(--text)">${t.cliente} - ${tipoLabel(t.tipo)}</div>
              <div class="text-xs" style="color:var(--red)">${dias > 0 ? dias + 'd atrasado' : 'vence hoje'} → ${memberName(t.responsavel)}</div>
            </div>
          </div>`;
        }).join('') : '<div class="text-xs text-faint" style="padding:8px 0;text-align:center">✓ Nada crítico</div>'}
      </div>
      <div class="card" style="border-left:3px solid var(--yellow)">
        <div class="flex-between mb-10">
          <h3 style="color:var(--yellow);margin:0">🟡 Aguardando Aprovação</h3>
          <span class="tag tag-yellow">${blocked.length}</span>
        </div>
        ${blocked.length ? blocked.slice(0,4).map(t => {
          const c = clientById(t.cliente);
          return `<div class="alert-row warn mb-4 gap-6" style="cursor:pointer;padding:7px 10px" onclick="openTaskDetail('${t.id}')">
            <span style="width:7px;height:7px;border-radius:50%;background:${c?c.cor:'#666'};flex-shrink:0;margin-top:4px"></span>
            <div style="flex:1;min-width:0">
              <div class="font-bold text-xs" style="color:var(--text)">${t.cliente} - ${tipoLabel(t.tipo)}</div>
              <div class="text-xs text-faint">postagem: ${fmtDate(t.postagem)} → ${memberName(t.responsavel)}</div>
            </div>
          </div>`;
        }).join('') : '<div class="text-xs text-faint" style="padding:8px 0;text-align:center">✓ Nenhuma travada</div>'}
      </div>
      <div class="card" style="border-left:3px solid var(--accent)">
        <div class="flex-between mb-10">
          <h3 style="color:var(--accent);margin:0">📋 Prioridades do Dia</h3>
          <button class="btn btn-ghost btn-xs" onclick="savePrioridades()">salvar</button>
        </div>
        ${[0,1,2].map(i => `
          <div class="flex-center gap-8 mb-6">
            <span class="text-xs text-faint font-bold">${i+1}.</span>
            <input type="text" value="${priors[i]||''}" id="prior-${i}"
              style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%"
              placeholder="prioridade ${i+1}..." onblur="savePrioridades()">
          </div>`).join('')}
      </div>
    </div>`;

  document.getElementById('kpi-cards').innerHTML = `
    <div class="card">
      <h3>Total de Tarefas</h3>
      <div class="kpi-value">${total}</div>
      <div class="kpi-sub">${done} concluídas</div>
    </div>
    <div class="card">
      <h3>Em Andamento</h3>
      <div class="kpi-value" style="color:var(--blue)">${inProg}</div>
      <div class="kpi-sub">produção ativa</div>
    </div>
    <div class="card">
      <h3>Atrasadas</h3>
      <div class="kpi-value" style="color:${over>0?'var(--red)':'var(--green)'}">${over}</div>
      <div class="kpi-sub">prazo vencido</div>
    </div>
    <div class="card">
      <h3>Revisões Médias</h3>
      <div class="kpi-value" style="color:${parseFloat(avgRev)>1.5?'var(--red)':'var(--green)'}">${avgRev}</div>
      <div class="kpi-sub">meta: &lt; 1.5</div>
    </div>`;

  // ClickUp sync status
  const sync = cuGetLastSync();
  if (sync) {
    const dt = new Date(sync.lastSync).toLocaleString('pt-BR');
    document.getElementById('dash-sync-info').innerHTML =
      `<span class="tag tag-clickup">ClickUp</span> Última sync: ${dt} → ${sync.count} tarefas`;
  }

  // Client status
  const clients     = getClients();
  const weeklyScores= getWeeklyScores();
  const curWeekRef  = getISOWeekRef(now);
  const HSC = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' };
  const HSL = { green: 'Verde', yellow: 'Amarelo', red: 'Vermelho' };
  let chtml = '';
  for (const c of clients) {
    const ct = tasks.filter(t => t.cliente===c.id);
    const cd = ct.filter(t => t.status==='concluido'||t.status==='aprovado'||t.status==='reprovado').length;
    const co = ct.filter(t => isOverdue(t.prazo, t.status)).length;
    const ca = ct.filter(t => t.status==='aprovacao').length;
    const pct = ct.length ? Math.round(cd/ct.length*100) : 0;
    const health = co>0 ? 'red' : pct>=80 ? 'green' : 'yellow';

    // Health score badge for this week
    const hsRec = weeklyScores.find(s => s.clientId === c.id && s.weekRef === curWeekRef);
    let hsBadge = '';
    if (hsRec && !hsRec.draft) {
      const geral = hsRec.consolidatedScore || calculateConsolidatedScore(hsRec, hsRec.trafego, hsRec.cx);
      const score = geral?.score ?? hsRec.totalScore;
      const st    = geral?.status ?? hsRec.finalStatus;
      if (score != null && st) {
        hsBadge = `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;background:${HSC[st]}22;color:${HSC[st]};white-space:nowrap">HS ${score}</span>`;
      }
    } else if (hsRec?.draft) {
      hsBadge = `<span style="font-size:10px;padding:2px 7px;border-radius:5px;background:var(--bg3);color:var(--text3);white-space:nowrap">HS rascunho</span>`;
    }

    chtml += `<div class="card mb-8" style="padding:12px 16px;cursor:pointer" onclick="setPage('clientes')">
      <div class="flex-between mb-8">
        <div class="flex-center gap-8">
          <span style="width:8px;height:8px;border-radius:50%;background:${c.cor};display:inline-block;flex-shrink:0"></span>
          <span class="font-bold">${c.nome}</span>
          <span class="text-xs text-faint">${c.nicho}</span>
        </div>
        <div class="flex-center gap-6">
          ${hsBadge}
          <span class="dot dot-${health}"></span>
        </div>
      </div>
      <div class="flex-between text-xs text-muted mb-4">
        <span>${cd}/${ct.length} concluídas${ca>0?` · <span style="color:var(--purple)">⏳ ${ca} aprov.</span>`:''}</span>
        ${co>0?`<span style="color:var(--red)">${co} atrasada(s)</span>`:''}
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${c.cor}"></div></div>
    </div>`;
  }
  document.getElementById('client-status-list').innerHTML = chtml||'<div class="empty-state">Nenhum cliente</div>';

  // Recent flow
  const recent = [...tasks].sort((a,b)=>(b.updatedAt||b.createdAt||'')>(a.updatedAt||a.createdAt||'')?1:-1).slice(0,8);
  let ahtml = '';
  for (const t of recent) {
    const c = clientById(t.cliente);
    ahtml += `<div class="alert-row mb-0 gap-8" style="cursor:pointer" onclick="openTaskDetail('${t.id}')">
      <span style="width:8px;height:8px;border-radius:50%;background:${c?c.cor:'#666'};flex-shrink:0;margin-top:4px"></span>
      <div style="flex:1;min-width:0">
        <div class="flex-between">
          <span class="font-bold text-sm">${t.cliente} - ${tipoLabel(t.tipo)}${t.subtipo&&t.subtipo!=='geral'?' ('+t.subtipo+')':''}</span>
          ${statusTag(t.status)}
        </div>
        <div class="text-xs text-faint mt-4">Prazo: ${fmtDate(t.prazo)} → ${memberName(t.responsavel)}</div>
      </div>
    </div>`;
  }
  document.getElementById('approval-flow').innerHTML = ahtml||'<div class="empty-state">Nenhuma tarefa</div>';

  // Week tasks
  const weekDates = getWeekDates(0);
  const weekTasks = tasks.filter(t => t.prazo && weekDates.includes(t.prazo))
    .sort((a,b) => (a.prazo||'9')>(b.prazo||'9')?1:-1);
  renderTaskTable(document.getElementById('dash-week-tasks'), weekTasks.slice(0,12));

  // Metas
  renderMetas();
}

function renderMetas() {
  const metas = getMetas();
  const statusMap = { em_andamento:'tag-blue', concluido:'tag-green', pendente:'tag-gray' };
  const labelMap  = { em_andamento:'Em andamento', concluido:'Concluído', pendente:'Pendente' };
  document.getElementById('metas-list').innerHTML = metas.map((m,i) => `
    <div class="meta-card">
      <div class="meta-num">${i+1}</div>
      <div style="flex:1">
        <div class="flex-between mb-4">
          <div class="meta-title">${m.titulo}</div>
          <span class="tag ${statusMap[m.status]||'tag-gray'}">${labelMap[m.status]||m.status}</span>
        </div>
        <div class="meta-desc">${m.desc}</div>
      </div>
    </div>`).join('');
}

// =====================================================
// TAREFAS
// =====================================================
let taskFilters = { status:'todos', cliente:'todos', tipo:'todos', responsavel:'todos' };

function renderTarefas() {
  resetTaskTableView();
  const clients = getClients();
  document.getElementById('task-filters').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%">
      <div class="flex-center gap-4 flex-wrap">
        <span class="text-xs text-faint">Status:</span>
        ${['todos','pendente','em_andamento','revisao','aprovacao','reprovado','travado','descartado','aprovado','concluido','atrasado'].map(s=>
          `<button class="filter-btn${taskFilters.status===s?' active':''}" onclick="setTaskFilter('status','${s}')">${s==='todos'?'Todos':statusLabel(s)}</button>`
        ).join('')}
      </div>
      <div class="flex-center gap-4 flex-wrap">
        <span class="text-xs text-faint">Cliente:</span>
        <button class="filter-btn${taskFilters.cliente==='todos'?' active':''}" onclick="setTaskFilter('cliente','todos')">Todos</button>
        ${clients.map(c=>`<button class="filter-btn${taskFilters.cliente===c.id?' active':''}" onclick="setTaskFilter('cliente','${c.id}')">${c.id}</button>`).join('')}
      </div>
      <div class="flex-center gap-4 flex-wrap">
        <span class="text-xs text-faint">Tipo:</span>
        ${['todos','copy','design','video','dark','outro'].map(t=>
          `<button class="filter-btn${taskFilters.tipo===t?' active':''}" onclick="setTaskFilter('tipo','${t}')">${t==='todos'?'Todos':tipoLabel(t)}</button>`
        ).join('')}
      </div>
      <div class="flex-center gap-6">
        <span class="text-xs text-faint">Equipe:</span>
        <select onchange="setTaskFilter('responsavel',this.value)"
          style="font-size:12px;padding:4px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);cursor:pointer">
          <option value="todos"${taskFilters.responsavel==='todos'?' selected':''}>Todos</option>
          ${getTeam().filter(m=>m.funcao).map(m=>`<option value="${m.id}"${taskFilters.responsavel===m.id?' selected':''}>${m.nome}</option>`).join('')}
        </select>
      </div>
    </div>`;

  let tasks = getTasks();
  if (taskFilters.status !== 'todos') {
    if (taskFilters.status === 'atrasado') tasks = tasks.filter(t => isOverdue(t.prazo, t.status));
    else tasks = tasks.filter(t => t.status === taskFilters.status);
  }
  if (taskFilters.cliente    !== 'todos') tasks = tasks.filter(t => t.cliente    === taskFilters.cliente);
  if (taskFilters.tipo       !== 'todos') tasks = tasks.filter(t => t.tipo       === taskFilters.tipo);
  if (taskFilters.responsavel!== 'todos') tasks = tasks.filter(t => t.responsavel=== taskFilters.responsavel);
  tasks.sort((a,b) => (a.prazo||'9999')>(b.prazo||'9999')?1:-1);
  renderTaskTable(document.getElementById('tasks-table'), tasks, true);
}

function setTaskFilter(key, val) {
  taskFilters[key] = val;
  renderTarefas();
}

// =====================================================
// CALENDÁRIO
// =====================================================
let weekOffset = 0;
let calFilter  = 'todos';

function renderCalendario() {
  const days = getWeekDates(weekOffset);
  const DAY_NAMES = ['Segunda','Terça','Quarta','Quinta','Sexta'];
  const todayStr  = today();

  const s = new Date(days[0]+'T12:00:00');
  const e = new Date(days[4]+'T12:00:00');
  document.getElementById('week-label').textContent =
    s.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) + ' - ' +
    e.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});

  const tasks = getTasks();
  let html = '';
  for (let i = 0; i < 5; i++) {
    const d = days[i];
    let dayTasks = tasks.filter(t => {
      if (calFilter==='postagem') return t.postagem===d;
      if (calFilter==='producao') return t.prazo===d && t.tipo!=='postagem';
      return t.prazo===d || t.postagem===d;
    });
    dayTasks.sort((a,b)=>a.tipo>b.tipo?1:-1);
    html += `<div class="cal-day${d===todayStr?' today':''}">
      <div class="cal-day-header">
        <span>${DAY_NAMES[i]}</span>
        <span class="day-num">${new Date(d+'T12:00:00').getDate()}</span>
      </div>
      ${dayTasks.length ? dayTasks.map(t => {
        const c = clientById(t.cliente);
        const isPost = t.postagem===d && t.prazo!==d;
        return `<div class="cal-task" style="border-left-color:${c?c.cor:'#666'}" onclick="openTaskDetail('${t.id}')">
          <div class="task-client" style="color:${c?c.cor:'#999'}">${t.cliente}${isPost?' 📣':''}</div>
          <div class="task-name">${tipoLabel(t.tipo)}${t.subtipo&&t.subtipo!=='geral'?' '+t.subtipo:''}</div>
        </div>`;
      }).join('') : '<div class="text-xs text-faint" style="margin-top:8px;text-align:center">-</div>'}
    </div>`;
  }
  document.getElementById('cal-grid').innerHTML = html;

  // Person load — only members with tasks this week, sorted by count desc
  const team = getTeam();
  const memberLoads = team
    .map(m => ({ m, mt: tasks.filter(t => t.responsavel===m.id && days.includes(t.prazo)) }))
    .filter(({ mt }) => mt.length > 0)
    .sort((a, b) => b.mt.length - a.mt.length);
  let phtml = '';
  if (!memberLoads.length) {
    phtml = '<div class="text-xs text-faint" style="padding:8px 0">Nenhuma tarefa alocada esta semana.</div>';
  }
  for (const { m, mt } of memberLoads) {
    const ol = mt.length >= 4;
    const warn = mt.length >= 3 && mt.length < 4;
    const tagClass = ol ? 'tag-red' : warn ? 'tag-yellow' : 'tag-green';
    const barColor = ol ? 'var(--red)' : warn ? 'var(--yellow)' : 'var(--green)';
    phtml += `<div class="card mb-8" style="padding:10px 14px">
      <div class="flex-between mb-6">
        <div class="font-bold text-sm">${m.nome} <span class="text-xs text-faint">${m.funcao}</span></div>
        <span class="tag ${tagClass}">${mt.length} tarefa${mt.length!==1?'s':''}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(mt.length/5*100,100)}%;background:${barColor}"></div></div>
    </div>`;
  }
  document.getElementById('person-load').innerHTML = phtml;

  // Bottlenecks
  const overdueTasks = tasks.filter(t => isOverdue(t.prazo, t.status));
  let bhtml = '';
  if (overdueTasks.length) {
    bhtml += `<div class="alert-row danger mb-8"><div>
      <div class="font-bold text-sm" style="color:var(--red)">⚠️ ${overdueTasks.length} tarefa(s) atrasada(s)</div>
      ${overdueTasks.slice(0,3).map(t=>`<div class="text-xs text-muted">${t.cliente} - ${tipoLabel(t.tipo)} (${fmtDate(t.prazo)})</div>`).join('')}
    </div></div>`;
  }
  const olMembers = memberLoads.filter(({ mt }) => mt.length >= 4).map(({ m }) => m);
  for (const m of olMembers) {
    bhtml += `<div class="alert-row warn mb-8"><div class="text-sm"><span class="font-bold">${m.nome}</span> - sobrecarga esta semana</div></div>`;
  }
  if (!bhtml) bhtml = '<div class="alert-row success mb-8"><div class="text-sm" style="color:var(--green)">✅ Nenhum gargalo identificado</div></div>';
  document.getElementById('bottlenecks').innerHTML = bhtml;
}

function changeWeek(d)       { weekOffset += d; renderCalendario(); }
function setCalFilter(f, btn) {
  calFilter = f;
  document.querySelectorAll('#page-calendario .filters .filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderCalendario();
}

// =====================================================
// EQUIPE — ordenação multi-coluna
// =====================================================
let _eqQualData  = [];
// Estado de ordenação: array de { key, dir } — ordem = prioridade
// dir: 1 = A→Z / menor→maior, -1 = Z→A / maior→menor
let _eqSortKeys  = [{ key: 'nome', dir: 1 }];

const _EQ_COLS = [
  { key: 'nome',       label: 'Membro',      type: 'str' },
  { key: 'feitas',     label: 'Feitas',       type: 'num' },
  { key: 'concluidas', label: 'Concluídas',   type: 'num' },
  { key: 'revisadas',  label: 'Revisadas',    type: 'num' },
  { key: 'reprovadas', label: 'Reprovadas',   type: 'num' },
  { key: 'atrasadas',  label: 'Atrasadas',    type: 'num' },
  { key: 'pontosAcum', label: 'Pontos acum.', type: 'num' },
  { key: 'proporcao',  label: 'Proporção',    type: 'num' }
];

function _eqSortBy(key) {
  const idx = _eqSortKeys.findIndex(s => s.key === key);
  if (idx >= 0) {
    const cur = _eqSortKeys[idx];
    if (cur.dir === 1) cur.dir = -1;           // asc → desc
    else _eqSortKeys.splice(idx, 1);           // desc → remove
  } else {
    const col = _EQ_COLS.find(c => c.key === key);
    _eqSortKeys.push({ key, dir: col?.type === 'str' ? 1 : -1 }); // str→A-Z, num→maior primeiro
  }
  if (!_eqSortKeys.length) _eqSortKeys = [{ key: 'nome', dir: 1 }]; // nunca fica vazio
  _eqRenderTable();
}

function _eqRenderTable() {
  const sorted = [..._eqQualData].sort((a, b) => {
    for (const { key, dir } of _eqSortKeys) {
      const va = a[key] ?? (key === 'nome' ? '' : -Infinity);
      const vb = b[key] ?? (key === 'nome' ? '' : -Infinity);
      const cmp = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' }) : va - vb;
      if (cmp !== 0) return cmp * dir;
    }
    return 0;
  });

  // Cabeçalhos clicáveis com indicadores de sort
  const thStyle = 'cursor:pointer;user-select:none;white-space:nowrap;padding-right:16px';
  const thead = _EQ_COLS.map(col => {
    const sortIdx = _eqSortKeys.findIndex(s => s.key === col.key);
    const arrow   = sortIdx >= 0 ? (_eqSortKeys[sortIdx].dir === 1 ? ' ↑' : ' ↓') : '';
    const badge   = _eqSortKeys.length > 1 && sortIdx >= 0
      ? `<sup style="font-size:9px;color:var(--accent);font-weight:700">${sortIdx + 1}</sup>` : '';
    const active  = sortIdx >= 0 ? 'color:var(--accent);font-weight:700' : '';
    return `<th style="${thStyle};${active}" onclick="_eqSortBy('${col.key}')" title="Ordenar por ${col.label}">${col.label}${arrow}${badge}</th>`;
  }).join('');

  const tbody = sorted.map(m => {
    const propTag = m.proporcao === null ? '<span class="tag">—</span>'
      : m.proporcao >= 80 ? `<span class="tag tag-green">${m.proporcao}%</span>`
      : m.proporcao >= 60 ? `<span class="tag tag-yellow">${m.proporcao}%</span>`
      : `<span class="tag tag-red">${m.proporcao}%</span>`;
    const pontosColor = m.pontosAcum === 0 ? 'var(--green)' : m.pontosAcum <= 3 ? 'var(--yellow)' : 'var(--red)';
    return `<tr>
      <td class="font-bold">${m.nome}<div class="text-xs text-muted">${m.funcao}</div></td>
      <td class="text-muted">${m.feitas}</td>
      <td style="color:var(--green)">${m.concluidas}</td>
      <td style="color:var(--yellow)">${m.revisadas}</td>
      <td style="color:var(--red)">${m.reprovadas}</td>
      <td style="color:var(--orange)">${m.atrasadas}</td>
      <td><span style="color:${pontosColor};font-weight:700">${m.pontosAcum}</span></td>
      <td>${propTag}</td>
    </tr>`;
  }).join('');

  const resetBtn = _eqSortKeys.length > 1 || (_eqSortKeys[0]?.key !== 'nome')
    ? `<button class="btn btn-ghost btn-xs" style="margin-left:8px;font-size:10px" onclick="_eqSortKeys=[{key:'nome',dir:1}];_eqRenderTable()">↺ Resetar</button>` : '';

  document.getElementById('revision-table').innerHTML =
    `<div class="flex-center gap-4 mb-8" style="font-size:11px;color:var(--text3)">
      ${resetBtn}
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table></div>`;
}

function renderEquipe() {
  const team    = getTeam().slice().sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'));
  const tasks   = getTasks();
  const clients = getClients();

  // Helper: linha de tarefa para os droplists da equipe
  const eqTaskRow = t => {
    const c = clients.find(x => x.id === t.cliente);
    const clienteTag = c ? `<span class="tag" style="background:${c.cor}22;color:${c.cor};font-size:10px">${c.id}</span>` : '';
    const label = t.nome || tipoLabel(t.tipo);
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div class="text-xs font-bold" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
        <div class="text-xs text-faint">${fmtDate(t.prazo)||'sem prazo'} · ${statusLabel(t.status)}</div>
      </div>
      ${clienteTag}
    </div>`;
  };

  const eqPanel = (id, list) => list.length === 0 ? '' : `
    <div id="${id}" class="task-drop-panel" style="display:none;position:absolute;z-index:300;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;min-width:240px;max-width:320px;max-height:240px;overflow-y:auto;box-shadow:0 6px 24px rgba(0,0,0,.18);top:calc(100% + 4px);left:0">
      ${list.map(eqTaskRow).join('')}
    </div>`;

  const ativas = t => t.status !== 'concluido' && t.status !== 'aprovado' && t.status !== 'descartado';

  let html = '';
  for (const m of team) {
    const mt       = tasks.filter(t => t.responsavel === m.id);
    const done     = mt.filter(t => t.status==='concluido'||t.status==='aprovado'||t.status==='reprovado').length;
    const pct      = mt.length ? Math.round(done/mt.length*100) : 0;
    const paiList  = mt.filter(t => ativas(t) && !t.parentClickupId);
    const subList  = mt.filter(t => ativas(t) && !!t.parentClickupId);

    const sel = m.clientes || [];
    const dropLbl = sel.length ? `${sel.join(', ')} (${sel.length})` : 'Selecionar clientes';
    const clientCheckboxes = clients.map(c =>
      `<label style="display:flex;align-items:center;gap:8px;padding:5px 7px;border-radius:6px;cursor:pointer;font-size:12px;transition:background 0.1s" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'">
        <input type="checkbox" name="cdrop-${m.id}" value="${c.id}" ${sel.includes(c.id)?'checked':''} onchange="_updateClientDropLabel('${m.id}')" style="width:auto;flex-shrink:0;margin:0;cursor:pointer">
        <span style="width:8px;height:8px;border-radius:50%;background:${c.cor};flex-shrink:0;display:inline-block"></span>
        <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nome}</span>
      </label>`
    ).join('');

    const normFuncao = { 'Copy':'Copywriter','Design':'Designer','Edição de Vídeo':'Editor','Diretor Criativo':'Direção Criativa' };
    const funcaoAtual = normFuncao[m.funcao] || m.funcao;
    const cargos = getCargos();
    const cargoOpts = cargos.map(c => `<option value="${c}"${funcaoAtual===c?' selected':''}>${c}</option>`).join('');
    const avatarHtml = m.foto
      ? `<img src="${m.foto}" class="avatar" style="object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const initialsHtml = `<div class="avatar" style="${m.foto?'display:none':''}">${m.nome.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>`;

    html += `<div class="team-card" id="equipe-card-${m.id}">
      <div class="flex-center gap-8 mb-8">
        <div style="position:relative;flex-shrink:0">${avatarHtml}${initialsHtml}</div>
        <div style="flex:1;min-width:0">
          <input type="text" id="eq-nome-${m.id}" value="${m.nome}" autocomplete="off"
            style="font-size:14px;font-weight:700;width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);padding:2px 0;color:var(--text1);outline:none;margin-bottom:4px">
          <input type="email" id="eq-email-${m.id}" value="${m.email||''}" placeholder="e-mail" autocomplete="off"
            style="font-size:11px;width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);padding:2px 0;color:var(--text2);outline:none;margin-bottom:4px">
        </div>
      </div>
      <div class="flex-center gap-6 mb-8">
        <div style="flex:1">
          <select id="eq-funcao-${m.id}"
            onchange="if(this.value==='__novo__'){document.getElementById('eq-cargo-novo-${m.id}').style.display='flex';this.value='${funcaoAtual}'}"
            style="font-size:12px;padding:3px 7px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%">
            ${cargoOpts}
            <option value="__novo__">+ Criar cargo...</option>
          </select>
          <div id="eq-cargo-novo-${m.id}" style="display:none;align-items:center;gap:4px;margin-top:4px">
            <input type="text" id="eq-cargo-input-${m.id}" placeholder="Nome do cargo"
              style="flex:1;font-size:11px;padding:3px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);outline:none">
            <button class="btn btn-primary btn-xs" onclick="_criarCargo('${m.id}')">Criar</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:3px">
          <input type="text" id="eq-id-${m.id}" value="${m.id}" title="ID interno"
            autocomplete="off" readonly
            style="font-size:11px;width:72px;padding:3px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text3);outline:none;cursor:default" placeholder="id">
          <button type="button" title="Alterar ID (migra tarefas)"
            onclick="_desbloquearId('${m.id}')"
            style="font-size:10px;padding:2px 5px;background:transparent;border:1px solid var(--border);border-radius:4px;color:var(--text3);cursor:pointer;flex-shrink:0">✎</button>
        </div>
      </div>
      <details style="margin-bottom:8px">
        <summary style="font-size:11px;color:var(--text3);cursor:pointer;user-select:none">Foto (URL)</summary>
        <input type="text" id="eq-foto-${m.id}" value="${m.foto||''}" placeholder="https://..."
          style="margin-top:4px;font-size:11px;width:100%;padding:3px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);outline:none">
      </details>
      <div style="position:relative;margin-bottom:8px">
        <button type="button" onclick="toggleClientDropdown('${m.id}',event)"
          style="width:100%;text-align:left;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
          <span id="cdrop-label-${m.id}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%">${dropLbl}</span>
          <span style="opacity:.5;flex-shrink:0">▾</span>
        </button>
        <div id="cdrop-panel-${m.id}" class="client-drop-panel" style="display:none;position:absolute;z-index:200;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;width:100%;max-height:180px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.18);top:calc(100% + 4px);left:0">
          ${clientCheckboxes}
        </div>
      </div>
      <div class="flex-between text-xs text-muted mb-4">
        <span>${done}/${mt.length} concluídas</span><span>${pct}%</span>
      </div>
      <div class="progress-bar mb-8"><div class="progress-fill" style="width:${pct}%;background:var(--accent)"></div></div>
      ${(paiList.length > 0 || subList.length > 0) ? `
      <div class="flex-center gap-6 mb-8" style="flex-wrap:wrap">
        ${paiList.length > 0 ? `<div style="position:relative">
          <span class="tag" style="background:var(--accent)22;color:var(--accent);cursor:pointer;user-select:none" onclick="_toggleTaskDropPanel('eq-pai-${m.id}',event)">📋 ${paiList.length} tarefa${paiList.length!==1?'s':''} pai ▾</span>
          ${eqPanel('eq-pai-'+m.id, paiList)}
        </div>` : ''}
        ${subList.length > 0 ? `<div style="position:relative">
          <span class="tag" style="background:var(--yellow)22;color:var(--yellow);cursor:pointer;user-select:none" onclick="_toggleTaskDropPanel('eq-sub-${m.id}',event)">↳ ${subList.length} subtarefa${subList.length!==1?'s':''} ▾</span>
          ${eqPanel('eq-sub-'+m.id, subList)}
        </div>` : ''}
      </div>` : ''}
      <div class="flex-center gap-6" style="justify-content:flex-end">
        <button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="excluirIntegrante('${m.id}')">Remover</button>
        <button class="btn btn-primary btn-xs" onclick="salvarCardEquipe('${m.id}')">Salvar</button>
      </div>
    </div>`;
  }
  document.getElementById('team-grid').innerHTML = html;

  // Qualidade por pessoa: feitas, concluídas, revisadas, reprovadas, pontos acumulados, proporção
  const qualData = team.map(m => {
    const feitas     = tasks.filter(t => t.responsavel === m.id);
    const concluidas = feitas.filter(t => t.status === 'concluido' || t.status === 'aprovado');
    // Revisadas: tiveram pelo menos 1 ciclo de revisão e foram resolvidas (concluídas/aprovadas)
    const revisadas  = feitas.filter(t => (+t.revisoes||0) > 0 && (t.status === 'concluido' || t.status === 'aprovado'));
    // Reprovadas: tiveram revisão e ainda NÃO foram resolvidas (pendentes, em andamento, reprovado, revisao)
    const TERMINAL   = new Set(['concluido','aprovado','descartado','travado']);
    const reprovadas = feitas.filter(t => (+t.revisoes||0) > 0 && !TERMINAL.has(t.status));
    // Atrasadas: prazo vencido e não concluídas
    const atrasadas  = feitas.filter(t => isOverdue(t.prazo, t.status));
    // Pontos acumulados de motivos de revisão
    const pontosAcum = feitas.reduce((sum, t) => {
      if (!t.motivosRevisao || !t.motivosRevisao.length) return sum;
      return sum + t.motivosRevisao.reduce((s, id) => {
        const m2 = MOTIVOS_REVISAO.find(x => x.id === id);
        return s + (m2 ? m2.pontos : 0);
      }, 0);
    }, 0);
    // Proporção: % de tarefas terminais sem revisão pendente
    const terminais  = concluidas.length + feitas.filter(t => t.status === 'reprovado').length;
    const semRevisao = terminais - feitas.filter(t => (+t.revisoes||0) > 0 && TERMINAL.has(t.status)).length;
    const proporcao  = terminais > 0 ? Math.round((semRevisao / terminais) * 100) : null;
    return { ...m, feitas: feitas.length, concluidas: concluidas.length, revisadas: revisadas.length, reprovadas: reprovadas.length, atrasadas: atrasadas.length, pontosAcum, proporcao, terminais };
  });

  _eqQualData = qualData;
  _eqRenderTable();

  // Atrasados por pessoa
  const overdueAll = tasks.filter(t => isOverdue(t.prazo, t.status));
  const overdueData = team.map(m => {
    const over = overdueAll.filter(t => t.responsavel === m.id);
    return { ...m, over };
  }).filter(m => m.over.length > 0).sort((a,b) => b.over.length - a.over.length);

  if (!overdueData.length) {
    document.getElementById('overdue-by-person').innerHTML =
      '<div class="alert-row success mb-8"><div class="text-sm" style="color:var(--green)">✅ Nenhum conteúdo atrasado</div></div>';
  } else {
    document.getElementById('overdue-by-person').innerHTML = `<table>
      <thead><tr><th>Membro</th><th>Função</th><th>Atrasados</th><th>Detalhes</th><th></th></tr></thead>
      <tbody>${overdueData.map(m => {
        // Agrupar por cliente, ordenar por mais atrasado dentro de cada grupo
        const byClient = {};
        m.over.forEach(t => {
          const c = t.cliente || '—';
          if (!byClient[c]) byClient[c] = [];
          byClient[c].push(t);
        });
        Object.keys(byClient).forEach(c => {
          byClient[c].sort((a, b) => new Date(a.prazo) - new Date(b.prazo)); // mais antigo = mais atrasado
        });
        // Ordenar clientes pelo task mais atrasado de cada um
        const sortedClients = Object.keys(byClient).sort((a, b) =>
          new Date(byClient[a][0].prazo) - new Date(byClient[b][0].prazo)
        );
        const details = sortedClients.map(cli => {
          const clientLabel = (() => { const cl = clients.find(x => x.id === cli); return cl ? cl.nome : cli; })();
          const tagsCli = byClient[cli].map(t => {
            const d = Math.floor((new Date(today()) - new Date(t.prazo)) / 86400000);
            return `<span class="tag tag-red" style="margin:1px;cursor:pointer" onclick="openTaskDetail('${t.id}')" title="${fmtDate(t.prazo)}">${tipoLabel(t.tipo)} +${d}d</span>`;
          }).join('');
          return `<div style="margin-bottom:4px"><span class="text-xs text-muted" style="display:inline-block;min-width:110px;font-weight:600">${clientLabel}</span> ${tagsCli}</div>`;
        }).join('');
        return `<tr>
          <td class="font-bold" style="vertical-align:top;padding-top:10px">${m.nome}</td>
          <td class="text-muted" style="vertical-align:top;padding-top:10px">${m.funcao}</td>
          <td style="vertical-align:top;padding-top:10px"><span style="color:var(--red);font-weight:700;font-size:18px">${m.over.length}</span></td>
          <td style="max-width:420px">${details}</td>
          <td style="white-space:nowrap;vertical-align:top;padding-top:10px"><button id="copy-overdue-${m.id}" class="btn btn-ghost btn-xs" onclick="copyOverdueByPerson('${m.id}')">Copiar</button></td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  // Alocação de Pessoas (embedded in Equipe tab)
  renderClientesAlocacao();
}

function toggleClientDropdown(id, e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('cdrop-panel-' + id);
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  document.querySelectorAll('.client-drop-panel').forEach(p => { p.style.display = 'none'; });
  if (!isOpen) panel.style.display = 'block';
}

function _updateClientDropLabel(id) {
  const boxes = document.querySelectorAll(`input[name="cdrop-${id}"]`);
  const checked = [...boxes].filter(cb => cb.checked).map(cb => cb.value);
  const lbl = document.getElementById('cdrop-label-' + id);
  if (lbl) lbl.textContent = checked.length ? `${checked.join(', ')} (${checked.length})` : 'Selecionar clientes';
}

function salvarCardEquipe(oldId) {
  const team  = getTeam();
  const m     = team.find(x => x.id === oldId);
  if (!m) return;

  const idInput = document.getElementById('eq-id-' + oldId);
  const newId = (!idInput?.readOnly && idInput?.value)
    ? idInput.value.trim().toLowerCase().replace(/\s+/g,'_') || oldId
    : oldId;
  const nome  = document.getElementById('eq-nome-'  + oldId)?.value.trim();
  const email = document.getElementById('eq-email-' + oldId)?.value.trim();
  const foto  = document.getElementById('eq-foto-'  + oldId)?.value.trim();
  const funcaoEl = document.getElementById('eq-funcao-' + oldId);
  const funcao = funcaoEl?.value && funcaoEl.value !== '__novo__' ? funcaoEl.value : m.funcao;

  if (nome)  m.nome  = nome;
  if (email !== undefined) m.email = email || '';
  if (foto  !== undefined) m.foto  = foto  || '';
  m.funcao = funcao;

  const boxes = document.querySelectorAll(`input[name="cdrop-${oldId}"]`);
  if (boxes.length) m.clientes = [...boxes].filter(cb => cb.checked).map(cb => cb.value);

  // Migração de ID
  if (newId && newId !== oldId) {
    if (team.find(x => x.id === newId && x !== m)) { showToast('ID já em uso', true); return; }
    m.id = newId;
    const tasks = getTasks();
    let migrated = 0;
    tasks.forEach(t => { if (t.responsavel === oldId) { t.responsavel = newId; migrated++; } });
    saveTasks(tasks);
    const aviso = migrated ? ` · ${migrated} tarefa(s) migrada(s). Atualize Alocação/ClickUp se necessário.` : ' Atualize Alocação/ClickUp se necessário.';
    saveTeam(team);
    renderEquipe();
    showToast('ID alterado' + aviso);
    return;
  }

  saveTeam(team);
  renderEquipe();
  showToast('Integrante atualizado!');
}

function _desbloquearId(memberId) {
  const input = document.getElementById('eq-id-' + memberId);
  if (!input) return;
  if (!confirm(`Alterar o ID interno de "${memberId}" vai migrar todas as tarefas vinculadas.\n\nAtenção: Alocação e mapeamento ClickUp precisarão ser atualizados manualmente.\n\nContinuar?`)) return;
  input.readOnly = false;
  input.style.cursor = 'text';
  input.style.borderColor = 'var(--accent)';
  input.focus();
  input.select();
}

function _criarCargo(memberId) {
  const input = document.getElementById('eq-cargo-input-' + memberId);
  const nome = input?.value.trim();
  if (!nome) return;
  const cargos = getCargos();
  if (!cargos.includes(nome)) { cargos.push(nome); saveCargos(cargos); }
  // Seleciona o novo cargo imediatamente no select
  const sel = document.getElementById('eq-funcao-' + memberId);
  if (sel) {
    const opt = document.createElement('option');
    opt.value = nome; opt.textContent = nome; opt.selected = true;
    sel.insertBefore(opt, sel.querySelector('option[value="__novo__"]'));
  }
  document.getElementById('eq-cargo-novo-' + memberId).style.display = 'none';
  showToast(`Cargo "${nome}" criado!`);
}

function excluirIntegrante(id) {
  if (!confirm('Remover este integrante da equipe?')) return;
  saveTeam(getTeam().filter(m => m.id !== id));
  renderEquipe();
  showToast('Integrante removido');
}

function abrirNovoIntegrante() {
  const clients = getClients();
  const cargos  = getCargos();
  const niCheckboxes = clients.map(c =>
    `<label style="display:flex;align-items:center;gap:8px;padding:5px 7px;border-radius:6px;cursor:pointer;font-size:12px;transition:background 0.1s" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'">
      <input type="checkbox" name="cdrop-novo" value="${c.id}" onchange="_updateClientDropLabel('novo')" style="width:auto;flex-shrink:0;margin:0;cursor:pointer">
      <span style="width:8px;height:8px;border-radius:50%;background:${c.cor};flex-shrink:0;display:inline-block"></span>
      <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.nome}</span>
    </label>`
  ).join('');

  const formHtml = `<div class="team-card" id="equipe-card-novo" style="border:2px dashed var(--accent)">
    <div class="text-sm font-bold mb-10" style="color:var(--accent)">Novo Integrante</div>
    <div class="form-group mb-8">
      <input type="text" id="ni-nome" placeholder="Nome completo"
        style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;margin-bottom:6px">
      <input type="email" id="ni-email" placeholder="E-mail (identificador oficial)"
        style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;margin-bottom:6px">
      <input type="text" id="ni-id" placeholder="ID interno (ex: carol) — gerado do nome se vazio" maxlength="20"
        style="font-size:11px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text3);width:100%;margin-bottom:6px">
      <select id="ni-funcao"
        onchange="if(this.value==='__novo__'){document.getElementById('ni-cargo-novo').style.display='flex';this.value=''}"
        style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;margin-bottom:6px">
        <option value="">Cargo / Função</option>
        ${cargos.map(c => `<option value="${c}">${c}</option>`).join('')}
        <option value="__novo__">+ Criar cargo...</option>
      </select>
      <div id="ni-cargo-novo" style="display:none;align-items:center;gap:4px;margin-bottom:6px">
        <input type="text" id="ni-cargo-input" placeholder="Nome do novo cargo"
          style="flex:1;font-size:11px;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);outline:none">
        <button class="btn btn-primary btn-xs" onclick="_criarCargoNovo()">Criar</button>
      </div>
      <input type="text" id="ni-foto" placeholder="URL da foto (opcional)"
        style="font-size:11px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text3);width:100%;margin-bottom:6px">
      <div style="position:relative;margin-bottom:6px">
        <button type="button" onclick="toggleClientDropdown('novo',event)"
          style="width:100%;text-align:left;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
          <span id="cdrop-label-novo">Selecionar clientes</span>
          <span style="opacity:.5">▾</span>
        </button>
        <div id="cdrop-panel-novo" class="client-drop-panel" style="display:none;position:absolute;z-index:200;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;width:100%;max-height:180px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.18);top:calc(100% + 4px);left:0">
          ${niCheckboxes}
        </div>
      </div>
    </div>
    <div class="flex-center gap-6" style="justify-content:flex-end">
      <button class="btn btn-ghost btn-xs" onclick="renderEquipe()">Cancelar</button>
      <button class="btn btn-primary btn-xs" onclick="confirmarNovoIntegrante()">Adicionar</button>
    </div>
  </div>`;

  document.getElementById('team-grid').insertAdjacentHTML('afterbegin', formHtml);
  document.getElementById('ni-nome').focus();
}

function _criarCargoNovo() {
  const input = document.getElementById('ni-cargo-input');
  const nome = input?.value.trim();
  if (!nome) return;
  const cargos = getCargos();
  if (!cargos.includes(nome)) { cargos.push(nome); saveCargos(cargos); }
  const sel = document.getElementById('ni-funcao');
  if (sel) {
    const opt = document.createElement('option');
    opt.value = nome; opt.textContent = nome; opt.selected = true;
    sel.insertBefore(opt, sel.querySelector('option[value="__novo__"]'));
  }
  document.getElementById('ni-cargo-novo').style.display = 'none';
  showToast(`Cargo "${nome}" criado!`);
}

function confirmarNovoIntegrante() {
  const nome   = document.getElementById('ni-nome').value.trim();
  const email  = document.getElementById('ni-email')?.value.trim() || '';
  const foto   = document.getElementById('ni-foto')?.value.trim()  || '';
  const funcao = document.getElementById('ni-funcao').value.trim();
  const clientes = [...document.querySelectorAll('input[name="cdrop-novo"]:checked')].map(cb => cb.value);

  if (!nome) { showToast('Preencha o nome', true); return; }

  // Gera ID do nome se vazio; usa email prefix se disponível
  const rawId = document.getElementById('ni-id')?.value.trim() ||
    (email ? email.split('@')[0] : nome.split(' ')[0]);
  const id = rawId.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúüç_0-9]/gi, '').replace(/\s+/g,'_') || 'membro';

  const team = getTeam();
  if (team.find(m => m.id === id)) { showToast(`ID "${id}" já em uso. Defina outro no campo ID.`, true); return; }

  team.push({ id, nome, email, foto, funcao: (funcao && funcao !== '__novo__') ? funcao : 'Designer', clientes });
  saveTeam(team);
  renderEquipe();
  showToast('Integrante adicionado!');
}

// =====================================================
// CLIENTES
// =====================================================
let _clientesTab = 'visao';

function clientesTab(tab) {
  _clientesTab = tab;
  ['visao','alocacao','fluxo'].forEach(t => {
    const el = document.getElementById('ctab-'+t);
    if (el) el.classList.toggle('active', t===tab);
  });
  if (tab==='visao')    renderClientesVisao();
  if (tab==='alocacao') renderClientesAlocacao();
  if (tab==='fluxo')    renderClientesFluxo();
}

function renderClientes() {
  clientesTab(_clientesTab);
}

// ── Aba 1: Visão Geral ───────────────────────────────────────────────────────
function renderClientesVisao() {
  const allClients   = getClients().slice().sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'));
  const contentClients = allClients.filter(c => !isTrafegoOnly(c));
  const trafegoClients = allClients.filter(c => isTrafegoOnly(c));
  const tasks        = getTasks();
  const weeklyScores = getWeeklyScores();
  const curWeekRef   = getISOWeekRef(new Date());
  const HSC = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' };

  const taskRow = t => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div class="text-xs font-bold" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${t.nome || tipoLabel(t.tipo)} ${t.subtipo && t.subtipo!=='geral' ? `<span class="text-faint">· ${t.subtipo}</span>` : ''}
        </div>
        <div class="text-xs text-faint">${memberName(t.responsavel)} · prazo ${fmtDate(t.prazo)}</div>
      </div>
      ${tipoTag(t.tipo)}
    </div>`;

  const badgePanel = (id, tasks) => tasks.length === 0 ? '' : `
    <div id="${id}" class="task-drop-panel" style="display:none;position:absolute;z-index:300;background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;min-width:260px;max-width:340px;max-height:260px;overflow-y:auto;box-shadow:0 6px 24px rgba(0,0,0,.18);top:calc(100% + 6px);left:0">
      ${tasks.map(taskRow).join('')}
    </div>`;

  function _hsInfo(c) {
    const hsRec  = weeklyScores.find(s => s.clientId === c.id && s.weekRef === curWeekRef);
    const isDraft= hsRec?.draft;
    const geral  = hsRec && !isDraft ? (hsRec.consolidatedScore || calculateConsolidatedScore(hsRec, hsRec.trafego, hsRec.cx)) : null;
    const hsScore= geral?.score ?? (hsRec && !isDraft ? hsRec.totalScore : null);
    const hsSt   = geral?.status ?? (hsRec && !isDraft ? hsRec.finalStatus : null);
    const hsBtnLabel = !hsRec ? 'Fechar semana' : isDraft ? 'Completar' : 'Editar';
    return { hsRec, isDraft, hsScore, hsSt, hsBtnLabel };
  }

  // ── Seção 1: Clientes (conteúdo) ──
  let html = '<div class="section-title mb-12">Clientes</div>';
  html += '<div class="grid grid-2 gap-16 mb-24">';
  for (const c of contentClients) {
    const aloc      = ALOCACAO[c.id] || {};
    const ct        = tasks.filter(t => t.cliente === c.id);
    const isPai     = t => !t.parentClickupId;
    const overTasks = ct.filter(t => isPai(t) && isOverdue(t.prazo, t.status));
    const aprovTasks= ct.filter(t => isPai(t) && t.status === 'aprovacao');
    const { hsScore, hsSt, hsBtnLabel, isDraft } = _hsInfo(c);

    html += `<div class="card">
      <div class="flex-between mb-12">
        <div class="flex-center gap-8">
          <span style="width:12px;height:12px;border-radius:50%;background:${c.cor};flex-shrink:0"></span>
          <div>
            <div class="font-bold" style="font-size:16px">${c.nome}</div>
            <div class="text-xs text-faint">${c.nicho} → ${c.id}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          ${hsScore != null && hsSt
            ? `<div style="display:flex;align-items:center;gap:5px">
                 <span style="width:8px;height:8px;border-radius:50%;background:${HSC[hsSt]};flex-shrink:0"></span>
                 <span style="font-weight:800;font-size:16px;color:${HSC[hsSt]}">${hsScore}</span>
                 <span style="font-size:11px;color:var(--text3)">/100</span>
               </div>`
            : isDraft
              ? `<span style="font-size:10px;color:var(--text3)">HS pendente</span>`
              : `<span style="font-size:10px;color:var(--text3)">Sem HS</span>`
          }
          <button class="btn btn-ghost btn-xs" onclick="_irParaFechamento('${c.id}')">${hsBtnLabel} →</button>
        </div>
      </div>
      <div class="flex-center gap-8 mb-8" style="flex-wrap:wrap">
        ${overTasks.length>0?`
          <div style="position:relative">
            <span class="tag tag-red" style="cursor:pointer;user-select:none" onclick="_toggleClientPanel('panel-over-${c.id}',event)">⚠ ${overTasks.length} atrasada(s) ▾</span>
            ${badgePanel('panel-over-'+c.id, overTasks)}
          </div>`:''}
        ${aprovTasks.length>0?`
          <div style="position:relative">
            <span class="tag tag-purple" style="cursor:pointer;user-select:none" onclick="_toggleClientPanel('panel-aprov-${c.id}',event)">⏳ ${aprovTasks.length} aguard. aprovação ▾</span>
            ${badgePanel('panel-aprov-'+c.id, aprovTasks)}
          </div>`:''}
      </div>
      <div class="divider"></div>
      <div class="text-xs text-faint font-bold mb-8" style="text-transform:uppercase;letter-spacing:.5px">Equipe alocada</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${Object.entries(aloc).map(([papel,val])=>{
          const vals = Array.isArray(val)?val:[val];
          return `<div class="flex-center gap-8 text-sm">
            <span class="text-faint" style="min-width:90px;font-size:11px">${papelLabel(papel)}</span>
            <span class="text-muted">${vals.map(v=>memberName(v)).join(', ')}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }
  html += '</div>';

  // ── Seção 2: Clientes Tráfego ──
  if (trafegoClients.length > 0) {
    html += '<div class="section-title mb-12">Clientes Tráfego <span class="badge">só gestão de tráfego</span></div>';
    html += '<div class="grid grid-3 gap-16">';
    for (const c of trafegoClients) {
      const aloc = ALOCACAO[c.id] || {};
      const { hsScore, hsSt, hsBtnLabel, isDraft } = _hsInfo(c);
      const vinc = c.vinculado ? clientById(c.vinculado) : null;

      html += `<div class="card" style="border-left:3px solid ${c.cor}">
        <div class="flex-between mb-8">
          <div>
            <div class="font-bold" style="font-size:14px">${c.nome}</div>
            <div class="text-xs text-faint">${c.nicho} → ${c.id}</div>
            ${vinc ? `<div class="text-xs" style="color:var(--accent);margin-top:2px">↳ vinculado a ${vinc.nome}</div>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
            ${hsScore != null && hsSt
              ? `<div style="display:flex;align-items:center;gap:4px">
                   <span style="width:7px;height:7px;border-radius:50%;background:${HSC[hsSt]}"></span>
                   <span style="font-weight:800;font-size:14px;color:${HSC[hsSt]}">${hsScore}</span>
                 </div>`
              : isDraft
                ? `<span style="font-size:9px;color:var(--text3)">HS pendente</span>`
                : `<span style="font-size:9px;color:var(--text3)">Sem HS</span>`
            }
            <button class="btn btn-ghost btn-xs" style="font-size:10px" onclick="_irParaFechamento('${c.id}')">${hsBtnLabel} →</button>
          </div>
        </div>
        <div class="divider" style="margin:6px 0"></div>
        <div style="display:flex;flex-direction:column;gap:3px">
          ${Object.entries(aloc).map(([papel,val])=>{
            const vals = Array.isArray(val)?val:[val];
            return `<div class="flex-center gap-6 text-xs">
              <span class="text-faint" style="min-width:60px">${papelLabel(papel)}</span>
              <span class="text-muted">${vals.map(v=>memberName(v)).join(', ')}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }
    html += '</div>';
  }

  document.getElementById('clientes-tab').innerHTML = html;
}

// Toggle genérico para qualquer painel de tarefas (clientes + equipe)
function _toggleClientPanel(id, e) { _toggleTaskDropPanel(id, e); }
function _toggleTaskDropPanel(id, e) {
  e.stopPropagation();
  const panel = document.getElementById(id);
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  document.querySelectorAll('.task-drop-panel').forEach(p => p.style.display = 'none');
  if (!isOpen) panel.style.display = 'block';
}
document.addEventListener('click', () => {
  document.querySelectorAll('.task-drop-panel').forEach(p => p.style.display = 'none');
});

// ── Aba 2: Alocação & Pessoas ───────────────────────────────────────────────
function renderClientesAlocacao() {
  const team    = getTeam();
  const clients = getClients();
  const memberOpts = team.map(m=>`<option value="${m.id}">${m.nome}</option>`).join('');
  const memberOptsBlank = `<option value="">-</option>` + memberOpts;

  // Seção 1: Substituição em massa
  let html = `<div class="card mb-16">
    <div class="section-title">Substituição de Responsável</div>
    <div class="text-xs text-muted mb-16">Troca uma pessoa em todos os clientes da Alocação e nas tarefas existentes.</div>
    <div class="grid grid-2 gap-16 mb-16">
      <div class="form-group mb-0">
        <label>Pessoa que saiu (De)</label>
        <select id="sub-de"><option value="">Selecionar...</option>${memberOpts}</select>
      </div>
      <div class="form-group mb-0">
        <label>Pessoa que entrou (Para)</label>
        <select id="sub-para"><option value="">Selecionar...</option>${memberOpts}</select>
      </div>
    </div>
    <div class="flex-center gap-16 mb-16">
      <label class="flex-center gap-6 text-sm" style="cursor:pointer">
        <input type="checkbox" id="sub-check-aloc" checked> Alocação</label>
      <label class="flex-center gap-6 text-sm" style="cursor:pointer">
        <input type="checkbox" id="sub-check-tasks" checked> Tarefas existentes</label>
    </div>
    <button class="btn btn-primary" onclick="substituirResponsavel()">Confirmar substituição</button>
  </div>`;

  // Seção 2: Alocação por cliente (editor)
  html += `<div class="card">
    <div class="section-title mb-12">Alocação por Cliente</div>
    <div class="form-group mb-16">
      <label>Cliente</label>
      <select id="aloc-cliente" onchange="renderAlocacaoClienteForm()" style="max-width:280px">
        ${clients.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')}
      </select>
    </div>
    <div id="aloc-form"></div>
  </div>`;

  const target = document.getElementById('equipe-alocacao') || document.getElementById('clientes-tab');
  if (target) target.innerHTML = html;
  renderAlocacaoClienteForm();
}

function renderAlocacaoClienteForm() {
  const clienteId = document.getElementById('aloc-cliente').value;
  const aloc      = ALOCACAO[clienteId] || {};
  const team      = getTeam();
  const memberOpts = id => team.map(m=>`<option value="${m.id}"${m.id===id?' selected':''}>${m.nome}</option>`).join('');
  const memberOptsBlank = id => `<option value=""${!id?' selected':''}>- vazio -</option>` + memberOpts(id);

  // Papéis conhecidos (exceto arrays como trafego)
  const PAPEIS = ['pai','copy','assistCopy','revisao','design','edicao','designDark','relatorioResp'];
  const rows = PAPEIS.map(p => {
    const val = aloc[p];
    if (val === undefined && !['pai','copy','design','edicao'].includes(p)) return ''; // Oculta papéis vazios não essenciais
    return `<tr>
      <td class="text-sm text-muted" style="width:150px">${papelLabel(p)}</td>
      <td><select class="aloc-input" data-papel="${p}" style="width:100%;max-width:220px">
        ${memberOptsBlank(val)}
      </select></td>
    </tr>`;
  }).join('');

  document.getElementById('aloc-form').innerHTML = `
    <table style="width:100%;max-width:500px;margin-bottom:16px">
      <thead><tr>
        <th>Papel</th><th>Responsável</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <button class="btn btn-primary btn-sm" onclick="salvarAlocacaoCliente('${clienteId}')">Salvar alocação de ${clienteId}</button>`;
}

function salvarAlocacaoCliente(clienteId) {
  const novaAloc = { ...ALOCACAO[clienteId] };
  document.querySelectorAll('.aloc-input').forEach(sel => {
    const papel = sel.dataset.papel;
    const val   = sel.value;
    if (val) novaAloc[papel] = val;
    else delete novaAloc[papel];
  });
  const aloc = { ...ALOCACAO, [clienteId]: novaAloc };
  saveAlocacao(aloc);
  showToast(`Alocação de ${clienteId} salva!`);
  renderClientesAlocacao();
}

function substituirResponsavel() {
  const de   = document.getElementById('sub-de').value;
  const para = document.getElementById('sub-para').value;
  const chAloc  = document.getElementById('sub-check-aloc').checked;
  const chTasks = document.getElementById('sub-check-tasks').checked;
  if (!de || !para)    { showToast('Selecione ambas as pessoas', true); return; }
  if (de === para)     { showToast('As pessoas são iguais', true); return; }

  let countAloc = 0, countTasks = 0;

  if (chAloc) {
    const aloc = JSON.parse(JSON.stringify(ALOCACAO));
    for (const cid of Object.keys(aloc)) {
      for (const [papel, val] of Object.entries(aloc[cid])) {
        if (val === de) { aloc[cid][papel] = para; countAloc++; }
        if (Array.isArray(val)) {
          aloc[cid][papel] = val.map(v => v===de ? para : v);
        }
      }
    }
    saveAlocacao(aloc);
  }

  if (chTasks) {
    const tasks = getTasks().map(t => {
      if (t.responsavel === de) { countTasks++; return { ...t, responsavel: para }; }
      return t;
    });
    saveTasks(tasks);
  }

  showToast(`Substituição concluída: ${countAloc} papéis de alocação, ${countTasks} tarefas`);
  renderClientesAlocacao();
}

// ── Aba 3: Fluxo de Produção ─────────────────────────────────────────────────
function renderClientesFluxo() {
  const clients = getClients();
  const team    = getTeam();

  let html = `<div class="card">
    <div class="section-title mb-12">Fluxo de Produção por Cliente</div>
    <div class="text-xs text-muted mb-16">Gerencie as peças e subtarefas geradas automaticamente para cada cliente.</div>
    <div class="form-group mb-20">
      <label>Cliente</label>
      <select id="fluxo-cliente" onchange="renderFluxoClienteForm()" style="max-width:280px">
        ${clients.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')}
      </select>
    </div>
    <div id="fluxo-form"></div>
  </div>`;

  document.getElementById('clientes-tab').innerHTML = html;
  renderFluxoClienteForm();
}

const _DIAS      = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const _DIAS_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

const _SUBTIPOS = {
  copy:      ['legenda', 'copy', 'copy para capa de vídeo'],
  design:    ['design', 'design de capa de vídeo'],
  edicao:    ['edição de vídeo'],
  dark:      ['copy-dark', 'design-dark'],
  relatorio: ['mensal', 'semanal'],
  revisao:   ['revisao'],
  outro:     ['outro']
};
function _defaultOffset(tipo) { return tipo === 'copy' ? -10 : -7; }

function _offsetDayLabel(input, postDow) {
  const offset = parseInt(input.value) || 0;
  const span = input.nextElementSibling;
  if (span) span.textContent = _DIAS_FULL[((postDow + offset) % 7 + 7) % 7];
}

function _clampNoWeekend(postDow, offset) {
  let result = ((postDow + offset) % 7 + 7) % 7;
  if (result === 6) offset -= 1; // Sábado → Sexta
  else if (result === 0) offset -= 2; // Domingo → Sexta
  return offset;
}

function fluxoUpdateOffset(cid, pi, ti, rawVal) {
  const f      = _fluxoCopy(cid);
  const piece  = f.pieces[pi];
  const tarefa = piece.tarefas[ti];
  tarefa.offset = _clampNoWeekend(piece.postDow, rawVal);
  FLUXO_SEMANAL[cid] = f;
  renderFluxoClienteForm();
}
const _TIPOS_TAREFA = ['copy','design','edicao','dark','relatorio','revisao','outro'];

function _fluxoOffsetGrid(cid, pi, ti, postDow, selectedOffset) {
  const d3 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const rowLabels = ['-2 sem.', '-1 sem.', 'Esta sem.'];
  // Rows ordered top=furthest from posting, bottom=closest (posting week)
  const weekRows = [2, 1, 0];

  let h = '<div style="display:grid;grid-template-columns:56px repeat(5,1fr);gap:2px;font-size:11px">';

  // Header row
  h += '<div></div>';
  [1,2,3,4,5].forEach(d => {
    const isPostDay = d === postDow;
    h += '<div style="text-align:center;padding-bottom:2px;'
       + (isPostDay ? 'color:var(--accent);font-weight:700' : 'color:var(--text3)')
       + '">' + d3[d] + (isPostDay ? ' ★' : '') + '</div>';
  });

  // Data rows
  weekRows.forEach(weekRow => {
    h += '<div style="color:var(--text3);font-size:10px;display:flex;align-items:center;padding-right:4px;white-space:nowrap">'
       + rowLabels[weekRow] + '</div>';
    [1,2,3,4,5].forEach(dow => {
      const off = dow - postDow - (weekRow * 7);
      if (off > 0) {
        // After posting day — disabled
        h += '<div style="text-align:center;padding:3px 1px;border-radius:4px;opacity:0.2;cursor:default;background:var(--bg2)">'
           + d3[dow] + '</div>';
      } else if (off === 0) {
        // Posting day itself
        h += '<div style="text-align:center;padding:3px 1px;border-radius:4px;cursor:default;'
           + 'background:var(--accent);color:#fff;font-weight:700;opacity:0.55" title="Dia da postagem">POST</div>';
      } else {
        // Selectable deadline day
        const clamped = _clampNoWeekend(postDow, off);
        const sel = clamped === selectedOffset;
        h += '<div onclick="fluxoUpdateOffset(\'' + cid + '\',' + pi + ',' + ti + ',' + off + ')"'
           + ' title="' + Math.abs(clamped) + ' dias antes da postagem"'
           + ' style="text-align:center;padding:3px 1px;border-radius:4px;cursor:pointer;'
           + 'background:' + (sel ? 'var(--accent)' : 'var(--bg3)') + ';'
           + 'color:' + (sel ? '#fff' : 'var(--text2)') + ';font-weight:' + (sel ? 700 : 400) + '">'
           + d3[dow] + '</div>';
      }
    });
  });

  h += '</div>';
  return h;
}

function renderFluxoClienteForm() {
  const clienteId = document.getElementById('fluxo-cliente').value;
  const fluxo     = FLUXO_SEMANAL[clienteId];
  const aloc      = ALOCACAO[clienteId] || {};
  const respKeys  = Object.keys(aloc).filter(k => !Array.isArray(aloc[k]));

  if (!fluxo) {
    document.getElementById('fluxo-form').innerHTML =
      `<div class="text-muted text-sm mb-16">Nenhum fluxo configurado para este cliente.</div>
       <button class="btn btn-ghost btn-sm" onclick="fluxoAddPiece('${clienteId}')">+ Adicionar primeira peça</button>`;
    return;
  }

  let html = '';
  fluxo.pieces.forEach((piece, pi) => {
    html += `<div class="card mb-12" style="border-left:3px solid var(--accent)" id="fluxo-piece-${pi}">
      <div class="flex-between mb-12">
        <div class="flex-center gap-8">
          <input type="text" value="${piece.nome}" placeholder="Nome da peça" style="width:160px;font-weight:600"
            onchange="fluxoUpdatePiece('${clienteId}',${pi},'nome',this.value)">
          <select onchange="fluxoUpdatePiece('${clienteId}',${pi},'postDow',+this.value)" style="width:110px">
            ${_DIAS.map((d,i)=>`<option value="${i}"${piece.postDow===i?' selected':''}>${d}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-danger btn-xs" onclick="fluxoRemovePiece('${clienteId}',${pi})">&#10005; Remover peça</button>
      </div>
      <table style="width:100%;margin-bottom:10px">
        <thead><tr>
          <th style="width:100px">Tipo</th>
          <th>Subtipo / ID</th>
          <th style="width:140px">Responsável</th>
          <th style="width:180px">Prazo</th>
          <th style="width:36px"></th>
        </tr></thead>
        <tbody id="fluxo-subs-${pi}">`;

    piece.tarefas.forEach((t, ti) => {
      const subSuggestions = (_SUBTIPOS[t.tipo] || []).map(s => `<option value="${s}">`).join('');
      const dlId = `dl-${pi}-${ti}`;
      const safeOffset = _clampNoWeekend(piece.postDow, t.offset || 0);
      const dayLabel   = _DIAS_FULL[((piece.postDow + safeOffset) % 7 + 7) % 7];
      html += `<tr>
        <td><select onchange="fluxoUpdateTarefa('${clienteId}',${pi},${ti},'tipo',this.value);fluxoUpdateOffset('${clienteId}',${pi},${ti},_defaultOffset(this.value))" style="width:90px">
          ${_TIPOS_TAREFA.map(tp=>`<option value="${tp}"${tp===t.tipo?' selected':''}>${tp}</option>`).join('')}
        </select></td>
        <td>
          <datalist id="${dlId}">${subSuggestions}</datalist>
          <input type="text" list="${dlId}" value="${t.subtipo||''}" placeholder="subtipo livre..."
            style="width:100%;box-sizing:border-box"
            onchange="fluxoUpdateTarefa('${clienteId}',${pi},${ti},'subtipo',this.value)"
            onblur="fluxoUpdateTarefa('${clienteId}',${pi},${ti},'subtipo',this.value)">
        </td>
        <td><select onchange="fluxoUpdateTarefa('${clienteId}',${pi},${ti},'respKey',this.value)" style="width:130px">
          ${respKeys.map(k=>`<option value="${k}"${k===t.respKey?' selected':''}>${papelLabel(k)}</option>`).join('')}
        </select></td>
        <td>${_fluxoOffsetGrid(clienteId, pi, ti, piece.postDow, safeOffset)}</td>
        <td><button class="btn btn-danger btn-xs" onclick="fluxoRemoveTarefa('${clienteId}',${pi},${ti})">&#10005;</button></td>
      </tr>`;
    });

    html += `</tbody></table>
      <button class="btn btn-ghost btn-xs" onclick="fluxoAddTarefa('${clienteId}',${pi})">+ Subtarefa</button>
    </div>`;
  });

  html += `<div class="flex-center gap-8 mt-16" style="flex-wrap:wrap">
    <button class="btn btn-ghost btn-sm" onclick="fluxoAddPiece('${clienteId}','design')">+ Peça Design</button>
    <button class="btn btn-ghost btn-sm" onclick="fluxoAddPiece('${clienteId}','video')">+ Peça Vídeo</button>
    <button class="btn btn-ghost btn-sm" onclick="fluxoAddPiece('${clienteId}','email')">+ E-mail Marketing</button>
    <button class="btn btn-primary btn-sm" onclick="fluxoSalvar('${clienteId}')">Salvar fluxo de ${clienteId}</button>
  </div>`;

  document.getElementById('fluxo-form').innerHTML = html;
}

// helpers mutam FLUXO_SEMANAL em memória e re-renderizam
function _fluxoCopy(clienteId) {
  return JSON.parse(JSON.stringify(FLUXO_SEMANAL[clienteId] || { pieces: [] }));
}
function fluxoUpdatePiece(cid, pi, field, val) {
  const f = _fluxoCopy(cid); f.pieces[pi][field] = val; FLUXO_SEMANAL[cid] = f;
}
function fluxoUpdateTarefa(cid, pi, ti, field, val) {
  const f = _fluxoCopy(cid); f.pieces[pi].tarefas[ti][field] = val; FLUXO_SEMANAL[cid] = f;
}
function fluxoRemovePiece(cid, pi) {
  if (!confirm('Remover esta peça e todas as suas subtarefas?')) return;
  const f = _fluxoCopy(cid); f.pieces.splice(pi, 1); FLUXO_SEMANAL[cid] = f;
  renderFluxoClienteForm();
}
function fluxoRemoveTarefa(cid, pi, ti) {
  const f = _fluxoCopy(cid); f.pieces[pi].tarefas.splice(ti, 1); FLUXO_SEMANAL[cid] = f;
  renderFluxoClienteForm();
}
function fluxoAddTarefa(cid, pi) {
  const f = _fluxoCopy(cid);
  const defTipo   = 'copy';
  const defOffset = _clampNoWeekend(f.pieces[pi].postDow, _defaultOffset(defTipo));
  f.pieces[pi].tarefas.push({ tipo: defTipo, subtipo: 'legenda', respKey: 'copy', offset: defOffset });
  FLUXO_SEMANAL[cid] = f;
  renderFluxoClienteForm();
}
function fluxoAddPiece(cid, tipo='design') {
  if (!FLUXO_SEMANAL[cid]) FLUXO_SEMANAL[cid] = { pieces: [] };
  const f      = _fluxoCopy(cid);
  const dow    = 1; // Segunda por padrão
  const co     = _clampNoWeekend(dow, -10);
  const de     = _clampNoWeekend(dow, co + 3);
  let tarefas  = [];
  if (tipo === 'video') {
    tarefas = [
      { tipo:'copy',   subtipo:'copy para capa de vídeo', respKey:'copy',   offset: co },
      { tipo:'copy',   subtipo:'legenda',                  respKey:'copy',   offset: co },
      { tipo:'design', subtipo:'design de capa de vídeo', respKey:'design', offset: de },
      { tipo:'edicao', subtipo:'edição de vídeo',          respKey:'edicao', offset: de },
    ];
  } else if (tipo === 'email') {
    tarefas = [
      { tipo:'copy',   subtipo:'texto do e-mail', respKey:'copy',   offset: co },
      { tipo:'design', subtipo:'template e-mail', respKey:'design', offset: de },
    ];
  } else {
    tarefas = [
      { tipo:'copy',   subtipo:'legenda', respKey:'copy',   offset: co },
      { tipo:'design', subtipo:'design',  respKey:'design', offset: de },
    ];
  }
  const nomeMap = { video:'Novo Vídeo', email:'E-mail Marketing' };
  const extraProps = tipo === 'email' ? { quinzenal: true } : {};
  f.pieces.push({ nome: nomeMap[tipo] || 'Novo Design', key:'nova-'+(f.pieces.length+1), postDow: dow, ...extraProps, tarefas });
  FLUXO_SEMANAL[cid] = f;
  renderFluxoClienteForm();
}
function fluxoSalvar(cid) {
  const saved = JSON.parse(localStorage.getItem('cd_fluxo') || '{}');
  saved[cid] = FLUXO_SEMANAL[cid];
  localStorage.setItem('cd_fluxo', JSON.stringify(saved));
  showToast(`Fluxo de ${cid} salvo!`);
}

// =====================================================
// FRAMEWORK
// =====================================================
function renderFwSemana() {
  const days = ['Segunda','Terça','Quarta','Quinta','Sexta'];
  let html = '<div class="sched-grid">';
  for (const day of days) {
    html += `<div class="sched-day"><h4>${day}</h4>`;
    for (const b of SEMANA_IDEAL[day]) {
      html += `<div class="sched-block block-${b.tipo}">
        <div class="sched-time">${b.time}</div>
        <div class="sched-label">${b.tipo==='bloqueado'?'🚫 ':''}${b.label}</div>
        <div class="sched-detail">${b.detalhe}</div>
      </div>`;
    }
    html += '</div>';
  }
  html += '</div>';
  document.getElementById('fw-semana').innerHTML = html;
}

function renderFwRotina() {
  const state    = getChecklist();
  const todayKey = today();
  const ts       = state[todayKey] || {};
  const done     = CHECKLIST_ITEMS.filter(i => ts[i.id]).length;
  const pct      = Math.round(done/CHECKLIST_ITEMS.length*100);

  let html = `<div class="card mb-16" style="padding:16px 20px">
    <div class="flex-between mb-8">
      <div><span class="font-bold">Progresso do dia</span> <span class="text-faint text-sm">${done}/${CHECKLIST_ITEMS.length} itens</span></div>
      <button class="btn btn-ghost btn-sm" onclick="resetChecklist()">Reiniciar dia</button>
    </div>
    <div class="progress-bar" style="height:8px"><div class="progress-fill" style="width:${pct}%;background:${pct>=80?'var(--green)':pct>=50?'var(--yellow)':'var(--accent)'}"></div></div>
  </div>`;

  let momAtual = null;
  for (const item of CHECKLIST_ITEMS) {
    const checked = !!ts[item.id];
    if (item.momento !== momAtual) {
      if (momAtual !== null) html += '<div style="margin-bottom:8px"></div>';
      html += `<div class="text-xs font-bold text-faint mb-8" style="text-transform:uppercase;letter-spacing:.5px;margin-top:${momAtual!==null?'16px':'0'}">${item.momento}</div>`;
      momAtual = item.momento;
    }
    html += `<div class="checklist-item${checked?' done':''}" onclick="toggleCheck('${item.id}')">
      <div class="check-box">${checked?'✓':''}</div>
      <div class="item-text">${item.texto}</div>
    </div>`;
  }
  document.getElementById('fw-rotina').innerHTML = html;
}

function renderFwRegras() {
  const princip = REGRAS.slice(0,5);
  const comun   = REGRAS.slice(5);
  document.getElementById('fw-regras').innerHTML = `
    <div class="grid grid-2 gap-16">
      <div>
        <div class="section-title">5 Princípios</div>
        ${princip.map(r=>`<div class="card mb-8"><div class="font-bold mb-4">${r.titulo}</div><div class="text-muted text-sm">${r.desc}</div></div>`).join('')}
      </div>
      <div>
        <div class="section-title">Regras de Comunicação</div>
        ${comun.map(r=>`<div class="card mb-8"><div class="font-bold mb-4">${r.titulo}</div><div class="text-muted text-sm">${r.desc}</div></div>`).join('')}
        <div class="divider"></div>
        <div class="section-title">Reuniões Fixas</div>
        ${REUNIOES_FIXAS.map(r=>`<div class="card mb-8" style="border-left:3px solid var(--red)">
          <div class="flex-between mb-4">
            <span class="font-bold">${r.nome}</span>
            <span class="tag tag-gray">${r.dia} ${r.hora}</span>
          </div>
          <div class="text-muted text-sm">${r.desc}</div>
        </div>`).join('')}
      </div>
    </div>`;
}

function renderFramework() {
  renderFwSemana();
  renderFwRotina();
  renderFwRegras();
}

function setFwTab(tab, btn) {
  document.querySelectorAll('.fw-panel').forEach(el => { el.style.display='none'; });
  document.querySelectorAll('#fw-tabs .filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('fw-'+tab).style.display = 'block';
  btn.classList.add('active');
  if (tab === 'rotina') renderFwRotina();
}

function toggleCheck(id) {
  const state = getChecklist();
  const k = today();
  if (!state[k]) state[k] = {};
  state[k][id] = !state[k][id];
  saveChecklist(state);
  renderFwRotina();
}

function resetChecklist() {
  if (!confirm('Reiniciar checklist do dia?')) return;
  const state = getChecklist();
  state[today()] = {};
  saveChecklist(state);
  renderFwRotina();
}

// =====================================================
// GOOGLE SHEETS — TRÁFEGO SYNC
// =====================================================

function _gsParseCsv(text) {
  const lines = text.trim().split('\n');
  if (!lines.length) return [];
  const headers = _gsSplitCsvRow(lines[0]);
  return lines.slice(1).map(line => {
    const vals = _gsSplitCsvRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function _gsSplitCsvRow(row) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

function _gsParsePct(val) {
  if (!val) return null;
  const s = String(val).replace('%','').replace(',','.').trim();
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  // Se veio como decimal (0.5 = 50%), converter
  return n <= 1.5 && !s.includes('%') ? Math.round(n * 100) : n;
}

async function gsTrafegoSync(tipo) {
  tipo = tipo || 'semanal';
  const cfg = gsGetConfig();
  const sheetName = tipo === 'mensal' ? (cfg.sheetMensal || 'Mensal') : (cfg.sheetSemanal || 'Semanal');
  const url = `https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const btnId = tipo === 'mensal' ? 'gs-sync-mensal-btn' : 'gs-sync-btn';
  const btn = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = 'Sincronizando...'; }

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const rows = _gsParseCsv(text);

    const clientMap = cfg.clientMap || GS_TRAFEGO_DEFAULT_MAP;
    const result = {};

    for (const row of rows) {
      const clienteName = (row['Cliente'] || '').trim();
      if (!clienteName) continue;
      const clientId = clientMap[clienteName];
      if (!clientId) continue;

      const pct = _gsParsePct(row['% Meta'] || row['%Meta'] || row['% meta'] || '');

      const perf  = parseInt(row['Performance (0-5)'] || row['Performance'] || '0') || 0;
      const relac = parseInt(row['Relacionamento (0-5)'] || row['Relacionamento'] || '0') || 0;
      const sheetScore = perf + relac;
      const sheetStatus = row['Status'] || '';

      const trafScore = pct !== null ? calculateTrafegoScore(pct) : { score: 0, status: 'red', metaPct: 0 };
      result[clientId] = {
        clienteName,
        metaPct:        pct ?? 0,
        score:          trafScore.score,
        status:         trafScore.status,
        investimento:   row['Investimento'] || '',
        leads:          row['Leads'] || '',
        vendas:         row['Vendas'] || '',
        cpl:            row['CPL'] || '',
        cac:            row['CAC'] || '',
        meta:           row['Meta (últimos 6 meses)'] || row['Meta (Semanal)'] || row['Meta'] || '',
        performance:    perf,
        relacionamento: relac,
        sheetScore,
        sheetStatus,
        data:           row['Data'] || '',
        lastSync:       new Date().toISOString()
      };
    }

    gsSaveData(result, tipo);
    const label = tipo === 'mensal' ? 'mensal' : 'semanal';
    showToast(`Tráfego ${label} sincronizado — ${Object.keys(result).length} cliente(s)`);
    if (typeof renderIntegracao === 'function') renderIntegracao();
    // Refresh Health tab if open
    if (_healthTab === 'mensal' && tipo === 'mensal') renderHealth();
  } catch(e) {
    showToast('Erro ao buscar planilha: ' + e.message, true);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↻ Sincronizar'; }
  }
}

// =====================================================
// INTEGRAÇÃO CLICKUP
// =====================================================
function renderIntegracao() {
  const cfg  = getClickUpCfg();
  const sync = cuGetLastSync();
  const connected = !!(cfg.token);

  const autoOn = cuAutoSyncRunning();
  const autoMin = cuAutoSyncInterval();
  document.getElementById('int-status').innerHTML = `
    <div class="integration-status">
      <div class="status-dot ${connected?'connected':'disconnected'}"></div>
      <div style="flex:1">
        <div class="font-bold">${connected?'Conectado ao ClickUp':'Não conectado'}</div>
        ${sync ? `<div class="text-xs text-faint">Última sync: ${new Date(sync.lastSync).toLocaleString('pt-BR')} → ${sync.count} tarefas</div>` : '<div class="text-xs text-faint">Nunca sincronizado</div>'}
        ${connected ? `<div class="text-xs text-faint mt-4">Auto-sync: <span style="color:${autoOn?'var(--green)':'var(--red)'}">
          ${autoOn ? `ativo (a cada ${autoMin} min)` : 'inativo'}</span></div>` : ''}
      </div>
      ${connected ? `
        <div class="flex-center gap-8" style="flex-wrap:wrap">
          <button class="btn btn-success btn-sm" id="sync-btn" onclick="doSync(false)">&#8635; A partir de hoje</button>
          <button class="btn btn-ghost btn-sm" id="sync-global-btn" onclick="doSync(true)">&#8635; Sincronizar global</button>
          ${autoOn
            ? `<button class="btn btn-ghost btn-sm" onclick="cuStopAutoSync();renderIntegracao()">Pausar auto</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="showAutoSyncPicker()">&#x23F1; Auto-sync</button>`}
        </div>` : ''}
    </div>`;

  document.getElementById('int-config').innerHTML = `
    <div class="card mb-16">
      <div class="section-title mb-12">Configuração</div>
      <div class="form-group">
        <label>Token pessoal do ClickUp</label>
        <div class="flex-center gap-8">
          <input type="password" id="cu-token" value="${cfg.token||''}" placeholder="pk_xxxxxxxxxxxxxxxxxx">
          <button class="btn btn-ghost btn-sm" onclick="toggleTokenVisibility()">👁</button>
        </div>
        <div class="text-xs text-faint mt-8">Settings → Apps → API Token no ClickUp</div>
      </div>
      <div class="form-group">
        <label>Workspace ID</label>
        <div class="flex-center gap-8">
          <input type="text" id="cu-workspace" value="${cfg.workspaceId||''}" placeholder="ID do workspace">
          <button class="btn btn-ghost btn-sm" onclick="cuLoadWorkspaces(this)">Buscar</button>
        </div>
      </div>
      <button class="btn btn-primary" onclick="saveCuConfig()">Salvar configuração</button>
      <button class="btn btn-ghost" style="margin-left:8px" onclick="testCuConnection()">Testar conexão</button>
    </div>`;

  renderCuMappings();

  // Alertas de erros e fantasmas
  let errHtml = '';
  if (sync && sync.errors && sync.errors.length) {
    errHtml += `<div class="alert-row danger mb-8">
      <div><div class="font-bold text-sm" style="color:var(--red)">Erros na última sync</div>
      ${sync.errors.map(e=>`<div class="text-xs text-muted">${e}</div>`).join('')}</div></div>`;
  }

  if (connected && sync) {
    // Tarefas ClickUp com prazo anterior à última sync parcial (não foram verificadas)
    const lastSyncDate = new Date(sync.lastSync).toISOString().split('T')[0];
    const allTasks = getTasks();
    const ghosts = allTasks.filter(t =>
      t.source === 'clickup' && t.clickupId &&
      t.prazo && t.prazo < lastSyncDate &&
      !['concluido','aprovado','descartado'].includes(t.status)
    );
    if (ghosts.length) {
      errHtml += `<div class="alert-row warning mb-8">
        <div style="flex:1">
          <div class="font-bold text-sm" style="color:var(--yellow)">⚠ ${ghosts.length} tarefa(s) não verificadas na última sync</div>
          <div class="text-xs text-muted mt-4">Prazo anterior à sync parcial — podem ter sido removidas do ClickUp sem refletir aqui.</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="doSync(true)">&#8635; Sync global</button>
      </div>`;
    }
  }
  document.getElementById('int-errors').innerHTML = errHtml;

  renderOrphans();
  renderGsTrafegoPanel();
}

function renderGsTrafegoPanel() {
  const el = document.getElementById('int-gs-trafego');
  if (!el) return;
  const cfg   = gsGetConfig();
  const data  = gsGetData('semanal');
  const dataMensal = gsGetData('mensal');
  const clients = getClients();
  const synced  = Object.keys(data);
  const lastSync = synced.length ? new Date(data[synced[0]].lastSync).toLocaleString('pt-BR') : null;

  const mapRows = Object.entries(cfg.clientMap || {}).map(([sheetName, cid]) =>
    `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">
       <span style="flex:1;color:var(--text2)">${sheetName}</span>
       <span style="color:var(--text3)">→</span>
       <span style="font-weight:600;color:var(--accent);min-width:30px">${cid}</span>
       <button onclick="gsRemoveMap('${sheetName}')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:12px;padding:0 2px">✕</button>
     </div>`).join('');

  const dataTable = synced.length ? `
    <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px">Dados atuais</div>
      <div style="display:grid;gap:6px">
        ${synced.map(cid => {
          const d = data[cid];
          const c = clients.find(x => x.id === cid);
          const sc = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' }[d.status] || 'var(--text3)';
          return `<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--bg3);border-radius:8px">
            ${c ? `<span style="width:8px;height:8px;border-radius:50%;background:${c.cor};flex-shrink:0"></span>` : ''}
            <span style="font-weight:600;font-size:12px;flex:1">${cid}</span>
            <span style="font-size:11px;color:var(--text3)">${d.metaPct}% meta</span>
            <span style="font-size:14px;font-weight:700;color:${sc}">${d.score}/5</span>
            <span style="width:8px;height:8px;border-radius:50%;background:${sc};flex-shrink:0"></span>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  const lastSyncM = Object.keys(dataMensal).length ? new Date(dataMensal[Object.keys(dataMensal)[0]].lastSync).toLocaleString('pt-BR') : null;

  el.innerHTML = `
    <div class="card mb-16">
      <div class="section-title mb-12">📊 Google Sheets — Tráfego</div>

      <div class="grid grid-2 gap-12 mb-16">
        <div style="padding:12px;background:var(--bg3);border-radius:10px;border-left:3px solid var(--accent)">
          <div class="flex-between mb-8">
            <div>
              <div style="font-weight:700;font-size:13px">Semanal</div>
              ${lastSync ? `<div class="text-xs text-muted">Sync: ${lastSync}</div>` : '<div class="text-xs text-muted">Nunca sincronizado</div>'}
            </div>
            <button id="gs-sync-btn" class="btn btn-primary btn-sm" onclick="gsTrafegoSync('semanal')">↻ Sincronizar</button>
          </div>
          <div class="text-xs text-faint">${synced.length} cliente(s) · aba: ${cfg.sheetSemanal || 'Semanal'}</div>
        </div>
        <div style="padding:12px;background:var(--bg3);border-radius:10px;border-left:3px solid var(--green)">
          <div class="flex-between mb-8">
            <div>
              <div style="font-weight:700;font-size:13px">Mensal</div>
              ${lastSyncM ? `<div class="text-xs text-muted">Sync: ${lastSyncM}</div>` : '<div class="text-xs text-muted">Nunca sincronizado</div>'}
            </div>
            <button id="gs-sync-mensal-btn" class="btn btn-success btn-sm" onclick="gsTrafegoSync('mensal')">↻ Sincronizar</button>
          </div>
          <div class="text-xs text-faint">${Object.keys(dataMensal).length} cliente(s) · aba: ${cfg.sheetMensal || 'Mensal'}</div>
        </div>
      </div>

      <div class="grid grid-3 gap-8 mb-12">
        <div class="form-group mb-0">
          <label>ID da Planilha</label>
          <input type="text" id="gs-sheet-id" value="${cfg.spreadsheetId}" placeholder="ID do Google Sheets"
            style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%">
        </div>
        <div class="form-group mb-0">
          <label>Aba Semanal</label>
          <input type="text" id="gs-sheet-semanal" value="${cfg.sheetSemanal || 'Semanal'}" placeholder="Semanal"
            style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%">
        </div>
        <div class="form-group mb-0">
          <label>Aba Mensal</label>
          <input type="text" id="gs-sheet-mensal" value="${cfg.sheetMensal || 'Mensal'}" placeholder="Mensal"
            style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%">
        </div>
      </div>

      <div class="form-group mb-12">
        <label>Mapeamento de Clientes (nome na planilha → ID interno)</label>
        <div style="background:var(--bg3);border-radius:8px;padding:10px 12px;margin-bottom:8px;max-height:180px;overflow-y:auto">
          ${mapRows || '<div class="text-xs text-faint">Nenhum mapeamento</div>'}
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" id="gs-map-name" placeholder="Nome na planilha" style="flex:2;font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text)">
          <input type="text" id="gs-map-id"   placeholder="ID (ex: AI)" style="flex:1;font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);text-transform:uppercase" maxlength="6">
          <button class="btn btn-ghost btn-sm" onclick="gsAddMap()">+ Adicionar</button>
        </div>
      </div>

      <button class="btn btn-ghost btn-sm" onclick="gsSaveSheetConfig()">Salvar configuração</button>
      ${dataTable}
    </div>`;
}

function gsSaveSheetConfig() {
  const cfg = gsGetConfig();
  const id  = document.getElementById('gs-sheet-id')?.value.trim();
  const sem = document.getElementById('gs-sheet-semanal')?.value.trim();
  const men = document.getElementById('gs-sheet-mensal')?.value.trim();
  if (id)  cfg.spreadsheetId = id;
  if (sem) cfg.sheetSemanal = sem;
  if (men) cfg.sheetMensal  = men;
  gsSaveConfig(cfg);
  showToast('Configuração do Sheets salva!');
}

function gsAddMap() {
  const name = document.getElementById('gs-map-name')?.value.trim();
  const id   = document.getElementById('gs-map-id')?.value.trim().toUpperCase();
  if (!name || !id) return;
  const cfg = gsGetConfig();
  cfg.clientMap = cfg.clientMap || {};
  cfg.clientMap[name] = id;
  gsSaveConfig(cfg);
  renderGsTrafegoPanel();
}

function gsRemoveMap(name) {
  const cfg = gsGetConfig();
  delete cfg.clientMap[name];
  gsSaveConfig(cfg);
  renderGsTrafegoPanel();
}

function renderOrphans() {
  const tasks    = getTasks();
  const clients  = getClients();
  const todayStr = today();

  // Tarefas sem vínculo com o ClickUp (sem clickupId)
  const orphans = tasks.filter(t => !t.clickupId);

  const el = document.getElementById('int-orphans');
  if (!el) return;

  if (!orphans.length) {
    el.innerHTML = `<div class="card">
      <div class="flex-center gap-8">
        <span style="color:var(--green);font-size:16px">✓</span>
        <span class="text-sm text-muted">Todas as tarefas têm vínculo com o ClickUp.</span>
      </div>
    </div>`;
    return;
  }

  // Agrupa por cliente
  const byClient = {};
  for (const t of orphans) {
    if (!byClient[t.cliente]) byClient[t.cliente] = [];
    byClient[t.cliente].push(t);
  }

  let rows = '';
  for (const t of orphans) {
    const c = clients.find(x => x.id === t.cliente);
    const isOverdue = t.prazo && t.prazo < todayStr && !['concluido','aprovado','descartado'].includes(t.status);
    rows += `<tr>
      <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c?.cor||'#888'};margin-right:6px"></span>${c?.nome || t.cliente}</td>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.nome || '<span class="text-faint">—</span>'}</td>
      <td>${statusTag(t.status)}</td>
      <td style="color:${isOverdue?'var(--red)':'var(--text2)'}">${t.prazo ? fmtDate(t.prazo) : '—'}</td>
      <td class="text-faint text-xs">${t.source || 'manual'}</td>
      <td>
        <div class="flex-center gap-4">
          <button class="btn btn-ghost btn-xs" onclick="openEditTask('${t.id}')">Editar</button>
          <button class="btn btn-danger btn-xs" onclick="orphanDelete('${t.id}')">Excluir</button>
        </div>
      </td>
    </tr>`;
  }

  // Summary badges by client
  const badges = Object.entries(byClient).map(([cid, ts]) => {
    const c = clients.find(x => x.id === cid);
    return `<span class="tag" style="background:${c?.cor||'#888'}22;color:${c?.cor||'#888'}">${c?.nome||cid}: ${ts.length}</span>`;
  }).join(' ');

  el.innerHTML = `<div class="card">
    <div class="flex-between mb-12">
      <div>
        <div class="section-title mb-4">Tarefas sem vínculo ClickUp <span class="badge">${orphans.length}</span></div>
        <div class="text-xs text-muted">Criadas manualmente ou importadas sem ID. Não são sincronizadas com o ClickUp.</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="orphanDeleteAll()">Excluir todas (${orphans.length})</button>
    </div>
    <div class="flex-center gap-6 flex-wrap mb-12">${badges}</div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Cliente</th><th>Tarefa</th><th>Status</th><th>Prazo</th><th>Origem</th><th>Ações</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function orphanDelete(id) {
  if (!confirm('Excluir esta tarefa?')) return;
  saveTasks(getTasks().filter(t => t.id !== id));
  renderOrphans();
  showToast('Tarefa excluída');
}

function orphanDeleteAll() {
  const orphans = getTasks().filter(t => !t.clickupId);
  if (!orphans.length) return;
  if (!confirm(`Excluir ${orphans.length} tarefa(s) sem vínculo ClickUp? Esta ação não pode ser desfeita.`)) return;
  saveTasks(getTasks().filter(t => !!t.clickupId));
  renderOrphans();
  showToast(`${orphans.length} tarefa(s) excluída(s)`);
}

function renderCuMappings() {
  const cfg     = getClickUpCfg();
  const clients = getClients();
  const mappings = cfg.mappings || [];

  let html = `<div class="card mb-16">
    <div class="section-title mb-12">Mapeamento: Lista ClickUp → Cliente</div>
    <div class="text-xs text-muted mb-12">Cada lista do ClickUp mapeia para um cliente. Use o rótulo para identificar listas do mesmo cliente (ex: Produção, Gravação).</div>
    <div id="mapping-rows">`;
  for (let i=0; i<Math.max(mappings.length,1); i++) {
    const m = mappings[i] || { listId:'', clientId:'', label:'' };
    html += `<div class="mapping-row" id="mrow-${i}" style="flex-wrap:wrap;gap:6px">
      <input type="text" value="${m.listId}" placeholder="ID da lista" style="flex:1.4;min-width:120px" id="m-list-${i}">
      <span class="mapping-arrow">&#8594;</span>
      <select style="flex:1;min-width:120px" id="m-client-${i}">
        <option value="">Selecionar cliente</option>
        ${clients.map(c=>`<option value="${c.id}"${m.clientId===c.id?' selected':''}>${c.nome}</option>`).join('')}
      </select>
      <input type="text" value="${m.label||''}" placeholder="Rótulo (ex: Produção)" style="flex:1;min-width:100px" id="m-label-${i}">
      <button class="btn btn-danger btn-xs" onclick="removeMapping(${i})">&#10005;</button>
    </div>`;
  }
  html += `</div>
    <button class="btn btn-ghost btn-sm mt-16" onclick="addMapping()">+ Adicionar lista</button>
    <button class="btn btn-primary btn-sm mt-16" style="margin-left:8px" onclick="saveMappings()">Salvar mapeamentos</button>
  </div>`;
  document.getElementById('int-mappings').innerHTML = html;
}

function addMapping() {
  const container = document.getElementById('mapping-rows');
  const clients = getClients();
  const row = document.createElement('div');
  row.className = 'mapping-row';
  row.style.cssText = 'flex-wrap:wrap;gap:6px';
  row.innerHTML = `
    <input type="text" placeholder="ID da lista" style="flex:1.4;min-width:120px" class="m-list-input">
    <span class="mapping-arrow">?</span>
    <select style="flex:1;min-width:120px" class="m-client-select">
      <option value="">Selecionar cliente</option>
      ${clients.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')}
    </select>
    <input type="text" placeholder="Rótulo (ex: Produção)" style="flex:1;min-width:100px" class="m-label-input">
    <button class="btn btn-danger btn-xs" onclick="this.closest('.mapping-row').remove()">&#10005;</button>`;
  container.appendChild(row);
}

function removeMapping(i) {
  // legacy: called from statically rendered rows in renderCuMappings
  const row = document.getElementById('mrow-'+i);
  if (row) row.remove();
}

function saveMappings() {
  const mappings = [];
  document.querySelectorAll('.mapping-row').forEach(row => {
    const listId   = (row.querySelector('.m-list-input')   || row.querySelector('[id^="m-list-"]')  )?.value.trim() || '';
    const clientId = (row.querySelector('.m-client-select') || row.querySelector('[id^="m-client-"]'))?.value       || '';
    const label    = (row.querySelector('.m-label-input')   || row.querySelector('[id^="m-label-"]') )?.value.trim() || '';
    if (listId && clientId) mappings.push({ listId, clientId, label });
  });
  const cfg = getClickUpCfg();
  cfg.mappings = mappings;
  saveClickUpCfg(cfg);
  showToast('Mapeamentos salvos!');
}

function saveCuConfig() {
  const cfg = getClickUpCfg();
  cfg.token = document.getElementById('cu-token').value.trim();
  cfg.workspaceId = document.getElementById('cu-workspace').value.trim();
  saveClickUpCfg(cfg);
  showToast('Configuração salva!');
  renderIntegracao();
}

function toggleTokenVisibility() {
  const input = document.getElementById('cu-token');
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function cuLoadWorkspaces(btn) {
  const token = document.getElementById('cu-token').value.trim();
  if (!token) { showToast('Insira o token primeiro', true); return; }
  btn.disabled = true; btn.textContent = '...';
  try {
    const cfg = getClickUpCfg(); cfg.token = token; saveClickUpCfg(cfg);
    const wss = await cuGetWorkspaces();
    if (!wss.length) { showToast('Nenhum workspace encontrado', true); return; }
    const wsInput = document.getElementById('cu-workspace');
    wsInput.value = wss[0].id;
    showToast(`Workspace: ${wss[0].name} (${wss[0].id})`);
  } catch(e) {
    showToast('Erro: ' + e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = 'Buscar';
  }
}

async function testCuConnection() {
  try {
    const ok = await cuTestConnection();
    showToast(ok ? '✅ Conexão bem-sucedida!' : 'Sem workspaces encontrados', !ok);
  } catch(e) {
    showToast('Erro: ' + e.message, true);
  }
}

async function doSync(global = false) {
  const btnId = global ? 'sync-global-btn' : 'sync-btn';
  const btn = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sincronizando...'; }
  try {
    let result;
    if (global) {
      _showSyncProgress(0, 1, 'Iniciando...');
      result = await cuSyncOptimistic((done, total, label) => _showSyncProgress(done, total, label));
      _hideSyncProgress();
    } else {
      result = await cuSync(new Date(today() + 'T00:00:00').getTime());
    }
    const rmLabel = result.removed ? ` · ${result.removed} removida${result.removed!==1?'s':''}` : '';
    showToast(`Sync ${global ? 'global' : 'a partir de hoje'}: ${result.count} tarefas${rmLabel}`);
    _syncRefreshAll();
  } catch(e) {
    _hideSyncProgress();
    showToast('Erro na sync: ' + e.message, true);
  } finally {
    renderIntegracao();
  }
}

function _showSyncProgress(done, total, label) {
  const bar = document.getElementById('int-progress');
  if (!bar) return;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  bar.style.display = 'block';
  bar.innerHTML = `<div class="card mb-12" style="padding:12px 16px">
    <div class="flex-between mb-8">
      <span class="text-sm text-faint">Sincronização global</span>
      <span class="text-sm font-bold">${label}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
  </div>`;
}

function _hideSyncProgress() {
  const bar = document.getElementById('int-progress');
  if (bar) bar.style.display = 'none';
}

// Atualiza todas as seções que dependem das tarefas após uma sync
function _syncRefreshAll() {
  if (currentPage !== 'equipe')     renderEquipe();
  if (currentPage !== 'clientes')   renderClientes();
  if (currentPage !== 'dashboard')  renderDashboard();
  if (currentPage !== 'tarefas')    renderTarefas();
}

function showAutoSyncPicker() {
  const opts = [1, 5, 10, 15, 30];
  const cur  = cuAutoSyncInterval();
  const html = `<div style="display:flex;flex-direction:column;gap:8px;padding:8px 0">
    <div class="text-xs text-faint mb-4">Verificar atualizações no ClickUp a cada:</div>
    ${opts.map(m=>`<button class="btn ${m===cur?'btn-primary':'btn-ghost'} btn-sm" onclick="cuStartAutoSync(${m});renderIntegracao();showToast('Auto-sync ativo: ${m} min')">${m} minuto${m>1?'s':''}</button>`).join('')}
  </div>`;
  // inline picker abaixo do botão
  let picker = document.getElementById('autosync-picker');
  if (picker) { picker.remove(); return; }
  picker = document.createElement('div');
  picker.id = 'autosync-picker';
  picker.className = 'card';
  picker.style.cssText = 'position:absolute;right:24px;z-index:200;min-width:180px;padding:12px 16px';
  picker.innerHTML = html;
  document.getElementById('int-status').style.position = 'relative';
  document.getElementById('int-status').appendChild(picker);
}

// =====================================================
// GERADOR DE TAREFAS
// =====================================================
let geradorStep    = 1;
let geradorMes     = '';
let geradorPreview = [];
let geradorMode    = 'mes'; // 'mes' | 'semana' | 'demanda'
let geradorSemanaStart  = '';
let geradorSemanaEnd    = '';
let geradorClientesSel  = []; // IDs selecionados; vazio = todos

function gcToggle(id, btn) {
  btn.classList.toggle('active');
  // sync "Todos" button state
  const todos = document.getElementById('gc-todos');
  if (!todos) return;
  const all = [...document.querySelectorAll('[id^="gc-"]:not(#gc-todos)')];
  todos.classList.toggle('active', all.every(b => b.classList.contains('active')));
}

function gcToggleTodos(btn) {
  const all = [...document.querySelectorAll('[id^="gc-"]:not(#gc-todos)')];
  const activate = !btn.classList.contains('active');
  btn.classList.toggle('active', activate);
  all.forEach(b => b.classList.toggle('active', activate));
}

function gcGetSelecionados() {
  return [...document.querySelectorAll('[id^="gc-"]:not(#gc-todos).active')].map(el => el.id.replace('gc-',''));
}

function _clientFilter() {
  const clients = getClients().filter(c => !isTrafegoOnly(c));
  return `<div class="form-group mt-16">
    <label>Clientes</label>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
      <button type="button" id="gc-todos" class="filter-btn"
        style="padding:5px 12px;font-weight:600"
        onclick="gcToggleTodos(this)">Todos</button>
      ${clients.map(c => `<button type="button" id="gc-${c.id}" class="filter-btn"
        style="border-left:3px solid ${c.cor};padding:5px 12px"
        onclick="gcToggle('${c.id}',this)">${c.nome}</button>`).join('')}
    </div>
  </div>`;
}

function renderGerador() {
  geradorStep    = 1;
  geradorMes     = '';
  geradorPreview = [];
  geradorMode    = 'mes';
  document.getElementById('gerador-content').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:760px;margin-bottom:32px">
      <div class="card" style="cursor:pointer;text-align:center;padding:28px 20px" onclick="renderGeradorModoMes()">
        <div style="font-size:32px;margin-bottom:10px">📅</div>
        <div class="font-bold mb-6">Novo Mês</div>
        <div class="text-xs text-muted">Gere todas as tarefas do mês de uma vez com as datas corretas por cliente</div>
      </div>
      <div class="card" style="cursor:pointer;text-align:center;padding:28px 20px" onclick="renderGeradorModoSemana()">
        <div style="font-size:32px;margin-bottom:10px">📆</div>
        <div class="font-bold mb-6">Nova Semana</div>
        <div class="text-xs text-muted">Gere as tarefas de uma semana específica por cliente</div>
      </div>
      <div class="card" style="cursor:pointer;text-align:center;padding:28px 20px" onclick="renderGeradorModoDemanda()">
        <div style="font-size:32px;margin-bottom:10px">✏️</div>
        <div class="font-bold mb-6">Nova Demanda</div>
        <div class="text-xs text-muted">Crie uma demanda unitária - escolha cliente, tipo e data</div>
      </div>
    </div>
    <div>
      <div class="flex-between mb-10">
        <div class="section-title mb-0" style="font-size:14px">Histórico de Criações</div>
        <button class="btn btn-ghost btn-xs" onclick="limparLogCriacao()" title="Limpar histórico">🗑 Limpar</button>
      </div>
      <div id="gerador-log">${_renderGeradorLog()}</div>
    </div>`;
}

function _renderGeradorLog() {
  const logs    = getLogsCriacao();
  const clients = getClients();
  if (!logs.length) return '<div class="text-xs text-faint">Nenhuma criação registrada ainda.</div>';
  const modeLabel = m => m === 'mes' ? 'Mês' : m === 'semana' ? 'Semana' : 'Demanda';
  return logs.map(l => {
    const dt   = new Date(l.timestamp).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
    const tags = (l.clientes||[]).map(id => {
      const c = clients.find(x => x.id === id);
      return c ? `<span class="tag" style="background:${c.cor}22;color:${c.cor}">${c.id}</span>` : '';
    }).join('');
    const canUndo = l.taskIds && l.taskIds.length > 0;
    return `<div class="card mb-6" style="padding:10px 14px">
      <div class="flex-between">
        <div class="flex-center gap-6 flex-wrap">
          <span class="tag" style="background:var(--accent)22;color:var(--accent)">${modeLabel(l.mode)}</span>
          ${tags}
          <span class="text-xs text-faint">${l.total} tarefa${l.total!==1?'s':''}</span>
        </div>
        <div class="flex-center gap-8">
          <span class="text-xs text-faint">${dt}</span>
          ${canUndo ? `<button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="desfazerCriacao('${l.id}')" title="Desfazer — remove as ${l.taskIds.length} tarefas criadas nesta ação">↩ Desfazer</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function desfazerCriacao(logId) {
  const logs = getLogsCriacao();
  const log  = logs.find(l => l.id === logId);
  if (!log || !log.taskIds || !log.taskIds.length) return;
  if (!confirm(`Remover as ${log.taskIds.length} tarefa${log.taskIds.length!==1?'s':''} criadas nesta ação?`)) return;
  const ids = new Set(log.taskIds);
  saveTasks(getTasks().filter(t => !ids.has(t.id)));
  const newLogs = logs.filter(l => l.id !== logId);
  localStorage.setItem('cd_logs_criacao', JSON.stringify(newLogs));
  showToast(`${log.taskIds.length} tarefa${log.taskIds.length!==1?'s':''} removida${log.taskIds.length!==1?'s':''}`);
  const el = document.getElementById('gerador-log');
  if (el) el.innerHTML = _renderGeradorLog();
}

function limparLogCriacao() {
  if (!confirm('Limpar todo o histórico de criações?')) return;
  localStorage.removeItem('cd_logs_criacao');
  const el = document.getElementById('gerador-log');
  if (el) el.innerHTML = '<div class="text-xs text-faint">Nenhuma criação registrada ainda.</div>';
}

function renderGeradorModoMes() {
  geradorMode = 'mes';
  document.getElementById('gerador-content').innerHTML = renderGeradorStep1();
}

// ── MODO SEMANA ──────────────────────────────────────
function renderGeradorModoSemana() {
  geradorMode = 'semana';
  const hoje = new Date().toISOString().slice(0, 10);
  document.getElementById('gerador-content').innerHTML = `
    <div class="card mb-16" style="max-width:600px">
      <div class="section-title">Nova Semana</div>
      <div class="form-group">
        <label>Selecione qualquer dia da semana desejada</label>
        <input type="date" id="g-semana-ref" value="${hoje}" style="max-width:200px">
      </div>
      ${_clientFilter()}
      <div class="flex-center gap-8 mt-16">
        <button class="btn btn-ghost" onclick="renderGerador()">← Voltar</button>
        <button class="btn btn-primary" onclick="geradorProximo1Semana()">Ver postagens →</button>
      </div>
    </div>`;
}

function geradorProximo1Semana() {
  const refDate = document.getElementById('g-semana-ref').value;
  if (!refDate) { showToast('Selecione uma data', true); return; }
  geradorClientesSel = gcGetSelecionados();
  if (!geradorClientesSel.length) { showToast('Selecione ao menos um cliente', true); return; }
  const ref = new Date(refDate + 'T12:00:00');
  const dow = ref.getDay();
  const mon = new Date(ref); mon.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  geradorSemanaStart = mon.toISOString().split('T')[0];
  geradorSemanaEnd   = sun.toISOString().split('T')[0];
  document.getElementById('gerador-content').innerHTML = renderGeradorStep2Semana();
}

function renderGeradorStep2Semana() {
  const clients = getClients().filter(c => !isTrafegoOnly(c));
  const fmtSem  = d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });

  function getDatesInRange(dow) {
    const dates = [];
    const d = new Date(geradorSemanaStart + 'T12:00:00');
    const e = new Date(geradorSemanaEnd   + 'T12:00:00');
    while (d <= e) { if (d.getDay() === dow) dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate()+1); }
    return dates;
  }

  let html = `<div class="card mb-16">
    <div class="section-title">Semana de ${fmtSem(geradorSemanaStart)} a ${fmtSem(geradorSemanaEnd)}</div>
    <div class="text-muted text-sm mb-20">Clique nas datas para incluir ou excluir. Destacadas = serão geradas.</div>`;

  let temAlgo = false;
  for (const c of clients.filter(c => geradorClientesSel.includes(c.id))) {
    const fluxo = FLUXO_SEMANAL[c.id]; if (!fluxo) continue;
    const pieces = fluxo.pieces.map(p => ({ ...p, datas: getDatesInRange(p.postDow) })).filter(p => p.datas.length);
    if (!pieces.length) continue;
    temAlgo = true;
    html += `<div class="card mb-12" style="border-left:3px solid ${c.cor};padding:16px 20px">
      <div class="flex-between mb-16">
        <div class="flex-center gap-8">
          <span style="width:10px;height:10px;border-radius:50%;background:${c.cor};flex-shrink:0"></span>
          <span class="font-bold">${c.nome}</span>
        </div>
        <div class="flex-center gap-6">
          <button class="btn btn-ghost btn-xs" onclick="gToggleCliente('${c.id}',true)">✓ Marcar tudo</button>
          <button class="btn btn-ghost btn-xs" onclick="gToggleCliente('${c.id}',false)">✗ Desmarcar tudo</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(${pieces.length},1fr);gap:0;border:1px solid var(--border);border-radius:10px;overflow:hidden">`;
    for (let pi = 0; pi < pieces.length; pi++) {
      const piece = pieces[pi];
      const color = _GPIECE_COLOR[piece.key] || c.cor;
      const borderRight = pi < pieces.length - 1 ? 'border-right:1px solid var(--border)' : '';
      html += `<div style="${borderRight}">
        <div style="padding:10px 12px;background:color-mix(in srgb,${color} 8%,var(--bg2));border-bottom:2px solid color-mix(in srgb,${color} 30%,var(--border))">
          <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.4px">${piece.nome}</div>
        </div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:5px">
          ${piece.datas.map((d, i) => _gDatePill(c.id, piece.key, d, i, true, color)).join('')}
        </div>
      </div>`;
    }
    html += `</div></div>`;
  }

  if (!temAlgo) html += `<div class="text-muted text-sm">Nenhuma postagem programada para essa semana.</div>`;

  html += `<div class="flex-center gap-8 mt-16">
    <button class="btn btn-ghost" onclick="renderGeradorModoSemana()">← Voltar</button>
    <button class="btn btn-primary" onclick="geradorProximo2()">Pré-visualizar tarefas →</button>
  </div></div>`;
  return html;
}

// ── MODO DEMANDA UNITÁRIA ────────────────────────────
function renderGeradorModoDemanda() {
  geradorMode = 'demanda';
  const clients = getClients().filter(c => !isTrafegoOnly(c));
  const hoje    = new Date().toISOString().slice(0, 10);

  document.getElementById('gerador-content').innerHTML = `
    <div class="card mb-16" style="max-width:520px">
      <div class="section-title">Nova Demanda</div>
      <div class="grid grid-2 gap-16 mb-16">
        <div class="form-group">
          <label>Cliente</label>
          <select id="nd-cliente" onchange="ndAtualizarTipos()">
            ${clients.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Tipo de Conteúdo</label>
          <select id="nd-tipo">
            ${ND_OPCOES.map(o => `<option value="${o.key}">${o.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Data de Postagem</label>
          <input type="date" id="nd-data" value="${hoje}">
        </div>
      </div>
      <div class="flex-center gap-8">
        <button class="btn btn-ghost" onclick="renderGerador()">← Voltar</button>
        <button class="btn btn-primary" onclick="geradorPreviewDemanda()">Pré-visualizar ?</button>
      </div>
    </div>`;
}

const ND_OPCOES = [
  { key: 'feed1', label: 'Design' },
  { key: 'video', label: 'Vídeo' },
  { key: 'dark',  label: 'Dark Post' }
];

function ndAtualizarTipos() {
  const prev = document.getElementById('nd-tipo').value;
  document.getElementById('nd-tipo').innerHTML = ND_OPCOES.map(o => `<option value="${o.key}">${o.label}</option>`).join('');
  if ([...document.getElementById('nd-tipo').options].find(o => o.value === prev)) document.getElementById('nd-tipo').value = prev;
}

function geradorPreviewDemanda() {
  const clienteId = document.getElementById('nd-cliente').value;
  const pieceKey  = document.getElementById('nd-tipo').value;
  const dataPost  = document.getElementById('nd-data').value;
  if (!dataPost) { showToast('Selecione a data de postagem', true); return; }

  const fluxo = FLUXO_SEMANAL[clienteId];
  const aloc  = ALOCACAO[clienteId];
  const piece = fluxo?.pieces.find(p => p.key === pieceKey);
  if (!piece) { showToast('Este cliente não tem ' + (pieceKey === 'dark' ? 'Dark Post' : pieceKey) + ' configurado', true); return; }
  if (!aloc)  { showToast('Alocação não encontrada', true); return; }

  function addDias(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0];
  }

  geradorPreview = [];
  for (const tarefa of piece.tarefas) {
    const prazo = addDias(dataPost, tarefa.offset);
    const resp  = aloc[tarefa.respKey] || aloc.copy || 'cd';
    geradorPreview.push({ cliente: clienteId, tipo: tarefa.tipo, subtipo: tarefa.subtipo, responsavel: resp, prazo, postagem: dataPost, pieceKey: piece.key, status: 'pendente',
      ...(piece.descricao ? { descricaoPai: piece.descricao } : {}) });
    if (tarefa.tipo === 'copy' && !['copy-dark','copy-capa','legenda'].includes(tarefa.subtipo)) {
      geradorPreview.push({ cliente: clienteId, tipo: 'copy', subtipo: 'legenda', responsavel: 'isa', prazo, postagem: dataPost, pieceKey: piece.key, status: 'pendente' });
    }
  }
  document.getElementById('gerador-content').innerHTML = renderGeradorStep3();
}

function geradorVoltar() {
  if (geradorMode === 'semana') document.getElementById('gerador-content').innerHTML = renderGeradorStep2Semana();
  else if (geradorMode === 'demanda') renderGeradorModoDemanda();
  else document.getElementById('gerador-content').innerHTML = renderGeradorStep2();
}

function renderGeradorStep1() {
  const now = new Date();
  const mesAtual = now.toISOString().slice(0, 7);
  return `
    <div class="card mb-16" style="max-width:600px">
      <div class="section-title">Etapa 1 - Selecionar Mês</div>
      <div class="form-group">
        <label>Mês de referência (postagens)</label>
        <input type="month" id="g-mes" value="${mesAtual}" style="max-width:200px">
      </div>
      ${_clientFilter()}
      <div class="flex-center gap-8 mt-20">
        <button class="btn btn-ghost" onclick="renderGerador()">← Voltar</button>
        <button class="btn btn-primary" onclick="geradorProximo1()">Continuar →</button>
      </div>
    </div>`;
}

function geradorProximo1() {
  geradorMes = document.getElementById('g-mes').value;
  if (!geradorMes) { showToast('Selecione o mês', true); return; }
  geradorClientesSel = gcGetSelecionados();
  if (!geradorClientesSel.length) { showToast('Selecione ao menos um cliente', true); return; }
  document.getElementById('gerador-content').innerHTML = renderGeradorStep2();
}

const _GPIECE_COLOR = { feed1:'#2e5e8a', feed2:'#1a6f8a', video:'#6b48c8', dark:'#a06818', email:'#3a7a28', email_mkt:'#3a7a28' };

function _gDatePill(cid, key, d, i, checked, color) {
  const dt = new Date(d + 'T12:00:00');
  const dayAbbr = dt.toLocaleDateString('pt-BR', { weekday:'short' }).replace('.','');
  const dateStr = dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
  return `<input type="checkbox" id="g-${cid}-${key}-${i}" value="${d}" ${checked ? 'checked' : ''} style="display:none">
    <label for="g-${cid}-${key}-${i}" class="g-date-pill${checked ? ' on' : ''}" style="--c:${color}" onclick="setTimeout(()=>gSyncPill(this),0)">
      <span class="g-pill-day">${dayAbbr}.</span>
      <span class="g-pill-date">${dateStr}</span>
      <span class="g-pill-check">✓</span>
    </label>`;
}

function renderGeradorStep2() {
  const [ano, mes] = geradorMes.split('-').map(Number);
  const clients = getClients().filter(c => !isTrafegoOnly(c));

  function getDiasDoMes(diaSemana) {
    const dias = [];
    const d = new Date(ano, mes - 1, 1);
    while (d.getMonth() === mes - 1) {
      if (d.getDay() === diaSemana) dias.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    return dias;
  }

  let html = `<div class="card mb-16">
    <div class="section-title">Etapa 2 — Datas de Postagem por Cliente</div>
    <div class="text-muted text-sm mb-20">Clique nas datas para incluir ou excluir. Destacadas = serão geradas.</div>`;

  for (const c of clients.filter(c => geradorClientesSel.includes(c.id))) {
    const fluxo = FLUXO_SEMANAL[c.id];
    if (!fluxo) continue;
    const vol = VOLUME_SEMANAL[c.id] || { designs: 2, videos: 1, darks: 0 };
    const volLabel = `${vol.designs} designs + 1 vídeo${vol.darks > 0 ? ' + 1 dark' : ''}`;
    const pieces = fluxo.pieces.map(p => ({ ...p, datas: getDiasDoMes(p.postDow) }));

    html += `<div class="card mb-16" style="border-left:3px solid ${c.cor};padding:16px 20px">
      <div class="flex-between mb-16">
        <div class="flex-center gap-8">
          <span style="width:10px;height:10px;border-radius:50%;background:${c.cor};flex-shrink:0"></span>
          <span class="font-bold">${c.nome}</span>
          <span class="tag tag-gray text-xs">${volLabel}</span>
        </div>
        <div class="flex-center gap-6">
          <button class="btn btn-ghost btn-xs" onclick="gToggleCliente('${c.id}',true)">✓ Marcar tudo</button>
          <button class="btn btn-ghost btn-xs" onclick="gToggleCliente('${c.id}',false)">✗ Desmarcar tudo</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(${pieces.length},1fr);gap:0;border:1px solid var(--border);border-radius:10px;overflow:hidden">`;

    for (let pi = 0; pi < pieces.length; pi++) {
      const piece = pieces[pi];
      const color = _GPIECE_COLOR[piece.key] || c.cor;
      const borderRight = pi < pieces.length - 1 ? 'border-right:1px solid var(--border)' : '';

      html += `<div style="${borderRight}">
        <div style="padding:10px 12px;background:color-mix(in srgb,${color} 8%,var(--bg2));border-bottom:2px solid color-mix(in srgb,${color} 30%,var(--border));display:flex;align-items:center;justify-content:space-between;gap:6px">
          <div>
            <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.4px">${piece.nome}</div>
            ${piece.quinzenal ? `<span style="font-size:9px;color:${color};opacity:0.75;font-weight:600">2x/mês</span>` : ''}
          </div>
          <button onclick="gTogglePiece('${c.id}','${piece.key}',event)" title="Alternar todas"
            style="width:22px;height:22px;border-radius:6px;border:1px solid color-mix(in srgb,${color} 35%,var(--border));background:color-mix(in srgb,${color} 15%,var(--bg2));color:${color};font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ↕
          </button>
        </div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:5px">
          ${piece.datas.map((d, i) => _gDatePill(c.id, piece.key, d, i, piece.quinzenal ? i % 2 === 0 : true, color)).join('')}
        </div>
      </div>`;
    }

    html += `</div></div>`;
  }

  html += `<div class="flex-center gap-8 mt-16">
    <button class="btn btn-ghost" onclick="renderGerador()">← Voltar</button>
    <button class="btn btn-primary" onclick="geradorProximo2()">Pré-visualizar tarefas →</button>
  </div></div>`;
  return html;
}

function gSyncPill(label) {
  const cb = document.getElementById(label.getAttribute('for'));
  if (cb) label.classList.toggle('on', cb.checked);
}

function gToggleCliente(cid, state) {
  document.querySelectorAll(`input[id^="g-${cid}-"]`).forEach(cb => {
    cb.checked = state;
    const label = document.querySelector(`label[for="${cb.id}"]`);
    if (label) label.classList.toggle('on', state);
  });
}

function gTogglePiece(cid, key, e) {
  const boxes = [...document.querySelectorAll(`input[id^="g-${cid}-${key}-"]`)];
  const allChecked = boxes.every(cb => cb.checked);
  boxes.forEach(cb => {
    cb.checked = !allChecked;
    const label = document.querySelector(`label[for="${cb.id}"]`);
    if (label) label.classList.toggle('on', !allChecked);
  });
}

function geradorProximo2() {
  const clients = getClients();

  function addDias(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  }

  geradorPreview = [];

  for (const c of clients) {
    const fluxo = FLUXO_SEMANAL[c.id];
    const aloc  = ALOCACAO[c.id];
    if (!fluxo || !aloc) continue;

    for (const piece of fluxo.pieces) {
      const checkedDates = [...document.querySelectorAll(`input[id^="g-${c.id}-${piece.key}-"]:checked`)].map(el => el.value).sort();

      for (const dataPost of checkedDates) {
        for (const tarefa of piece.tarefas) {
          const prazo = addDias(dataPost, tarefa.offset);
          const resp  = aloc[tarefa.respKey] || aloc.copy || 'cd';
          geradorPreview.push({
            cliente:     c.id,
            tipo:        tarefa.tipo,
            subtipo:     tarefa.subtipo,
            responsavel: resp,
            prazo,
            postagem:    dataPost,
            pieceKey:    piece.key,
            pieceNome:   piece.nome,
            status:      'pendente',
            ...(piece.descricao ? { descricaoPai: piece.descricao } : {})
          });
          // Legenda: auto-gera apenas se o piece não tem legenda explícita e o subtipo não é especial
          const pieceTemLegenda = piece.tarefas.some(t => t.subtipo === 'legenda' || t.tipo === 'revisao');
          if (tarefa.tipo === 'copy' && !['copy-dark','copy-capa','legenda'].includes(tarefa.subtipo) && !pieceTemLegenda) {
            geradorPreview.push({
              cliente:     c.id,
              tipo:        'copy',
              subtipo:     'legenda',
              responsavel: aloc.assistCopy || aloc.copy || 'isa',
              prazo,
              postagem:    dataPost,
              pieceKey:    piece.key,
              status:      'pendente'
            });
          }
        }
      }
    }
  }

  document.getElementById('gerador-content').innerHTML = renderGeradorStep3();
}

function renderGeradorStep3() {
  const clients = getClients();
  const byCliente = {};
  for (const c of clients) byCliente[c.id] = geradorPreview.filter(t => t.cliente === c.id);

  let html = `<div class="card mb-16">
    <div class="section-title">Etapa 3 - Confirmar e Criar</div>
    <div class="text-muted text-sm mb-16">${geradorPreview.length} tarefas serão criadas para ${Object.values(byCliente).filter(ct => ct.length > 0).length} cliente${Object.values(byCliente).filter(ct => ct.length > 0).length !== 1 ? 's' : ''}.</div>`;

  for (const c of clients) {
    const ct = byCliente[c.id] || [];
    if (!ct.length) continue;
    html += `<div style="margin-bottom:16px">
      <div class="flex-center gap-8 mb-8">
        <span style="width:8px;height:8px;border-radius:50%;background:${c.cor}"></span>
        <span class="font-bold">${c.nome}</span>
        <span class="tag tag-gray">${ct.length} tarefas</span>
      </div>
      <div class="table-wrap">
        <table><thead><tr><th>Tipo</th><th>Subtipo</th><th>Responsável</th><th>Prazo Entrega</th><th>Postagem</th></tr></thead>
        <tbody>${ct.map(t => `<tr>
          <td>${tipoTag(t.tipo)}</td>
          <td class="text-faint text-xs">${geradorSubtipoLabel(t.tipo, t.subtipo)}</td>
          <td class="text-muted">${memberName(t.responsavel)}</td>
          <td class="text-muted">${fmtDate(t.prazo)}</td>
          <td class="text-muted">${fmtDate(t.postagem)}</td>
        </tr>`).join('')}</tbody></table>
      </div>
    </div>`;
  }

  html += `<div class="flex-center gap-8 mt-20">
    <button class="btn btn-ghost" onclick="geradorVoltar()">← Voltar</button>
    <button class="btn btn-primary" onclick="geradorConfirmar()">✓ Criar ${geradorPreview.length} Tarefas</button>
  </div></div>`;
  return html;
}

// ── DUPLICATE DETECTION & REVIEW ─────────────────────────────────────────────
let _revDupes    = [];
let _revIdx      = 0;
let _revSkip     = new Set();   // índices do preview para NÃO criar
let _revToDelete = new Set();   // IDs de tarefas existentes para deletar (substituição)

function detectarDuplicatas(preview) {
  const tasks = getTasks();
  const dupes = [];
  preview.forEach((p, idx) => {
    // Gatilho 1: mesmo cliente + data postagem + tipo + subtipo
    const dupData = tasks.find(t =>
      t.cliente  === p.cliente  &&
      t.postagem === p.postagem &&
      t.tipo     === p.tipo     &&
      (t.subtipo||'geral') === (p.subtipo||'geral') &&
      t.status !== 'concluido' && t.status !== 'travado'
    );
    if (dupData) { dupes.push({ idx, nova: p, existente: dupData, motivo: 'data' }); return; }

    // Gatilho 2: mesmo nome de tarefa + mesmo subtipo (mesmo cliente)
    const nomeNova = (p.nome||'').trim().toLowerCase();
    if (nomeNova) {
      const dupNome = tasks.find(t =>
        t.status !== 'concluido' &&
        t.cliente === p.cliente  &&
        (t.subtipo||'geral') === (p.subtipo||'geral') &&
        (t.nome||'').trim().toLowerCase() === nomeNova
      );
      if (dupNome) dupes.push({ idx, nova: p, existente: dupNome, motivo: 'nome' });
    }
  });
  return dupes;
}

async function geradorConfirmar() {
  const dupes = detectarDuplicatas(geradorPreview);
  if (dupes.length > 0) {
    _revDupes    = dupes;
    _revIdx      = 0;
    _revSkip     = new Set();
    _revToDelete = new Set();
    _geradorMostrarConflito(dupes);
  } else {
    await _geradorCriarFinal(geradorPreview);
  }
}

function _geradorMostrarConflito(dupes) {
  const clients = getClients();
  const rows = dupes.slice(0, 6).map(d => {
    const c = clients.find(x => x.id === d.nova.cliente);
    const motivoTag = d.motivo === 'nome'
      ? `<span class="tag" style="background:var(--accent)22;color:var(--accent);font-size:10px">mesmo nome</span>`
      : `<span class="tag" style="background:var(--yellow)22;color:var(--yellow);font-size:10px">mesma data</span>`;
    const desc = d.motivo === 'nome'
      ? `${c?.nome||d.nova.cliente} - "${d.nova.nome}" (${d.nova.subtipo||''})`
      : `${c?.nome||d.nova.cliente} - ${tipoLabel(d.nova.tipo)} (${d.nova.subtipo||''}) → postagem ${fmtDate(d.nova.postagem)}`;
    return `<div class="alert-row warn text-xs mb-4" style="padding:6px 10px;gap:8px;align-items:center">
      <span style="width:6px;height:6px;border-radius:50%;background:${c?.cor||'#999'};flex-shrink:0"></span>
      ${motivoTag}
      <span>${desc}</span>
    </div>`;
  }).join('');
  const mais = dupes.length > 6 ? `<div class="text-xs text-faint" style="padding:2px 10px">+${dupes.length-6} mais...</div>` : '';

  document.getElementById('gerador-content').innerHTML = `
    <div style="max-width:640px">
      <div class="card" style="border-left:3px solid var(--yellow)">
        <div class="flex-center gap-10 mb-14">
          <span style="font-size:24px">⚠️</span>
          <div>
            <div class="font-bold" style="font-size:15px">${dupes.length} demanda${dupes.length!==1?'s':''} já existe${dupes.length===1?'':'m'} no sistema</div>
            <div class="text-xs text-muted">Itens com status ativo — possível duplicação</div>
          </div>
        </div>
        <div class="mb-14">${rows}${mais}</div>
        <div class="divider mb-14"></div>
        <div class="flex-center gap-10 flex-wrap">
          <button class="btn btn-ghost" onclick="renderGerador()">✗ Não criar</button>
          <button class="btn btn-primary" onclick="_geradorCriarFinal(geradorPreview)">✓ Criar todas assim mesmo</button>
          <button class="btn" style="background:var(--red);color:#fff;border:none" onclick="_geradorSubstituirTodas()">↩ Substituir todas</button>
          <button class="btn" style="background:var(--accent);color:#fff;border:none" onclick="_geradorIniciarRevisao()">🔍 Revisar uma por uma</button>
        </div>
      </div>
    </div>`;
}

function _geradorIniciarRevisao() {
  _revIdx  = 0;
  _revSkip = new Set();
  _geradorMostrarRevItem();
}

function _geradorMostrarRevItem() {
  if (_revIdx >= _revDupes.length) {
    // All reviewed — show summary
    const toCreate    = geradorPreview.filter((_, i) => !_revSkip.has(i));
    const puladas     = _revSkip.size;
    const substitutas = _revToDelete.size;
    document.getElementById('gerador-content').innerHTML = `
      <div style="max-width:520px">
        <div class="card">
          <div class="font-bold mb-10" style="font-size:15px">Revisão concluída</div>
          <div class="mb-16" style="display:grid;gap:6px">
            <div class="text-sm text-muted">
              <b style="color:var(--green)">${toCreate.length}</b> tarefa${toCreate.length!==1?'s':''} serão criadas
            </div>
            ${substitutas ? `<div class="text-sm text-muted">
              <b style="color:var(--red)">${substitutas}</b> tarefa${substitutas!==1?'s':''} existente${substitutas!==1?'s':''} serão <b style="color:var(--red)">deletadas</b> (substituição)
            </div>` : ''}
            ${puladas ? `<div class="text-sm text-muted">
              <b style="color:var(--text-faint)">${puladas}</b> duplicata${puladas!==1?'s':''} pulada${puladas!==1?'s':''}
            </div>` : ''}
          </div>
          <div class="flex-center gap-8">
            <button class="btn btn-ghost" onclick="renderGerador()">Cancelar</button>
            <button class="btn btn-primary" onclick="_geradorCriarFinalRevisado()">
              ✓ Confirmar
            </button>
          </div>
        </div>
      </div>`;
    return;
  }

  const d       = _revDupes[_revIdx];
  const total   = _revDupes.length;
  const clients = getClients();
  const c       = clients.find(x => x.id === d.nova.cliente);
  const barra   = Array.from({length: total}, (_, i) =>
    `<div style="width:20px;height:4px;border-radius:2px;background:${i < _revIdx ? 'var(--green)' : i === _revIdx ? 'var(--accent)' : 'var(--border)'}"></div>`
  ).join('');

  const row = (lbl, val) => val ? `<div class="flex-center gap-8 mb-4">
    <span class="text-xs text-faint" style="width:80px;flex-shrink:0">${lbl}</span>
    <span class="text-xs">${val}</span></div>` : '';

  document.getElementById('gerador-content').innerHTML = `
    <div style="max-width:660px">
      <div class="flex-between mb-12">
        <span class="text-xs text-faint">Conflito <b style="color:var(--text)">${_revIdx+1}</b> de <b style="color:var(--text)">${total}</b></span>
        <div class="flex-center gap-3">${barra}</div>
      </div>
      <div class="grid grid-2 gap-12 mb-14">
        <div class="card" style="border-left:3px solid var(--border)">
          <div class="text-xs font-bold text-faint mb-10">Já EXISTE</div>
          ${row('Cliente', c?.nome||d.existente.cliente)}
          ${row('Tipo', tipoLabel(d.existente.tipo))}
          ${row('Subtipo', d.existente.subtipo||'-')}
          ${row('Responsável', memberName(d.existente.responsavel))}
          ${row('Prazo', fmtDate(d.existente.prazo))}
          ${row('Postagem', fmtDate(d.existente.postagem))}
          ${row('Status', statusLabel(d.existente.status))}
        </div>
        <div class="card" style="border-left:3px solid var(--accent)">
          <div class="text-xs font-bold mb-10" style="color:var(--accent)">NOVA</div>
          ${row('Cliente', c?.nome||d.nova.cliente)}
          ${row('Tipo', tipoLabel(d.nova.tipo))}
          ${row('Subtipo', d.nova.subtipo||'-')}
          ${row('Responsável', memberName(d.nova.responsavel))}
          ${row('Prazo', fmtDate(d.nova.prazo))}
          ${row('Postagem', fmtDate(d.nova.postagem))}
        </div>
      </div>
      <div class="flex-center gap-10">
        <button class="btn btn-ghost" style="flex:1" onclick="_revPular()">✗ Pular</button>
        <button class="btn btn-primary" style="flex:1" onclick="_revCriar()">✓ Criar assim mesmo</button>
        <button class="btn" style="flex:1;background:var(--red);color:#fff;border:none" onclick="_revSubstituir()" title="Deleta a tarefa existente e cria a nova no lugar">↩ Substituir</button>
      </div>
    </div>`;
}

function _revPular()      { _revSkip.add(_revDupes[_revIdx].idx); _revIdx++; _geradorMostrarRevItem(); }
function _revCriar()      { _revIdx++; _geradorMostrarRevItem(); }
function _revSubstituir() {
  const d = _revDupes[_revIdx];
  _revToDelete.add(d.existente.id); // marca a existente para deletar
  // NÃO adiciona ao _revSkip → a nova SERÁ criada
  _revIdx++;
  _geradorMostrarRevItem();
}

async function _geradorSubstituirTodas() {
  // Marca todas as existentes para deleção e cria todas as novas
  _revDupes.forEach(d => _revToDelete.add(d.existente.id));
  await _geradorCriarFinalRevisado();
}

async function _geradorCriarFinalRevisado() {
  // Deleta tarefas marcadas para substituição
  if (_revToDelete.size > 0) {
    saveTasks(getTasks().filter(t => !_revToDelete.has(t.id)));
  }
  await _geradorCriarFinal(geradorPreview.filter((_, i) => !_revSkip.has(i)));
}

async function _geradorCriarFinal(preview) {
  if (!preview.length) {
    showToast('Nenhuma tarefa para criar', true);
    renderGerador();
    return;
  }

  const novas = preview.map(t => ({
    ...t,
    id: uid(),
    obs: '',
    revisoes: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  saveTasks([...getTasks(), ...novas]);

  // Log
  salvarLogCriacao({
    id:        uid(),
    timestamp: new Date().toISOString(),
    mode:      geradorMode,
    clientes:  [...new Set(preview.map(t => t.cliente))],
    total:     novas.length,
    taskIds:   novas.map(t => t.id),
    tasks:     preview.map(t => ({ cliente: t.cliente, tipo: t.tipo, subtipo: t.subtipo, postagem: t.postagem, prazo: t.prazo, responsavel: t.responsavel, nome: t.nome||'' }))
  });

  let ok = 0, errs = 0;
  try {
    showToast('Criando no ClickUp...');
    ({ ok, errs } = await cuCriarDemandas(preview));
    if (errs === 0)
      showToast(`${novas.length} tarefas salvas → ${ok} demandas criadas no ClickUp ✓`);
    else if (ok > 0)
      showToast(`Salvo localmente → ClickUp: ${ok} ok, ${errs} com erro`, false);
    else
      showToast(`Salvo localmente → Falha no ClickUp (${errs} erro${errs>1?'s':''})`, true);
  } catch(e) {
    console.error('cuCriarDemandas falhou:', e);
    showToast(`${novas.length} tarefas salvas localmente`, false);
  } finally {
    renderGerador();
  }
}

// =====================================================
// TOAST
// =====================================================
function showToast(msg, isError=false) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;z-index:500;transition:opacity .3s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.background = isError ? '#7f1d1d' : '#14532d';
  t.style.color = isError ? '#fca5a5' : '#86efac';
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity='0'; }, 2500);
}

// =====================================================
// HEALTH SCORE
// =====================================================
let _healthTab          = 'clientes';
let _healthWeekRef      = null;
let _healthMonthRef     = null;  // YYYY-MM for mensal view
let _healthPeriod       = '4w';
let _healthFormClient   = null;
let _healthFormDelivery = null;
let _healthFormRejection = 'none';
let _healthFormRevisions = [];
let _healthFormManualRevisions = [];
let _healthFormCustomErrorTypes = [];
let _healthFormNextActions = [];
let _healthFormPrevActions = [];       // ações anotadas na semana anterior
let _healthFormPrevChecked = [];       // quais foram concluídas (booleans)
let _healthFormTrafego     = null;     // null=sem tráfego | { metaPct, investimento, leads, vendas, cpl, cac, meta }
let _healthFormCX          = null;     // null=sem CX | { rating: 1-5 }
let _healthFormPostsList = { conclusao: [], status: [], implicita: [] };
let _hsPostsHideTimer    = null;

function _buildPostsPopup(autoCount) {
  const all  = [
    ..._healthFormPostsList.conclusao.map(t => ({ ...t, fonte: 'conclusao' })),
    ..._healthFormPostsList.status.map(t =>    ({ ...t, fonte: 'status' })),
    ..._healthFormPostsList.implicita.map(t =>  ({ ...t, fonte: 'implicita' }))
  ];
  const fonteLabel = { conclusao: '✓ date_closed', status: '✓ status concluído', implicita: '📅 data passada' };
  const fonteColor = { conclusao: '#22c55e', status: '#3b82f6', implicita: '#a78bfa' };

  let rows = '';
  if (all.length === 0) {
    rows = `<div style="color:var(--text3);font-size:12px;padding:4px 0">Nenhuma postagem detectada automaticamente</div>`;
  } else {
    rows = all.map(t => {
      const label = t.nome || tipoLabel(t.tipo) || t.tipo || '—';
      const date  = fmtDate(t.postagem || t.dataConclusao || '');
      const cuLink = t.clickupId
        ? `<a href="https://app.clickup.com/t/${t.clickupId}" target="_blank"
             style="color:var(--accent);font-size:10px;text-decoration:none;white-space:nowrap">↗ ClickUp</a>`
        : '';
      return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="width:6px;height:6px;border-radius:50%;background:${fonteColor[t.fonte]};flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
          <div style="font-size:10px;color:var(--text3)">${fonteLabel[t.fonte]} · ${date}</div>
        </div>
        ${cuLink}
      </div>`;
    }).join('');
  }

  const manualSection = `
    <div id="hs-posts-manual-section" style="display:none;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <div style="font-size:10px;font-weight:600;color:var(--yellow);margin-bottom:4px">📝 Posts adicionados manualmente</div>
      <textarea id="hs-posts-manual-obs" rows="2" placeholder="Registre os links ou descreva os posts que não foram detectados automaticamente..."
        style="width:100%;font-size:11px;padding:5px 7px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);resize:vertical;box-sizing:border-box"
        onclick="event.stopPropagation()" onmouseenter="clearTimeout(_hsPostsHideTimer)" onmouseleave="_hsPostsScheduleHide()"></textarea>
    </div>`;

  return `<div id="hs-posts-popup"
    onmouseenter="clearTimeout(_hsPostsHideTimer)" onmouseleave="_hsPostsScheduleHide()"
    style="display:none;position:absolute;left:0;top:calc(100% + 6px);z-index:200;
           min-width:280px;max-width:340px;padding:12px;
           background:var(--bg2);border:1px solid var(--border);border-radius:10px;
           box-shadow:0 8px 24px rgba(0,0,0,.15);
           opacity:0;transition:opacity .2s ease;pointer-events:none">
    <div style="font-size:11px;font-weight:700;color:var(--text2);margin-bottom:8px;letter-spacing:.4px">POSTAGENS DETECTADAS</div>
    ${rows}
    ${manualSection}
  </div>`;
}

function _hsAddManualRev() {
  const input = document.getElementById('hs-rev-input');
  const desc  = input?.value.trim();
  if (!desc) return;
  _healthFormManualRevisions.push({ subtaskName: desc, area: 'Manual', assigneeId: '', revisionCount: 1 });
  input.value = '';
  _hsRenderRevList();
  _atualizarScorePreview();
}

function _hsRemoveManualRev(idx) {
  _healthFormManualRevisions.splice(idx, 1);
  _hsRenderRevList();
  _atualizarScorePreview();
}

function _hsRenderRevList() {
  const el = document.getElementById('hs-rev-list');
  if (!el) return;
  const auto   = _healthFormRevisions   || [];
  const manual = _healthFormManualRevisions || [];
  const AREA_COLOR = { video: '#8b5cf6', design: '#3b82f6', copy: '#f59e0b', general: '#6b7280' };
  let html = '';
  if (auto.length === 0 && manual.length === 0) {
    html = `<div style="color:var(--text3);font-size:12px;padding:4px 0">Nenhuma revisão registrada</div>`;
  } else {
    html += auto.map(r => {
      const ac = AREA_COLOR[r.area] || '#6b7280';
      const member = getTeam().find(m => m.id === r.assigneeId);
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg3);border-radius:7px;font-size:12px;margin-bottom:4px">
        <span style="width:6px;height:6px;border-radius:50%;background:${ac};flex-shrink:0"></span>
        <span style="flex:1">${r.subtaskName}</span>
        <span style="background:${ac}22;color:${ac};padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600">${r.area}</span>
        <span style="color:var(--text3);font-size:11px">${member?.nome || r.assigneeId || '—'}</span>
        <span style="color:var(--text3);font-size:11px">${r.revisionCount}×</span>
      </div>`;
    }).join('');
    html += manual.map((r, i) =>
      `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg3);border-radius:7px;font-size:12px;margin-bottom:4px">
        <span style="width:6px;height:6px;border-radius:50%;background:#94a3b8;flex-shrink:0"></span>
        <span style="flex:1">${r.subtaskName}</span>
        <span style="color:var(--text3);font-size:10px;padding:1px 7px;border-radius:4px;background:var(--bg2)">Manual</span>
        <button onclick="_hsRemoveManualRev(${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:0 2px;line-height:1">✕</button>
      </div>`
    ).join('');
  }
  el.innerHTML = html;
  const count   = auto.length + manual.length;
  const counter = document.getElementById('hs-rev-count');
  if (counter) {
    counter.textContent = count;
    counter.style.color = count === 0 ? '#22c55e' : '#eab308';
  }
}

function _buildCustomErrorList() {
  if (!_healthFormCustomErrorTypes.length)
    return `<div style="color:var(--text3);font-size:12px;padding:2px 0">Nenhum tipo personalizado adicionado</div>`;
  return _healthFormCustomErrorTypes.map((ct, i) =>
    `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg3);border-radius:7px;font-size:12px;margin-bottom:4px">
      <input type="checkbox" class="hs-custom-error-type" data-idx="${i}" data-pts="${ct.pts}"
        onchange="_atualizarScorePreview()" checked style="width:auto;flex-shrink:0;margin:0">
      <span style="flex:1">${ct.label}</span>
      <span style="background:var(--bg2);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap">+${ct.pts}pt</span>
      <button onclick="_hsRemoveCustomErrorType(${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:0 2px;line-height:1">✕</button>
    </div>`
  ).join('');
}

function _hsAddCustomErrorType() {
  const label = document.getElementById('hs-custom-label')?.value.trim();
  const pts   = parseInt(document.getElementById('hs-custom-pts')?.value) || 1;
  if (!label) return;
  _healthFormCustomErrorTypes.push({ label, pts });
  document.getElementById('hs-custom-label').value = '';
  document.getElementById('hs-custom-pts').value   = '1';
  const el = document.getElementById('hs-custom-error-list');
  if (el) el.innerHTML = _buildCustomErrorList();
  _atualizarScorePreview();
}

function _hsRemoveCustomErrorType(idx) {
  _healthFormCustomErrorTypes.splice(idx, 1);
  const el = document.getElementById('hs-custom-error-list');
  if (el) el.innerHTML = _buildCustomErrorList();
  _atualizarScorePreview();
}

// ── Tráfego helpers ──────────────────────────────────
function _hsTrafegoToggle(hasTraffic) {
  const form = document.getElementById('hs-traf-form');
  if (!form) return;
  if (hasTraffic) {
    const cid    = _healthFormClient;
    const sheetD = cid ? (gsGetData('semanal')[cid] || null) : null;
    if (!_healthFormTrafego) {
      _healthFormTrafego = {
        metaPct:      sheetD?.metaPct      ?? '',
        investimento: sheetD?.investimento ?? '',
        leads:        sheetD?.leads        ?? '',
        vendas:       sheetD?.vendas       ?? '',
        cpl:          sheetD?.cpl          ?? '',
        cac:          sheetD?.cac          ?? '',
        meta:         sheetD?.meta         ?? ''
      };
    }
    form.style.display = 'block';
    // Sync metaPct into the input DOM (may have been pre-filled from sheet)
    const pctEl = document.getElementById('hs-traf-metapct');
    if (pctEl && _healthFormTrafego.metaPct !== '') {
      pctEl.value = _healthFormTrafego.metaPct;
    }
    _hsTrafegoUpdateFromPct();   // refresh badge colour immediately
    // Auto-sync from sheet if no cached data exists for this client
    if (!sheetD) {
      _hsSyncAndPopulateTrafego();
    }
  } else {
    _healthFormTrafego = null;
    form.style.display = 'none';
  }
  _atualizarScorePreview();
}

function _hsTrafegoUpdateFromPct() {
  if (!_healthFormTrafego) return;
  const el  = document.getElementById('hs-traf-metapct');
  if (!el) return;
  _healthFormTrafego.metaPct = el.value;
  const result = calculateTrafegoScore(_healthFormTrafego.metaPct);
  const colors = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' };
  const dotEl  = document.getElementById('hs-traf-score-dot');
  const valEl  = document.getElementById('hs-traf-score-val');
  if (dotEl) dotEl.style.background = colors[result.status];
  if (valEl) { valEl.textContent = result.score + '/5'; valEl.style.color = colors[result.status]; }
  el.style.color = colors[result.status];
  _atualizarScorePreview();
}

function _hsTrafegoSyncData() {
  if (!_healthFormTrafego) return;
  ['investimento','leads','vendas','cpl','cac','meta'].forEach(f => {
    const el = document.getElementById('hs-traf-' + f);
    if (el) _healthFormTrafego[f] = el.value;
  });
}

async function _hsSyncAndPopulateTrafego() {
  const cid = _healthFormClient;
  if (!cid) return;

  const syncBtn = document.getElementById('hs-traf-sync-btn');
  if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = 'Buscando...'; }

  try {
    const cfg = gsGetConfig();
    const sheetName = cfg.sheetSemanal || 'Semanal';
    const url = `https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const rows = _gsParseCsv(text);

    const clientMap = cfg.clientMap || GS_TRAFEGO_DEFAULT_MAP;
    const existing  = gsGetData('semanal') || {};

    for (const row of rows) {
      const clienteName = (row['Cliente'] || '').trim();
      if (!clienteName) continue;
      const clientId = clientMap[clienteName];
      if (!clientId) continue;
      const pct = _gsParsePct(row['% Meta'] || row['%Meta'] || row['% meta'] || '');
      const perf  = parseInt(row['Performance (0-5)'] || '0') || 0;
      const relac = parseInt(row['Relacionamento (0-5)'] || '0') || 0;
      const trafScore = pct !== null ? calculateTrafegoScore(pct) : { score: 0, status: 'red', metaPct: 0 };
      existing[clientId] = {
        clienteName,
        metaPct:        pct ?? 0,
        score:          trafScore.score,
        status:         trafScore.status,
        investimento:   row['Investimento'] || '',
        leads:          row['Leads'] || '',
        vendas:         row['Vendas'] || '',
        cpl:            row['CPL'] || '',
        cac:            row['CAC'] || '',
        meta:           row['Meta (Semanal)'] || row['Meta'] || '',
        performance:    perf,
        relacionamento: relac,
        sheetScore:     perf + relac,
        data:           row['Data'] || '',
        lastSync:       new Date().toISOString()
      };
    }
    gsSaveData(existing, 'semanal');

    const sheetD = existing[cid] || null;
    if (sheetD) {
      if (!_healthFormTrafego) _healthFormTrafego = {};
      _healthFormTrafego.metaPct      = sheetD.metaPct ?? '';
      _healthFormTrafego.investimento = sheetD.investimento || '';
      _healthFormTrafego.leads        = sheetD.leads        || '';
      _healthFormTrafego.vendas       = sheetD.vendas       || '';
      _healthFormTrafego.cpl          = sheetD.cpl          || '';
      _healthFormTrafego.cac          = sheetD.cac          || '';
      _healthFormTrafego.meta         = sheetD.meta         || '';

      const pctEl = document.getElementById('hs-traf-metapct');
      if (pctEl) pctEl.value = sheetD.metaPct ?? '';
      ['investimento','leads','vendas','cpl','cac','meta'].forEach(f => {
        const el = document.getElementById('hs-traf-' + f);
        if (el) el.value = sheetD[f] || '';
      });
      _hsTrafegoUpdateFromPct();

      // Update the sync date label
      const lblEl = document.getElementById('hs-traf-sync-label');
      if (lblEl) lblEl.textContent = '📊 Planilha · ' + new Date(sheetD.lastSync).toLocaleDateString('pt-BR');

      showToast('Dados de tráfego atualizados da planilha!');
    } else {
      showToast('Nenhum dado de tráfego encontrado para este cliente na planilha.', true);
    }
  } catch(e) {
    showToast('Erro ao buscar planilha: ' + e.message, true);
  } finally {
    if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = '↻ Planilha'; }
  }
}

function _hsCXToggle(hasCX) {
  const form = document.getElementById('hs-cx-form');
  if (!form) return;
  if (hasCX) {
    if (!_healthFormCX) _healthFormCX = { rating: 0 };
    form.style.display = 'block';
    _hsCXUpdate();
  } else {
    _healthFormCX = null;
    form.style.display = 'none';
  }
  _atualizarScorePreview();
}

function _hsCXUpdate() {
  if (!_healthFormCX) return;
  const rating = _healthFormCX.rating;
  const SC = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' };
  // Update pill buttons
  [1,2,3,4,5].forEach(n => {
    const btn = document.getElementById('hs-cx-pill-' + n);
    if (!btn) return;
    btn.style.background  = n <= rating ? 'var(--accent)' : 'var(--bg3)';
    btn.style.color       = n <= rating ? '#fff'           : 'var(--text3)';
    btn.style.borderColor = n <= rating ? 'var(--accent)'  : 'var(--border)';
  });
  const valEl = document.getElementById('hs-cx-score-val');
  const dotEl = document.getElementById('hs-cx-score-dot');
  if (!rating) {
    if (valEl) { valEl.textContent = '—'; valEl.style.color = 'var(--text3)'; }
    if (dotEl) dotEl.style.background = 'var(--border)';
  } else {
    const res = calculateCXScore(rating);
    if (valEl) { valEl.textContent = res.score + '/5'; valEl.style.color = SC[res.status]; }
    if (dotEl) dotEl.style.background = SC[res.status];
  }
  _atualizarScorePreview();
}

function _hsCXSetRating(n) {
  if (!_healthFormCX) _healthFormCX = { rating: 0 };
  _healthFormCX.rating = n;
  _hsCXUpdate();
}

function hsPrevToggle(idx, checked) {
  _healthFormPrevChecked[idx] = checked;
  // update visual
  const label = document.querySelector(`[data-prev-idx="${idx}"]`)?.closest('label');
  if (label) {
    label.style.background = checked ? 'var(--bg3)' : 'var(--bg2)';
    const span = label.querySelector('span');
    if (span) { span.style.textDecoration = checked ? 'line-through' : ''; span.style.color = checked ? 'var(--text3)' : 'var(--text)'; }
  }
}

function _buildNextActionsList() {
  if (!_healthFormNextActions.length)
    return `<div style="color:var(--text3);font-size:12px;padding:2px 0">Nenhuma ação adicionada</div>`;
  return _healthFormNextActions.map((a, i) =>
    `<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--accent);font-size:14px;line-height:1.4;flex-shrink:0">•</span>
      <span style="flex:1;font-size:13px;color:var(--text1);line-height:1.4">${a}</span>
      <button onclick="_hsRemoveNextAction(${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:0 2px;line-height:1;flex-shrink:0">✕</button>
    </div>`
  ).join('');
}

function _hsAddNextAction() {
  const input = document.getElementById('hs-next-input');
  const text  = input?.value.trim();
  if (!text) return;
  _healthFormNextActions.push(text);
  input.value = '';
  const el = document.getElementById('hs-next-list');
  if (el) el.innerHTML = _buildNextActionsList();
}

function _hsRemoveNextAction(idx) {
  _healthFormNextActions.splice(idx, 1);
  const el = document.getElementById('hs-next-list');
  if (el) el.innerHTML = _buildNextActionsList();
}

function _hsPostsShow() {
  clearTimeout(_hsPostsHideTimer);
  const pop = document.getElementById('hs-posts-popup');
  if (!pop) return;
  pop.style.display = 'block';
  pop.style.pointerEvents = 'auto';
  // Check if manual input > auto
  const autoCount = _healthFormDelivery?.postsCompleted ?? 0;
  const manualVal = parseInt(document.getElementById('hs-posts-completed')?.value ?? autoCount);
  const manualSection = document.getElementById('hs-posts-manual-section');
  if (manualSection) manualSection.style.display = manualVal > autoCount ? 'block' : 'none';
  requestAnimationFrame(() => { pop.style.opacity = '1'; });
}

function _hsPostsScheduleHide() {
  _hsPostsHideTimer = setTimeout(() => {
    const pop = document.getElementById('hs-posts-popup');
    if (!pop) return;
    pop.style.opacity = '0';
    setTimeout(() => { pop.style.display = 'none'; pop.style.pointerEvents = 'none'; }, 200);
  }, 300);
}

function renderHealth() {
  if (!_healthWeekRef) _healthWeekRef = getISOWeekRef(new Date());
  if (!_healthMonthRef) _healthMonthRef = new Date().toISOString().slice(0, 7);
  const el = document.getElementById('health-content');
  if (!el) return;
  el.innerHTML = _healthFormClient ? _renderFechamento(_healthFormClient) : _renderHealthMain();
}

function _renderHealthMain() {
  const { start, end } = isoWeekToDateRange(_healthWeekRef);
  const startStr = fmtDate(start.toISOString().slice(0, 10));
  const endStr   = fmtDate(end.toISOString().slice(0, 10));

  let html = `
    <div class="flex-between mb-20">
      <div>
        <div class="section-title mb-4">Health Score</div>
        <div class="text-muted text-sm">${startStr} → ${endStr}</div>
      </div>
      <input type="week" id="hs-week-input" value="${_healthWeekRef}"
        onchange="_hsWeekChange(this.value)"
        style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:13px;width:180px">
    </div>
    <div class="filters mb-20">
      <button class="filter-btn${_healthTab === 'clientes' ? ' active' : ''}" onclick="setHealthTab('clientes')">Fechamento Semanal</button>
      <button class="filter-btn${_healthTab === 'mensal'   ? ' active' : ''}" onclick="setHealthTab('mensal')">Fechamento Mensal</button>
      <button class="filter-btn${_healthTab === 'equipe'   ? ' active' : ''}" onclick="setHealthTab('equipe')">Score de Equipe</button>
    </div>`;

  html += _healthTab === 'clientes' ? _renderHealthClientes()
        : _healthTab === 'mensal'   ? _renderHealthMensal()
        : _renderHealthEquipe();
  return html;
}

function setHealthTab(tab) { _healthTab = tab; renderHealth(); }
function _hsWeekChange(val) { if (val) { _healthWeekRef = val; renderHealth(); } }
function _hsMonthChange(val) { if (val) { _healthMonthRef = val; renderHealth(); } }
function _hsSetPeriod(p)    { _healthPeriod = p; renderHealth(); }

// Navega para Health Score e abre o formulário de fechamento de um cliente específico
// Sempre usa a semana atual (ignora semana histórica que possa estar selecionada)
function _irParaFechamento(cid) {
  _healthWeekRef = getISOWeekRef(new Date());  // sempre semana atual
  setPage('health');
  abrirFechamento(cid);
}

// ── Aba 1: Score de Clientes ─────────────────────────────────────────────────

function _renderHealthClientes() {
  const clients      = getClients();
  const weeklyScores = getWeeklyScores();
  const weekRef      = _healthWeekRef;

  const SC = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' };
  const SL = { green: 'Verde',        yellow: 'Amarelo',       red: 'Vermelho'   };

  function _scoreDot(status, size = 8) {
    const c = SC[status] || 'var(--text3)';
    return `<span style="width:${size}px;height:${size}px;border-radius:50%;background:${c};flex-shrink:0;display:inline-block"></span>`;
  }

  let html = `<div class="card">
    <div class="section-title mb-16">Fechamento Semanal — ${weekRef}</div>
    <div class="table-wrap"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid var(--border)">
        <th style="text-align:left;padding:8px 12px;font-size:12px;color:var(--text3)">Cliente</th>
        <th style="text-align:center;padding:8px 12px;font-size:12px;color:var(--text3)">Direção Criativa</th>
        <th style="text-align:center;padding:8px 12px;font-size:12px;color:var(--text3)">Tráfego</th>
        <th style="text-align:center;padding:8px 12px;font-size:12px;color:var(--text3)">CX</th>
        <th style="text-align:center;padding:8px 12px;font-size:12px;color:var(--text3)">Score Geral</th>
        <th style="text-align:center;padding:8px 12px;font-size:12px;color:var(--text3)">Status</th>
        <th style="text-align:right;padding:8px 12px;font-size:12px;color:var(--text3)">Ação</th>
      </tr></thead>
      <tbody>`;

  for (const c of clients) {
    const rec     = weeklyScores.find(s => s.clientId === c.id && s.weekRef === weekRef);
    const isTraf  = isTrafegoOnly(c);
    const nomeTag = isTraf ? `${c.nome} <span style="font-size:9px;background:var(--bg3);color:var(--text3);padding:1px 5px;border-radius:3px;margin-left:4px">Tráfego</span>` : c.nome;
    if (rec) {
      const isDraft = !!rec.draft;
      // DC (N/A para clientes tráfego-only)
      const dcScore   = isDraft || isTraf ? null : rec.totalScore;
      const dcMax     = isDraft || isTraf ? null : rec.maxScore;
      const dcStatus  = isDraft || isTraf ? null : rec.finalStatus;
      const dcOv      = !isTraf && rec.overrideActive ? ' <span style="font-size:9px;background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:3px">!</span>' : '';
      // Tráfego
      const traf      = rec.trafego;
      // CX
      const cx        = rec.cx;
      // Geral
      const geral     = isDraft ? null : (rec.consolidatedScore || calculateConsolidatedScore(isTraf ? null : rec, traf, cx));
      // Status final
      const statusSrc = geral || (dcStatus ? { status: dcStatus } : null);
      const sc        = isDraft ? 'var(--yellow)' : (SC[statusSrc?.status] || 'var(--text3)');
      const sl        = isDraft ? 'Rascunho'      : (SL[statusSrc?.status] || '—');

      html += `<tr style="border-bottom:1px solid var(--border);${isDraft ? 'opacity:0.75' : ''}">
        <td style="padding:10px 12px"><div style="display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:${c.cor};flex-shrink:0"></span>
          <span style="font-weight:600;font-size:13px">${nomeTag}</span>
        </div></td>
        <td style="text-align:center;padding:10px 12px">
          ${isTraf ? '<span style="color:var(--text3);font-size:10px">N/A</span>' :
            isDraft ? '<span style="color:var(--text3)">—</span>' :
            `<div style="display:inline-flex;align-items:center;gap:5px">
              ${_scoreDot(dcStatus)}
              <span style="font-size:14px;font-weight:700">${dcScore}</span>
              <span style="font-size:11px;color:var(--text3)">/${dcMax}</span>${dcOv}
            </div>`}
        </td>
        <td style="text-align:center;padding:10px 12px">
          ${!traf ? '<span style="color:var(--text3)">—</span>' :
            isDraft ? '<span style="color:var(--text3)">—</span>' :
            `<div style="display:inline-flex;align-items:center;gap:5px">
              ${_scoreDot(traf.status)}
              <span style="font-size:14px;font-weight:700">${traf.score}</span>
              <span style="font-size:11px;color:var(--text3)">/5</span>
            </div>`}
        </td>
        <td style="text-align:center;padding:10px 12px">
          ${!cx ? '<span style="color:var(--text3)">—</span>' :
            isDraft ? '<span style="color:var(--text3)">—</span>' :
            `<div style="display:inline-flex;align-items:center;gap:5px">
              ${_scoreDot(cx.status)}
              <span style="font-size:14px;font-weight:700">${cx.score}</span>
              <span style="font-size:11px;color:var(--text3)">/5</span>
            </div>`}
        </td>
        <td style="text-align:center;padding:10px 12px">
          ${isDraft || !geral ? '<span style="color:var(--text3)">—</span>' :
            `<div style="display:inline-flex;align-items:center;gap:5px">
              ${_scoreDot(geral.status)}
              <span style="font-size:15px;font-weight:800">${geral.score}</span>
            </div>`}
        </td>
        <td style="text-align:center;padding:10px 12px">
          <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:${sc}">
            <span style="width:9px;height:9px;border-radius:50%;background:${sc}"></span>${sl}
          </span>
        </td>
        <td style="text-align:right;padding:10px 12px">
          <button class="btn ${isDraft ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="abrirFechamento('${c.id}')">${isDraft ? 'Completar' : 'Editar'}</button>
        </td>
      </tr>`;
    } else {
      html += `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:10px 12px"><div style="display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:${c.cor};flex-shrink:0"></span>
          <span style="font-weight:600;font-size:13px">${nomeTag}</span>
        </div></td>
        <td colspan="5" style="padding:10px 12px;color:var(--text3);font-size:12px;font-style:italic">Sem registro para esta semana</td>
        <td style="text-align:right;padding:10px 12px">
          <button class="btn btn-primary btn-sm" onclick="abrirFechamento('${c.id}')">Fechar semana</button>
        </td>
      </tr>`;
    }
  }

  html += `</tbody></table></div></div>`;
  return html;
}

// ── Aba 2: Fechamento Mensal ─────────────────────────────────────────────────

function _renderHealthMensal() {
  const clients      = getClients();
  const weeklyScores = getWeeklyScores();
  const trafData     = gsGetData('mensal');
  const monthRef     = _healthMonthRef;
  const [mAno, mMes] = monthRef.split('-').map(Number);
  const mesLabel     = new Date(mAno, mMes - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const lastSync     = Object.values(trafData)[0]?.lastSync || null;

  const SC = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' };
  const SL = { green: 'Verde', yellow: 'Amarelo', red: 'Vermelho' };
  function _dot(status, sz) { return `<span style="width:${sz||8}px;height:${sz||8}px;border-radius:50%;background:${SC[status]||'var(--text3)'};display:inline-block;flex-shrink:0"></span>`; }

  // Collect all week refs that fall within this month
  function weekInMonth(weekRef) {
    try {
      const { start, end } = isoWeekToDateRange(weekRef);
      const sM = start.getMonth() + 1, sY = start.getFullYear();
      const eM = end.getMonth() + 1,   eY = end.getFullYear();
      return (sY === mAno && sM === mMes) || (eY === mAno && eM === mMes);
    } catch(e) { return false; }
  }

  const monthWeekRefs = [...new Set(weeklyScores.map(s => s.weekRef))].filter(weekInMonth).sort();
  const nWeeks = monthWeekRefs.length;

  // Build per-client monthly aggregation
  const rows = clients.map(c => {
    const isTraf = isTrafegoOnly(c);
    const recs   = monthWeekRefs.map(wr => weeklyScores.find(s => s.clientId === c.id && s.weekRef === wr && !s.draft)).filter(Boolean);

    // DC: average of weekly totalScores
    let dcAvg = null, dcStatus = null;
    if (!isTraf && recs.length) {
      const dcScores = recs.filter(r => r.totalScore != null).map(r => r.totalScore);
      if (dcScores.length) {
        dcAvg = Math.round(dcScores.reduce((a, b) => a + b, 0) / dcScores.length);
        dcStatus = dcAvg >= 76 ? 'green' : dcAvg >= 51 ? 'yellow' : 'red';
      }
    }

    // CX: average of weekly CX scores
    let cxAvg = null, cxStatus = null;
    const cxScores = recs.filter(r => r.cx?.score).map(r => r.cx.score);
    if (cxScores.length) {
      cxAvg = Math.round((cxScores.reduce((a, b) => a + b, 0) / cxScores.length) * 10) / 10;
      cxStatus = cxAvg >= 4 ? 'green' : cxAvg >= 3 ? 'yellow' : 'red';
    }

    // Tráfego: from mensal sheet
    const traf = trafData[c.id] || null;
    let trafScore = null, trafStatus = null;
    if (traf) {
      trafScore = traf.sheetScore ?? (traf.score != null ? traf.score : null);
      const ts = traf.sheetStatus || '';
      trafStatus = ts.includes('Verde') ? 'green' : ts.includes('Alerta') ? 'yellow' : ts.includes('Vermelho') ? 'red' : (traf.status || null);
    }

    // Score TOTAL: consolidated
    const dcNorm   = dcAvg;
    const trafNorm = trafScore != null ? Math.min(Math.round((trafScore / 10) * 100), 100) : null;
    const cxNorm   = cxAvg    != null ? Math.min(Math.round((cxAvg / 5) * 100), 100) : null;
    const areas    = [dcNorm, trafNorm, cxNorm].filter(v => v !== null);
    const total    = areas.length ? Math.round(areas.reduce((a, b) => a + b, 0) / areas.length) : null;
    const totalSt  = total != null ? (total >= 76 ? 'green' : total >= 51 ? 'yellow' : 'red') : null;

    return { c, isTraf, recs, dcAvg, dcStatus, cxAvg, cxStatus, traf, trafScore, trafStatus, total, totalSt, weeksCount: recs.length };
  }).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

  let html = `<div class="card">
    <div class="flex-between mb-16">
      <div>
        <div class="section-title mb-2">Fechamento Mensal — ${mesLabel}</div>
        <div class="text-xs text-muted">${nWeeks} semana(s) com fechamento · ${lastSync ? 'Tráfego sync: ' + new Date(lastSync).toLocaleDateString('pt-BR') : 'Tráfego não sincronizado'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="month" value="${monthRef}" onchange="_hsMonthChange(this.value)"
          style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:13px">
        <button id="gs-sync-mensal-btn" class="btn btn-primary btn-sm" onclick="gsTrafegoSync('mensal')">↻ Sync Tráfego</button>
      </div>
    </div>

    <div class="table-wrap"><table style="width:100%;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid var(--border)">
        <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--text3)">Cliente</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Semanas</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">DC</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Tráfego</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">CX</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Score Total</th>
        <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Status</th>
      </tr></thead>
      <tbody>`;

  for (const r of rows) {
    const { c, isTraf, dcAvg, dcStatus, cxAvg, cxStatus, traf, trafScore, trafStatus, total, totalSt, weeksCount } = r;
    const rowBg = totalSt === 'green' ? 'color-mix(in srgb,var(--green) 4%,transparent)'
                : totalSt === 'red'   ? 'color-mix(in srgb,var(--red) 4%,transparent)'
                : totalSt === 'yellow' ? 'color-mix(in srgb,var(--yellow) 4%,transparent)' : 'transparent';
    const nomeTag = isTraf ? `${c.nome} <span style="font-size:9px;background:var(--bg3);color:var(--text3);padding:1px 4px;border-radius:3px;margin-left:4px">Tráfego</span>` : c.nome;

    html += `<tr style="border-bottom:1px solid var(--border);background:${rowBg}">
      <td style="padding:10px 10px"><div style="display:flex;align-items:center;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:${c.cor};flex-shrink:0"></span>
        <span style="font-weight:600;font-size:13px">${nomeTag}</span>
      </div></td>
      <td style="text-align:center;padding:10px 10px;font-size:12px;color:var(--text3)">${weeksCount}/${nWeeks}</td>
      <td style="text-align:center;padding:10px 10px">
        ${isTraf ? '<span style="font-size:10px;color:var(--text3)">N/A</span>'
          : dcAvg != null ? `<div style="display:inline-flex;align-items:center;gap:4px">${_dot(dcStatus)}<span style="font-size:14px;font-weight:700">${dcAvg}</span><span style="font-size:10px;color:var(--text3)">/100</span></div>`
          : '<span style="color:var(--text3)">—</span>'}
      </td>
      <td style="text-align:center;padding:10px 10px">
        ${trafScore != null ? `<div style="display:inline-flex;align-items:center;gap:4px">${_dot(trafStatus)}<span style="font-size:14px;font-weight:700">${trafScore}</span><span style="font-size:10px;color:var(--text3)">/10</span></div>`
          : '<span style="color:var(--text3)">—</span>'}
      </td>
      <td style="text-align:center;padding:10px 10px">
        ${cxAvg != null ? `<div style="display:inline-flex;align-items:center;gap:4px">${_dot(cxStatus)}<span style="font-size:14px;font-weight:700">${cxAvg}</span><span style="font-size:10px;color:var(--text3)">/5</span></div>`
          : '<span style="color:var(--text3)">—</span>'}
      </td>
      <td style="text-align:center;padding:10px 10px">
        ${total != null ? `<div style="display:inline-flex;align-items:center;gap:4px">${_dot(totalSt, 10)}<span style="font-size:16px;font-weight:800">${total}</span><span style="font-size:10px;color:var(--text3)">/100</span></div>`
          : '<span style="color:var(--text3)">—</span>'}
      </td>
      <td style="text-align:center;padding:10px 10px">
        ${totalSt ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:${SC[totalSt]}">${_dot(totalSt, 9)}${SL[totalSt]}</span>`
          : '<span style="color:var(--text3)">—</span>'}
      </td>
    </tr>`;
  }

  html += `</tbody></table></div>`;

  // Summary cards
  const withTotal = rows.filter(r => r.total != null);
  const ct = withTotal.length;
  const verdes    = withTotal.filter(r => r.totalSt === 'green').length;
  const amarelos  = withTotal.filter(r => r.totalSt === 'yellow').length;
  const vermelhos = withTotal.filter(r => r.totalSt === 'red').length;
  const avgTotal  = ct ? (withTotal.reduce((s, r) => s + r.total, 0) / ct).toFixed(0) : '—';
  const semData   = rows.filter(r => r.total == null).length;

  html += `<div class="grid grid-5 gap-12 mt-16">
    <div style="text-align:center;padding:12px;background:var(--bg3);border-radius:10px">
      <div style="font-size:24px;font-weight:800">${ct}</div>
      <div style="font-size:10px;color:var(--text3)">Com dados</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg3);border-radius:10px">
      <div style="font-size:24px;font-weight:800;color:var(--green)">${verdes}</div>
      <div style="font-size:10px;color:var(--text3)">🟢 Verde</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg3);border-radius:10px">
      <div style="font-size:24px;font-weight:800;color:var(--yellow)">${amarelos}</div>
      <div style="font-size:10px;color:var(--text3)">🟡 Alerta</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg3);border-radius:10px">
      <div style="font-size:24px;font-weight:800;color:var(--red)">${vermelhos}</div>
      <div style="font-size:10px;color:var(--text3)">🔴 Vermelho</div>
    </div>
    <div style="text-align:center;padding:12px;background:var(--bg3);border-radius:10px">
      <div style="font-size:24px;font-weight:800">${avgTotal}</div>
      <div style="font-size:10px;color:var(--text3)">Score médio</div>
    </div>
  </div>
  ${semData > 0 ? `<div style="text-align:center;margin-top:8px;font-size:11px;color:var(--text3)">${semData} cliente(s) sem dados suficientes neste mês</div>` : ''}
  </div>`;
  return html;
}

// ── Formulário de fechamento ──────────────────────────────────────────────────

function abrirFechamento(cid) {
  const weekRef = _healthWeekRef || getISOWeekRef(new Date());
  const tasks   = getTasks();
  const { start, end } = isoWeekToDateRange(weekRef);
  const todayStr = today();

  const clientTasks = tasks.filter(t => {
    if (t.cliente !== cid) return false;
    if (t.parentClickupId) return false;           // apenas tarefas pai
    if (['descartado', 'travado'].includes(t.status)) return false;
    const d = t.postagem || t.prazo;
    if (!d) return false;
    return new Date(d + 'T12:00:00') >= start && new Date(d + 'T12:00:00') <= end;
  });

  const vol = VOLUME_SEMANAL[cid] || {};
  const postsExpected = (vol.designs || 2) + (vol.videos || 1) + (vol.darks || 0);
  const startStr = start.toISOString().split('T')[0];
  const endStr   = end.toISOString().split('T')[0];

  // Fonte 1 (alta): dataConclusao capturada na transição → concluídos dentro da semana
  const tasksConcluidas = clientTasks.filter(t =>
    t.dataConclusao && t.dataConclusao >= startStr && t.dataConclusao <= endStr
  );
  const datasConclusao = new Set(tasksConcluidas.map(t => t.postagem || t.dataConclusao).filter(Boolean));

  // Fonte 2 (média): status concluido/aprovado, postagem na semana, sem dataConclusao
  const concluidos = clientTasks.filter(t =>
    ['concluido', 'aprovado'].includes(t.status) && !t.dataConclusao
  );
  const datasStatus = new Set(concluidos.map(t => t.postagem).filter(Boolean));

  // Fonte 3 (baixa): data de postagem já passou, tarefa não concluída (implícito — publicado via mLabs)
  const tasksPosData = clientTasks.filter(t => {
    if (['concluido', 'aprovado', 'reprovado'].includes(t.status)) return false;
    if (t.dataConclusao) return false;
    return t.postagem && t.postagem <= todayStr;
  });
  const datasImplicitas = new Set(tasksPosData.map(t => t.postagem).filter(Boolean));

  const todasDatas = new Set([...datasConclusao, ...datasStatus, ...datasImplicitas]);
  const postsCompleted = todasDatas.size;

  // Atrasos reais: concluído após o prazo OU não entregue com prazo vencido
  const atrasadas = clientTasks.filter(t => {
    if (t.dataConclusao && t.prazo) return t.dataConclusao > t.prazo;
    if (!t.dataConclusao && t.prazo && !['concluido', 'aprovado', 'descartado'].includes(t.status))
      return t.prazo < todayStr;
    return false;
  });

  _healthFormDelivery = {
    postsCompleted, postsExpected,
    fonteConclusao: datasConclusao.size,
    fonteStatus:    datasStatus.size,
    fonteImplicita: datasImplicitas.size,
    atrasadas:      atrasadas.length
  };
  _healthFormPostsList = {
    conclusao: tasksConcluidas.map(t => ({ id: t.id, clickupId: t.clickupId, nome: t.nome, tipo: t.tipo, postagem: t.postagem, dataConclusao: t.dataConclusao })),
    status:    concluidos.map(t => ({ id: t.id, clickupId: t.clickupId, nome: t.nome, tipo: t.tipo, postagem: t.postagem })),
    implicita: tasksPosData.map(t => ({ id: t.id, clickupId: t.clickupId, nome: t.nome, tipo: t.tipo, postagem: t.postagem }))
  };
  _healthFormRevisions = clientTasks
    .filter(t => (t.revisoes || 0) > 0)
    .map(t => ({
      subtaskName:   t.nome || tipoLabel(t.tipo),
      area:          parseAreaFromSubtaskName(t.nome || t.tipo || ''),
      assigneeId:    t.responsavel || '',
      revisionCount: t.revisoes || 1
    }));
  const allScores    = getWeeklyScores();
  const _existingRec = allScores.find(s => s.clientId === cid && s.weekRef === weekRef);
  _healthFormManualRevisions  = (_existingRec?.revisions?.manualEntries  || []);
  _healthFormCustomErrorTypes = (_existingRec?.revisions?.customTypes     || []);
  _healthFormNextActions      = (_existingRec?.nextActions               || []);

  // Ações da semana anterior → vira checklist de acompanhamento
  const prevRec = allScores
    .filter(s => s.clientId === cid && s.weekRef < weekRef && (s.nextActions || []).length > 0)
    .sort((a, b) => b.weekRef.localeCompare(a.weekRef))[0];
  _healthFormPrevActions = prevRec?.nextActions || [];
  _healthFormPrevChecked = (_existingRec?.prevActionsChecked || _healthFormPrevActions.map(() => false));
  _healthFormTrafego     = _existingRec?.trafego || null;
  _healthFormCX          = _existingRec?.cx     || null;

  const reprovadas = clientTasks.filter(t => t.status === 'reprovado');
  _healthFormRejection = reprovadas.length === 0 ? 'none'
    : concluidos.length === 0 ? 'total' : 'partial';

  _healthFormClient = cid;
  renderHealth();
}

function fecharFechamento() {
  _healthFormClient           = null;
  _healthFormDelivery         = null;
  _healthFormRejection        = 'none';
  _healthFormRevisions        = [];
  _healthFormManualRevisions  = [];
  _healthFormCustomErrorTypes = [];
  _healthFormNextActions      = [];
  _healthFormPrevActions      = [];
  _healthFormPrevChecked      = [];
  _healthFormTrafego          = null;
  _healthFormCX               = null;
  renderHealth();
}

function _renderFechamento(cid) {
  const c       = getClients().find(x => x.id === cid);
  const _isTrafOnly = isTrafegoOnly(c);
  const weekRef = _healthWeekRef || getISOWeekRef(new Date());
  const { start, end } = isoWeekToDateRange(weekRef);
  const delivery  = _healthFormDelivery  || { postsCompleted: 0, postsExpected: 3 };
  const revisions = _healthFormRevisions || [];
  const rejection = _healthFormRejection || 'none';
  const existing  = getWeeklyScores().find(s => s.clientId === cid && s.weekRef === weekRef);

  const rejBadge = rejection === 'total'
    ? '<span style="background:#fef2f2;color:#dc2626;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:600">Reprovação total</span>'
    : rejection === 'partial'
    ? '<span style="background:#fffbeb;color:#d97706;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:600">Reprovação parcial</span>'
    : '<span style="color:var(--text3);font-size:12px">Nenhuma detectada</span>';

  const delivColor = delivery.postsCompleted >= delivery.postsExpected ? '#22c55e'
    : delivery.postsCompleted >= 2 ? '#eab308' : '#ef4444';

  // ── Bloco 0: Checklist da semana anterior ──
  const _prevBlock = _healthFormPrevActions.length ? `
    <div class="card mb-16" style="border-left:3px solid var(--accent)">
      <div class="section-title mb-4" style="color:var(--accent)">📋 Pendências da semana anterior</div>
      <div class="text-xs text-muted mb-14">Ações anotadas no fechamento anterior. Marque as concluídas.</div>
      <div style="display:flex;flex-direction:column;gap:7px">
        ${_healthFormPrevActions.map((action, i) => {
          const done = _healthFormPrevChecked[i] === true;
          return `<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:8px 10px;border-radius:8px;background:${done ? 'var(--bg3)' : 'var(--bg2)'};border:1px solid var(--border);transition:background 0.15s">
            <input type="checkbox" data-prev-idx="${i}" ${done ? 'checked' : ''}
              style="width:auto;flex-shrink:0;margin:2px 0 0"
              onchange="hsPrevToggle(${i},this.checked)">
            <span style="font-size:13px;${done ? 'text-decoration:line-through;color:var(--text3)' : 'color:var(--text)'}">${action}</span>
          </label>`;
        }).join('')}
      </div>
    </div>` : '';

  // ── Header ──
  let html = `
    <div class="flex-between mb-20">
      <div>
        <div class="section-title mb-4">Fechamento — ${c?.nome || cid}</div>
        <div class="text-muted text-sm">${fmtDate(start.toISOString().slice(0,10))} → ${fmtDate(end.toISOString().slice(0,10))} · ${weekRef}</div>
        ${_isTrafOnly ? '<div class="text-xs" style="color:var(--accent);margin-top:4px">Cliente Tráfego — somente Tráfego e CX</div>' : ''}
      </div>
      <button class="btn btn-ghost" onclick="fecharFechamento()">← Voltar</button>
    </div>`;

  // ── Blocos DC (①–④) — somente para clientes com produção de conteúdo ──
  if (!_isTrafOnly) {
  html += `
    <div class="card mb-16">
      <div class="section-title mb-4">① Leitura automática</div>
      <div class="text-xs text-muted mb-12">Posts detectados automaticamente via ClickUp. Ajuste manualmente se necessário.</div>
      <div class="grid grid-4 gap-12 mb-12">
        <div style="padding:14px;background:var(--bg3);border-radius:10px;position:relative"
             onmouseenter="_hsPostsShow()" onmouseleave="_hsPostsScheduleHide()">
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px">
            <input type="number" id="hs-posts-completed" min="0" max="99"
              value="${delivery.postsCompleted}"
              oninput="_atualizarScorePreview()"
              style="width:56px;text-align:center;font-size:26px;font-weight:800;color:${delivColor};background:transparent;border:none;border-bottom:2px solid var(--border);outline:none;padding:0">
            <span style="font-size:18px;color:var(--text3)">/${delivery.postsExpected}</span>
          </div>
          <div class="text-xs text-muted" style="text-align:center">posts publicados</div>
          ${_buildPostsPopup(delivery.postsCompleted)}
        </div>
        <div style="text-align:center;padding:14px;background:var(--bg3);border-radius:10px">
          <div id="hs-rev-count" style="font-size:28px;font-weight:800;color:${(revisions.length + _healthFormManualRevisions.length) === 0 ? '#22c55e' : '#eab308'}">${revisions.length + _healthFormManualRevisions.length}</div>
          <div class="text-xs text-muted">revisões registradas</div>
        </div>
        <div style="text-align:center;padding:14px;background:var(--bg3);border-radius:10px">
          <div style="font-size:28px;font-weight:800;color:${(delivery.atrasadas?.length ?? 0) === 0 ? '#22c55e' : '#ef4444'}">${delivery.atrasadas?.length ?? 0}</div>
          <div class="text-xs text-muted">entregas atrasadas</div>
          ${(delivery.atrasadas?.length ?? 0) > 0 ? `<div style="margin-top:6px;display:flex;flex-direction:column;gap:2px">${(delivery.atrasadas || []).slice(0,3).map(t => `<div style="font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.nome || t.id}</div>`).join('')}${(delivery.atrasadas?.length ?? 0) > 3 ? `<div style="font-size:10px;color:var(--text3)">+${(delivery.atrasadas?.length ?? 0) - 3} mais</div>` : ''}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;justify-content:center;padding:14px;background:var(--bg3);border-radius:10px">
          ${rejBadge}
        </div>
      </div>`;

  html += `</div>`; // end card block 1

  // ── Bloco 2 ──
  html += `
    <div class="card mb-16">
      <div class="section-title mb-12">② Feedback do cliente <span style="color:#ef4444">*</span></div>
      <select id="hs-feedback" onchange="_atualizarScorePreview()" style="max-width:340px;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:13px">
        <option value="">Selecione...</option>
        <option value="positive"${existing?.clientFeedback?.type==='positive'?' selected':''}>Positivo — cliente satisfeito, sem apontamentos</option>
        <option value="neutral"${existing?.clientFeedback?.type==='neutral'?' selected':''}>Neutro — sugestão de melhoria, sem crítica direta</option>
        <option value="negative"${existing?.clientFeedback?.type==='negative'?' selected':''}>Negativo — reclamação formal ou insatisfação clara</option>
        <option value="none"${existing?.clientFeedback?.type==='none'?' selected':''}>Sem feedback — semana sem retorno do cliente</option>
      </select>
      <div style="margin-top:12px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Justificativa <span style="font-weight:400">(opcional)</span></div>
        <textarea id="hs-feedback-obs" rows="2" placeholder="Descreva o contexto ou detalhe o feedback do cliente..."
          style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--text1);font-size:12px;resize:vertical;box-sizing:border-box;font-family:inherit"
        >${existing?.clientFeedback?.justificativa || ''}</textarea>
      </div>
    </div>`;

  // ── Bloco 3 ──
  const ERROR_TYPES = [
    { key: 'spelling',          label: 'Erro de ortografia',                     pts: 1, area: 'Copy' },
    { key: 'content_direction', label: 'Alteração de direcionamento de conteúdo', pts: 2, area: 'Copy / CD' },
    { key: 'video',             label: 'Alteração de vídeo',                      pts: 1, area: 'Vídeo' },
    { key: 'design',            label: 'Alteração de design',                     pts: 1, area: 'Design' },
    { key: 'timing',            label: 'Perda de timing (erro crítico)',           pts: 3, area: 'Tráfego / CD' },
  ];
  const existingErrors = existing?.revisions?.errorTypes || [];

  // Build initial revision list HTML
  const AREA_COLOR = { video: '#8b5cf6', design: '#3b82f6', copy: '#f59e0b', general: '#6b7280' };
  let revListHTML = '';
  if (revisions.length === 0 && _healthFormManualRevisions.length === 0) {
    revListHTML = `<div style="color:var(--text3);font-size:12px;padding:4px 0">Nenhuma revisão registrada</div>`;
  } else {
    revListHTML += revisions.map(r => {
      const ac = AREA_COLOR[r.area] || '#6b7280';
      const member = getTeam().find(m => m.id === r.assigneeId);
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg3);border-radius:7px;font-size:12px;margin-bottom:4px">
        <span style="width:6px;height:6px;border-radius:50%;background:${ac};flex-shrink:0"></span>
        <span style="flex:1">${r.subtaskName}</span>
        <span style="background:${ac}22;color:${ac};padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600">${r.area}</span>
        <span style="color:var(--text3);font-size:11px">${member?.nome || r.assigneeId || '—'}</span>
        <span style="color:var(--text3);font-size:11px">${r.revisionCount}×</span>
      </div>`;
    }).join('');
    revListHTML += _healthFormManualRevisions.map((r, i) =>
      `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg3);border-radius:7px;font-size:12px;margin-bottom:4px">
        <span style="width:6px;height:6px;border-radius:50%;background:#94a3b8;flex-shrink:0"></span>
        <span style="flex:1">${r.subtaskName}</span>
        <span style="color:var(--text3);font-size:10px;padding:1px 7px;border-radius:4px;background:var(--bg2)">Manual</span>
        <button onclick="_hsRemoveManualRev(${i})" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:13px;padding:0 2px;line-height:1">✕</button>
      </div>`
    ).join('');
  }

  html += `
    <div class="card mb-16">
      <div class="section-title mb-12">③ Revisões</div>
      <div id="hs-rev-list" style="margin-bottom:10px">${revListHTML}</div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <input type="text" id="hs-rev-input" placeholder="Descreva a revisão a adicionar..."
          style="flex:1;padding:7px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg3);color:var(--text1);font-size:12px"
          onkeydown="if(event.key==='Enter'){event.preventDefault();_hsAddManualRev();}">
        <button class="btn btn-ghost btn-sm" onclick="_hsAddManualRev()">+ Adicionar</button>
      </div>
      <div class="text-muted text-xs mb-10">Assinale os tipos de erro identificados. A pontuação é descontada independente da origem da revisão.</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${ERROR_TYPES.map(et => {
          const checked = existingErrors.includes(et.key) ? 'checked' : '';
          return `<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:9px 12px;border-radius:8px;background:var(--bg3)">
            <input type="checkbox" class="hs-error-type" data-key="${et.key}" data-pts="${et.pts}" onchange="_atualizarScorePreview()" ${checked} style="width:auto;flex-shrink:0;margin:0">
            <span style="flex:1;font-size:13px">${et.label}</span>
            <span style="color:var(--text3);font-size:11px;white-space:nowrap">${et.area}</span>
            <span style="background:var(--bg2);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap">+${et.pts}pt</span>
          </label>`;
        }).join('')}
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:8px">Tipos personalizados</div>
        <div id="hs-custom-error-list">${_buildCustomErrorList()}</div>
        <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
          <input type="text" id="hs-custom-label" placeholder="Descrição do erro..."
            style="flex:1;padding:6px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg3);color:var(--text1);font-size:12px"
            onkeydown="if(event.key==='Enter'){event.preventDefault();_hsAddCustomErrorType();}">
          <input type="number" id="hs-custom-pts" min="1" max="10" value="1" placeholder="pts"
            style="width:56px;padding:6px 8px;border-radius:7px;border:1px solid var(--border);background:var(--bg3);color:var(--text1);font-size:12px;text-align:center">
          <button class="btn btn-ghost btn-sm" onclick="_hsAddCustomErrorType()">+ Adicionar</button>
        </div>
      </div>
    </div>`;

  // ── Bloco 4 ──
  html += `
    <div class="card mb-16">
      <div class="section-title mb-4">④ Gravação <span style="color:var(--text3);font-size:12px;font-weight:400">(facultativo)</span></div>
      <select id="hs-recording" onchange="_atualizarScorePreview()"
        style="max-width:280px;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text1);font-size:13px">
        <option value="na"${!existing || existing.recording?.status==='na' ?' selected':''}>Não avaliado esta semana</option>
        <option value="done"${existing?.recording?.status==='done'    ?' selected':''}>Em dia</option>
        <option value="pending"${existing?.recording?.status==='pending'?' selected':''}>Atrasada</option>
      </select>
      <div class="text-xs text-muted mt-8">Quando não avaliado, score máximo da semana = 90 pts.</div>
    </div>`;
  } // end if (!_isTrafOnly)

  // ── Bloco 5 — Tráfego ──
  const _traf    = _healthFormTrafego;
  const _hasT    = _traf !== null;
  const _sheetD  = gsGetData('semanal')[cid] || null;  // dados semanais da planilha
  const _metaPct = _hasT ? (_traf.metaPct ?? _sheetD?.metaPct ?? 0) : 0;
  const _trafRes = _hasT ? calculateTrafegoScore(_metaPct) : null;
  const _trafSC  = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' };

  const _trafDataFields = [
    { id:'investimento', label:'Investimento', val: _traf?.investimento || _sheetD?.investimento || '' },
    { id:'leads',        label:'Leads',        val: _traf?.leads        || _sheetD?.leads        || '' },
    { id:'vendas',       label:'Vendas',       val: _traf?.vendas       || _sheetD?.vendas       || '' },
    { id:'cpl',          label:'CPL',          val: _traf?.cpl          || _sheetD?.cpl          || '' },
    { id:'cac',          label:'CAC',          val: _traf?.cac          || _sheetD?.cac          || '' },
    { id:'meta',         label:'Meta',         val: _traf?.meta         || _sheetD?.meta         || '' },
  ];

  html += `
    <div class="card mb-16">
      <div class="flex-between mb-14">
        <div class="section-title mb-0">⑤ Tráfego</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span id="hs-traf-sync-label" style="font-size:11px;color:var(--text3)">${_sheetD ? `📊 Planilha · ${new Date(_sheetD.lastSync).toLocaleDateString('pt-BR')}` : ''}</span>
          <button id="hs-traf-sync-btn" class="btn btn-ghost btn-sm" onclick="_hsSyncAndPopulateTrafego()" style="font-size:11px;padding:3px 8px">↻ Planilha</button>
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:16px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 14px;border-radius:8px;border:1px solid ${_hasT ? 'var(--accent)' : 'var(--border)'};background:${_hasT ? 'color-mix(in srgb,var(--accent) 10%,var(--bg2))' : 'var(--bg3)'};flex:1">
          <input type="radio" name="hs-traf-toggle" value="sim" ${_hasT ? 'checked' : ''}
            onchange="_hsTrafegoToggle(true)" style="width:auto;flex-shrink:0;margin:0">
          <span style="font-size:13px;font-weight:600;color:${_hasT ? 'var(--accent)' : 'var(--text2)'}">Sim — tem gestão de tráfego</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:${!_hasT ? 'var(--bg3)' : 'var(--bg2)'};flex:1">
          <input type="radio" name="hs-traf-toggle" value="nao" ${!_hasT ? 'checked' : ''}
            onchange="_hsTrafegoToggle(false)" style="width:auto;flex-shrink:0;margin:0">
          <span style="font-size:13px;color:var(--text3)">Não se aplica</span>
        </label>
      </div>

      <div id="hs-traf-form" style="display:${_hasT ? 'block' : 'none'}">

        <!-- % Meta + Score -->
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px">% Meta atingida</div>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="number" id="hs-traf-metapct" min="0" max="200" value="${_metaPct}"
                oninput="_hsTrafegoUpdateFromPct()"
                style="width:80px;text-align:center;font-size:22px;font-weight:800;color:${_trafRes ? _trafSC[_trafRes.status] : 'var(--text)'};background:transparent;border:none;border-bottom:2px solid var(--border);outline:none;padding:0">
              <span style="font-size:16px;color:var(--text3)">%</span>
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:4px">${_sheetD ? 'Da planilha — editável' : 'Clique em ↻ Planilha para buscar'}</div>
          </div>
          <div id="hs-traf-score-badge" style="padding:10px 16px;border-radius:10px;background:var(--bg3);display:flex;align-items:center;gap:10px">
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px">Score Tráfego</div>
              <div style="display:flex;align-items:baseline;gap:4px;margin-top:2px">
                <span id="hs-traf-score-val" style="font-size:24px;font-weight:800;color:${_trafRes ? _trafSC[_trafRes.status] : 'var(--text3)'}">${_trafRes ? _trafRes.score : '—'}</span>
                <span style="font-size:13px;color:var(--text3)">/5</span>
              </div>
            </div>
            <span id="hs-traf-score-dot" style="width:12px;height:12px;border-radius:50%;background:${_trafRes ? _trafSC[_trafRes.status] : 'var(--border)'};flex-shrink:0"></span>
          </div>
        </div>

        <!-- Dados complementares -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${_trafDataFields.map(f => `<div>
            <div style="font-size:10px;font-weight:600;color:var(--text3);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px">${f.label}</div>
            <input type="text" id="hs-traf-${f.id}" value="${f.val}" placeholder="—"
              oninput="_hsTrafegoSyncData()"
              style="width:100%;padding:5px 8px;font-size:12px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text)">
          </div>`).join('')}
        </div>
      </div>
    </div>`;

  // ── Bloco 6 — CX ──
  const _cx     = _healthFormCX;
  const _hasCX  = _cx !== null;
  const _cxRat  = _cx?.rating || 0;
  const _cxRes  = _hasCX && _cxRat ? calculateCXScore(_cxRat) : null;
  const _cxSC   = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' };

  html += `
    <div class="card mb-16">
      <div class="flex-between mb-14">
        <div class="section-title mb-0">⑥ CX — Experiência do Cliente</div>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:16px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 14px;border-radius:8px;border:1px solid ${_hasCX ? 'var(--accent)' : 'var(--border)'};background:${_hasCX ? 'color-mix(in srgb,var(--accent) 10%,var(--bg2))' : 'var(--bg3)'};flex:1">
          <input type="radio" name="hs-cx-toggle" value="sim" ${_hasCX ? 'checked' : ''}
            onchange="_hsCXToggle(true)" style="width:auto;flex-shrink:0;margin:0">
          <span style="font-size:13px;font-weight:600;color:${_hasCX ? 'var(--accent)' : 'var(--text2)'}">Sim — avaliar CX</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:${!_hasCX ? 'var(--bg3)' : 'var(--bg2)'};flex:1">
          <input type="radio" name="hs-cx-toggle" value="nao" ${!_hasCX ? 'checked' : ''}
            onchange="_hsCXToggle(false)" style="width:auto;flex-shrink:0;margin:0">
          <span style="font-size:13px;color:var(--text3)">Não se aplica</span>
        </label>
      </div>

      <div id="hs-cx-form" style="display:${_hasCX ? 'block' : 'none'}">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px">Nota (1–5)</div>
            <div style="display:flex;gap:6px">
              ${[1,2,3,4,5].map(n => `
                <button id="hs-cx-pill-${n}" onclick="_hsCXSetRating(${n})"
                  style="width:36px;height:36px;border-radius:8px;border:1px solid ${n <= _cxRat ? 'var(--accent)' : 'var(--border)'};
                         background:${n <= _cxRat ? 'var(--accent)' : 'var(--bg3)'};
                         color:${n <= _cxRat ? '#fff' : 'var(--text3)'};
                         font-size:15px;font-weight:700;cursor:pointer;transition:all .15s">
                  ${n}
                </button>`).join('')}
            </div>
          </div>
          <div id="hs-cx-score-badge" style="padding:10px 16px;border-radius:10px;background:var(--bg3);display:flex;align-items:center;gap:10px">
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px">Score CX</div>
              <div style="display:flex;align-items:baseline;gap:4px;margin-top:2px">
                <span id="hs-cx-score-val" style="font-size:24px;font-weight:800;color:${_cxRes ? _cxSC[_cxRes.status] : 'var(--text3)'}">${_cxRes ? _cxRes.score : '—'}</span>
                <span style="font-size:13px;color:var(--text3)">/5</span>
              </div>
            </div>
            <span id="hs-cx-score-dot" style="width:12px;height:12px;border-radius:50%;background:${_cxRes ? _cxSC[_cxRes.status] : 'var(--border)'};flex-shrink:0"></span>
          </div>
        </div>
      </div>
    </div>`;

  // ── Bloco 7 — Pendências + Ações ──
  if (_prevBlock) html += _prevBlock;
  html += `
    <div class="card mb-16">
      <div class="section-title mb-12">⑦ Ações para a próxima semana</div>
      <div id="hs-next-list" style="margin-bottom:12px">${_buildNextActionsList()}</div>
      <div style="display:flex;gap:8px">
        <input type="text" id="hs-next-input" placeholder="Descreva uma ação ou ponto de atenção..."
          style="flex:1;padding:7px 10px;border-radius:7px;border:1px solid var(--border);background:var(--bg3);color:var(--text1);font-size:13px"
          onkeydown="if(event.key==='Enter'){event.preventDefault();_hsAddNextAction();}">
        <button class="btn btn-ghost btn-sm" onclick="_hsAddNextAction()">+ Adicionar</button>
      </div>
    </div>`;

  // ── Bloco 7 ──
  html += `
    <div id="hs-score-preview" class="card mb-20">
      <div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">
        Selecione o feedback do cliente para calcular o score ↑
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;align-items:center">
      <button class="btn btn-ghost" onclick="fecharFechamento()">Cancelar</button>
      <button class="btn btn-ghost" onclick="salvarRascunhoFechamento('${cid}')" style="border-color:var(--accent);color:var(--accent)">💾 Salvar</button>
      <button class="btn btn-primary" onclick="confirmarFechamento('${cid}')">✓ Confirmar fechamento</button>
    </div>`;

  return html;
}

function _atualizarScorePreview() {
  const previewDiv = document.getElementById('hs-score-preview');
  if (!previewDiv) return;

  const _isTrafOnly = isTrafegoOnly(clientById(_healthFormClient));
  const CSC = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' };
  const CSL = { green: 'Verde', yellow: 'Amarelo', red: 'Vermelho' };
  const trafResult = _healthFormTrafego ? calculateTrafegoScore(_healthFormTrafego.metaPct) : null;
  const cxResult   = (_healthFormCX && _healthFormCX.rating) ? calculateCXScore(_healthFormCX.rating) : null;

  // ── Cliente tráfego-only: preview simplificado ──
  if (_isTrafOnly) {
    const consolidated = calculateConsolidatedScore(null, trafResult ? { score: trafResult.score } : null, cxResult ? { score: cxResult.score } : null);
    previewDiv.innerHTML = `
      <div class="section-title mb-12">Score calculado em tempo real</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="padding:12px 14px;background:var(--bg3);border-radius:10px;border-left:3px solid ${trafResult ? CSC[trafResult.status] : 'var(--border)'}">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Tráfego</div>
          ${trafResult
            ? `<div style="display:flex;align-items:baseline;gap:4px">
                 <span style="font-size:22px;font-weight:800;color:${CSC[trafResult.status]}">${trafResult.score}</span>
                 <span style="font-size:12px;color:var(--text3)">/5</span>
               </div>`
            : `<div style="font-size:13px;color:var(--text3);margin-top:4px">—</div>`}
        </div>
        <div style="padding:12px 14px;background:var(--bg3);border-radius:10px;border-left:3px solid ${cxResult ? CSC[cxResult.status] : 'var(--border)'}">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">CX</div>
          ${cxResult
            ? `<div style="display:flex;align-items:baseline;gap:4px">
                 <span style="font-size:22px;font-weight:800;color:${CSC[cxResult.status]}">${cxResult.score}</span>
                 <span style="font-size:12px;color:var(--text3)">/5</span>
               </div>`
            : `<div style="font-size:13px;color:var(--text3);margin-top:4px">—</div>`}
        </div>
        <div style="padding:12px 14px;background:var(--bg3);border-radius:10px;border-left:3px solid ${consolidated ? CSC[consolidated.status] : 'var(--border)'}">
          <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Score Geral</div>
          ${consolidated
            ? `<div style="display:flex;align-items:baseline;gap:4px">
                 <span style="font-size:22px;font-weight:800;color:${CSC[consolidated.status]}">${consolidated.score}</span>
                 <span style="font-size:12px;color:var(--text3)">/100</span>
               </div>
               <div style="font-size:11px;font-weight:600;color:${CSC[consolidated.status]};margin-top:2px">● ${CSL[consolidated.status]}</div>`
            : `<div style="font-size:13px;color:var(--text3);margin-top:4px">—</div>`}
        </div>
      </div>`;
    return;
  }

  // ── Cliente completo: preview com DC ──
  const feedbackEl = document.getElementById('hs-feedback');
  if (!feedbackEl) return;

  const feedback = feedbackEl.value;
  if (!feedback) {
    previewDiv.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">Selecione o feedback do cliente para calcular o score ↑</div>';
    return;
  }

  let errorPts = 0;
  const errorTypes = [];
  document.querySelectorAll('.hs-error-type:checked').forEach(cb => {
    errorPts += parseInt(cb.dataset.pts || 0);
    errorTypes.push(cb.dataset.key);
  });
  document.querySelectorAll('.hs-custom-error-type:checked').forEach(cb => {
    errorPts += parseInt(cb.dataset.pts || 0);
  });

  const recording = document.getElementById('hs-recording')?.value || 'na';
  const base      = _healthFormDelivery  || { postsCompleted: 0, postsExpected: 3 };
  const postsInput = parseInt(document.getElementById('hs-posts-completed')?.value ?? base.postsCompleted);
  const delivery   = { ...base, postsCompleted: isNaN(postsInput) ? base.postsCompleted : postsInput };
  const rejection = _healthFormRejection || 'none';
  const result    = calculateClientScore(delivery, feedback, { errorPoints: errorPts, rejection }, recording);

  // Mostrar/ocultar seção manual no popup
  const manualSection = document.getElementById('hs-posts-manual-section');
  if (manualSection) manualSection.style.display = (!isNaN(postsInput) && postsInput > base.postsCompleted) ? 'block' : 'none';

  const SC = { green: '#22c55e', yellow: '#eab308', red: '#ef4444' };
  const SL = { green: 'Verde', yellow: 'Amarelo', red: 'Vermelho' };
  const sc = SC[result.finalStatus];
  const sl = SL[result.finalStatus];

  const overNote = result.overrideActive
    ? `<div style="font-size:11px;color:#d97706;margin-top:4px">⚠ Override: ${result.overrideReason === 'total_rejection' ? 'Reprovação total → forçado Vermelho' : 'Reprovação parcial → máx. Amarelo'}</div>`
    : '';

  const dcRecordPreview = { totalScore: result.totalScore };
  const consolidated = calculateConsolidatedScore(dcRecordPreview, trafResult ? { score: trafResult.score } : null, cxResult ? { score: cxResult.score } : null);

  previewDiv.innerHTML = `
    <div class="section-title mb-12">⑧ Score calculado em tempo real</div>
    <div class="grid grid-4 gap-10 mb-16">
      <div style="text-align:center;padding:12px;background:var(--bg3);border-radius:9px">
        <div style="font-size:22px;font-weight:800">${result.breakdown.delivery}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">Entrega /40</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--bg3);border-radius:9px">
        <div style="font-size:22px;font-weight:800">${result.breakdown.feedback}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">Feedback /30</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--bg3);border-radius:9px">
        <div style="font-size:22px;font-weight:800">${result.breakdown.revisions}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">Revisões /20</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--bg3);border-radius:9px">
        <div style="font-size:22px;font-weight:800">${result.breakdown.recording}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">Gravação /${result.maxScore === 100 ? '10' : '—'}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px">
      <div style="padding:12px 14px;background:var(--bg3);border-radius:10px;border-left:3px solid ${sc}">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Direção Criativa</div>
        <div style="display:flex;align-items:baseline;gap:4px">
          <span style="font-size:22px;font-weight:800;color:${sc}">${result.totalScore}</span>
          <span style="font-size:12px;color:var(--text3)">/${result.maxScore}</span>
        </div>
        ${overNote}
      </div>
      <div style="padding:12px 14px;background:var(--bg3);border-radius:10px;border-left:3px solid ${trafResult ? CSC[trafResult.status] : 'var(--border)'}">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Tráfego</div>
        ${trafResult
          ? `<div style="display:flex;align-items:baseline;gap:4px">
               <span style="font-size:22px;font-weight:800;color:${CSC[trafResult.status]}">${trafResult.score}</span>
               <span style="font-size:12px;color:var(--text3)">/5</span>
             </div>
             <div style="font-size:11px;color:var(--text3);margin-top:2px">% Meta: ${trafResult.metaPct}%</div>`
          : `<div style="font-size:13px;color:var(--text3);margin-top:4px">—</div>`
        }
      </div>
      <div style="padding:12px 14px;background:var(--bg3);border-radius:10px;border-left:3px solid ${cxResult ? CSC[cxResult.status] : 'var(--border)'}">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">CX</div>
        ${cxResult
          ? `<div style="display:flex;align-items:baseline;gap:4px">
               <span style="font-size:22px;font-weight:800;color:${CSC[cxResult.status]}">${cxResult.score}</span>
               <span style="font-size:12px;color:var(--text3)">/5</span>
             </div>`
          : `<div style="font-size:13px;color:var(--text3);margin-top:4px">—</div>`
        }
      </div>
      <div style="padding:12px 14px;background:var(--bg3);border-radius:10px;border-left:3px solid ${consolidated ? CSC[consolidated.status] : 'var(--border)'}">
        <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Score Geral</div>
        ${consolidated
          ? `<div style="display:flex;align-items:baseline;gap:4px">
               <span style="font-size:22px;font-weight:800;color:${CSC[consolidated.status]}">${consolidated.score}</span>
               <span style="font-size:12px;color:var(--text3)">/100</span>
             </div>
             <div style="font-size:11px;font-weight:600;color:${CSC[consolidated.status]};margin-top:2px">● ${CSL[consolidated.status]}</div>`
          : `<div style="font-size:13px;color:var(--text3);margin-top:4px">—</div>`
        }
      </div>
    </div>`;
}

function confirmarFechamento(cid) {
  const _isTrafOnly = isTrafegoOnly(clientById(cid));
  const weekRef     = _healthWeekRef || getISOWeekRef(new Date());

  // DC fields (skip for tráfego-only)
  let feedback = 'none', errorPts = 0, errorTypes = [], recording = 'na', delivery, rejection = 'none', result;
  if (!_isTrafOnly) {
    feedback = document.getElementById('hs-feedback')?.value;
    if (!feedback) { showToast('Selecione o feedback do cliente', true); return; }
    document.querySelectorAll('.hs-error-type:checked').forEach(cb => {
      errorPts += parseInt(cb.dataset.pts || 0);
      errorTypes.push(cb.dataset.key);
    });
    document.querySelectorAll('.hs-custom-error-type:checked').forEach(cb => {
      errorPts += parseInt(cb.dataset.pts || 0);
    });
    recording  = document.getElementById('hs-recording')?.value || 'na';
    const base      = _healthFormDelivery  || { postsCompleted: 0, postsExpected: 3 };
    const postsInput = parseInt(document.getElementById('hs-posts-completed')?.value ?? base.postsCompleted);
    delivery   = { ...base, postsCompleted: isNaN(postsInput) ? base.postsCompleted : postsInput };
    rejection  = _healthFormRejection || 'none';
    result     = calculateClientScore(delivery, feedback, { errorPoints: errorPts, rejection }, recording);
  } else {
    delivery = { postsCompleted: 0, postsExpected: 0 };
    result   = { totalScore: 0, maxScore: 0, finalStatus: 'green', breakdown: { delivery: 0, feedback: 0, revisions: 0, recording: 0 }, overrideActive: false, overrideReason: null };
  }

  const epStatus = errorPts === 0 ? 'none' : errorPts <= 2 ? 'expected' : errorPts <= 4 ? 'attention' : 'critical';

  const trafRec = _healthFormTrafego ? (() => {
    const _tr = calculateTrafegoScore(_healthFormTrafego.metaPct);
    return {
      metaPct:      parseFloat(_healthFormTrafego.metaPct) || 0,
      score:        _tr.score,
      status:       _tr.status,
      investimento: _healthFormTrafego.investimento || '',
      leads:        _healthFormTrafego.leads || '',
      vendas:       _healthFormTrafego.vendas || '',
      cpl:          _healthFormTrafego.cpl || '',
      cac:          _healthFormTrafego.cac || '',
      meta:         _healthFormTrafego.meta || ''
    };
  })() : null;

  const cxRec = (_healthFormCX && _healthFormCX.rating) ? (() => {
    const _cr = calculateCXScore(_healthFormCX.rating);
    return { rating: _healthFormCX.rating, score: _cr.score, status: _cr.status };
  })() : null;

  const record = {
    id:        uid(),
    clientId:  cid,
    weekRef,
    createdAt: new Date().toISOString(),
    delivery:  { postsCompleted: delivery.postsCompleted, postsExpected: delivery.postsExpected, points: result.breakdown.delivery },
    clientFeedback: { type: feedback, justificativa: (!_isTrafOnly ? document.getElementById('hs-feedback-obs')?.value.trim() : '') || '', points: result.breakdown.feedback },
    revisions: {
      detectedByClickUp: _healthFormRevisions,
      manualEntries:     _healthFormManualRevisions,
      customTypes:       _healthFormCustomErrorTypes,
      errorTypes,
      errorPoints:        errorPts,
      status:             epStatus,
      contributionPoints: result.breakdown.revisions,
      rejection
    },
    recording:     { status: recording, points: result.breakdown.recording },
    totalScore:    _isTrafOnly ? null : result.totalScore,
    maxScore:      _isTrafOnly ? null : result.maxScore,
    finalStatus:   _isTrafOnly ? null : result.finalStatus,
    overrideActive: result.overrideActive,
    overrideReason: result.overrideReason,
    trafego: trafRec,
    cx: cxRec,
    consolidatedScore: calculateConsolidatedScore(
      _isTrafOnly ? null : { totalScore: result.totalScore },
      trafRec ? { score: trafRec.score } : null,
      cxRec ? { score: cxRec.score } : null
    ),
    nextActions:          [..._healthFormNextActions],
    prevActionsChecked:   [..._healthFormPrevChecked]
  };

  const scores   = getWeeklyScores().filter(s => !(s.clientId === cid && s.weekRef === weekRef));
  scores.push(record);
  saveWeeklyScores(scores);

  if (_isTrafOnly) {
    const cons = record.consolidatedScore;
    const sl = cons ? ({ green: 'Verde', yellow: 'Amarelo', red: 'Vermelho' }[cons.status] || '') : '';
    showToast(`${cid} · Score ${cons?.score ?? '—'} — ${sl}`);
  } else {
    const sl = { green: 'Verde', yellow: 'Amarelo', red: 'Vermelho' }[result.finalStatus] || '';
    showToast(`${cid} · ${result.totalScore}/${result.maxScore} pts — ${sl}`);
  }
  fecharFechamento();
}

function salvarRascunhoFechamento(cid) {
  const _isTrafOnly = isTrafegoOnly(clientById(cid));
  const weekRef    = _healthWeekRef || getISOWeekRef(new Date());
  const base       = _healthFormDelivery || { postsCompleted: 0, postsExpected: 3 };
  const postsInput = !_isTrafOnly ? parseInt(document.getElementById('hs-posts-completed')?.value ?? base.postsCompleted) : 0;
  const delivery   = { ...base, postsCompleted: isNaN(postsInput) ? base.postsCompleted : postsInput };
  const feedback   = !_isTrafOnly ? (document.getElementById('hs-feedback')?.value || '') : '';
  const recording  = !_isTrafOnly ? (document.getElementById('hs-recording')?.value || 'na') : 'na';

  let errorPts = 0;
  const errorTypes = [];
  if (!_isTrafOnly) {
    document.querySelectorAll('.hs-error-type:checked').forEach(cb => {
      errorPts += parseInt(cb.dataset.pts || 0);
      errorTypes.push(cb.dataset.key);
    });
    document.querySelectorAll('.hs-custom-error-type:checked').forEach(cb => {
      errorPts += parseInt(cb.dataset.pts || 0);
    });
  }

  const record = {
    id:        uid(),
    clientId:  cid,
    weekRef,
    draft:     true,
    createdAt: new Date().toISOString(),
    delivery:  { postsCompleted: delivery.postsCompleted, postsExpected: delivery.postsExpected },
    clientFeedback: { type: feedback, justificativa: (!_isTrafOnly ? document.getElementById('hs-feedback-obs')?.value.trim() : '') || '' },
    revisions: {
      detectedByClickUp: _healthFormRevisions || [],
      manualEntries:     _healthFormManualRevisions || [],
      customTypes:       _healthFormCustomErrorTypes || [],
      errorTypes,
      errorPoints: errorPts,
      status: 'none',
      rejection: _healthFormRejection || 'none'
    },
    recording:   { status: recording },
    trafego: _healthFormTrafego ? (() => {
      const _tr = calculateTrafegoScore(_healthFormTrafego.metaPct);
      return {
        metaPct:      parseFloat(_healthFormTrafego.metaPct) || 0,
        score:        _tr.score,
        status:       _tr.status,
        investimento: _healthFormTrafego.investimento || '',
        leads:        _healthFormTrafego.leads || '',
        vendas:       _healthFormTrafego.vendas || '',
        cpl:          _healthFormTrafego.cpl || '',
        cac:          _healthFormTrafego.cac || '',
        meta:         _healthFormTrafego.meta || ''
      };
    })() : null,
    cx: (_healthFormCX && _healthFormCX.rating) ? (() => {
      const _cr = calculateCXScore(_healthFormCX.rating);
      return { rating: _healthFormCX.rating, score: _cr.score, status: _cr.status };
    })() : null,
    nextActions:        [..._healthFormNextActions],
    prevActionsChecked: [..._healthFormPrevChecked]
  };

  const scores = getWeeklyScores().filter(s => !(s.clientId === cid && s.weekRef === weekRef));
  scores.push(record);
  saveWeeklyScores(scores);
  showToast(`Rascunho de ${cid} salvo!`);
  fecharFechamento();
}

// ── Aba 2: Score de Equipe ────────────────────────────────────────────────────

function _renderHealthEquipe() {
  const period   = _healthPeriod;
  const team     = getTeam();
  const tasks    = getTasks();
  const clients  = getClients();
  const todayStr = today();

  let periodStart = null;
  const now = new Date();
  if (period === '1w') { periodStart = new Date(now); periodStart.setDate(now.getDate() - 7); }
  else if (period === '4w') { periodStart = new Date(now); periodStart.setDate(now.getDate() - 28); }
  else if (period === 'mes') { periodStart = new Date(now.getFullYear(), now.getMonth(), 1); }

  const inPeriod = t => {
    if (!periodStart) return true;
    const d = t.prazo || t.postagem;
    return d && new Date(d + 'T12:00:00') >= periodStart;
  };

  const SC = { healthy: '#22c55e', attention: '#eab308', critical: '#ef4444' };
  const SL = { healthy: 'Saudável', attention: 'Atenção', critical: 'Crítico' };

  let html = `
    <div class="card">
      <div class="flex-between mb-16">
        <div class="section-title mb-0">Score de Equipe</div>
        <div class="filters" style="margin:0">
          <button class="filter-btn${period==='1w' ?' active':''}" onclick="_hsSetPeriod('1w')">Última semana</button>
          <button class="filter-btn${period==='4w' ?' active':''}" onclick="_hsSetPeriod('4w')">Últimas 4 sem.</button>
          <button class="filter-btn${period==='mes'?' active':''}" onclick="_hsSetPeriod('mes')">Este mês</button>
        </div>
      </div>
      <div class="table-wrap"><table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:2px solid var(--border)">
          <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--text3)">Integrante</th>
          <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Feitas</th>
          <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Concluídas</th>
          <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Revisadas</th>
          <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Reprovadas</th>
          <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Atrasadas</th>
          <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Pts erro</th>
          <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Proporção</th>
          <th style="text-align:left;padding:8px 10px;font-size:11px;color:var(--text3)">Clientes</th>
          <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Score</th>
          <th style="text-align:center;padding:8px 10px;font-size:11px;color:var(--text3)">Status</th>
        </tr></thead>
        <tbody>`;

  for (const m of team) {
    const myTasks  = tasks.filter(t => t.responsavel === m.id && t.status !== 'descartado' && inPeriod(t));
    const done     = myTasks.filter(t => ['concluido', 'aprovado'].includes(t.status));
    const revised  = myTasks.filter(t => (t.revisoes || 0) > 0);
    const rejected = myTasks.filter(t => t.status === 'reprovado');
    const delayed  = myTasks.filter(t => {
      if (t.status === 'descartado') return false;
      if (t.dataConclusao && t.prazo) return t.dataConclusao > t.prazo; // entregue tarde
      if (['concluido', 'aprovado'].includes(t.status)) return false;
      return t.prazo && t.prazo < todayStr;
    });
    const errorPts = revised.reduce((s, t) => s + (t.revisoes || 1), 0);

    // Client breakdown (where member had revisions)
    const byClient = {};
    revised.forEach(t => {
      byClient[t.cliente] = (byClient[t.cliente] || 0) + 1;
    });
    const pills = Object.entries(byClient).map(([cid, cnt]) => {
      const cl = clients.find(x => x.id === cid);
      return cl ? `<span style="background:${cl.cor}22;color:${cl.cor};padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600">${cl.id} ×${cnt}</span>` : '';
    }).join(' ');

    const stats = { total: myTasks.length, completed: done.length, revised: revised.length,
                    rejected: rejected.length, delayed: delayed.length, errorPoints: errorPts };
    const sr    = calculateMemberScore(stats);
    const c     = stats.completed;
    const prop  = c > 0 ? ((errorPts / c) * 100).toFixed(1) + '%' : '—';
    const sc    = SC[sr.status];
    const sl    = SL[sr.status];

    html += `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:10px"><div style="font-weight:600;font-size:13px">${m.nome}</div>
        <div style="font-size:11px;color:var(--text3)">${m.funcao || ''}</div></td>
      <td style="text-align:center;padding:10px;font-size:13px">${stats.total}</td>
      <td style="text-align:center;padding:10px;font-size:13px">${stats.completed}</td>
      <td style="text-align:center;padding:10px;font-size:13px;color:${stats.revised  > 0 ? '#eab308' : 'inherit'}">${stats.revised}</td>
      <td style="text-align:center;padding:10px;font-size:13px;color:${stats.rejected > 0 ? '#ef4444' : 'inherit'}">${stats.rejected}</td>
      <td style="text-align:center;padding:10px;font-size:13px;color:${stats.delayed  > 0 ? '#f59e0b' : 'inherit'}">${stats.delayed}</td>
      <td style="text-align:center;padding:10px;font-size:13px">${errorPts}</td>
      <td style="text-align:center;padding:10px;font-size:12px">${prop}</td>
      <td style="padding:10px"><div style="display:flex;flex-wrap:wrap;gap:4px">${pills || '<span style="color:var(--text3);font-size:11px">—</span>'}</div></td>
      <td style="text-align:center;padding:10px;font-size:15px;font-weight:800">${sr.scores.total}</td>
      <td style="text-align:center;padding:10px">
        <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:${sc}">
          <span style="width:8px;height:8px;border-radius:50%;background:${sc}"></span>${sl}
        </span>
      </td>
    </tr>`;
  }

  html += `</tbody></table></div></div>`;
  return html;
}
