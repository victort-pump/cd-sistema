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
  const todayTasks   = tasks.filter(t => t.prazo === today() && t.status !== 'concluido' && t.status !== 'aprovado' && t.status !== 'reprovado');
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
  const clients = getClients();
  let chtml = '';
  for (const c of clients) {
    const ct = tasks.filter(t => t.cliente===c.id);
    const cd = ct.filter(t => t.status==='concluido'||t.status==='aprovado'||t.status==='reprovado').length;
    const co = ct.filter(t => isOverdue(t.prazo, t.status)).length;
    const ca = ct.filter(t => t.status==='aprovacao').length;
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
        ${['todos','pendente','em_andamento','revisao','aprovacao','reprovado','descartado','aprovado','concluido','atrasado'].map(s=>
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
      <div class="font-bold text-sm" style="color:var(--red)">? ${overdueTasks.length} tarefa(s) atrasada(s)</div>
      ${overdueTasks.slice(0,3).map(t=>`<div class="text-xs text-muted">${t.cliente} - ${tipoLabel(t.tipo)} (${fmtDate(t.prazo)})</div>`).join('')}
    </div></div>`;
  }
  const olMembers = team.filter(m => tasks.filter(t=>t.responsavel===m.id&&days.includes(t.prazo)).length>=3);
  for (const m of olMembers) {
    bhtml += `<div class="alert-row warn mb-8"><div class="text-sm"><span class="font-bold">${m.nome}</span> - sobrecarga esta semana</div></div>`;
  }
  if (!bhtml) bhtml = '<div class="alert-row success mb-8"><div class="text-sm" style="color:var(--green)">? Nenhum gargalo identificado</div></div>';
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
  const team    = getTeam();
  const tasks   = getTasks();
  const clients = getClients();
  let html = '';
  for (const m of team) {
    const mt   = tasks.filter(t => t.responsavel===m.id);
    const done = mt.filter(t=>t.status==='concluido'||t.status==='aprovado'||t.status==='reprovado').length;
    const pct  = mt.length ? Math.round(done/mt.length*100) : 0;
    const sel = m.clientes || [];
    const dropLbl = sel.length ? `${sel.join(', ')} (${sel.length})` : 'Selecionar clientes';
    const clientCheckboxes = clients.map(c =>
      `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:12px">
        <input type="checkbox" name="cdrop-${m.id}" value="${c.id}" ${sel.includes(c.id)?'checked':''} onchange="_updateClientDropLabel('${m.id}')">
        ${c.nome}
      </label>`
    ).join('');
    html += `<div class="team-card" id="equipe-card-${m.id}">
      <div class="flex-center gap-8 mb-8">
        <div class="avatar">${m.nome.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
        <div style="flex:1;min-width:0">
          <div class="font-bold" style="font-size:15px">${m.nome}</div>
          <select id="eq-funcao-${m.id}"
            style="font-size:12px;padding:3px 7px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;margin-top:2px">
            <option value="Direção Criativa"${m.funcao==='Direção Criativa'?' selected':''}>Direção Criativa</option>
            <option value="Copywriter"${(m.funcao==='Copywriter'||m.funcao==='Copy')?' selected':''}>Copywriter</option>
            <option value="Designer"${(m.funcao==='Designer'||m.funcao==='Design')?' selected':''}>Designer</option>
            <option value="Editor"${(m.funcao==='Editor'||m.funcao==='Edição de Vídeo')?' selected':''}>Editor</option>
            <option value="Tráfego"${m.funcao==='Tráfego'?' selected':''}>Tráfego</option>
          </select>
        </div>
      </div>
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
      <div class="flex-center gap-6" style="justify-content:flex-end">
        <button class="btn btn-ghost btn-xs" style="color:var(--red)" onclick="excluirIntegrante('${m.id}')">Remover</button>
        <button class="btn btn-primary btn-xs" onclick="salvarCardEquipe('${m.id}')">Salvar</button>
      </div>
    </div>`;
  }
  document.getElementById('team-grid').innerHTML = html;

  // Qualidade por pessoa: feitas, concluídas, revisadas, reprovadas, pontos acumulados, proporção
  const qualData = team.map(m => {
    const feitas      = tasks.filter(t => t.responsavel === m.id);
    const concluidas  = feitas.filter(t => t.status === 'concluido' || t.status === 'aprovado');
    const revisadas   = feitas.filter(t => (+t.revisoes||0) > 0);
    const reprovadas  = feitas.filter(t => t.status === 'reprovado');
    // Pontos acumulados: soma dos pontos de motivosRevisao de todas as tarefas revisadas/reprovadas
    const pontosAcum  = feitas.reduce((sum, t) => {
      if (!t.motivosRevisao || !t.motivosRevisao.length) return sum;
      return sum + t.motivosRevisao.reduce((s, id) => {
        const m2 = MOTIVOS_REVISAO.find(x => x.id === id);
        return s + (m2 ? m2.pontos : 0);
      }, 0);
    }, 0);
    // Proporção de qualidade: % de demandas sem revisão dentre as concluídas+reprovadas (terminais)
    const terminais   = concluidas.length + reprovadas.length;
    const semRevisao  = terminais - revisadas.filter(t => t.status === 'concluido' || t.status === 'aprovado' || t.status === 'reprovado').length;
    const proporcao   = terminais > 0 ? Math.round((semRevisao / terminais) * 100) : null;
    return { ...m, feitas: feitas.length, concluidas: concluidas.length, revisadas: revisadas.length, reprovadas: reprovadas.length, pontosAcum, proporcao, terminais };
  }).sort((a, b) => {
    if (a.proporcao === null && b.proporcao === null) return 0;
    if (a.proporcao === null) return 1;
    if (b.proporcao === null) return -1;
    return b.proporcao - a.proporcao; // maior proporção = melhor qualidade
  });

  document.getElementById('revision-table').innerHTML = `<table>
    <thead><tr><th>Membro</th><th>Feitas</th><th>Concluídas</th><th>Revisadas</th><th>Reprovadas</th><th>Pontos acum.</th><th>Proporção</th></tr></thead>
    <tbody>${qualData.map(m => {
      const propColor = m.proporcao === null ? 'var(--text3)' : m.proporcao >= 80 ? 'var(--green)' : m.proporcao >= 60 ? 'var(--yellow)' : 'var(--red)';
      const propTag   = m.proporcao === null ? '<span class="tag">—</span>'
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
        <td><span style="color:${pontosColor};font-weight:700">${m.pontosAcum}</span></td>
        <td>${propTag}</td>
      </tr>`;
    }).join('')}</tbody></table>`;

  // Atrasados por pessoa
  const overdueAll = tasks.filter(t => isOverdue(t.prazo, t.status));
  const overdueData = team.map(m => {
    const over = overdueAll.filter(t => t.responsavel === m.id);
    return { ...m, over };
  }).filter(m => m.over.length > 0).sort((a,b) => b.over.length - a.over.length);

  if (!overdueData.length) {
    document.getElementById('overdue-by-person').innerHTML =
      '<div class="alert-row success mb-8"><div class="text-sm" style="color:var(--green)">? Nenhum conteúdo atrasado</div></div>';
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

function salvarCardEquipe(id) {
  const team = getTeam();
  const m = team.find(x => x.id === id);
  if (!m) return;
  const funcaoEl = document.getElementById('eq-funcao-' + id);
  if (funcaoEl) m.funcao = funcaoEl.value || m.funcao;
  const boxes = document.querySelectorAll(`input[name="cdrop-${id}"]`);
  if (boxes.length) m.clientes = [...boxes].filter(cb => cb.checked).map(cb => cb.value);
  saveTeam(team);
  renderEquipe();
  showToast('Integrante atualizado!');
}

function excluirIntegrante(id) {
  if (!confirm('Remover este integrante da equipe?')) return;
  saveTeam(getTeam().filter(m => m.id !== id));
  renderEquipe();
  showToast('Integrante removido');
}

function abrirNovoIntegrante() {
  const clients = getClients();
  const niCheckboxes = clients.map(c =>
    `<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:12px">
      <input type="checkbox" name="cdrop-novo" value="${c.id}" onchange="_updateClientDropLabel('novo')">
      ${c.nome}
    </label>`
  ).join('');

  const formHtml = `<div class="team-card" id="equipe-card-novo" style="border:2px dashed var(--accent)">
    <div class="text-sm font-bold mb-10" style="color:var(--accent)">Novo Integrante</div>
    <div class="form-group mb-8">
      <input type="text" id="ni-id" placeholder="ID único (ex: carol)" maxlength="20"
        style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;margin-bottom:6px">
      <input type="text" id="ni-nome" placeholder="Nome completo"
        style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;margin-bottom:6px">
      <select id="ni-funcao"
        style="font-size:12px;padding:5px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;margin-bottom:6px">
        <option value="">Cargo / Função</option>
        <option value="Direção Criativa">Direção Criativa</option>
        <option value="Copywriter">Copywriter</option>
        <option value="Designer">Designer</option>
        <option value="Editor">Editor</option>
        <option value="Tráfego">Tráfego</option>
      </select>
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
  document.getElementById('ni-id').focus();
}

function confirmarNovoIntegrante() {
  const id     = document.getElementById('ni-id').value.trim().toLowerCase().replace(/\s+/g,'_');
  const nome   = document.getElementById('ni-nome').value.trim();
  const funcao = document.getElementById('ni-funcao').value.trim();
  const clientes = [...document.querySelectorAll('input[name="cdrop-novo"]:checked')].map(cb => cb.value);

  if (!id || !nome) { showToast('Preencha ID e nome', true); return; }

  const team = getTeam();
  if (team.find(m => m.id === id)) { showToast('ID já em uso', true); return; }

  team.push({ id, nome, funcao: funcao || 'Designer', clientes });
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
  const clients = getClients();
  const tasks   = getTasks();
  let html = '<div class="grid grid-2 gap-16">';
  for (const c of clients) {
    const aloc = ALOCACAO[c.id] || {};
    const ct   = tasks.filter(t => t.cliente===c.id);
    const done  = ct.filter(t=>t.status==='concluido'||t.status==='aprovado'||t.status==='reprovado').length;
    const over  = ct.filter(t=>isOverdue(t.prazo,t.status)).length;
    const aprov = ct.filter(t=>t.status==='aprovacao').length;
    html += `<div class="card">
      <div class="flex-between mb-12">
        <div class="flex-center gap-8">
          <span style="width:12px;height:12px;border-radius:50%;background:${c.cor};flex-shrink:0"></span>
          <div>
            <div class="font-bold" style="font-size:16px">${c.nome}</div>
            <div class="text-xs text-faint">${c.nicho} → ${c.id}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="font-bold">${done}/${ct.length}</div>
          <div class="text-xs text-faint">concluídas</div>
        </div>
      </div>
      <div class="flex-center gap-8 mb-8" style="flex-wrap:wrap">
        ${over>0?`<span class="tag tag-red">⚠ ${over} atrasada(s)</span>`:''}
        ${aprov>0?`<span class="tag tag-purple">⏳ ${aprov} aguard. aprovação</span>`:''}
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
  document.getElementById('clientes-tab').innerHTML = html;
}

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
  const offset = _clampNoWeekend(piece.postDow, rawVal);
  tarefa.offset = offset;

  if (tarefa.tipo === 'copy') {
    // Sync all copy tasks to same offset
    piece.tarefas.forEach(t => { if (t.tipo === 'copy') t.offset = offset; });
    // Design follows: copy + 3 days (design is 3 days closer to publication)
    const designOffset = _clampNoWeekend(piece.postDow, offset + 3);
    piece.tarefas.forEach(t => { if (t.tipo === 'design') t.offset = designOffset; });
  } else if (tarefa.tipo === 'design') {
    // Sync all design tasks to same offset
    piece.tarefas.forEach(t => { if (t.tipo === 'design') t.offset = offset; });
    // Copy follows: design - 3 days (copy is 3 days earlier)
    const copyOffset = _clampNoWeekend(piece.postDow, offset - 3);
    piece.tarefas.forEach(t => { if (t.tipo === 'copy') t.offset = copyOffset; });
  }

  FLUXO_SEMANAL[cid] = f;
  renderFluxoClienteForm();
}
const _TIPOS_TAREFA = ['copy','design','edicao','dark','relatorio','revisao','outro'];

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
          <th style="width:140px">Offset (dias)</th>
          <th style="width:36px"></th>
        </tr></thead>
        <tbody id="fluxo-subs-${pi}">`;

    piece.tarefas.forEach((t, ti) => {
      const subOpts = (_SUBTIPOS[t.tipo] || ['outro']).map(s =>
        `<option value="${s}"${s===(t.subtipo||'')?' selected':''}>${s}</option>`
      ).join('');
      const safeOffset = _clampNoWeekend(piece.postDow, t.offset || 0);
      const dayLabel   = _DIAS_FULL[((piece.postDow + safeOffset) % 7 + 7) % 7];
      html += `<tr>
        <td><select onchange="fluxoUpdateTarefa('${clienteId}',${pi},${ti},'tipo',this.value);fluxoUpdateOffset('${clienteId}',${pi},${ti},_defaultOffset(this.value))" style="width:90px">
          ${_TIPOS_TAREFA.map(tp=>`<option value="${tp}"${tp===t.tipo?' selected':''}>${tp}</option>`).join('')}
        </select></td>
        <td><select onchange="fluxoUpdateTarefa('${clienteId}',${pi},${ti},'subtipo',this.value)" style="width:100%">
          ${subOpts}
        </select></td>
        <td><select onchange="fluxoUpdateTarefa('${clienteId}',${pi},${ti},'respKey',this.value)" style="width:130px">
          ${respKeys.map(k=>`<option value="${k}"${k===t.respKey?' selected':''}>${papelLabel(k)}</option>`).join('')}
        </select></td>
        <td style="white-space:nowrap">
          <input type="number" value="${safeOffset}" min="-30" max="0"
            onchange="fluxoUpdateOffset('${clienteId}',${pi},${ti},+this.value)"
            oninput="_offsetDayLabel(this,${piece.postDow})"
            style="width:58px;text-align:center">
          <span class="text-xs text-muted" style="margin-left:4px">${dayLabel}</span>
        </td>
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
  } else {
    tarefas = [
      { tipo:'copy',   subtipo:'legenda', respKey:'copy',   offset: co },
      { tipo:'design', subtipo:'design',  respKey:'design', offset: de },
    ];
  }
  f.pieces.push({ nome: tipo==='video'?'Novo Vídeo':'Novo Design', key:'nova-'+(f.pieces.length+1), postDow: dow, tarefas });
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

  if (sync && sync.errors && sync.errors.length) {
    document.getElementById('int-errors').innerHTML = `<div class="alert-row danger mb-8">
      <div><div class="font-bold text-sm" style="color:var(--red)">Erros na Última sync</div>
      ${sync.errors.map(e=>`<div class="text-xs text-muted">${e}</div>`).join('')}</div></div>`;
  }
}

function renderCuMappings() {
  const cfg     = getClickUpCfg();
  const clients = getClients();
  const mappings = cfg.mappings || [];

  let html = `<div class="card mb-16">
    <div class="section-title mb-12">Mapeamento: Lista ClickUp ? Cliente</div>
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
    showToast(ok ? '? Conexão bem-sucedida!' : 'Sem workspaces encontrados', !ok);
  } catch(e) {
    showToast('Erro: ' + e.message, true);
  }
}

async function doSync(global = false) {
  const btnId = global ? 'sync-global-btn' : 'sync-btn';
  const btn = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sincronizando...'; }
  try {
    const fromDateMs = global ? undefined : new Date(today() + 'T00:00:00').getTime();
    const result = await cuSync(fromDateMs);
    const label = global ? 'global' : 'a partir de hoje';
    showToast(`Sync ${label} concluído: ${result.count} tarefas`);
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
        <button class="btn btn-ghost btn-xs" onclick="limparLogCriacao()" title="Limpar histórico">? Limpar</button>
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
    return `<div class="card mb-6" style="padding:10px 14px">
      <div class="flex-between">
        <div class="flex-center gap-6 flex-wrap">
          <span class="tag" style="background:var(--accent)22;color:var(--accent)">${modeLabel(l.mode)}</span>
          ${tags}
          <span class="text-xs text-faint">${l.total} tarefa${l.total!==1?'s':''}</span>
        </div>
        <span class="text-xs text-faint">${dt}</span>
      </div>
    </div>`;
  }).join('');
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
        <button class="btn btn-ghost" onclick="renderGerador()">? Voltar</button>
        <button class="btn btn-primary" onclick="geradorProximo1Semana()">Ver postagens ?</button>
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
    <button class="btn btn-ghost" onclick="renderGeradorModoSemana()">? Voltar</button>
    <button class="btn btn-primary" onclick="geradorProximo2()">Pré-visualizar tarefas ?</button>
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
        <button class="btn btn-ghost" onclick="renderGerador()">? Voltar</button>
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
  if (geradorMode === 'semana') renderGeradorStep2Semana();
  else if (geradorMode === 'demanda') renderGeradorModoDemanda();
  else geradorProximo1();
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
        <button class="btn btn-ghost" onclick="renderGerador()">? Voltar</button>
        <button class="btn btn-primary" onclick="geradorProximo1()">Continuar ?</button>
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
    <div class="section-title">Etapa 2 - Datas de Postagem por Cliente</div>
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
    <button class="btn btn-ghost" onclick="renderGerador()">? Voltar</button>
    <button class="btn btn-primary" onclick="geradorProximo2()">Pré-visualizar tarefas ?</button>
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
          const resp  = aloc[tarefa.respKey] || aloc.copy || 'cd';
          geradorPreview.push({
            cliente:     c.id,
            tipo:        tarefa.tipo,
            subtipo:     tarefa.subtipo,
            responsavel: resp,
            prazo,
            postagem:    dataPost,
            pieceKey:    piece.key,
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
    <button class="btn btn-ghost" onclick="geradorVoltar()">? Voltar</button>
    <button class="btn btn-primary" onclick="geradorConfirmar()">? Criar ${geradorPreview.length} Tarefas</button>
  </div></div>`;
  return html;
}

// ── DUPLICATE DETECTION & REVIEW ─────────────────────────────────────────────
let _revDupes = [];
let _revIdx   = 0;
let _revSkip  = new Set();

function detectarDuplicatas(preview) {
  const tasks = getTasks();
  const dupes = [];
  preview.forEach((p, idx) => {
    const dup = tasks.find(t =>
      t.cliente  === p.cliente  &&
      t.postagem === p.postagem &&
      t.tipo     === p.tipo     &&
      (t.subtipo||'geral') === (p.subtipo||'geral') &&
      t.status !== 'concluido'
    );
    if (dup) dupes.push({ idx, nova: p, existente: dup });
  });
  return dupes;
}

async function geradorConfirmar() {
  const dupes = detectarDuplicatas(geradorPreview);
  if (dupes.length > 0) {
    _revDupes = dupes;
    _revIdx   = 0;
    _revSkip  = new Set();
    _geradorMostrarConflito(dupes);
  } else {
    await _geradorCriarFinal(geradorPreview);
  }
}

function _geradorMostrarConflito(dupes) {
  const clients = getClients();
  const rows = dupes.slice(0, 6).map(d => {
    const c = clients.find(x => x.id === d.nova.cliente);
    return `<div class="alert-row warn text-xs mb-4" style="padding:6px 10px;gap:8px">
      <span style="width:6px;height:6px;border-radius:50%;background:${c?.cor||'#999'};flex-shrink:0;margin-top:1px"></span>
      <span>${c?.nome||d.nova.cliente} - ${tipoLabel(d.nova.tipo)} (${d.nova.subtipo||''}) → postagem ${fmtDate(d.nova.postagem)}</span>
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
            <div class="text-xs text-muted">Itens com status ativo - possível duplicação</div>
          </div>
        </div>
        <div class="mb-14">${rows}${mais}</div>
        <div class="divider mb-14"></div>
        <div class="flex-center gap-10 flex-wrap">
          <button class="btn btn-ghost" onclick="renderGerador()">✗ Não criar</button>
          <button class="btn btn-primary" onclick="_geradorCriarFinal(geradorPreview)">✓ Criar todas assim mesmo</button>
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
    // All reviewed - show summary
    const toCreate = geradorPreview.filter((_, i) => !_revSkip.has(i));
    const puladas  = _revSkip.size;
    document.getElementById('gerador-content').innerHTML = `
      <div style="max-width:520px">
        <div class="card">
          <div class="font-bold mb-10" style="font-size:15px">Revisão concluída</div>
          <div class="text-sm text-muted mb-16">
            <b style="color:var(--text)">${toCreate.length}</b> tarefa${toCreate.length!==1?'s':''} serão criadas
            &nbsp;→&nbsp;
            <b style="color:var(--text)">${puladas}</b> duplicata${puladas!==1?'s':''} pulada${puladas!==1?'s':''}
          </div>
          <div class="flex-center gap-8">
            <button class="btn btn-ghost" onclick="renderGerador()">Cancelar</button>
            <button class="btn btn-primary" onclick="_geradorCriarFinalRevisado()">
              ? Criar ${toCreate.length} tarefa${toCreate.length!==1?'s':''}
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
        <button class="btn btn-ghost" style="flex:1" onclick="_revPular()">? Pular - não criar</button>
        <button class="btn btn-primary" style="flex:1" onclick="_revCriar()">? Criar mesmo assim ?</button>
      </div>
    </div>`;
}

function _revPular() { _revSkip.add(_revDupes[_revIdx].idx); _revIdx++; _geradorMostrarRevItem(); }
function _revCriar() { _revIdx++; _geradorMostrarRevItem(); }

async function _geradorCriarFinalRevisado() {
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
    tasks:     preview.map(t => ({ cliente: t.cliente, tipo: t.tipo, subtipo: t.subtipo, postagem: t.postagem, prazo: t.prazo, responsavel: t.responsavel, nome: t.nome||'' }))
  });

  showToast('Criando no ClickUp...');
  let ok = 0, errs = 0;
  try {
    ({ ok, errs } = await cuCriarDemandas(preview));
  } catch(e) {
    console.error('cuCriarDemandas falhou:', e);
    errs = 1;
  }

  if (errs === 0)
    showToast(`${novas.length} tarefas salvas → ${ok} demandas criadas no ClickUp ?`);
  else if (ok > 0)
    showToast(`Salvo localmente → ClickUp: ${ok} ok, ${errs} com erro`, false);
  else
    showToast(`Salvo localmente → Falha no ClickUp (${errs} erro${errs>1?'s':''})`, true);

  renderGerador();
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
