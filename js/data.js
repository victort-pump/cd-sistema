// =====================================================
// CONSTANTS
// =====================================================
const CLIENTES_DEFAULT = [
  { id: 'AI', nome: 'Arquitetura Ideal',    nicho: 'Arquitetura', cor: '#7c6af7' },
  { id: 'AS', nome: 'Atenua Som',           nicho: 'Acústica',    cor: '#22c55e' },
  { id: 'MP', nome: 'Mini Panda',           nicho: 'Geral',       cor: '#f97316' },
  { id: 'TM', nome: 'T&M',                 nicho: 'Negócios',    cor: '#3b82f6' },
  { id: 'WG', nome: 'Wagner',               nicho: 'Geral',       cor: '#eab308' },
  { id: 'PL', nome: 'Prospere Lingerie',    nicho: 'Moda',        cor: '#ec4899' },
  { id: 'DL', nome: 'Depósito da Lingerie', nicho: 'Moda',        cor: '#06b6d4' },
  { id: 'MN', nome: 'Manobox',              nicho: 'Geral',       cor: '#a855f7' }
];

const EQUIPE_DEFAULT = [
  { id: 'cd',      nome: 'Victor Turati', funcao: 'Diretor Criativo',        clientes: ['AI','AS','MP','TM','WG','PL','DL','MN'] },
  { id: 'isa',     nome: 'Isa Caruso',    funcao: 'Copywriter',              clientes: ['AI','TM','AS','MP','WG','PL','DL','MN'] },
  { id: 'fernanda',nome: 'Fernanda Naya', funcao: 'Designer',                clientes: ['AI','AS','MP'] },
  { id: 'ana',     nome: 'Ana',           funcao: 'Designer',                clientes: ['DL','MN'] },
  { id: 'luis',    nome: 'Luís Lobão',    funcao: 'Editor',                  clientes: ['AI','TM','WG','PL'] },
  { id: 'yasmin',  nome: 'Yasmin',        funcao: 'Editor',                  clientes: ['AS','MP','DL','MN'] },
  { id: 'dai',     nome: 'Dai',           funcao: 'Tráfego',                 clientes: ['AI','AS','MP','TM','WG','PL','DL','MN'] },
  { id: 'thais',   nome: 'Thais',         funcao: 'Tráfego',                 clientes: ['AI','AS','MP','TM','WG','PL','DL','MN'] },
  { id: 'pedro',   nome: 'Pedro Victor',  funcao: 'Designer',                clientes: ['TM','WG'] },
  { id: 'maruju',  nome: 'Ana Maruju',    funcao: 'Designer',                clientes: ['PL'] }
];

const ALOCACAO = {
  AI: { pai: 'isa', copy: 'isa',                    revisao: 'cd', design: 'fernanda', edicao: 'luis',   trafego: ['dai','thais'] },
  AS: { pai: 'cd', copy: 'isa',                    revisao: 'cd', design: 'fernanda', edicao: 'yasmin', trafego: ['dai','thais'] },
  MP: { pai: 'cd', copy: 'cd',  assistCopy: 'isa', revisao: 'cd', design: 'fernanda', edicao: 'yasmin', trafego: ['dai','thais'], designDark: 'fernanda', relatorioResp: 'isa' },
  TM: { pai: 'cd', copy: 'isa',                    revisao: 'cd', design: 'pedro',    edicao: 'luis',   trafego: ['dai','thais'] },
  WG: { pai: 'cd', copy: 'cd',  assistCopy: 'isa', revisao: 'cd', design: 'pedro',    edicao: 'luis',   trafego: ['dai','thais'] },
  PL: { pai: 'cd', copy: 'cd',  assistCopy: 'isa', revisao: 'cd', design: 'maruju',   edicao: 'luis',   trafego: ['dai','thais'] },
  DL: { pai: 'isa', copy: 'isa',                    revisao: 'cd', design: 'ana',      edicao: 'yasmin', trafego: ['dai','thais'] },
  MN: { pai: 'isa', copy: 'isa',                    revisao: 'cd', design: 'ana',      edicao: 'yasmin', trafego: ['dai','thais'] }
};

const VOLUME_SEMANAL = {
  AI: { designs: 2, videos: 1, darks: 0 },
  AS: { designs: 2, videos: 1, darks: 0 },
  MP: { designs: 2, videos: 1, darks: 1 },
  TM: { designs: 2, videos: 1, darks: 0 },
  WG: { designs: 2, videos: 1, darks: 0 },
  PL: { designs: 2, videos: 1, darks: 0 },
  DL: { designs: 2, videos: 1, darks: 0 },
  MN: { designs: 2, videos: 1, darks: 0 }
};

// Dias de postagem e subtarefas por cliente - conforme Organização Mensal
// postDow: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
// offset: dias a subtrair da data de postagem para o prazo de cada subtarefa
const FLUXO_SEMANAL = {
  PL: { pieces: [
    { nome: 'Design 1', key: 'feed1', postDow: 3, tarefas: [
      { tipo: 'copy',   subtipo: 'feed1',     respKey: 'copy',   offset: -7 },
      { tipo: 'design', subtipo: 'feed1',     respKey: 'design', offset: -7 }
    ]},
    { nome: 'Design 2', key: 'feed2', postDow: 5, tarefas: [
      { tipo: 'copy',   subtipo: 'feed2',     respKey: 'copy',   offset: -7 },
      { tipo: 'design', subtipo: 'feed2',     respKey: 'design', offset: -7 }
    ]},
    { nome: 'Vídeo', key: 'video', postDow: 2, tarefas: [
      { tipo: 'copy',   subtipo: 'copy-capa', respKey: 'copy',   offset: -7 },
      { tipo: 'copy',   subtipo: 'legenda',   respKey: 'copy',   offset: -7 },
      { tipo: 'video',  subtipo: 'reels',     respKey: 'edicao', offset: -7 },
      { tipo: 'design', subtipo: 'capa-video',respKey: 'design', offset: -7 }
    ]}
  ]},
  AI: { pieces: [
    { nome: 'Design 1', key: 'feed1', postDow: 2, tarefas: [
      { tipo: 'copy',   subtipo: 'feed1', respKey: 'copy',   offset: -7 },
      { tipo: 'design', subtipo: 'feed1', respKey: 'design', offset: -7 }
    ]},
    { nome: 'Design 2', key: 'feed2', postDow: 5, tarefas: [
      { tipo: 'copy',   subtipo: 'feed2', respKey: 'copy',   offset: -7 },
      { tipo: 'design', subtipo: 'feed2', respKey: 'design', offset: -7 }
    ]},
    { nome: 'Vídeo', key: 'video', postDow: 3, tarefas: [
      { tipo: 'copy',   subtipo: 'copy-capa', respKey: 'copy',   offset: -7 },
      { tipo: 'copy',   subtipo: 'legenda',   respKey: 'copy',   offset: -7 },
      { tipo: 'video',  subtipo: 'reels',     respKey: 'edicao', offset: -7 },
      { tipo: 'design', subtipo: 'capa-video',respKey: 'design', offset: -7 }
    ]}
  ]},
  AS: { pieces: [
    { nome: 'Design 1', key: 'feed1', postDow: 3, tarefas: [
      { tipo: 'copy',    subtipo: 'feed1', respKey: 'copy',   offset: -7 },
      { tipo: 'revisao', subtipo: 'feed1', respKey: 'revisao',offset: -7 },
      { tipo: 'design',  subtipo: 'feed1', respKey: 'design', offset: -7 }
    ]},
    { nome: 'Design 2', key: 'feed2', postDow: 4, tarefas: [
      { tipo: 'copy',    subtipo: 'feed2', respKey: 'copy',   offset: -7 },
      { tipo: 'revisao', subtipo: 'feed2', respKey: 'revisao',offset: -7 },
      { tipo: 'design',  subtipo: 'feed2', respKey: 'design', offset: -7 }
    ]},
    { nome: 'Vídeo', key: 'video', postDow: 5, tarefas: [
      { tipo: 'copy',   subtipo: 'copy-capa', respKey: 'copy',   offset: -7 },
      { tipo: 'copy',   subtipo: 'legenda',   respKey: 'copy',   offset: -7 },
      { tipo: 'video',  subtipo: 'reels',     respKey: 'edicao', offset: -7 },
      { tipo: 'design', subtipo: 'capa-video',respKey: 'design', offset: -7 }
    ]}
  ]},
  MP: { pieces: [
    { nome: 'Design 1', key: 'feed1', postDow: 5, tarefas: [
      { tipo: 'copy',    subtipo: 'feed1', respKey: 'copy',   offset: -8 },
      { tipo: 'revisao', subtipo: 'feed1', respKey: 'revisao',offset: -7 },
      { tipo: 'design',  subtipo: 'feed1', respKey: 'design', offset: -7 }
    ]},
    { nome: 'Design 2', key: 'feed2', postDow: 4, tarefas: [
      { tipo: 'copy',   subtipo: 'feed2', respKey: 'copy',   offset: -7 },
      { tipo: 'design', subtipo: 'feed2', respKey: 'design', offset: -7 }
    ]},
    { nome: 'Vídeo', key: 'video', postDow: 3, tarefas: [
      { tipo: 'copy',   subtipo: 'copy-capa', respKey: 'copy',   offset: -7 },
      { tipo: 'copy',   subtipo: 'legenda',   respKey: 'copy',   offset: -7 },
      { tipo: 'video',  subtipo: 'reels',     respKey: 'edicao', offset: -7 },
      { tipo: 'design', subtipo: 'capa-video',respKey: 'design', offset: -7 }
    ]},
    { nome: 'Dark Post', key: 'dark', postDow: 4, tarefas: [
      { tipo: 'dark', subtipo: 'copy-dark',   respKey: 'copyDark',   offset: -7 },
      { tipo: 'dark', subtipo: 'design-dark', respKey: 'designDark', offset: -7 }
    ]},
    { nome: 'Relatório Semanal', key: 'relatorio', postDow: 5,
      descricao: 'Revisar duas vezes a conta da Mini Panda para verificar os comentários, seja para criar um conteúdo em cima quanto para conferir comentários negativos ou problemas para resolver',
      tarefas: [
        { tipo: 'relatorio', subtipo: 'revisao-ter', respKey: 'relatorioResp', offset: -3 },
        { tipo: 'relatorio', subtipo: 'revisao-qui', respKey: 'relatorioResp', offset: -1 }
      ]
    }
  ]},
  TM: { pieces: [
    { nome: 'Design 1', key: 'feed1', postDow: 1, tarefas: [
      { tipo: 'copy',    subtipo: 'feed1', respKey: 'copy',   offset: -7 },
      { tipo: 'revisao', subtipo: 'feed1', respKey: 'revisao',offset: -7 },
      { tipo: 'design',  subtipo: 'feed1', respKey: 'design', offset: -7 }
    ]},
    { nome: 'Design 2', key: 'feed2', postDow: 3, tarefas: [
      { tipo: 'copy',    subtipo: 'feed2', respKey: 'copy',   offset: -7 },
      { tipo: 'revisao', subtipo: 'feed2', respKey: 'revisao',offset: -7 },
      { tipo: 'design',  subtipo: 'feed2', respKey: 'design', offset: -7 }
    ]},
    { nome: 'Vídeo', key: 'video', postDow: 2, tarefas: [
      { tipo: 'copy',   subtipo: 'copy-capa', respKey: 'copy',   offset: -7 },
      { tipo: 'copy',   subtipo: 'legenda',   respKey: 'copy',   offset: -7 },
      { tipo: 'video',  subtipo: 'reels',     respKey: 'edicao', offset: -7 },
      { tipo: 'design', subtipo: 'capa-video',respKey: 'design', offset: -7 }
    ]}
  ]},
  WG: { pieces: [
    { nome: 'Design 1', key: 'feed1', postDow: 1, tarefas: [
      { tipo: 'copy',    subtipo: 'feed1', respKey: 'copy',   offset: -7 },
      { tipo: 'revisao', subtipo: 'feed1', respKey: 'revisao',offset: -7 },
      { tipo: 'design',  subtipo: 'feed1', respKey: 'design', offset: -7 }
    ]},
    { nome: 'Design 2', key: 'feed2', postDow: 5, tarefas: [
      { tipo: 'copy',    subtipo: 'feed2', respKey: 'copy',   offset: -9 },
      { tipo: 'revisao', subtipo: 'feed2', respKey: 'revisao',offset: -8 },
      { tipo: 'design',  subtipo: 'feed2', respKey: 'design', offset: -7 }
    ]},
    { nome: 'Vídeo', key: 'video', postDow: 2, tarefas: [
      { tipo: 'copy',   subtipo: 'copy-capa', respKey: 'copy',   offset: -7 },
      { tipo: 'copy',   subtipo: 'legenda',   respKey: 'copy',   offset: -7 },
      { tipo: 'video',  subtipo: 'reels',     respKey: 'edicao', offset: -7 },
      { tipo: 'design', subtipo: 'capa-video',respKey: 'design', offset: -7 }
    ]}
  ]},
  DL: { pieces: [
    { nome: 'Design 1', key: 'feed1', postDow: 1, tarefas: [
      { tipo: 'copy',   subtipo: 'feed1',     respKey: 'copy',   offset: -7 },
      { tipo: 'design', subtipo: 'feed1',     respKey: 'design', offset: -7 }
    ]},
    { nome: 'Design 2', key: 'feed2', postDow: 2, tarefas: [
      { tipo: 'copy',   subtipo: 'feed2',     respKey: 'copy',   offset: -7 },
      { tipo: 'design', subtipo: 'feed2',     respKey: 'design', offset: -7 }
    ]},
    { nome: 'Vídeo', key: 'video', postDow: 5, tarefas: [
      { tipo: 'copy',   subtipo: 'copy-capa',  respKey: 'copy',   offset: -7 },
      { tipo: 'copy',   subtipo: 'legenda',    respKey: 'copy',   offset: -7 },
      { tipo: 'video',  subtipo: 'reels',      respKey: 'edicao', offset: -7 },
      { tipo: 'design', subtipo: 'capa-video', respKey: 'design', offset: -7 }
    ]}
  ]},
  MN: { pieces: [
    { nome: 'Design 1', key: 'feed1', postDow: 1, tarefas: [
      { tipo: 'copy',   subtipo: 'feed1',     respKey: 'copy',   offset: -7 },
      { tipo: 'design', subtipo: 'feed1',     respKey: 'design', offset: -7 }
    ]},
    { nome: 'Design 2', key: 'feed2', postDow: 5, tarefas: [
      { tipo: 'copy',   subtipo: 'feed2',     respKey: 'copy',   offset: -7 },
      { tipo: 'design', subtipo: 'feed2',     respKey: 'design', offset: -7 }
    ]},
    { nome: 'Vídeo', key: 'video', postDow: 3, tarefas: [
      { tipo: 'copy',   subtipo: 'copy-capa',  respKey: 'copy',   offset: -7 },
      { tipo: 'copy',   subtipo: 'legenda',    respKey: 'copy',   offset: -7 },
      { tipo: 'video',  subtipo: 'reels',      respKey: 'edicao', offset: -7 },
      { tipo: 'design', subtipo: 'capa-video', respKey: 'design', offset: -7 }
    ]}
  ]}
};

// SEMANA IDEAL - com reuniões fixas e bloqueios reais
// Segunda: 09h-12h BLOQUEADO (Abertura de semana + Direção Criativa)
// Quarta: SAÍDA FIXA ÀS 17H - sem tarefas após esse horário
// Sexta: 17h → fechamento, NÃO → produção
const SEMANA_IDEAL = {
  'Segunda': [
    { time:'09:00-12:00', label:'Abertura de Semana',    detalhe:'Pendências, urgências + Direção Criativa - BLOQUEADO para produção', tipo:'bloqueado' },
    { time:'12:00-13:00', label:'Almoço',                detalhe:'Pausa obrigatória', tipo:'buffer' },
    { time:'14:00-16:30', label:'Copy Feed 1',           detalhe:'AS, MP, WG, PL - foco total, sem interrupções', tipo:'criativo' },
    { time:'16:30-17:30', label:'Direção criativa',      detalhe:'Briefing de design/vídeo para a semana', tipo:'gestao' },
    { time:'17:30-18:00', label:'Buffer / Fechamento',   detalhe:'Organizar amanhã, anotar pendências', tipo:'buffer' }
  ],
  'Terça': [
    { time:'08:00-09:00', label:'Abertura',              detalhe:'Check-in equipe, verificar entregas de design', tipo:'gestao' },
    { time:'09:00-11:00', label:'Revisão Copy Feed 1',   detalhe:'Revisar e aprovar copies feitas na segunda', tipo:'revisao' },
    { time:'11:00-12:00', label:'Atendimento clientes',  detalhe:'Calls, alinhamentos, aprovações pendentes', tipo:'clientes' },
    { time:'14:00-15:30', label:'Copy Feed 2 (início)',  detalhe:'Iniciar copy dos feeds da segunda leva', tipo:'criativo' },
    { time:'15:30-17:00', label:'Direção criativa',      detalhe:'Feedback de vídeos em produção', tipo:'gestao' },
    { time:'17:00-18:00', label:'Buffer',                detalhe:'Margem para imprevistos e follow-ups', tipo:'buffer' }
  ],
  'Quarta': [
    { time:'08:00-09:00', label:'Abertura',              detalhe:'Verificar postagens do dia, aprovar se necessário', tipo:'gestao' },
    { time:'09:00-11:30', label:'Copy Feed 2 (finalização)', detalhe:'Finalizar copies e enviar para revisão', tipo:'criativo' },
    { time:'11:30-12:00', label:'Gestão de processos',   detalhe:'Status, gargalos, atualizações', tipo:'gestao' },
    { time:'14:00-15:30', label:'Bloco criativo livre',  detalhe:'Roteiros, ideias para reels, pauta', tipo:'criativo' },
    { time:'15:30-16:30', label:'Atendimento clientes',  detalhe:'Reuniões de alinhamento', tipo:'clientes' },
    { time:'16:30-17:00', label:'Saída fixa - 17h',      detalhe:'Encerramento obrigatório - SEM tarefas após 17h', tipo:'bloqueado' }
  ],
  'Quinta': [
    { time:'08:00-09:00', label:'Abertura',              detalhe:'Receber entregas finais de design e vídeo', tipo:'gestao' },
    { time:'09:00-11:00', label:'Revisão Copy Feed 2',   detalhe:'Revisão final antes da postagem', tipo:'revisao' },
    { time:'11:00-12:00', label:'Aprovação de vídeos',   detalhe:'Feedback final ou aprovar vídeos da semana', tipo:'revisao' },
    { time:'14:00-16:00', label:'Planejamento semana',   detalhe:'Briefings, pautas, cronograma', tipo:'gestao' },
    { time:'16:00-17:30', label:'Atendimento e alinhamentos', detalhe:'Calls com clientes ou equipe', tipo:'clientes' },
    { time:'17:30-18:00', label:'Buffer',                detalhe:'Margem e fechamento', tipo:'buffer' }
  ],
  'Sexta': [
    { time:'08:00-09:30', label:'Review semanal',        detalhe:'Entregas, pendências, retrospectiva', tipo:'gestao' },
    { time:'09:30-11:00', label:'Planejamento e pauta',  detalhe:'Pautar conteúdo da próxima semana', tipo:'criativo' },
    { time:'11:00-12:00', label:'Desenvolvimento equipe',detalhe:'Feedback, alinhamento, processos internos', tipo:'clientes' },
    { time:'14:00-16:00', label:'Estratégia e crescimento', detalhe:'Novos clientes, propostas, processos', tipo:'criativo' },
    { time:'16:00-17:00', label:'Buffer estratégico',    detalhe:'Margem para o que não coube na semana', tipo:'buffer' },
    { time:'17:00-18:00', label:'Fechamento de semana',  detalhe:'Encerramento - NÃO → bloco de produção', tipo:'bloqueado' }
  ]
};

const CHECKLIST_ITEMS = [
  { id:'c1',  momento:'☀ Abertura (8:00-8:30)',     texto:'Revisar tarefas prioritárias do dia' },
  { id:'c2',  momento:'☀ Abertura (8:00-8:30)',     texto:'Checar mensagens urgentes (máx. 15min)' },
  { id:'c3',  momento:'☀ Abertura (8:00-8:30)',     texto:'Confirmar entregas esperadas hoje' },
  { id:'c4',  momento:'✍ Bloco Criativo',           texto:'Fechar comunicação (foco total)' },
  { id:'c5',  momento:'✍ Bloco Criativo',           texto:'Escrever copies/roteiros do bloco' },
  { id:'c6',  momento:'✍ Bloco Criativo',           texto:'Documentar referências e insights' },
  { id:'c7',  momento:'📋 Gestão / Direção',        texto:'Verificar status de design e vídeo' },
  { id:'c8',  momento:'📋 Gestão / Direção',        texto:'Dar feedbacks pendentes à equipe' },
  { id:'c9',  momento:'📋 Gestão / Direção',        texto:'Atualizar status das tarefas no sistema' },
  { id:'c10', momento:'📋 Gestão / Direção',        texto:'Responder clientes (janela dedicada)' },
  { id:'c11', momento:'🌅 Pós-almoço',              texto:'Revisar copies/peças entregues' },
  { id:'c12', momento:'🌅 Pós-almoço',              texto:'Aprovar ou dar retorno de revisão' },
  { id:'c13', momento:'🌅 Pós-almoço',              texto:'Calls e reuniões agendadas' },
  { id:'c14', momento:'🌅 Pós-almoço',              texto:'Checar postagens do dia (ok ou ajuste)' },
  { id:'c15', momento:'🔒 Fechamento (17:30-18:00)',texto:'Registrar o que foi entregue hoje' },
  { id:'c16', momento:'🔒 Fechamento (17:30-18:00)',texto:'Anotar pendências para amanhã' },
  { id:'c17', momento:'🔒 Fechamento (17:30-18:00)',texto:'Preparar briefings necessários' },
  { id:'c18', momento:'🔒 Fechamento (17:30-18:00)',texto:'Fechar o dia com mente limpa' }
];

const MOTIVOS_REVISAO = [
  { id: 'ortografia',    label: 'Erro de ortografia',                        pontos: 1 },
  { id: 'direcao',       label: 'Alteração de direcionamento de conteúdo',   pontos: 2 },
  { id: 'video',         label: 'Alteração de vídeo',                        pontos: 1 },
  { id: 'design',        label: 'Alteração de design',                       pontos: 1 },
  { id: 'timing',        label: 'Perda de timing',                            pontos: 3 }
];

const REGRAS = [
  { titulo:'Separação de contexto',          desc:'Copy e gestão nunca no mesmo bloco. Cada papel tem seu horário.' },
  { titulo:'Antecedência de 1 semana',        desc:'Toda entrega é feita 7 dias antes da data de postagem. Sem exceção.' },
  { titulo:'Revisões máximas: 1.5/tarefa',    desc:'Mais do que isso indica problema de briefing. Revisitar o processo.' },
  { titulo:'Janelas de comunicação',          desc:'Clientes e equipe respondem em horários definidos, não de forma reativa.' },
  { titulo:'Buffer é sagrado',               desc:'30-60min de margem por dia. Não preencher com tarefas. é para imprevistos.' },
  { titulo:'Briefing completo sempre',        desc:'Nenhuma tarefa começa sem briefing claro. Dúvida = bloco de clareza antes.' },
  { titulo:'Feedback descritivo',            desc:'Retorno com referência e motivo. Não apenas "refaz".' },
  { titulo:'Uma rodada de revisão por padrão',desc:'Deixar claro desde o início. Segunda rodada = briefing falhou.' }
];

const REUNIOES_FIXAS = [
  { dia:'Segunda', hora:'09:00-12:00', nome:'Abertura de semana', desc:'Pendências, urgências e novas metas' },
  { dia:'Segunda', hora:'Variável',    nome:'Direção Criativa',   desc:'Receber novas metas (incluso no bloco acima)' },
  { dia:'Quarta',  hora:'17:00',       nome:'Saída fixa',         desc:'Encerramento obrigatório às 17h' },
  { dia:'Sexta',   hora:'17:00-18:00', nome:'Fechamento de semana', desc:'Retrospectiva e preparação para segunda' }
];

// =====================================================
// STORAGE
// =====================================================
function _lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch(e) { console.warn('localStorage parse error ['+key+']:', e); return null; }
}
function getClients()     { return _lsGet('cd_clientes') || CLIENTES_DEFAULT; }
function getTeam()        { return _lsGet('cd_equipe')   || EQUIPE_DEFAULT; }
function getTasks()       { return _lsGet('cd_tasks')    || []; }
function getChecklist()   { return _lsGet('cd_checklist')|| {}; }
function getMetas()       { return _lsGet('cd_metas')    || getDefaultMetas(); }
function getClickUpCfg()  { return _lsGet('cd_clickup')  || { token:'', workspaceId:'', mappings:[] }; }

function saveClients(d)      { localStorage.setItem('cd_clientes',  JSON.stringify(d)); }
function saveTasks(d)        { localStorage.setItem('cd_tasks',     JSON.stringify(d)); }
function saveChecklist(d)    { localStorage.setItem('cd_checklist', JSON.stringify(d)); }
function saveMetas(d)        { localStorage.setItem('cd_metas',     JSON.stringify(d)); }
function saveClickUpCfg(d)   { localStorage.setItem('cd_clickup',   JSON.stringify(d)); }
function saveTeam(d)         { localStorage.setItem('cd_equipe',   JSON.stringify(d)); }
function getLogsCriacao()    { return _lsGet('cd_logs_criacao') || []; }
function salvarLogCriacao(d) {
  const logs = getLogsCriacao();
  logs.unshift(d);
  if (logs.length > 100) logs.length = 100;
  localStorage.setItem('cd_logs_criacao', JSON.stringify(logs));
}
function saveAlocacao(d)     { localStorage.setItem('cd_alocacao',  JSON.stringify(d)); Object.assign(ALOCACAO, d); }
function saveFluxoSemanal(d) { localStorage.setItem('cd_fluxo',     JSON.stringify(d)); Object.assign(FLUXO_SEMANAL, d); }

function clientById(id)   { return getClients().find(c => c.id === id); }
function memberById(id)   { return getTeam().find(m => m.id === id); }

function getDefaultMetas() {
  return [
    { id:'m1', titulo:'Migrar dashboard para o Claude Code', desc:'Transformar os artefatos HTML em aplicação com estrutura de arquivos organizada e persistência de dados', status:'em_andamento' },
    { id:'m2', titulo:'Integração Claude + ClickUp', desc:'Conectar ao ClickUp via API para leitura em tempo real de tarefas, status, responsáveis e prazos', status:'em_andamento' }
  ];
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
