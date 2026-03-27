// =====================================================
// DASHBOARD
// =====================================================
function renderDashboard() {
  const now = new Date();
  document.getElementById('dash-date').textContent =
    now.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const tasks = getTasks();
  const total = tasks.length;
  const done  = tasks.filter(t => t.status==='concluido'||t.status==='aprovado').length;
  const over  = tasks.filter(t => isOverdue(t.prazo, t.status)).length;
  const inProg= tasks.filter(t => t.status==='em_andamento'||t.status==='revisao').length;
  const avgRev= total ? (tasks.reduce((a,t)=>a+(+t.revisoes||0),0)/total).toFixed(1) : '0.0';

  // Seção HOJE
  const todayTasks   = tasks.filter(t => t.prazo === today() && t.status !== 'concluido' && t.status !== 'aprovado');
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
              <div class="font-bold text-xs" style="color:var(--text)">${t.cliente} — ${tipoLabel(t.tipo)}</div>
              <div class="text-xs" style="color:var(--red)">${dias > 0 ? dias + 'd atrasado' : 'vence hoje'} · ${memberName(t.responsavel)}</div>
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
              <div class="font-bold text-xs" style="color:var(--text)">${t.cliente} — ${tipoLabel(t.tipo)}</div>
              <div class="text-xs text-faint">postagem: ${fmtDate(t.postagem)} · ${memberName(t.responsavel)}</div>
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
      `<span class="tag tag-clickup">ClickUp</span> Última sync: ${dt} · ${sync.count} tarefas`;
  }

  // Client status
  const clients = getClients();
  let chtml = '';
  for (const c of clients) {
    const ct = tasks.filter(t => t.cliente===c.id);
    const cd = ct.filter(t => t.status==='concluido'||t.status==='aprovado').length;
    const co = ct.filter(t => isOverdue(t.prazo, t.status)).length;
    const pct = ct.length ? Math.round(cd/ct.length*100) : 0;
    const health = co>0 ? 'red' : pct>=80 ? 'green' : 'yellow';
    chtml += `<div class="card mb-8" style="padding:12px 16px;cursor:pointer" onclick="setPage('clientes')">
      <div class="flex-between mb-8">
        <div class="flex-center gap-8">
          <span style="width:8px;height:8px;border-radius:50%;background:${c.cor};display:inline-block;flex-shrink:0"></span>
          <span class="font-bold">${c.nome}</span>
          <span class="text-xs text-faint">${c.nicho}</span>
        </div>
        <span class="dot dot-${health}"></span>
      </div>
      <div class="flex-between text-xs text-muted mb-4">
        <span>${cd}/${ct.length} concluídas</span>
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
          <span class="font-bold text-sm">${t.cliente} — ${tipoLabel(t.tipo)}${t.subtipo&&t.subtipo!=='geral'?' ('+t.subtipo+')':''}</span>
          ${statusTag(t.status)}
        </div>
        <div class="text-xs text-faint mt-4">Prazo: ${fmtDate(t.prazo)} · ${memberName(t.responsavel)}</div>
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
  const clients = getClients();
  document.getElementById('task-filters').innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%">
      <div class="flex-center gap-4 flex-wrap">
        <span class="text-xs text-faint">Status:</span>
        ${['todos','pendente','em_andamento','revisao','aprovado','concluido','atrasado'].map(s=>
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
        ${['todos','copy','design','video','dark','revisao','postagem','outro'].map(t=>
          `<button class="filter-btn${taskFilters.tipo===t?' active':''}" onclick="setTaskFilter('tipo','${t}')">${t==='todos'?'Todos':tipoLabel(t)}</button>`
        ).join('')}
      </div>
      <div class="flex-center gap-4 flex-wrap">
        <span class="text-xs text-faint">Equipe:</span>
        <button class="filter-btn${taskFilters.responsavel==='todos'?' active':''}" onclick="setTaskFilter('responsavel','todos')">Todos</button>
        ${getTeam().map(m=>`<button class="filter-btn${taskFilters.responsavel===m.id?' active':''}" onclick="setTaskFilter('responsavel','${m.id}')">${m.nome.split(' ')[0]}</button>`).join('')}
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
    s.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) + ' – ' +
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
      }).join('') : '<div class="text-xs text-faint" style="margin-top:8px;text-align:center">—</div>'}
    </div>`;
  }
  document.getElementById('cal-grid').innerHTML = html;

  // Person load
  const team = getTeam();
  let phtml = '';
  for (const m of team) {
    const mt = tasks.filter(t => t.responsavel===m.id && days.includes(t.prazo));
    const ol = mt.length >= 3;
    phtml += `<div class="card mb-8" style="padding:10px 14px">
      <div class="flex-between mb-6">
        <div class="font-bold text-sm">${m.nome} <span class="text-xs text-faint">${m.funcao}</span></div>
        <span class="tag ${ol?'tag-red':'tag-green'}">${mt.length} tarefa${mt.length!==1?'s':''}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(mt.length/5*100,100)}%;background:${ol?'var(--red)':'var(--green)'}"></div></div>
    </div>`;
  }
  document.getElementById('person-load').innerHTML = phtml;

  // Bottlenecks
  const overdueTasks = tasks.filter(t => isOverdue(t.prazo, t.status));
  let bhtml = '';
  if (overdueTasks.length) {
    bhtml += `<div class="alert-row danger mb-8"><div>
      <div class="font-bold text-sm" style="color:var(--red)">⚠ ${overdueTasks.length} tarefa(s) atrasada(s)</div>
      ${overdueTasks.slice(0,3).map(t=>`<div class="text-xs text-muted">${t.cliente} — ${tipoLabel(t.tipo)} (${fmtDate(t.prazo)})</div>`).join('')}
    </div></div>`;
  }
  const olMembers = team.filter(m => tasks.filter(t=>t.responsavel===m.id&&days.includes(t.prazo)).length>=3);
  for (const m of olMembers) {
    bhtml += `<div class="alert-row warn mb-8"><div class="text-sm"><span class="font-bold">${m.nome}</span> — sobrecarga esta semana</div></div>`;
  }
  if (!bhtml) bhtml = '<div class="alert-row success mb-8"><div class="text-sm" style="color:var(--green)">✓ Nenhum gargalo identificado</div></div>';
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
// EQUIPE
// =====================================================
function renderEquipe() {
  const team = getTeam();
  const tasks = getTasks();
  let html = '';
  for (const m of team) {
    const mt   = tasks.filter(t => t.responsavel===m.id);
    const done = mt.filter(t=>t.status==='concluido'||t.status==='aprovado').length;
    const pct  = mt.length ? Math.round(done/mt.length*100) : 0;
    html += `<div class="team-card">
      <div class="flex-center gap-8 mb-8">
        <div class="avatar">${m.nome.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
        <div>
          <div class="font-bold" style="font-size:15px">${m.nome}</div>
          <div class="text-muted text-sm">${m.funcao}</div>
        </div>
      </div>
      <div class="flex-center gap-4 flex-wrap mb-10">
        ${m.clientes.map(cid=>{const c=clientById(cid);return c?`<span class="tag" style="background:${c.cor}22;color:${c.cor}">${c.id}</span>`:''}).join('')}
      </div>
      <div class="flex-between text-xs text-muted mb-4">
        <span>${done}/${mt.length} concluídas</span><span>${pct}%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:var(--accent)"></div></div>
    </div>`;
  }
  document.getElementById('team-grid').innerHTML = html;

  const revData = team.map(m => {
    const mt = tasks.filter(t => t.responsavel===m.id && (+t.revisoes||0)>0);
    const avg = mt.length ? (mt.reduce((a,t)=>a+(+t.revisoes||0),0)/mt.length).toFixed(1) : '0.0';
    return { ...m, avgRev: parseFloat(avg), taskCount: tasks.filter(t=>t.responsavel===m.id).length };
  }).sort((a,b)=>b.avgRev-a.avgRev);

  document.getElementById('revision-table').innerHTML = `<table>
    <thead><tr><th>Membro</th><th>Função</th><th>Tarefas</th><th>Média Rev.</th><th>Status</th></tr></thead>
    <tbody>${revData.map(m=>`<tr>
      <td class="font-bold">${m.nome}</td>
      <td class="text-muted">${m.funcao}</td>
      <td class="text-muted">${m.taskCount}</td>
      <td><span style="color:${m.avgRev>1.5?'var(--red)':m.avgRev>1?'var(--yellow)':'var(--green)'};font-weight:700">${m.avgRev}</span></td>
      <td>${m.avgRev>1.5?'<span class="tag tag-red">Acima da meta</span>':m.avgRev>1?'<span class="tag tag-yellow">Atenção</span>':'<span class="tag tag-green">OK</span>'}</td>
    </tr>`).join('')}</tbody></table>`;

  // Atrasados por pessoa
  const overdueAll = tasks.filter(t => isOverdue(t.prazo, t.status));
  const overdueData = team.map(m => {
    const over = overdueAll.filter(t => t.responsavel === m.id);
    return { ...m, over };
  }).filter(m => m.over.length > 0).sort((a,b) => b.over.length - a.over.length);

  if (!overdueData.length) {
    document.getElementById('overdue-by-person').innerHTML =
      '<div class="alert-row success mb-8"><div class="text-sm" style="color:var(--green)">✓ Nenhum conteúdo atrasado</div></div>';
  } else {
    document.getElementById('overdue-by-person').innerHTML = `<table>
      <thead><tr><th>Membro</th><th>Função</th><th>Atrasados</th><th>Detalhes</th></tr></thead>
      <tbody>${overdueData.map(m => {
        const tags = m.over.map(t => {
          const d = Math.floor((new Date(today()) - new Date(t.prazo)) / 86400000);
          return `<span class="tag tag-red" style="margin:1px;cursor:pointer" onclick="openTaskDetail('${t.id}')" title="${fmtDate(t.prazo)}">${t.cliente} ${tipoLabel(t.tipo)} +${d}d</span>`;
        }).join('');
        return `<tr>
          <td class="font-bold">${m.nome}</td>
          <td class="text-muted">${m.funcao}</td>
          <td><span style="color:var(--red);font-weight:700;font-size:18px">${m.over.length}</span></td>
          <td style="max-width:340px">${tags}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }
}

// =====================================================
// CLIENTES
// =====================================================
function renderClientes() {
  const clients = getClients();
  const tasks   = getTasks();
  let html = '';
  for (const c of clients) {
    const aloc = ALOCACAO[c.id] || {};
    const ct   = tasks.filter(t => t.cliente===c.id);
    const done = ct.filter(t=>t.status==='concluido'||t.status==='aprovado').length;
    const over = ct.filter(t=>isOverdue(t.prazo,t.status)).length;
    html += `<div class="card">
      <div class="flex-between mb-12">
        <div class="flex-center gap-8">
          <span style="width:12px;height:12px;border-radius:50%;background:${c.cor};flex-shrink:0"></span>
          <div>
            <div class="font-bold" style="font-size:16px">${c.nome}</div>
            <div class="text-xs text-faint">${c.nicho} · ${c.id}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="font-bold">${done}/${ct.length}</div>
          <div class="text-xs text-faint">concluídas</div>
        </div>
      </div>
      ${over>0?`<div class="tag tag-red mb-8">⚠ ${over} atrasada(s)</div>`:''}
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
  document.getElementById('clients-grid').innerHTML = html;
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
        ${sync ? `<div class="text-xs text-faint">Última sync: ${new Date(sync.lastSync).toLocaleString('pt-BR')} · ${sync.count} tarefas</div>` : '<div class="text-xs text-faint">Nunca sincronizado</div>'}
        ${connected ? `<div class="text-xs text-faint mt-4">Auto-sync: <span style="color:${autoOn?'var(--green)':'var(--red)'}">
          ${autoOn ? `ativo (a cada ${autoMin} min)` : 'inativo'}</span></div>` : ''}
      </div>
      ${connected ? `
        <div class="flex-center gap-8">
          <button class="btn btn-success btn-sm" id="sync-btn" onclick="doSync()">Sincronizar agora</button>
          ${autoOn
            ? `<button class="btn btn-ghost btn-sm" onclick="cuStopAutoSync();renderIntegracao()">Pausar auto</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="showAutoSyncPicker()">▶ Auto-sync</button>`}
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

  if (sync && sync.errors && sync.errors.length) {
    document.getElementById('int-errors').innerHTML = `<div class="alert-row danger mb-8">
      <div><div class="font-bold text-sm" style="color:var(--red)">Erros na última sync</div>
      ${sync.errors.map(e=>`<div class="text-xs text-muted">${e}</div>`).join('')}</div></div>`;
  }
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
      <span class="mapping-arrow">→</span>
      <select style="flex:1;min-width:120px" id="m-client-${i}">
        <option value="">Selecionar cliente</option>
        ${clients.map(c=>`<option value="${c.id}"${m.clientId===c.id?' selected':''}>${c.nome}</option>`).join('')}
      </select>
      <input type="text" value="${m.label||''}" placeholder="Rótulo (ex: Produção)" style="flex:1;min-width:100px" id="m-label-${i}">
      <button class="btn btn-danger btn-xs" onclick="removeMapping(${i})">✕</button>
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
    <span class="mapping-arrow">→</span>
    <select style="flex:1;min-width:120px" class="m-client-select">
      <option value="">Selecionar cliente</option>
      ${clients.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('')}
    </select>
    <input type="text" placeholder="Rótulo (ex: Produção)" style="flex:1;min-width:100px" class="m-label-input">
    <button class="btn btn-danger btn-xs" onclick="this.closest('.mapping-row').remove()">✕</button>`;
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
    showToast(ok ? '✓ Conexão bem-sucedida!' : 'Sem workspaces encontrados', !ok);
  } catch(e) {
    showToast('Erro: ' + e.message, true);
  }
}

async function doSync() {
  const btn = document.getElementById('sync-btn');
  if (btn) { btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Sincronizando...'; }
  try {
    const result = await cuSync();
    showToast(`Sync concluído: ${result.count} tarefas importadas`);
  } catch(e) {
    showToast('Erro na sync: ' + e.message, true);
  } finally {
    renderIntegracao();
  }
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
}

function gcGetSelecionados() {
  const ativos = [...document.querySelectorAll('[id^="gc-"].active')].map(el => el.id.replace('gc-',''));
  return ativos.length ? ativos : getClients().map(c => c.id);
}

function _clientFilter() {
  const clients = getClients();
  return `<div class="form-group mt-16">
    <label>Clientes</label>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
      ${clients.map(c => `<button type="button" id="gc-${c.id}" class="filter-btn active"
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
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:760px">
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
        <div class="text-xs text-muted">Crie uma demanda unitária — escolha cliente, tipo e data</div>
      </div>
    </div>`;
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
  const ref = new Date(refDate + 'T12:00:00');
  const dow = ref.getDay();
  const mon = new Date(ref); mon.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  geradorSemanaStart = mon.toISOString().split('T')[0];
  geradorSemanaEnd   = sun.toISOString().split('T')[0];
  document.getElementById('gerador-content').innerHTML = renderGeradorStep2Semana();
}

function renderGeradorStep2Semana() {
  const clients = getClients();
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
    <div class="text-muted text-sm mb-16">Postagens que caem nessa semana por cliente. Desmarque as que não se aplicam.</div>`;

  let temAlgo = false;
  for (const c of clients.filter(c => geradorClientesSel.includes(c.id))) {
    const fluxo = FLUXO_SEMANAL[c.id]; if (!fluxo) continue;
    const pieces = fluxo.pieces.map(p => ({ ...p, datas: getDatesInRange(p.postDow) })).filter(p => p.datas.length);
    if (!pieces.length) continue;
    temAlgo = true;
    html += `<div class="card mb-12" style="border-left:3px solid ${c.cor}">
      <div class="flex-center gap-8 mb-10">
        <span style="width:10px;height:10px;border-radius:50%;background:${c.cor}"></span>
        <span class="font-bold">${c.nome}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:16px">`;
    for (const piece of pieces) {
      html += `<div style="min-width:140px">
        <div class="text-xs text-faint font-bold mb-6">${piece.nome.toUpperCase()}</div>
        ${piece.datas.map((d,i) => `
          <div class="flex-center gap-8 mb-4">
            <input type="checkbox" id="g-${c.id}-${piece.key}-${i}" value="${d}" checked>
            <label for="g-${c.id}-${piece.key}-${i}" class="text-sm" style="cursor:pointer">${fmtDateLong(d)}</label>
          </div>`).join('')}
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
  const clients = getClients();
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
        <button class="btn btn-primary" onclick="geradorPreviewDemanda()">Pré-visualizar →</button>
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
    const resp  = aloc[tarefa.respKey] || aloc.copy;
    geradorPreview.push({ cliente: clienteId, tipo: tarefa.tipo, subtipo: tarefa.subtipo, responsavel: resp, prazo, postagem: dataPost, status: 'pendente',
      ...(piece.descricao ? { descricaoPai: piece.descricao } : {}) });
    if (tarefa.tipo === 'copy' && !['copy-dark','copy-capa','legenda'].includes(tarefa.subtipo)) {
      geradorPreview.push({ cliente: clienteId, tipo: 'copy', subtipo: 'legenda', responsavel: 'isa', prazo, postagem: dataPost, status: 'pendente' });
    }
  }
  document.getElementById('gerador-content').innerHTML = renderGeradorStep3();
}

function geradorVoltar() {
  if (geradorMode === 'semana') renderGeradorStep2Semana();
  else if (geradorMode === 'demanda') renderGeradorModoDemanda();
  else geradorProximo1();
}

function renderGeradorStep1() {
  const now = new Date();
  const mesAtual = now.toISOString().slice(0, 7);
  return `
    <div class="card mb-16" style="max-width:600px">
      <div class="section-title">Etapa 1 — Selecionar Mês</div>
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
  document.getElementById('gerador-content').innerHTML = renderGeradorStep2();
}

function renderGeradorStep2() {
  const [ano, mes] = geradorMes.split('-').map(Number);
  const clients = getClients();

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
    <div class="text-muted text-sm mb-16">Datas conforme Organização Mensal. Desmarque datas que não se aplicam.</div>`;

  for (const c of clients.filter(c => geradorClientesSel.includes(c.id))) {
    const fluxo = FLUXO_SEMANAL[c.id];
    if (!fluxo) continue;
    const vol = VOLUME_SEMANAL[c.id] || { designs: 2, videos: 1, darks: 0 };
    const volLabel = `${vol.designs} designs + 1 vídeo${vol.darks > 0 ? ' + 1 dark' : ''}`;

    html += `<div class="card mb-12" style="border-left:3px solid ${c.cor}">
      <div class="flex-center gap-8 mb-12">
        <span style="width:10px;height:10px;border-radius:50%;background:${c.cor}"></span>
        <span class="font-bold">${c.nome}</span>
        <span class="tag tag-gray text-xs">${volLabel}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:16px">`;

    for (const piece of fluxo.pieces) {
      const datas = getDiasDoMes(piece.postDow);
      html += `<div style="min-width:140px">
        <div class="text-xs text-faint font-bold mb-6">${piece.nome.toUpperCase()}</div>
        ${datas.map((d, i) => `
          <div class="flex-center gap-8 mb-4">
            <input type="checkbox" id="g-${c.id}-${piece.key}-${i}" value="${d}" checked>
            <label for="g-${c.id}-${piece.key}-${i}" class="text-sm" style="cursor:pointer">${fmtDateLong(d)}</label>
          </div>`).join('')}
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
          const resp  = aloc[tarefa.respKey] || aloc.copy;
          geradorPreview.push({
            cliente:     c.id,
            tipo:        tarefa.tipo,
            subtipo:     tarefa.subtipo,
            responsavel: resp,
            prazo,
            postagem:    dataPost,
            status:      'pendente',
            ...(piece.descricao ? { descricaoPai: piece.descricao } : {})
          });
          // Legenda: Isa entrega na mesma data que a copy (exceto dark post, capa e legenda explícita)
          if (tarefa.tipo === 'copy' && !['copy-dark','copy-capa','legenda'].includes(tarefa.subtipo)) {
            geradorPreview.push({
              cliente:     c.id,
              tipo:        'copy',
              subtipo:     'legenda',
              responsavel: 'isa',
              prazo,
              postagem:    dataPost,
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
    <div class="section-title">Etapa 3 — Confirmar e Criar</div>
    <div class="text-muted text-sm mb-16">${geradorPreview.length} tarefas serão criadas para ${clients.length} clientes.</div>`;

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

function geradorConfirmar() {
  const tasks = getTasks();
  const novas = geradorPreview.map(t => ({
    ...t,
    id: uid(),
    obs: '',
    revisoes: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  saveTasks([...tasks, ...novas]);
  showToast(`${novas.length} tarefas criadas com sucesso!`);
  setPage('tarefas');
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
