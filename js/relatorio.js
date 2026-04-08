// =====================================================
// RELATÓRIO DE PERFORMANCE — CSV Parsers & Logic
// =====================================================

const MESES_PT = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const PLATAFORMA_CORES = {
  instagram: '#E1306C',
  facebook:  '#1877F2',
  youtube:   '#FF0000',
  tiktok:    '#010101'
};

const PLATAFORMA_ICONS = {
  instagram: '📸',
  facebook:  '📘',
  youtube:   '▶️',
  tiktok:    '🎵'
};

// =====================================================
// SMART FILE READER (UTF-8 / UTF-16LE auto-detection)
// =====================================================
function readCSVFile(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const buf = new Uint8Array(e.target.result);
    // UTF-16LE BOM: FF FE
    if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xFE) {
      const r2 = new FileReader();
      r2.onload = ev => callback(ev.target.result);
      r2.readAsText(file, 'UTF-16LE');
    } else {
      const r2 = new FileReader();
      r2.onload = ev => callback(ev.target.result);
      r2.readAsText(file, 'UTF-8');
    }
  };
  reader.readAsArrayBuffer(file);
}

// =====================================================
// CSV PARSER GENÉRICO (handles quoted fields, multiline)
// =====================================================
function parseCSVText(text) {
  // Remove BOM (byte order mark) if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        current.push(field.trim());
        if (current.some(f => f !== '')) rows.push(current);
        current = [];
        field = '';
        if (ch === '\r') i++;
      } else {
        field += ch;
      }
    }
  }
  // last field
  current.push(field.trim());
  if (current.some(f => f !== '')) rows.push(current);

  return rows;
}

// =====================================================
// DETECÇÃO AUTOMÁTICA DO TIPO DE CSV
// =====================================================
function detectCSVType(headers) {
  const h = headers.map(s => s.toLowerCase());
  const joined = h.join('|');

  // TikTok Overview
  if (h.includes('video views') && h.includes('profile views') && h.includes('date')) {
    return 'tiktok_overview';
  }

  // YouTube — Dados da tabela (per-video summary)
  if (h.includes('título do vídeo') && h.includes('tempo de exibição (horas)') && h.includes('inscritos')) {
    return 'yt_tabela';
  }

  // YouTube — Total.csv (daily channel views, just 2 cols)
  if (h.length === 2 && h.includes('data') && h.includes('visualizações')) {
    return 'yt_total_diario';
  }

  // YouTube — Dados do gráfico (daily per-video)
  if (h.includes('data') && h.includes('conteúdo') && h.includes('título do vídeo')) {
    return 'yt_grafico_diario';
  }

  // Facebook Videos
  if (joined.includes('número de identificação do ativo de vídeo') || joined.includes('identificação do vídeo universal')) {
    return 'fb_videos';
  }

  // Instagram Feed (has "salvamentos")
  if (h.includes('nome de usuário da conta') && h.includes('salvamentos')) {
    return 'ig_feed';
  }

  // Instagram Stories (has "navegação" or "toques em figurinhas")
  if (h.includes('nome de usuário da conta') && (h.includes('navegação') || joined.includes('toques em figurinhas'))) {
    return 'ig_stories';
  }

  // Facebook Page Daily (has "engajamentos de usuário único")
  if (joined.includes('engajamentos de usuário único')) {
    return 'fb_page_daily';
  }

  // Facebook Posts (has "identificação da página" + "tipo de post", no "nome de usuário da conta")
  if (joined.includes('identificação da página') && h.includes('tipo de post') && !h.includes('nome de usuário da conta')) {
    return 'fb_posts';
  }

  return 'unknown';
}

function csvTypeLabel(type) {
  const labels = {
    'tiktok_overview': 'TikTok — Visão Geral',
    'yt_tabela': 'YouTube — Vídeos (Tabela)',
    'yt_total_diario': 'YouTube — Views Diárias',
    'yt_grafico_diario': 'YouTube — Views por Vídeo',
    'fb_videos': 'Facebook — Vídeos',
    'ig_feed': 'Instagram — Feed',
    'ig_stories': 'Instagram — Stories',
    'fb_page_daily': 'Facebook — Página (Diário)',
    'fb_posts': 'Facebook — Posts',
    'ig_insights_alcance': 'Instagram — Alcance (Insights)',
    'ig_insights_visualizacoes': 'Instagram — Visualizações (Insights)',
    'ig_insights_seguidores': 'Instagram — Seguidores (Insights)',
    'ig_insights_visitas': 'Instagram — Visitas ao Perfil (Insights)',
    'ig_insights_interacoes': 'Instagram — Interações (Insights)',
    'ig_insights_cliques_link': 'Instagram — Cliques no Link (Insights)',
    'ig_insights_publico': 'Instagram — Público (Insights)',
    'unknown': 'Tipo não reconhecido'
  };
  return labels[type] || type;
}

function csvTypePlatform(type) {
  if (type.startsWith('ig_')) return 'instagram';
  if (type.startsWith('fb_')) return 'facebook';
  if (type.startsWith('yt_')) return 'youtube';
  if (type.startsWith('tiktok_')) return 'tiktok';
  return 'unknown';
}

// =====================================================
// PARSERS ESPECÍFICOS
// =====================================================

function col(headers, name) {
  const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  return idx;
}

function colIncludes(headers, substr) {
  return headers.findIndex(h => h.toLowerCase().includes(substr.toLowerCase()));
}

function num(val) {
  if (!val || val === '' || val === '-') return 0;
  const n = parseFloat(String(val).replace(/,/g, '.'));
  return isNaN(n) ? 0 : n;
}

// --- IG Feed ---
function parseIGFeed(rows) {
  const headers = rows[0];
  const ci = {
    desc: col(headers, 'Descrição'),
    tipo: col(headers, 'Tipo de post'),
    data: col(headers, 'Data'),
    views: col(headers, 'Visualizações'),
    alcance: col(headers, 'Alcance'),
    curtidas: col(headers, 'Curtidas'),
    compartilhamentos: col(headers, 'Compartilhamentos'),
    seguimentos: col(headers, 'Seguimentos'),
    comentarios: col(headers, 'Comentários'),
    salvamentos: col(headers, 'Salvamentos')
  };

  const posts = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 5) continue;
    posts.push({
      descricao: r[ci.desc] || '',
      tipo: r[ci.tipo] || '',
      data: r[ci.data] || '',
      visualizacoes: num(r[ci.views]),
      alcance: num(r[ci.alcance]),
      curtidas: num(r[ci.curtidas]),
      compartilhamentos: num(r[ci.compartilhamentos]),
      seguimentos: num(r[ci.seguimentos]),
      comentarios: num(r[ci.comentarios]),
      salvamentos: num(r[ci.salvamentos])
    });
  }

  const agg = {
    posts: posts.length,
    visualizacoes: posts.reduce((a, p) => a + p.visualizacoes, 0),
    alcance: posts.reduce((a, p) => a + p.alcance, 0),
    curtidas: posts.reduce((a, p) => a + p.curtidas, 0),
    compartilhamentos: posts.reduce((a, p) => a + p.compartilhamentos, 0),
    seguimentos: posts.reduce((a, p) => a + p.seguimentos, 0),
    comentarios: posts.reduce((a, p) => a + p.comentarios, 0),
    salvamentos: posts.reduce((a, p) => a + p.salvamentos, 0)
  };
  agg.engajamento = agg.curtidas + agg.comentarios + agg.compartilhamentos + agg.salvamentos;

  return { aggregated: agg, posts };
}

// --- IG Stories ---
function parseIGStories(rows) {
  const headers = rows[0];
  const ci = {
    desc: col(headers, 'Descrição'),
    data: col(headers, 'Data'),
    views: col(headers, 'Visualizações'),
    alcance: col(headers, 'Alcance'),
    curtidas: col(headers, 'Curtidas'),
    compartilhamentos: col(headers, 'Compartilhamentos'),
    seguimentos: col(headers, 'Seguimentos'),
    respostas: col(headers, 'Respostas'),
    navegacao: col(headers, 'Navegação'),
    cliquesLink: colIncludes(headers, 'cliques no link'),
    visitasPerfil: colIncludes(headers, 'visitas ao perfil')
  };

  const stories = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 5) continue;
    stories.push({
      descricao: r[ci.desc] || '',
      data: r[ci.data] || '',
      visualizacoes: num(r[ci.views]),
      alcance: num(r[ci.alcance]),
      curtidas: num(r[ci.curtidas]),
      compartilhamentos: num(r[ci.compartilhamentos]),
      seguimentos: num(r[ci.seguimentos]),
      respostas: num(r[ci.respostas]),
      navegacao: num(r[ci.navegacao]),
      cliquesLink: ci.cliquesLink >= 0 ? num(r[ci.cliquesLink]) : 0,
      visitasPerfil: ci.visitasPerfil >= 0 ? num(r[ci.visitasPerfil]) : 0
    });
  }

  const agg = {
    posts: stories.length,
    visualizacoes: stories.reduce((a, p) => a + p.visualizacoes, 0),
    alcance: stories.reduce((a, p) => a + p.alcance, 0),
    curtidas: stories.reduce((a, p) => a + p.curtidas, 0),
    compartilhamentos: stories.reduce((a, p) => a + p.compartilhamentos, 0),
    seguimentos: stories.reduce((a, p) => a + p.seguimentos, 0),
    respostas: stories.reduce((a, p) => a + p.respostas, 0),
    navegacao: stories.reduce((a, p) => a + p.navegacao, 0),
    cliquesLink: stories.reduce((a, p) => a + p.cliquesLink, 0),
    visitasPerfil: stories.reduce((a, p) => a + p.visitasPerfil, 0)
  };

  return { aggregated: agg, posts: stories };
}

// --- FB Page Daily ---
function parseFBPageDaily(rows) {
  const headers = rows[0];
  const ciData = col(headers, 'Data');
  const ciEng = colIncludes(headers, 'engajamentos de usuário único');
  const ciFeedback = colIncludes(headers, 'feedbacks negativos');

  const daily = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 3) continue;
    daily.push({
      data: r[ciData] || '',
      engajamentos: num(r[ciEng]),
      feedbacksNegativos: ciFeedback >= 0 ? num(r[ciFeedback]) : 0
    });
  }

  const agg = {
    totalEngajamentos: daily.reduce((a, d) => a + d.engajamentos, 0),
    feedbacksNegativos: daily.reduce((a, d) => a + d.feedbacksNegativos, 0),
    diasComDados: daily.length,
    mediaEngajamentos: daily.length ? Math.round(daily.reduce((a, d) => a + d.engajamentos, 0) / daily.length) : 0,
    engajamentosDiarios: daily.map(d => d.engajamentos)
  };

  return { aggregated: agg, daily };
}

// --- FB Posts ---
function parseFBPosts(rows) {
  const headers = rows[0];
  const ci = {
    titulo: col(headers, 'Título') >= 0 ? col(headers, 'Título') : colIncludes(headers, 'descrição'),
    desc: colIncludes(headers, 'descrição'),
    tipo: col(headers, 'Tipo de post'),
    data: col(headers, 'Data'),
    views: col(headers, 'Visualizações'),
    alcance: col(headers, 'Alcance'),
    reacoes: col(headers, 'Reações'),
    comentarios: col(headers, 'Comentários'),
    compartilhamentos: col(headers, 'Compartilhamentos'),
    cliques: colIncludes(headers, 'total de cliques')
  };

  const posts = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 5) continue;
    posts.push({
      titulo: r[ci.titulo] || '',
      descricao: r[ci.desc] || '',
      tipo: r[ci.tipo] || '',
      data: r[ci.data] || '',
      visualizacoes: num(r[ci.views]),
      alcance: num(r[ci.alcance]),
      reacoes: num(r[ci.reacoes]),
      comentarios: num(r[ci.comentarios]),
      compartilhamentos: num(r[ci.compartilhamentos]),
      cliques: ci.cliques >= 0 ? num(r[ci.cliques]) : 0
    });
  }

  const agg = {
    posts: posts.length,
    visualizacoes: posts.reduce((a, p) => a + p.visualizacoes, 0),
    alcance: posts.reduce((a, p) => a + p.alcance, 0),
    reacoes: posts.reduce((a, p) => a + p.reacoes, 0),
    comentarios: posts.reduce((a, p) => a + p.comentarios, 0),
    compartilhamentos: posts.reduce((a, p) => a + p.compartilhamentos, 0),
    cliques: posts.reduce((a, p) => a + p.cliques, 0)
  };
  agg.engajamento = agg.reacoes + agg.comentarios + agg.compartilhamentos;

  return { aggregated: agg, posts };
}

// --- FB Videos ---
function parseFBVideos(rows) {
  const headers = rows[0];
  const ci = {
    titulo: col(headers, 'Título') >= 0 ? col(headers, 'Título') : colIncludes(headers, 'nome da página'),
    data: col(headers, 'Data'),
    alcance: col(headers, 'Alcance'),
    views3s: colIncludes(headers, 'visualizações de 3 segundos do vídeo'),
    views1min: colIncludes(headers, 'visualizações do vídeo de 1 minuto'),
    reacoes: colIncludes(headers, 'reações, comentários e compartilhamentos') >= 0
      ? colIncludes(headers, 'reações, comentários e compartilhamentos')
      : col(headers, 'Reações'),
    comentarios: col(headers, 'Comentários'),
    compartilhamentos: col(headers, 'Compartilhamentos'),
    segundosVisu: colIncludes(headers, 'segundos de visualização'),
    mediaSegundos: colIncludes(headers, 'média de segundos de visualização')
  };

  const videos = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 5) continue;
    videos.push({
      titulo: r[ci.titulo] || '',
      data: r[ci.data] || '',
      alcance: num(r[ci.alcance]),
      views3s: ci.views3s >= 0 ? num(r[ci.views3s]) : 0,
      views1min: ci.views1min >= 0 ? num(r[ci.views1min]) : 0,
      reacoes: num(r[ci.reacoes]),
      comentarios: num(r[ci.comentarios]),
      compartilhamentos: num(r[ci.compartilhamentos]),
      segundosVisu: ci.segundosVisu >= 0 ? num(r[ci.segundosVisu]) : 0,
      mediaSegundos: ci.mediaSegundos >= 0 ? num(r[ci.mediaSegundos]) : 0
    });
  }

  const agg = {
    videos: videos.length,
    alcance: videos.reduce((a, v) => a + v.alcance, 0),
    views3s: videos.reduce((a, v) => a + v.views3s, 0),
    views1min: videos.reduce((a, v) => a + v.views1min, 0),
    reacoes: videos.reduce((a, v) => a + v.reacoes, 0),
    comentarios: videos.reduce((a, v) => a + v.comentarios, 0),
    compartilhamentos: videos.reduce((a, v) => a + v.compartilhamentos, 0)
  };

  return { aggregated: agg, posts: videos };
}

// --- YouTube Tabela (per-video summary) ---
function parseYTTabela(rows) {
  const headers = rows[0];
  const ci = {
    conteudo: col(headers, 'Conteúdo'),
    titulo: col(headers, 'Título do vídeo'),
    publicacao: col(headers, 'Horário de publicação do vídeo'),
    duracao: col(headers, 'Duração'),
    views: col(headers, 'Visualizações'),
    horas: col(headers, 'Tempo de exibição (horas)'),
    inscritos: col(headers, 'Inscritos'),
    impressoes: col(headers, 'Impressões'),
    ctr: col(headers, 'Taxa de cliques de impressões (%)')
  };

  let totalRow = null;
  const videos = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 3) continue;

    if (r[ci.conteudo] === 'Total') {
      totalRow = {
        visualizacoes: num(r[ci.views]),
        horasExibicao: num(r[ci.horas]),
        inscritos: num(r[ci.inscritos]),
        impressoes: num(r[ci.impressoes]),
        ctr: num(r[ci.ctr])
      };
      continue;
    }

    videos.push({
      videoId: r[ci.conteudo] || '',
      titulo: r[ci.titulo] || '',
      publicacao: r[ci.publicacao] || '',
      duracao: num(r[ci.duracao]),
      visualizacoes: num(r[ci.views]),
      horasExibicao: num(r[ci.horas]),
      inscritos: num(r[ci.inscritos]),
      impressoes: num(r[ci.impressoes]),
      ctr: num(r[ci.ctr])
    });
  }

  const agg = totalRow || {
    visualizacoes: videos.reduce((a, v) => a + v.visualizacoes, 0),
    horasExibicao: videos.reduce((a, v) => a + v.horasExibicao, 0),
    inscritos: videos.reduce((a, v) => a + v.inscritos, 0),
    impressoes: videos.reduce((a, v) => a + v.impressoes, 0),
    ctr: 0
  };
  agg.videos = videos.length;

  return { aggregated: agg, posts: videos };
}

// --- YouTube Total Diário (daily channel views) ---
// --- YouTube Dados do gráfico (daily per-video views) ---
function parseYTGraficoDiario(rows) {
  // Format: Data, Conteúdo, Título do vídeo, Horário de publicação, Duração, Visualizações
  const daily = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    daily.push({ data: r[0] || '', visualizacoes: num(r[r.length - 1]) });
  }
  return { aggregated: {}, posts: [], daily };
}

function parseYTTotalDiario(rows) {
  const daily = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    daily.push({ data: r[0], visualizacoes: num(r[1]) });
  }

  const agg = {
    totalViews: daily.reduce((a, d) => a + d.visualizacoes, 0),
    dias: daily.length,
    mediaViews: daily.length ? Math.round(daily.reduce((a, d) => a + d.visualizacoes, 0) / daily.length) : 0,
    viewsDiarias: daily.map(d => d.visualizacoes)
  };

  return { aggregated: agg, daily };
}

// --- TikTok Overview ---
function parseTikTokOverview(rows) {
  const headers = rows[0];
  const ci = {
    data: col(headers, 'Date'),
    videoViews: col(headers, 'Video Views'),
    profileViews: col(headers, 'Profile Views'),
    likes: col(headers, 'Likes'),
    comments: col(headers, 'Comments'),
    shares: col(headers, 'Shares')
  };

  const daily = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 3) continue;
    daily.push({
      data: r[ci.data] || '',
      videoViews: num(r[ci.videoViews]),
      profileViews: num(r[ci.profileViews]),
      likes: num(r[ci.likes]),
      comments: num(r[ci.comments]),
      shares: num(r[ci.shares])
    });
  }

  const agg = {
    totalVideoViews: daily.reduce((a, d) => a + d.videoViews, 0),
    totalProfileViews: daily.reduce((a, d) => a + d.profileViews, 0),
    totalLikes: daily.reduce((a, d) => a + d.likes, 0),
    totalComments: daily.reduce((a, d) => a + d.comments, 0),
    totalShares: daily.reduce((a, d) => a + d.shares, 0),
    dias: daily.length,
    viewsDiarias: daily.map(d => d.videoViews)
  };
  agg.totalEngajamento = agg.totalLikes + agg.totalComments + agg.totalShares;

  return { aggregated: agg, daily };
}

// =====================================================
// PROCESS FILE — detect + parse
// =====================================================
// =====================================================
// AUTO-EXTRACTION: Client + Date from CSV data/filename
// =====================================================

const MONTH_MAP_EN = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
const MONTH_MAP_PT = { janeiro:1,fevereiro:2,'março':3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 };

function extractClientFromPath(relativePath) {
  if (!relativePath) return null;
  // webkitRelativePath: "Atenua Som/TikTok Fevereiro/Overview.csv"
  // First folder segment = client name
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length >= 2) return parts[0]; // folder name
  return null;
}

function extractClientFromCSV(rows, headers, type) {
  if (!rows || rows.length < 2) return null;
  const h = headers.map(s => s.toLowerCase());
  const firstDataRow = rows[1];

  // IG Feed/Stories: "Nome da conta" or "Nome de usuário da conta"
  if (type === 'ig_feed' || type === 'ig_stories') {
    const iName = h.findIndex(c => c === 'nome da conta');
    const iUser = h.findIndex(c => c === 'nome de usuário da conta');
    if (iName >= 0 && firstDataRow[iName]) return firstDataRow[iName];
    if (iUser >= 0 && firstDataRow[iUser]) return firstDataRow[iUser];
  }

  // FB Posts/Videos/Page: "Nome da Página"
  if (type === 'fb_posts' || type === 'fb_videos' || type === 'fb_page_daily') {
    const iPage = h.findIndex(c => c === 'nome da página');
    if (iPage >= 0 && firstDataRow[iPage]) return firstDataRow[iPage];
  }

  return null;
}

function matchClientByName(extractedName, clients) {
  if (!extractedName) return null;
  const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const lower = normalize(extractedName);
  const lowerNoSpace = lower.replace(/[\s\-_]/g, '');

  for (const c of clients) {
    const cLower = normalize(c.nome);
    const cNoSpace = cLower.replace(/[\s\-_]/g, '');
    // Check containment with and without spaces
    if (lower.includes(cLower) || cLower.includes(lower)) return c.id;
    if (lowerNoSpace.includes(cNoSpace) || cNoSpace.includes(lowerNoSpace)) return c.id;
  }

  // Try matching by ID (sigla)
  for (const c of clients) {
    if (lower === c.id.toLowerCase()) return c.id;
  }

  return null;
}

function extractDateFromFilename(fileName) {
  if (!fileName) return null;
  // Pattern: "Feb-01-2026_Feb-28-2026_xxx.csv" or "Mar-01-2026_Mar-31-2026_xxx.csv"
  const m = fileName.match(/^(\w{3})-\d{2}-(\d{4})_/);
  if (m) {
    const monthStr = m[1].toLowerCase();
    const year = parseInt(m[2]);
    const month = MONTH_MAP_EN[monthStr];
    if (month && year) return { mes: month, ano: year };
  }
  return null;
}

function extractDateFromData(parsedResult, type) {
  // From daily arrays (have date strings)
  if ((type === 'yt_total_diario' || type === 'yt_grafico_diario') && parsedResult.daily?.length) {
    const d = parsedResult.daily[0].data; // "2026-02-01"
    const m = d.match(/^(\d{4})-(\d{2})/);
    if (m) return { mes: parseInt(m[2]), ano: parseInt(m[1]) };
  }

  if (type === 'tiktok_overview' && parsedResult.daily?.length) {
    const d = parsedResult.daily[0].data; // "1 de fevereiro"
    for (const [name, num] of Object.entries(MONTH_MAP_PT)) {
      if (d.toLowerCase().includes(name)) {
        // TikTok doesn't include year in date text — infer current year
        return { mes: num, ano: new Date().getFullYear() };
      }
    }
  }

  // From individual posts (IG/FB have date or "Total")
  if (parsedResult.posts?.length) {
    for (const p of parsedResult.posts) {
      const dateStr = p.data || p.publicacao || '';
      // Try ISO format: "2026-02-03"
      const mISO = dateStr.match(/^(\d{4})-(\d{2})/);
      if (mISO) return { mes: parseInt(mISO[2]), ano: parseInt(mISO[1]) };
      // Try "Mon DD, YYYY" format (YouTube): "Feb 5, 2026"
      const mEN = dateStr.match(/^(\w{3})\s+\d+,\s*(\d{4})/);
      if (mEN) {
        const month = MONTH_MAP_EN[mEN[1].toLowerCase()];
        if (month) return { mes: month, ano: parseInt(mEN[2]) };
      }
    }
  }

  return null;
}

function extractDateFromPath(relativePath) {
  if (!relativePath) return null;
  const lower = relativePath.toLowerCase();
  // Look for month names in path segments: "TikTok Fevereiro" → fevereiro
  for (const [name, num] of Object.entries(MONTH_MAP_PT)) {
    if (lower.includes(name)) {
      // Try to find year in path too
      const yearMatch = relativePath.match(/20\d{2}/);
      return { mes: num, ano: yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear() };
    }
  }
  // English month names in path
  for (const [name, num] of Object.entries(MONTH_MAP_EN)) {
    if (lower.includes(name)) {
      const yearMatch = relativePath.match(/20\d{2}/);
      return { mes: num, ano: yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear() };
    }
  }
  return null;
}

// =====================================================
// INSTAGRAM INSIGHTS (native app export, UTF-16LE)
// Format: sep=, → metric name → "Data","Primary" → daily data
// =====================================================
function tryParseIGInsights(rows, fileName) {
  // Check for the "sep=," + metric name pattern
  // After parseCSVText, "sep=," becomes row [["sep=,"]] or similar
  if (!rows.length) return null;

  // Find the metric name and data start
  let metricName = '';
  let dataStartIdx = -1;

  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const firstCell = (rows[i][0] || '').trim().toLowerCase();
    if (firstCell.startsWith('sep=') || firstCell === 'sep') continue;
    if (firstCell === 'data' && (rows[i][1] || '').trim().toLowerCase() === 'primary') {
      dataStartIdx = i + 1;
      break;
    }
    // This row might be the metric name
    if (!metricName && firstCell && firstCell !== 'sep=,' && firstCell !== 'data') {
      metricName = (rows[i][0] || '').trim();
    }
  }

  const fnameLower = (fileName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Special case: Público.csv without daily data section (starts with demographics directly)
  if (dataStartIdx < 0) {
    const allText = rows.map(r => (r[0]||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).join('|');
    const hasSep = rows.some(r => (r[0]||'').trim().toLowerCase().startsWith('sep='));
    const hasDemographics = allText.includes('faixa') || allText.includes('cidade') || allText.includes('pais');
    if (hasSep && (hasDemographics || fnameLower.includes('publico'))) {
      // Parse as público without daily data
      const demographics = _parseIGPublico(rows, 0);
      return {
        type: 'ig_insights_publico',
        metricType: 'publico',
        metricName: 'Público',
        aggregated: { total: 0, media: 0, dias: 0, diario: [] },
        daily: [],
        demographics,
        extractedDate: null
      };
    }
    return null;
  }
  if (!metricName) return null;

  // Identify metric type from name or filename
  const metricLower = metricName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let metricType = '';
  if (metricLower.includes('alcance') || fnameLower.includes('alcance')) metricType = 'alcance';
  else if (metricLower.includes('visualizac') || fnameLower.includes('visualizac')) metricType = 'visualizacoes';
  else if (metricLower.includes('seguidor') || fnameLower.includes('seguidor')) metricType = 'seguidores';
  else if (metricLower.includes('visita') || fnameLower.includes('visita')) metricType = 'visitas';
  else if (metricLower.includes('interac') || fnameLower.includes('interac')) metricType = 'interacoes';
  else if (metricLower.includes('clique') || fnameLower.includes('clique')) metricType = 'cliques_link';
  else if (metricLower.includes('publico') || fnameLower.includes('publico') || metricLower.includes('faixa')) metricType = 'publico';
  else return null; // Unknown Instagram Insights metric

  // Parse daily data
  const daily = [];
  let extractedDate = null;

  for (let i = dataStartIdx; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    const dateStr = (r[0] || '').trim();
    const value = parseFloat((r[1] || '0').trim());
    if (!dateStr || isNaN(value)) continue;
    // Stop if not a date-like entry (must start with digit or contain ISO T00:00:00)
    if (!dateStr.match(/^\d{4}-/) && !dateStr.match(/T\d{2}:\d{2}/)) break;

    daily.push({ data: dateStr, valor: value });

    // Extract date from first entry
    if (!extractedDate) {
      const m = dateStr.match(/^(\d{4})-(\d{2})/);
      if (m) extractedDate = { mes: parseInt(m[2]), ano: parseInt(m[1]) };
    }
  }

  // Parse demographics from Público.csv (has multiple sections)
  let demographics = null;
  if (metricType === 'publico' || fnameLower.includes('publico')) {
    demographics = _parseIGPublico(rows, dataStartIdx + daily.length);
    if (demographics && (demographics.ageGender.length || demographics.cities.length || demographics.countries.length)) {
      metricType = 'publico'; // Override type if demographics found
    }
  }

  const total = daily.reduce((a, d) => a + d.valor, 0);
  const media = daily.length ? Math.round(total / daily.length) : 0;

  return {
    type: 'ig_insights_' + metricType,
    metricType,
    metricName,
    aggregated: { total, media, dias: daily.length, diario: daily.map(d => d.valor) },
    daily,
    demographics,
    extractedDate
  };
}

function _parseIGPublico(rows, startIdx) {
  const result = { ageGender: [], cities: [], countries: [] };
  const norm = s => (s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let section = '';
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0] || !r[0].trim()) continue;
    const first = norm(r[0]);

    // Detect section headers
    if (first.includes('faixa') || first.includes('etaria') || (first.includes('genero') && !first.match(/^\d/))) {
      section = 'age';
      continue;
    }
    if (first.includes('principais cidades') || first === 'cidades') {
      section = 'city';
      continue;
    }
    if (first.includes('principais paises') || first === 'paises') {
      section = 'country';
      continue;
    }

    // Skip sub-header rows (like "","Homens","Mulheres")
    if (first === '' && r.length >= 2) continue;

    // Parse rows based on current section
    if (section === 'age' && r.length >= 3 && first.match(/^\d/)) {
      result.ageGender.push({ range: r[0].trim(), homens: parseFloat(r[1])||0, mulheres: parseFloat(r[2])||0 });
    }
    else if ((section === 'city' || section === 'country') && first.match(/[a-zA-Z]/) && !first.match(/^\d/)) {
      const vals = rows[i+1];
      if (vals && vals[0]?.trim().match(/^[\d.]/)) {
        if (r.length > 1 && vals.length > 1) {
          // Horizontal format: "SP","RJ","MG" then "19.5","3.8","2.3"
          for (let j = 0; j < r.length; j++) {
            if (r[j]?.trim() && vals[j]?.trim()) {
              const entry = { [section === 'city' ? 'city' : 'country']: r[j].trim(), pct: parseFloat(vals[j])||0 };
              if (section === 'city') result.cities.push(entry);
              else result.countries.push(entry);
            }
          }
          i++; // skip values row
          section = ''; // horizontal = all in one go
        } else {
          // Vertical format: "Brasil" then "70.3" (one per pair of lines)
          const name = r[0].trim();
          const pct = parseFloat(vals[0]) || 0;
          const entry = { [section === 'city' ? 'city' : 'country']: name, pct };
          if (section === 'city') result.cities.push(entry);
          else result.countries.push(entry);
          i++; // skip value row, but DON'T reset section — more may follow
        }
      }
    }
  }

  return result;
}

// =====================================================
// PROCESS FILE — detect + parse + extract metadata
// =====================================================
function processCSVFile(text, fileName, relativePath) {
  const rows = parseCSVText(text);
  if (!rows.length) return { type: 'unknown', error: 'CSV vazio', fileName };

  // Detect Instagram Insights format (starts with "sep=," then metric name)
  const igInsightsResult = tryParseIGInsights(rows, fileName);
  if (igInsightsResult) {
    const type = igInsightsResult.type;
    const extractedClient = extractClientFromPath(relativePath);
    const extractedDate = extractDateFromFilename(fileName)
      || extractDateFromPath(relativePath)
      || igInsightsResult.extractedDate;
    const clients = getClients();
    const matchedClientId = matchClientByName(extractedClient, clients);
    return { type, fileName, relativePath, platform: 'instagram', label: csvTypeLabel(type),
      extractedClient, matchedClientId, extractedDate, ...igInsightsResult };
  }

  const headers = rows[0];
  const type = detectCSVType(headers);

  let result;
  switch (type) {
    case 'ig_feed':         result = parseIGFeed(rows); break;
    case 'ig_stories':      result = parseIGStories(rows); break;
    case 'fb_page_daily':   result = parseFBPageDaily(rows); break;
    case 'fb_posts':        result = parseFBPosts(rows); break;
    case 'fb_videos':       result = parseFBVideos(rows); break;
    case 'yt_tabela':       result = parseYTTabela(rows); break;
    case 'yt_total_diario': result = parseYTTotalDiario(rows); break;
    case 'yt_grafico_diario': result = parseYTGraficoDiario(rows); break;
    case 'tiktok_overview': result = parseTikTokOverview(rows); break;
    default: return { type: 'unknown', error: 'Formato não reconhecido', fileName };
  }

  // Auto-extract client and date
  const extractedClient = extractClientFromPath(relativePath)
    || extractClientFromCSV(rows, headers, type);
  const extractedDate = extractDateFromFilename(fileName)
    || extractDateFromPath(relativePath)
    || extractDateFromData(result, type);

  const clients = getClients();
  const matchedClientId = matchClientByName(extractedClient, clients);

  return {
    type, fileName, relativePath,
    platform: csvTypePlatform(type),
    label: csvTypeLabel(type),
    extractedClient,
    matchedClientId,
    extractedDate,
    ...result
  };
}

// =====================================================
// AGGREGATE ALL FILES INTO REPORT
// =====================================================
function buildRelatorio(clienteId, ano, mes, parsedFiles) {
  const cliente = clientById(clienteId);

  const rel = {
    id: uid(),
    clienteId,
    clienteNome: cliente ? cliente.nome : clienteId,
    ano,
    mes,
    mesLabel: MESES_PT[mes],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    instagram: { feed: null, stories: null, account: {} },
    facebook: { page: null, posts: null, videos: null },
    youtube: { tabela: null, totalDiario: null },
    tiktok: { overview: null },
    _rawPosts: { igFeed: [], igStories: [], fbPosts: [], fbVideos: [], ytVideos: [], tkDaily: [] }
  };

  for (const f of parsedFiles) {
    switch (f.type) {
      case 'ig_feed':
        rel.instagram.feed = f.aggregated;
        rel._rawPosts.igFeed = f.posts || [];
        break;
      case 'ig_stories':
        rel.instagram.stories = f.aggregated;
        rel._rawPosts.igStories = f.posts || [];
        break;
      case 'fb_page_daily':
        rel.facebook.page = f.aggregated;
        break;
      case 'fb_posts':
        rel.facebook.posts = f.aggregated;
        rel._rawPosts.fbPosts = f.posts || [];
        break;
      case 'fb_videos':
        rel.facebook.videos = f.aggregated;
        rel._rawPosts.fbVideos = f.posts || [];
        break;
      case 'yt_tabela':
        rel.youtube.tabela = f.aggregated;
        rel._rawPosts.ytVideos = f.posts || [];
        break;
      case 'yt_total_diario':
        rel.youtube.totalDiario = f.aggregated;
        break;
      case 'tiktok_overview':
        rel.tiktok.overview = f.aggregated;
        rel._rawPosts.tkDaily = f.daily || [];
        break;
      default:
        // Instagram Insights (ig_insights_*)
        if (f.type && f.type.startsWith('ig_insights_')) {
          if (!rel.instagram.account) rel.instagram.account = {};
          const key = f.metricType; // alcance, visualizacoes, seguidores, etc.
          rel.instagram.account[key] = f.aggregated;
          if (f.demographics) rel.instagram.account.demographics = f.demographics;
        }
        break;
    }
  }

  return rel;
}

// =====================================================
// COMPARAÇÃO ENTRE MESES
// =====================================================
function calcChange(atual, anterior) {
  if (!anterior || anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

function changeTag(pct) {
  if (pct === 0 || pct === null || isNaN(pct)) return '<span class="rel-change rel-neutral">0%</span>';
  const cls = pct > 0 ? 'rel-positive' : 'rel-negative';
  const arrow = pct > 0 ? '↑' : '↓';
  return `<span class="rel-change ${cls}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

// =====================================================
// RENDER — Lista de Relatórios
// =====================================================
let relViewingId = null;
let relFilterCliente = '';
let relFilterAno = '';

function consolidateDuplicates() {
  const rels = getRelatorios();
  const map = {};
  let changed = false;

  for (const r of rels) {
    const key = `${r.clienteId}_${r.ano}_${r.mes}`;
    if (!map[key]) {
      map[key] = r;
    } else {
      // Merge duplicate into the first one
      const target = map[key];
      // Merge each platform's raw data
      const types = [
        ['ig_feed', 'instagram', 'feed', 'igFeed'],
        ['ig_stories', 'instagram', 'stories', 'igStories'],
        ['fb_posts', 'facebook', 'posts', 'fbPosts'],
        ['fb_videos', 'facebook', 'videos', 'fbVideos'],
        ['fb_page_daily', 'facebook', 'page', null],
        ['yt_tabela', 'youtube', 'tabela', 'ytVideos'],
        ['yt_total_diario', 'youtube', 'totalDiario', null],
        ['tiktok_overview', 'tiktok', 'overview', 'tkDaily']
      ];
      for (const [type, plat, sub, rawKey] of types) {
        const src = plat === 'tiktok' ? r[plat]?.[sub] : r[plat]?.[sub];
        if (src && !target[plat][sub]) {
          target[plat][sub] = src;
          if (rawKey && r._rawPosts?.[rawKey]?.length) {
            target._rawPosts[rawKey] = (target._rawPosts[rawKey] || []).concat(r._rawPosts[rawKey]);
          }
        }
      }
      target.updatedAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) {
    saveRelatorios(Object.values(map));
  }
}

function renderRelatorio() {
  consolidateDuplicates();
  const container = document.getElementById('page-relatorio');
  const rels = getRelatorios();
  const clientes = getClients();
  const anos = [...new Set(rels.map(r => r.ano))].sort((a, b) => b - a);

  // Filters
  let filtered = rels;
  if (relFilterCliente) filtered = filtered.filter(r => r.clienteId === relFilterCliente);
  if (relFilterAno) filtered = filtered.filter(r => r.ano === +relFilterAno);
  filtered.sort((a, b) => b.ano - a.ano || b.mes - a.mes || b.createdAt.localeCompare(a.createdAt));

  // Group by client for summary
  const byClient = {};
  rels.forEach(r => {
    if (!byClient[r.clienteId]) byClient[r.clienteId] = { nome: r.clienteNome, count: 0 };
    byClient[r.clienteId].count++;
  });

  container.innerHTML = `
    <div class="flex-between mb-20">
      <div>
        <div class="section-title mb-4">Base de Dados — Relatórios</div>
        <div class="text-muted text-sm">Registro mensal de performance por cliente. Para comparativos, acesse <a href="#" onclick="_perfClienteId='';setPage('clientes');setTimeout(()=>clientesTab('performance'),100);return false" style="color:var(--accent);font-weight:600">Clientes → Performance</a></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost" onclick="openMassImport()">📦 Import em Massa</button>
        <button class="btn btn-primary" onclick="openModal('relatorio')">+ Novo Registro</button>
      </div>
    </div>

    ${rels.length ? `
      <div class="grid grid-4 gap-12 mb-20">
        <div class="card" style="text-align:center;padding:14px">
          <div class="text-xs text-muted">Total de registros</div>
          <div style="font-size:24px;font-weight:800">${rels.length}</div>
        </div>
        <div class="card" style="text-align:center;padding:14px">
          <div class="text-xs text-muted">Clientes com dados</div>
          <div style="font-size:24px;font-weight:800">${Object.keys(byClient).length}</div>
        </div>
        <div class="card" style="text-align:center;padding:14px">
          <div class="text-xs text-muted">Meses registrados</div>
          <div style="font-size:24px;font-weight:800">${[...new Set(rels.map(r => r.ano+'-'+r.mes))].length}</div>
        </div>
        <div class="card" style="text-align:center;padding:14px;cursor:pointer" onclick="_perfClienteId='';setPage('clientes');setTimeout(()=>clientesTab('performance'),100)">
          <div class="text-xs text-muted">Ver comparativos</div>
          <div style="font-size:16px;font-weight:700;color:var(--accent)">Clientes → Performance</div>
        </div>
      </div>
    ` : ''}

    <div class="flex-center gap-8 mb-16">
      <select class="input-sm" onchange="relFilterCliente=this.value;renderRelatorio()" style="min-width:160px">
        <option value="">Todos os clientes</option>
        ${clientes.map(c => `<option value="${c.id}" ${relFilterCliente===c.id?'selected':''}>${c.nome}</option>`).join('')}
      </select>
      <select class="input-sm" onchange="relFilterAno=this.value;renderRelatorio()" style="min-width:100px">
        <option value="">Todos os anos</option>
        ${anos.map(a => `<option value="${a}" ${relFilterAno==a?'selected':''}>${a}</option>`).join('')}
      </select>
      <span class="text-muted text-sm">${filtered.length} registro(s)</span>
    </div>

    ${filtered.length === 0 ? `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:12px">📊</div>
        <div class="text-muted">Nenhum registro mensal ainda.</div>
        <div class="text-sm text-faint mt-4">Clique em "+ Novo Registro" para subir CSVs de um cliente.</div>
      </div>
    ` : `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Período</th>
              <th>Plataformas</th>
              <th>Registrado em</th>
              <th>Atualizado em</th>
              <th style="width:140px">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(r => {
              const platforms = [];
              if (r.instagram.feed || r.instagram.stories) platforms.push('<span class="rel-plat-badge rel-plat-ig">IG</span>');
              if (r.facebook.page || r.facebook.posts || r.facebook.videos) platforms.push('<span class="rel-plat-badge rel-plat-fb">FB</span>');
              if (r.youtube.tabela || r.youtube.totalDiario) platforms.push('<span class="rel-plat-badge rel-plat-yt">YT</span>');
              if (r.tiktok.overview) platforms.push('<span class="rel-plat-badge rel-plat-tk">TK</span>');

              return `<tr>
                <td><strong>${r.clienteNome}</strong></td>
                <td>${r.mesLabel} ${r.ano}</td>
                <td>${platforms.join(' ')}</td>
                <td class="text-sm">${fmtDateTime(r.createdAt)}</td>
                <td class="text-sm">${r.updatedAt !== r.createdAt ? fmtDateTime(r.updatedAt) : '—'}</td>
                <td>
                  <button class="btn btn-ghost btn-sm rel-btn-add" onclick="document.getElementById('rel-add-${r.id}').click()" title="Adicionar CSVs">📁</button>
                  <input type="file" id="rel-add-${r.id}" accept=".csv" multiple style="display:none" onchange="handleAddCSVsToReport('${r.id}', this)">
                  <button class="btn btn-ghost btn-sm" onclick="_perfClienteId='${r.clienteId}';setPage('clientes');setTimeout(()=>clientesTab('performance'),100)" title="Ver performance">📊</button>
                  <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteRelatorio('${r.id}')" title="Excluir registro">✕</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
}

// =====================================================
// RENDER — Visualização do Relatório
// =====================================================
function renderRelatorioView(container, rel, anterior) {
  const fmtNum = n => n != null ? n.toLocaleString('pt-BR') : '—';

  // Highlights data
  const highlights = [];
  const igFeed = rel.instagram.feed;
  const igStories = rel.instagram.stories;
  const fbPosts = rel.facebook.posts;
  const fbPage = rel.facebook.page;
  const yt = rel.youtube.tabela;
  const tk = rel.tiktok.overview;

  if (igFeed || igStories) {
    const v = (igFeed?.alcance||0) + (igStories?.alcance||0);
    const pv = anterior ? ((anterior.instagram.feed?.alcance||0) + (anterior.instagram.stories?.alcance||0)) : null;
    highlights.push({ platform:'instagram', abbr:'ig', label:'Instagram', value: fmtNum(v), change: pv!==null?calcChange(v,pv):null, sub:`alcance em ${rel.mesLabel}` });
  }
  if (yt) {
    const pv = anterior?.youtube?.tabela?.visualizacoes;
    highlights.push({ platform:'youtube', abbr:'yt', label:'YouTube', value: fmtNum(yt.visualizacoes), change: pv!=null?calcChange(yt.visualizacoes,pv):null, sub:`views em ${rel.mesLabel}` });
  }
  if (tk) {
    const pv = anterior?.tiktok?.overview?.totalVideoViews;
    highlights.push({ platform:'tiktok', abbr:'tk', label:'TikTok', value: fmtNum(tk.totalVideoViews), change: pv!=null?calcChange(tk.totalVideoViews,pv):null, sub:`views em ${rel.mesLabel}` });
  }
  if (fbPosts || fbPage) {
    const v = fbPosts?.alcance || fbPage?.totalEngajamentos || 0;
    const pv = anterior ? (anterior.facebook.posts?.alcance || anterior.facebook.page?.totalEngajamentos || 0) : null;
    highlights.push({ platform:'facebook', abbr:'fb', label:'Facebook', value: fmtNum(v), change: pv!==null?calcChange(v,pv):null, sub: fbPosts?`alcance em ${rel.mesLabel}`:`engajamentos em ${rel.mesLabel}` });
  }

  const mesAnteriorLabel = anterior ? anterior.mesLabel : '';

  container.innerHTML = `<div class="rel-view">

    <!-- HEADER -->
    <div class="flex-between mb-8 rel-animate">
      <button class="btn btn-ghost btn-sm" onclick="relViewingId=null;renderRelatorio()">← Voltar</button>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm rel-btn-add" onclick="document.getElementById('rel-add-csv-input').click()">📁 Adicionar CSVs</button>
        <input type="file" id="rel-add-csv-input" accept=".csv" multiple style="display:none" onchange="handleAddCSVsToReport('${rel.id}', this)">
        <button class="btn btn-ghost btn-sm rel-btn-export" onclick="exportRelPDF('${rel.id}')">📄 Exportar PDF</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteRelatorio('${rel.id}')">🗑 Excluir</button>
      </div>
    </div>
    <div class="rel-animate rel-animate-delay-1" style="margin-bottom:24px">
      <div class="rel-header-label">RELATÓRIO DE PERFORMANCE</div>
      <h1 class="rel-header-title">${rel.clienteNome}</h1>
      <div class="rel-header-sub">${anterior ? mesAnteriorLabel+' & ' : ''}${rel.mesLabel} ${rel.ano}</div>
    </div>

    <!-- HIGHLIGHTS -->
    ${highlights.length ? `
      <div class="rel-highlights-grid">
        ${highlights.map((h,i) => `
          <div class="rel-highlight-card rel-animate rel-animate-delay-${i+2}">
            <div class="rel-highlight-platform">${h.label}</div>
            <div class="rel-highlight-value ${h.change!==null && h.change>0 ? 'rel-val-green' : 'rel-val-'+h.abbr}">${h.change!==null ? (h.change>0?'+':'')+h.change.toFixed(0)+'%' : h.value}</div>
            <div class="rel-highlight-sub">${h.sub}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- SECTIONS -->
    ${igFeed || igStories ? renderInstagramSection(rel, anterior) : ''}
    ${fbPosts || fbPage || rel.facebook.videos ? renderFacebookSection(rel, anterior) : ''}
    ${yt || rel.youtube.totalDiario ? renderYouTubeSection(rel, anterior) : ''}
    ${tk ? renderTikTokSection(rel, anterior) : ''}
    ${renderTopPosts(rel)}

    <div class="rel-footer">Produzido por PumP · ${rel.clienteNome} · ${fmtDateTime(rel.createdAt)}</div>
  </div>`;

  setTimeout(() => renderRelatorioCharts(rel, anterior), 100);
}

// =====================================================
// SECTION RENDERERS
// =====================================================
function renderInstagramSection(rel, ant) {
  const f = rel.instagram.feed;
  const s = rel.instagram.stories;
  const af = ant?.instagram?.feed;
  const as_ = ant?.instagram?.stories;

  // Count post types from raw data
  const rawFeed = rel._rawPosts?.igFeed || [];
  const countByType = (posts, tipo) => posts.filter(p => (p.tipo || '').toLowerCase().includes(tipo)).length;
  const nReels = countByType(rawFeed, 'reel');
  const nCarrossel = countByType(rawFeed, 'carrossel');
  const nImagem = countByType(rawFeed, 'imagem');

  return `
    <div class="rel-section rel-animate rel-animate-delay-5">
      <div class="rel-section-header">
        <span class="rel-platform-icon rel-icon-ig">📸</span>
        <span>Instagram</span>
      </div>

      ${f ? `
        <div class="rel-subsection-title">Feed & Reels</div>
        <div class="rel-metrics-grid cols-4">
          ${metricCard('Posts publicados', f.posts, af?.posts)}
          ${metricCard('Alcance', f.alcance, af?.alcance)}
          ${metricCard('Visualizações', f.visualizacoes, af?.visualizacoes)}
          ${metricCard('Curtidas', f.curtidas, af?.curtidas)}
        </div>
        <div class="rel-metrics-grid cols-4" style="margin-top:12px">
          ${metricCard('Comentários', f.comentarios, af?.comentarios)}
          ${metricCard('Compartilhamentos', f.compartilhamentos, af?.compartilhamentos)}
          ${metricCard('Salvamentos', f.salvamentos, af?.salvamentos)}
          ${metricCard('Seguimentos', f.seguimentos, af?.seguimentos)}
        </div>

        ${nReels || nCarrossel || nImagem ? `
          <div class="rel-metrics-grid cols-3" style="margin-top:12px">
            ${nReels ? metricCard('Reels', nReels) : ''}
            ${nCarrossel ? metricCard('Carrosséis', nCarrossel) : ''}
            ${nImagem ? metricCard('Imagens', nImagem) : ''}
          </div>
        ` : ''}

        <div class="rel-grid-2" style="margin-top:16px">
          <div class="rel-chart-wrap">
            <div class="rel-chart-title">Feed — ${ant ? ant.mesLabel+' vs ' : ''}${rel.mesLabel}</div>
            <canvas id="chart-ig"></canvas>
          </div>
          ${renderComparisonTable('Feed — Completo',
            ['Posts publicados','Alcance','Visualizações','Curtidas','Comentários','Compartilhamentos','Salvamentos','Seguimentos','Engajamento total'],
            [f.posts, f.alcance, f.visualizacoes, f.curtidas, f.comentarios, f.compartilhamentos, f.salvamentos, f.seguimentos, f.engajamento],
            af ? [af.posts, af.alcance, af.visualizacoes, af.curtidas, af.comentarios, af.compartilhamentos, af.salvamentos, af.seguimentos, af.engajamento] : null,
            rel.mesLabel, ant?.mesLabel
          )}
        </div>
      ` : ''}

      ${s ? `
        <div class="rel-subsection-title">Stories</div>
        <div class="rel-metrics-grid cols-4">
          ${metricCard('Stories publicados', s.posts, as_?.posts)}
          ${metricCard('Alcance', s.alcance, as_?.alcance)}
          ${metricCard('Visualizações', s.visualizacoes, as_?.visualizacoes)}
          ${metricCard('Curtidas', s.curtidas, as_?.curtidas)}
        </div>
        <div class="rel-metrics-grid cols-4" style="margin-top:12px">
          ${metricCard('Respostas', s.respostas, as_?.respostas)}
          ${metricCard('Compartilhamentos', s.compartilhamentos, as_?.compartilhamentos)}
          ${metricCard('Seguimentos', s.seguimentos, as_?.seguimentos)}
          ${metricCard('Cliques no Link', s.cliquesLink, as_?.cliquesLink)}
        </div>
        ${renderComparisonTable('Stories — Completo',
          ['Stories publicados','Alcance','Visualizações','Curtidas','Respostas','Compartilhamentos','Seguimentos','Cliques no link'],
          [s.posts, s.alcance, s.visualizacoes, s.curtidas, s.respostas, s.compartilhamentos, s.seguimentos, s.cliquesLink],
          as_ ? [as_.posts, as_.alcance, as_.visualizacoes, as_.curtidas, as_.respostas, as_.compartilhamentos, as_.seguimentos, as_.cliquesLink] : null,
          rel.mesLabel, ant?.mesLabel
        )}
      ` : ''}
    </div>
  `;
}

function renderFacebookSection(rel, ant) {
  const p = rel.facebook.posts;
  const pg = rel.facebook.page;
  const v = rel.facebook.videos;
  const ap = ant?.facebook?.posts;
  const apg = ant?.facebook?.page;
  const av = ant?.facebook?.videos;

  return `
    <div class="rel-section rel-animate rel-animate-delay-6">
      <div class="rel-section-header">
        <span class="rel-platform-icon rel-icon-fb">📘</span>
        <span>Facebook</span>
      </div>

      ${pg ? `
        <div class="rel-metrics-grid cols-4">
          ${metricCard('Total Engajamentos', pg.totalEngajamentos, apg?.totalEngajamentos)}
          ${metricCard('Média/Dia', pg.mediaEngajamentos, apg?.mediaEngajamentos)}
          ${metricCard('Feedbacks Negativos', pg.feedbacksNegativos, apg?.feedbacksNegativos)}
          ${metricCard('Dias com dados', pg.diasComDados)}
        </div>
      ` : ''}

      ${p || v ? `
        <div class="rel-grid-2" style="margin-top:16px">
          ${p ? renderComparisonTable('Posts — Comparativo',
            ['Posts publicados','Alcance','Visualizações','Reações','Comentários','Compartilhamentos'],
            [p.posts, p.alcance, p.visualizacoes, p.reacoes, p.comentarios, p.compartilhamentos],
            ap ? [ap.posts, ap.alcance, ap.visualizacoes, ap.reacoes, ap.comentarios, ap.compartilhamentos] : null,
            rel.mesLabel, ant?.mesLabel
          ) : ''}
          ${v ? renderComparisonTable('Vídeos — Comparativo',
            ['Vídeos publicados','Alcance','Views (3s)','Views (1 min)','Reações'],
            [v.videos, v.alcance, v.views3s, v.views1min, v.reacoes],
            av ? [av.videos, av.alcance, av.views3s, av.views1min, av.reacoes] : null,
            rel.mesLabel, ant?.mesLabel
          ) : ''}
        </div>
      ` : ''}

      ${pg ? `
        <div class="rel-chart-wrap" style="margin-top:16px">
          <div class="rel-chart-title">Engajamentos diários da página</div>
          <canvas id="chart-fb-daily"></canvas>
        </div>
      ` : ''}
    </div>
  `;
}

function renderYouTubeSection(rel, ant) {
  const yt = rel.youtube.tabela;
  const ytd = rel.youtube.totalDiario;
  const ayt = ant?.youtube?.tabela;

  return `
    <div class="rel-section rel-animate rel-animate-delay-7">
      <div class="rel-section-header">
        <span class="rel-platform-icon rel-icon-yt">▶️</span>
        <span>YouTube</span>
      </div>

      ${yt ? `
        <div class="rel-metrics-grid cols-4">
          ${metricCard('Visualizações', yt.visualizacoes, ayt?.visualizacoes)}
          ${metricCard('Horas de Exibição', yt.horasExibicao, ayt?.horasExibicao, true)}
          ${metricCard('Inscritos', yt.inscritos, ayt?.inscritos)}
          ${metricCard('Impressões', yt.impressoes, ayt?.impressoes)}
        </div>

        ${ant && ayt ? renderComparisonTable('YouTube — Comparativo',
          ['Visualizações','Horas Exibição','Inscritos','Impressões','CTR (%)'],
          [yt.visualizacoes, yt.horasExibicao, yt.inscritos, yt.impressoes, yt.ctr],
          [ayt.visualizacoes, ayt.horasExibicao, ayt.inscritos, ayt.impressoes, ayt.ctr],
          rel.mesLabel, ant.mesLabel
        ) : ''}

        ${rel._rawPosts.ytVideos.length ? `
          <div class="rel-subsection-title">Top 5 Vídeos</div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Título</th><th>Views</th><th>Tempo</th><th>CTR</th></tr></thead>
              <tbody>
                ${rel._rawPosts.ytVideos.slice(0, 5).map((v,i) => `
                  <tr>
                    <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
                    <td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${v.titulo}">${v.titulo}</td>
                    <td><strong>${v.visualizacoes.toLocaleString('pt-BR')}</strong></td>
                    <td>${v.horasExibicao.toFixed(1)}h</td>
                    <td>${v.ctr}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      ` : ''}

      ${ytd ? `
        <div class="rel-chart-wrap" style="margin-top:16px">
          <div class="rel-chart-title">Views diárias do canal</div>
          <canvas id="chart-yt-daily"></canvas>
        </div>
      ` : ''}
    </div>
  `;
}

function renderTikTokSection(rel, ant) {
  const tk = rel.tiktok.overview;
  const atk = ant?.tiktok?.overview;

  return `
    <div class="rel-section rel-animate rel-animate-delay-8">
      <div class="rel-section-header">
        <span class="rel-platform-icon rel-icon-tk">🎵</span>
        <span>TikTok</span>
      </div>

      <div class="rel-metrics-grid cols-4">
        ${metricCard('Video Views', tk.totalVideoViews, atk?.totalVideoViews)}
        ${metricCard('Curtidas', tk.totalLikes, atk?.totalLikes)}
        ${metricCard('Compartilhamentos', tk.totalShares, atk?.totalShares)}
        ${metricCard('Visitas ao Perfil', tk.totalProfileViews, atk?.totalProfileViews)}
      </div>

      ${ant && atk ? renderComparisonTable('TikTok — Comparativo',
        ['Video Views','Visitas Perfil','Curtidas','Comentários','Compartilhamentos','Engajamento'],
        [tk.totalVideoViews, tk.totalProfileViews, tk.totalLikes, tk.totalComments, tk.totalShares, tk.totalEngajamento],
        [atk.totalVideoViews, atk.totalProfileViews, atk.totalLikes, atk.totalComments, atk.totalShares, atk.totalEngajamento],
        rel.mesLabel, ant.mesLabel
      ) : ''}

      <div class="rel-chart-wrap" style="margin-top:16px">
        <div class="rel-chart-title">Video Views diárias</div>
        <canvas id="chart-tk-daily"></canvas>
      </div>
    </div>
  `;
}

// =====================================================
// HELPER RENDERERS
// =====================================================
function metricCard(label, value, prevValue, isDecimal) {
  const fmtNum = n => n != null ? (isDecimal ? n.toFixed(1) : n.toLocaleString('pt-BR')) : '—';
  const chg = prevValue != null ? calcChange(value || 0, prevValue) : null;
  return `
    <div class="rel-metric-card">
      <div class="rel-metric-label">${label}</div>
      <div class="rel-metric-value">${fmtNum(value)}</div>
      ${chg !== null ? changeTag(chg) : ''}
    </div>
  `;
}

function renderComparisonTable(title, labels, current, previous, mesAtual, mesAnterior) {
  const hasPrev = previous && Array.isArray(previous);
  const fv = v => typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString('pt-BR') : v.toFixed(2)) : (v || '—');

  return `
    <div class="table-wrap">
      <div class="rel-table-title">${title}</div>
      <table>
        <thead>
          <tr>
            <th>Métrica</th>
            ${hasPrev ? `<th>${mesAnterior}</th>` : ''}
            <th>${mesAtual}</th>
            ${hasPrev ? '<th>Variação</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${labels.map((l, i) => {
            const curr = current[i] || 0;
            const prev = hasPrev ? (previous[i] || 0) : null;
            const pct = hasPrev ? calcChange(curr, prev) : null;
            return `<tr>
              <td><strong>${l}</strong></td>
              ${hasPrev ? `<td>${fv(prev)}</td>` : ''}
              <td><strong>${fv(curr)}</strong></td>
              ${hasPrev ? `<td>${changeTag(pct)}</td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTopPosts(rel) {
  const fmtN = n => (n||0).toLocaleString('pt-BR');
  const truncate = (s, len) => { s = (s||'').replace(/\n/g,' ').trim(); return s.length > len ? s.substring(0,len)+'...' : s; };

  let html = '';

  // ── IG Feed — Segmentado por tipo ──
  const igFeed = (rel._rawPosts?.igFeed || []).slice();
  if (igFeed.length) {
    const classify = p => {
      const t = (p.tipo || '').toLowerCase();
      if (t.includes('reel')) return 'Reels';
      if (t.includes('carrossel')) return 'Carrosséis';
      return 'Imagens';
    };
    // Group by type
    const groups = {};
    igFeed.forEach(p => {
      const cat = classify(p);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    // Sort each group by alcance desc
    Object.values(groups).forEach(arr => arr.sort((a, b) => (b.alcance||0) - (a.alcance||0)));

    // Render order
    const order = ['Reels', 'Carrosséis', 'Imagens'].filter(k => groups[k]?.length);

    html += `
      <div class="rel-section rel-animate rel-animate-delay-7">
        <div class="rel-section-header">
          <span class="rel-platform-icon rel-icon-ig">📸</span>
          <span>Conteúdos Instagram — Feed</span>
        </div>

        ${order.map(cat => {
          const posts = groups[cat];
          const icon = cat === 'Reels' ? '🎬' : cat === 'Carrosséis' ? '🖼️' : '📷';
          return `
            <div class="rel-subsection-title">${icon} ${cat} (${posts.length})</div>
            <div class="table-wrap" style="margin-bottom:16px">
              <table>
                <thead><tr><th>#</th><th>Conteúdo</th><th>Alcance</th><th>Views</th><th>Curtidas</th><th>Coment.</th><th>Compart.</th><th>Salv.</th></tr></thead>
                <tbody>
                  ${posts.map((p,i) => `<tr>
                    <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
                    <td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(p.descricao||'').replace(/"/g,'&quot;')}">${truncate(p.descricao, 60) || '<span class="text-faint">Sem descrição</span>'}</td>
                    <td><strong>${fmtN(p.alcance)}</strong></td>
                    <td>${fmtN(p.visualizacoes)}</td>
                    <td>${fmtN(p.curtidas)}</td>
                    <td>${fmtN(p.comentarios)}</td>
                    <td>${fmtN(p.compartilhamentos)}</td>
                    <td>${fmtN(p.salvamentos)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
        }).join('')}
      </div>`;
  }

  // ── IG Stories — Individual ──
  const igStories = (rel._rawPosts?.igStories || []).slice().sort((a,b) => (b.alcance||0) - (a.alcance||0));
  if (igStories.length) {
    html += `
      <div class="rel-section rel-animate rel-animate-delay-7">
        <div class="rel-section-header">
          <span class="rel-platform-icon rel-icon-ig">📸</span>
          <span>Conteúdos Instagram — Stories</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Conteúdo</th><th>Alcance</th><th>Views</th><th>Curtidas</th><th>Respostas</th><th>Link</th></tr></thead>
            <tbody>
              ${igStories.map((p,i) => `<tr>
                <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
                <td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(p.descricao||'').replace(/"/g,'&quot;')}">${truncate(p.descricao, 60) || '<span class="text-faint">Story</span>'}</td>
                <td><strong>${fmtN(p.alcance)}</strong></td>
                <td>${fmtN(p.visualizacoes)}</td>
                <td>${fmtN(p.curtidas)}</td>
                <td>${fmtN(p.respostas)}</td>
                <td>${fmtN(p.cliquesLink)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ── FB Posts — Individual ──
  const fbPosts = (rel._rawPosts?.fbPosts || []).slice().sort((a,b) => (b.alcance||0) - (a.alcance||0));
  if (fbPosts.length) {
    html += `
      <div class="rel-section rel-animate rel-animate-delay-8">
        <div class="rel-section-header">
          <span class="rel-platform-icon rel-icon-fb">📘</span>
          <span>Conteúdos Facebook — Posts</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Conteúdo</th><th>Tipo</th><th>Alcance</th><th>Views</th><th>Reações</th><th>Coment.</th><th>Compart.</th></tr></thead>
            <tbody>
              ${fbPosts.map((p,i) => `<tr>
                <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
                <td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(p.titulo||p.descricao||'').replace(/"/g,'&quot;')}">${truncate(p.titulo || p.descricao, 60) || '<span class="text-faint">Sem título</span>'}</td>
                <td>${(p.tipo||'').trim()}</td>
                <td><strong>${fmtN(p.alcance)}</strong></td>
                <td>${fmtN(p.visualizacoes)}</td>
                <td>${fmtN(p.reacoes)}</td>
                <td>${fmtN(p.comentarios)}</td>
                <td>${fmtN(p.compartilhamentos)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ── FB Videos — Individual ──
  const fbVids = (rel._rawPosts?.fbVideos || []).slice().sort((a,b) => (b.alcance||0) - (a.alcance||0));
  if (fbVids.length) {
    html += `
      <div class="rel-section rel-animate rel-animate-delay-8">
        <div class="rel-section-header">
          <span class="rel-platform-icon rel-icon-fb">📘</span>
          <span>Conteúdos Facebook — Vídeos</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Conteúdo</th><th>Alcance</th><th>Views 3s</th><th>Views 1min</th><th>Reações</th></tr></thead>
            <tbody>
              ${fbVids.map((p,i) => `<tr>
                <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
                <td style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(p.titulo||'').replace(/"/g,'&quot;')}">${truncate(p.titulo, 60) || '<span class="text-faint">Vídeo</span>'}</td>
                <td><strong>${fmtN(p.alcance)}</strong></td>
                <td>${fmtN(p.views3s)}</td>
                <td>${fmtN(p.views1min)}</td>
                <td>${fmtN(p.reacoes)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ── YouTube — Vídeos individuais ──
  const ytVids = (rel._rawPosts?.ytVideos || []).slice().sort((a,b) => (b.visualizacoes||0) - (a.visualizacoes||0));
  if (ytVids.length) {
    html += `
      <div class="rel-section rel-animate rel-animate-delay-8">
        <div class="rel-section-header">
          <span class="rel-platform-icon rel-icon-yt">▶️</span>
          <span>Conteúdos YouTube — Vídeos</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Título</th><th>Views</th><th>Tempo</th><th>Inscritos</th><th>CTR</th></tr></thead>
            <tbody>
              ${ytVids.map((v,i) => `<tr>
                <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
                <td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(v.titulo||'').replace(/"/g,'&quot;')}">${truncate(v.titulo, 65) || '<span class="text-faint">Vídeo</span>'}</td>
                <td><strong>${fmtN(v.visualizacoes)}</strong></td>
                <td>${(v.horasExibicao||0).toFixed(1)}h</td>
                <td>${fmtN(v.inscritos)}</td>
                <td>${v.ctr||0}%</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  // ── TikTok — Dias individuais ──
  const tkDaily = (rel._rawPosts?.tkDaily || []).slice().sort((a,b) => (b.videoViews||0) - (a.videoViews||0));
  if (tkDaily.length) {
    const top10 = tkDaily.slice(0, 10);
    html += `
      <div class="rel-section rel-animate rel-animate-delay-8">
        <div class="rel-section-header">
          <span class="rel-platform-icon rel-icon-tk">🎵</span>
          <span>TikTok — Top 10 Dias por Views</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Data</th><th>Video Views</th><th>Curtidas</th><th>Comentários</th><th>Compartilh.</th><th>Visitas Perfil</th></tr></thead>
            <tbody>
              ${top10.map((d,i) => `<tr>
                <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
                <td>${d.data || '—'}</td>
                <td><strong>${fmtN(d.videoViews)}</strong></td>
                <td>${fmtN(d.likes)}</td>
                <td>${fmtN(d.comments)}</td>
                <td>${fmtN(d.shares)}</td>
                <td>${fmtN(d.profileViews)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  return html;
}

// =====================================================
// CHART.JS RENDERERS
// =====================================================
let relChartInstances = [];

function destroyRelCharts() {
  relChartInstances.forEach(c => { try { c.destroy(); } catch(e){} });
  relChartInstances = [];
  // Also destroy any orphaned Chart instances on canvases
  document.querySelectorAll('canvas').forEach(cv => {
    const existing = Chart.getChart(cv);
    if (existing) { try { existing.destroy(); } catch(e){} }
  });
}

function renderRelatorioCharts(rel, anterior) {
  destroyRelCharts();

  // Instagram bar chart
  const igCanvas = document.getElementById('chart-ig');
  if (igCanvas && (rel.instagram.feed || rel.instagram.stories)) {
    const f = rel.instagram.feed;
    const s = rel.instagram.stories;
    const af = anterior?.instagram?.feed;
    const as_ = anterior?.instagram?.stories;

    const labels = ['Alcance', 'Views', 'Curtidas', 'Engajamento'];
    const current = [
      (f?.alcance||0) + (s?.alcance||0),
      (f?.visualizacoes||0) + (s?.visualizacoes||0),
      (f?.curtidas||0) + (s?.curtidas||0),
      (f?.engajamento||0)
    ];

    const datasets = [{
      label: rel.mesLabel,
      data: current,
      backgroundColor: PLATAFORMA_CORES.instagram + '99',
      borderColor: PLATAFORMA_CORES.instagram,
      borderWidth: 1
    }];

    if (anterior && (af || as_)) {
      datasets.push({
        label: anterior.mesLabel,
        data: [
          (af?.alcance||0) + (as_?.alcance||0),
          (af?.visualizacoes||0) + (as_?.visualizacoes||0),
          (af?.curtidas||0) + (as_?.curtidas||0),
          (af?.engajamento||0)
        ],
        backgroundColor: PLATAFORMA_CORES.instagram + '40',
        borderColor: PLATAFORMA_CORES.instagram + '80',
        borderWidth: 1
      });
    }

    relChartInstances.push(new Chart(igCanvas, {
      type: 'bar',
      data: { labels, datasets },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    }));
  }

  // Facebook daily line chart
  const fbCanvas = document.getElementById('chart-fb-daily');
  if (fbCanvas && rel.facebook.page?.engajamentosDiarios) {
    const data = rel.facebook.page.engajamentosDiarios;
    const labels = data.map((_, i) => i + 1);

    const datasets = [{
      label: `${rel.mesLabel} — Engajamentos/dia`,
      data,
      borderColor: PLATAFORMA_CORES.facebook,
      backgroundColor: PLATAFORMA_CORES.facebook + '20',
      fill: true,
      tension: 0.3
    }];

    if (anterior?.facebook?.page?.engajamentosDiarios) {
      datasets.push({
        label: `${anterior.mesLabel} — Engajamentos/dia`,
        data: anterior.facebook.page.engajamentosDiarios,
        borderColor: PLATAFORMA_CORES.facebook + '60',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3
      });
    }

    relChartInstances.push(new Chart(fbCanvas, {
      type: 'line',
      data: { labels, datasets },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    }));
  }

  // YouTube daily line chart
  const ytCanvas = document.getElementById('chart-yt-daily');
  if (ytCanvas && rel.youtube.totalDiario?.viewsDiarias) {
    const data = rel.youtube.totalDiario.viewsDiarias;
    const labels = data.map((_, i) => i + 1);

    const datasets = [{
      label: `${rel.mesLabel} — Views/dia`,
      data,
      borderColor: PLATAFORMA_CORES.youtube,
      backgroundColor: PLATAFORMA_CORES.youtube + '20',
      fill: true,
      tension: 0.3
    }];

    if (anterior?.youtube?.totalDiario?.viewsDiarias) {
      datasets.push({
        label: `${anterior.mesLabel} — Views/dia`,
        data: anterior.youtube.totalDiario.viewsDiarias,
        borderColor: PLATAFORMA_CORES.youtube + '60',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3
      });
    }

    relChartInstances.push(new Chart(ytCanvas, {
      type: 'line',
      data: { labels, datasets },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    }));
  }

  // TikTok daily line chart
  const tkCanvas = document.getElementById('chart-tk-daily');
  if (tkCanvas && rel.tiktok.overview?.viewsDiarias) {
    const data = rel.tiktok.overview.viewsDiarias;
    const labels = data.map((_, i) => i + 1);

    const datasets = [{
      label: `${rel.mesLabel} — Video Views/dia`,
      data,
      borderColor: PLATAFORMA_CORES.tiktok,
      backgroundColor: PLATAFORMA_CORES.tiktok + '15',
      fill: true,
      tension: 0.3
    }];

    if (anterior?.tiktok?.overview?.viewsDiarias) {
      datasets.push({
        label: `${anterior.mesLabel} — Video Views/dia`,
        data: anterior.tiktok.overview.viewsDiarias,
        borderColor: PLATAFORMA_CORES.tiktok + '60',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3
      });
    }

    relChartInstances.push(new Chart(tkCanvas, {
      type: 'line',
      data: { labels, datasets },
      options: { responsive: true, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    }));
  }
}

// =====================================================
// MODAL — Novo Relatório (upload + criação)
// =====================================================
let relUploadedFiles = []; // { fileName, text, parsed }

function initRelatorioModal() {
  relUploadedFiles = [];
  document.getElementById('rel-file-list').innerHTML = '';
  document.getElementById('rel-upload-input').value = '';

  // populate client dropdown
  const sel = document.getElementById('rel-cliente');
  sel.innerHTML = getClients().map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

  // populate month/year
  const now = new Date();
  document.getElementById('rel-ano').value = now.getFullYear();
  document.getElementById('rel-mes').value = now.getMonth(); // previous month by default
}

function handleRelCSVUpload(input) {
  const files = input.files;
  if (!files.length) return;

  Array.from(files).forEach(file => {
    readCSVFile(file, text => {
      const parsed = processCSVFile(text, file.name);
      relUploadedFiles.push({ fileName: file.name, text, parsed });
      renderRelFileList();
    });
  });

  input.value = '';
}

function removeRelFile(idx) {
  relUploadedFiles.splice(idx, 1);
  renderRelFileList();
}

function renderRelFileList() {
  const list = document.getElementById('rel-file-list');
  if (!relUploadedFiles.length) {
    list.innerHTML = '<div class="text-muted text-sm" style="padding:12px">Nenhum arquivo carregado</div>';
    return;
  }

  list.innerHTML = relUploadedFiles.map((f, i) => {
    const p = f.parsed;
    const isErr = p.type === 'unknown';
    const platformCls = p.platform ? `rel-plat-${p.platform === 'instagram' ? 'ig' : p.platform === 'facebook' ? 'fb' : p.platform === 'youtube' ? 'yt' : 'tk'}` : '';

    return `
      <div class="rel-file-item ${isErr ? 'rel-file-error' : ''}">
        <div>
          ${!isErr ? `<span class="rel-plat-badge ${platformCls}">${p.platform?.substring(0,2).toUpperCase()}</span>` : '⚠️'}
          <strong>${f.fileName}</strong>
          <span class="text-muted text-xs ml-8">${p.label || p.error}</span>
        </div>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="removeRelFile(${i})">✕</button>
      </div>
    `;
  }).join('');
}

function gerarRelatorio() {
  const clienteId = document.getElementById('rel-cliente').value;
  const ano = +document.getElementById('rel-ano').value;
  const mes = +document.getElementById('rel-mes').value;

  if (!clienteId) return showToast('Selecione um cliente', true);
  if (!mes || mes < 1 || mes > 12) return showToast('Selecione um mês válido', true);
  if (!ano || ano < 2020) return showToast('Ano inválido', true);

  const validFiles = relUploadedFiles.map(f => f.parsed).filter(p => p.type !== 'unknown');
  if (!validFiles.length) return showToast('Carregue pelo menos um CSV válido', true);

  const rels = getRelatorios();
  const existingIdx = rels.findIndex(r => r.clienteId === clienteId && r.mes === mes && r.ano === ano);

  let relId;
  if (existingIdx >= 0) {
    // Merge into existing report
    const existing = rels[existingIdx];
    validFiles.forEach(pf => mergeIntoRelatorio(existing, pf));
    existing.updatedAt = new Date().toISOString();
    relId = existing.id;
    saveRelatorios(rels);
    showToast('Dados adicionados ao relatório existente!');
  } else {
    const rel = buildRelatorio(clienteId, ano, mes, validFiles);
    relId = rel.id;
    rels.push(rel);
    saveRelatorios(rels);
    showToast('Relatório criado com sucesso!');
  }

  closeModal('relatorio');
  renderRelatorio();
}

// =====================================================
// ADICIONAR CSVs A RELATÓRIO EXISTENTE
// =====================================================
function handleAddCSVsToReport(relId, input) {
  const files = input.files;
  if (!files.length) return;

  const rels = getRelatorios();
  const idx = rels.findIndex(r => r.id === relId);
  if (idx < 0) return showToast('Relatório não encontrado', true);
  const rel = rels[idx];

  let addedCount = 0;
  let pending = files.length;

  Array.from(files).forEach(file => {
    readCSVFile(file, text => {
      const parsed = processCSVFile(text, file.name);

      if (parsed.type === 'unknown') {
        showToast(`"${file.name}" — formato não reconhecido`, true);
      } else {
        mergeIntoRelatorio(rel, parsed);
        addedCount++;
        showToast(`✓ ${file.name} → ${parsed.label}`);
      }

      pending--;
      if (pending === 0) {
        rel.updatedAt = new Date().toISOString();
        rels[idx] = rel;
        saveRelatorios(rels);
        renderRelatorio();
        showToast(`${addedCount} arquivo(s) adicionado(s) ao relatório!`);
      }
    });
  });

  input.value = '';
}

function mergeIntoRelatorio(rel, parsed) {
  switch (parsed.type) {
    case 'ig_feed':
      if (rel.instagram.feed) {
        // Merge: sum aggregated, concat posts
        const a = rel.instagram.feed, b = parsed.aggregated;
        a.posts += b.posts; a.visualizacoes += b.visualizacoes; a.alcance += b.alcance;
        a.curtidas += b.curtidas; a.compartilhamentos += b.compartilhamentos;
        a.seguimentos += b.seguimentos; a.comentarios += b.comentarios; a.salvamentos += b.salvamentos;
        a.engajamento = a.curtidas + a.comentarios + a.compartilhamentos + a.salvamentos;
      } else {
        rel.instagram.feed = parsed.aggregated;
      }
      rel._rawPosts.igFeed = (rel._rawPosts.igFeed || []).concat(parsed.posts || []);
      break;

    case 'ig_stories':
      if (rel.instagram.stories) {
        const a = rel.instagram.stories, b = parsed.aggregated;
        a.posts += b.posts; a.visualizacoes += b.visualizacoes; a.alcance += b.alcance;
        a.curtidas += b.curtidas; a.compartilhamentos += b.compartilhamentos;
        a.seguimentos += b.seguimentos; a.respostas += b.respostas;
        a.navegacao += b.navegacao; a.cliquesLink += b.cliquesLink;
      } else {
        rel.instagram.stories = parsed.aggregated;
      }
      rel._rawPosts.igStories = (rel._rawPosts.igStories || []).concat(parsed.posts || []);
      break;

    case 'fb_page_daily':
      // Replace — daily data is a full dataset, not cumulative
      rel.facebook.page = parsed.aggregated;
      break;

    case 'fb_posts':
      if (rel.facebook.posts) {
        const a = rel.facebook.posts, b = parsed.aggregated;
        a.posts += b.posts; a.visualizacoes += b.visualizacoes; a.alcance += b.alcance;
        a.reacoes += b.reacoes; a.comentarios += b.comentarios; a.compartilhamentos += b.compartilhamentos;
        a.cliques += b.cliques; a.engajamento = a.reacoes + a.comentarios + a.compartilhamentos;
      } else {
        rel.facebook.posts = parsed.aggregated;
      }
      rel._rawPosts.fbPosts = (rel._rawPosts.fbPosts || []).concat(parsed.posts || []);
      break;

    case 'fb_videos':
      if (rel.facebook.videos) {
        const a = rel.facebook.videos, b = parsed.aggregated;
        a.videos += b.videos; a.alcance += b.alcance; a.views3s += b.views3s;
        a.views1min += b.views1min; a.reacoes += b.reacoes;
        a.comentarios += b.comentarios; a.compartilhamentos += b.compartilhamentos;
      } else {
        rel.facebook.videos = parsed.aggregated;
      }
      rel._rawPosts.fbVideos = (rel._rawPosts.fbVideos || []).concat(parsed.posts || []);
      break;

    case 'yt_tabela':
      // Replace — YouTube tabela is a full summary
      rel.youtube.tabela = parsed.aggregated;
      rel._rawPosts.ytVideos = parsed.posts || [];
      break;

    case 'yt_total_diario':
      rel.youtube.totalDiario = parsed.aggregated;
      break;

    case 'tiktok_overview':
      rel.tiktok.overview = parsed.aggregated;
      rel._rawPosts.tkDaily = parsed.daily || [];
      break;

    default:
      // Instagram Insights (ig_insights_*)
      if (parsed.type && parsed.type.startsWith('ig_insights_')) {
        if (!rel.instagram.account) rel.instagram.account = {};
        const key = parsed.metricType;
        rel.instagram.account[key] = parsed.aggregated;
        if (parsed.demographics) rel.instagram.account.demographics = parsed.demographics;
      }
      break;
  }
}

function deleteRelatorio(id) {
  if (!confirm('Excluir este relatório?')) return;
  const rels = getRelatorios().filter(r => r.id !== id);
  saveRelatorios(rels);
  if (relViewingId === id) relViewingId = null;
  renderRelatorio();
  showToast('Relatório excluído');
}

// =====================================================
// DRAG & DROP SUPPORT
// =====================================================
function initDragDrop() {
  const zone = document.getElementById('rel-drop-zone');
  if (!zone) return;

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('rel-drop-active');
  });

  zone.addEventListener('dragleave', e => {
    e.preventDefault();
    zone.classList.remove('rel-drop-active');
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('rel-drop-active');

    const files = e.dataTransfer.files;
    Array.from(files).forEach(file => {
      if (!file.name.endsWith('.csv')) return;
      readCSVFile(file, text => {
        const parsed = processCSVFile(text, file.name);
        relUploadedFiles.push({ fileName: file.name, text, parsed });
        renderRelFileList();
      });
    });
  });
}

// =====================================================
// CLIENTES → PERFORMANCE (comparativo mensal)
// =====================================================
let _perfClienteId = '';
let _perfMesA = '';
let _perfMesB = '';

function renderClientesPerformance() {
  consolidateDuplicates();
  const container = document.getElementById('clientes-tab');
  const rels = getRelatorios();
  const clientes = getClients().filter(c => rels.some(r => r.clienteId === c.id));

  // If no reports exist at all
  if (!rels.length) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:12px">📊</div>
        <div class="text-muted">Nenhum relatório emitido ainda.</div>
        <div class="text-sm text-faint mt-4">Acesse <strong>Ferramentas → Relatórios</strong> para criar relatórios a partir de CSVs.</div>
        <button class="btn btn-primary btn-sm mt-16" onclick="setPage('relatorio')">Ir para Relatórios</button>
      </div>`;
    return;
  }

  // Available months for selected client
  const clienteRels = _perfClienteId ? rels.filter(r => r.clienteId === _perfClienteId).sort((a,b) => a.ano-b.ano || a.mes-b.mes) : [];
  const mesesDisponiveis = clienteRels.map(r => ({ value: r.id, label: `${r.mesLabel} ${r.ano}` }));

  // Resolve selected reports
  const relA = _perfMesA ? rels.find(r => r.id === _perfMesA) : null;
  const relB = _perfMesB ? rels.find(r => r.id === _perfMesB) : null;

  container.innerHTML = `
    <div class="section-title mb-12">Comparativo de Performance</div>

    <!-- Seletores -->
    <div class="card mb-20">
      <div class="grid grid-3 gap-16" style="align-items:end">
        <div class="form-group mb-0">
          <label>Cliente</label>
          <select class="input-sm" style="width:100%" onchange="_perfClienteId=this.value;_perfMesA='';_perfMesB='';renderClientesPerformance()">
            <option value="">Selecione um cliente</option>
            ${clientes.map(c => `<option value="${c.id}" ${_perfClienteId===c.id?'selected':''}>${c.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-0">
          <label>Mês A</label>
          <select class="input-sm" style="width:100%" onchange="_perfMesA=this.value;renderClientesPerformance()" ${!_perfClienteId?'disabled':''}>
            <option value="">Selecione</option>
            ${mesesDisponiveis.map(m => `<option value="${m.value}" ${_perfMesA===m.value?'selected':''}>${m.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-0">
          <label>Mês B</label>
          <select class="input-sm" style="width:100%" onchange="_perfMesB=this.value;renderClientesPerformance()" ${!_perfClienteId?'disabled':''}>
            <option value="">Selecione</option>
            ${mesesDisponiveis.filter(m => m.value !== _perfMesA).map(m => `<option value="${m.value}" ${_perfMesB===m.value?'selected':''}>${m.label}</option>`).join('')}
          </select>
        </div>
      </div>
      ${_perfClienteId && !mesesDisponiveis.length ? `
        <div class="text-sm text-muted mt-12">Nenhum relatório para este cliente. <a href="#" onclick="setPage('relatorio');return false" style="color:var(--accent)">Criar relatório</a></div>
      ` : ''}
      ${_perfClienteId && mesesDisponiveis.length === 1 ? `
        <div class="text-sm text-muted mt-12">Apenas 1 mês disponível. Crie mais relatórios para comparar.</div>
      ` : ''}
    </div>

    <!-- Comparativo -->
    <div id="perf-comparativo"></div>
  `;

  if (relA && relB) {
    renderPerfComparativo(document.getElementById('perf-comparativo'), relA, relB);
  } else if (relA && !relB) {
    // Show single report summary
    renderPerfSingle(document.getElementById('perf-comparativo'), relA);
  }
}

function renderPerfSingle(container, rel) {
  _perfRelA = rel;
  _perfRelB = null;
  _renderPerfWithTabs(container, rel, null);
}

function renderPerfComparativo(container, relA, relB) {
  if (relA.ano > relB.ano || (relA.ano === relB.ano && relA.mes > relB.mes)) {
    [relA, relB] = [relB, relA];
  }
  _perfRelA = relA;
  _perfRelB = relB;
  _renderPerfWithTabs(container, relA, relB);
}

// =====================================================
// PERFORMANCE — Tab System
// =====================================================
let _perfTab = 'resumo';
let _perfRelA = null;
let _perfRelB = null;
let _perfSort = {}; // { sectionKey: { col: 'alcance', dir: 'desc' } }

function _getSortState(key) {
  if (!_perfSort[key]) {
    const defaults = {
      ig_feed: 'alcance', ig_stories: 'alcance',
      fb_posts: 'alcance', fb_videos: 'alcance',
      yt_videos: 'visualizacoes', tk_daily: 'videoViews'
    };
    _perfSort[key] = { col: defaults[key] || 'alcance', dir: 'desc' };
  }
  return _perfSort[key];
}

function _toggleSort(key, col) {
  const s = _getSortState(key);
  if (s.col === col) s.dir = s.dir === 'desc' ? 'asc' : 'desc';
  else { s.col = col; s.dir = 'desc'; }
  setPerfTab(_perfTab);
}

function _sortBtn(sectionKey, col, label) {
  const s = _getSortState(sectionKey);
  const active = s.col === col;
  const arrow = active ? (s.dir === 'desc' ? ' ▼' : ' ▲') : '';
  return `<th class="sort-btn ${active?'sort-active':''}" onclick="_toggleSort('${sectionKey}','${col}')">${label}${arrow}</th>`;
}

function _sortArray(arr, sectionKey, engCalc) {
  const s = _getSortState(sectionKey);
  const col = s.col;
  return arr.slice().sort((a, b) => {
    const va = col === 'engajamento' && engCalc ? engCalc(a) : (a[col] || 0);
    const vb = col === 'engajamento' && engCalc ? engCalc(b) : (b[col] || 0);
    return s.dir === 'desc' ? vb - va : va - vb;
  });
}

function setPerfTab(tab) {
  _perfTab = tab;
  document.querySelectorAll('.perf-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const container = document.getElementById('perf-tab-content');
  if (container) _renderPerfTabContent(container, _perfRelA, _perfRelB);
}

function _renderPerfWithTabs(container, relA, relB) {
  const labA = relA ? `${relA.mesLabel} ${relA.ano}` : '';
  const labB = relB ? `${relB.mesLabel} ${relB.ano}` : '';
  const title = relB ? `${labA} vs ${labB}` : labA;

  // Detect which platforms have data
  const latest = relB || relA;
  const hasIG = latest.instagram?.feed || latest.instagram?.stories;
  const hasFB = latest.facebook?.posts || latest.facebook?.videos || latest.facebook?.page;
  const hasYT = latest.youtube?.tabela || latest.youtube?.totalDiario;
  const hasTK = latest.tiktok?.overview;

  container.innerHTML = `
    <div class="rel-view" id="perf-view">
      <div class="flex-between mb-8 rel-animate">
        <div>
          <div class="rel-header-label">${relB ? 'COMPARATIVO' : 'PERFORMANCE'}</div>
          <h2 class="rel-header-title" style="font-size:24px;margin-bottom:2px">${latest.clienteNome}</h2>
          <div class="rel-header-sub">${title}</div>
        </div>
        <button class="btn btn-ghost btn-sm rel-btn-export" onclick="exportPerfPDF('${relB?'compare':'single'}','${relB ? relA.id+'_'+relB.id : relA.id}')">📄 PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="copyPerfText('${relB?'compare':'single'}','${relB ? relA.id+'_'+relB.id : relA.id}')">📋 Copiar Texto</button>
      </div>

      <div class="perf-tabs rel-animate rel-animate-delay-1">
        <button class="perf-tab-btn active" data-tab="resumo" onclick="setPerfTab('resumo')">Resumo</button>
        ${hasIG ? '<button class="perf-tab-btn" data-tab="instagram" onclick="setPerfTab(\'instagram\')">📸 Instagram</button>' : ''}
        ${hasFB ? '<button class="perf-tab-btn" data-tab="facebook" onclick="setPerfTab(\'facebook\')">📘 Facebook</button>' : ''}
        ${hasYT ? '<button class="perf-tab-btn" data-tab="youtube" onclick="setPerfTab(\'youtube\')">▶️ YouTube</button>' : ''}
        ${hasTK ? '<button class="perf-tab-btn" data-tab="tiktok" onclick="setPerfTab(\'tiktok\')">🎵 TikTok</button>' : ''}
      </div>

      <div id="perf-tab-content" class="rel-animate rel-animate-delay-2"></div>
    </div>
  `;

  _perfTab = 'resumo';
  _renderPerfTabContent(document.getElementById('perf-tab-content'), relA, relB);
}

function _renderPerfTabContent(container, relA, relB) {
  const tab = _perfTab;
  destroyRelCharts();

  switch (tab) {
    case 'resumo':   container.innerHTML = _perfTabResumo(relA, relB); break;
    case 'instagram': container.innerHTML = _perfTabInstagram(relA, relB); break;
    case 'facebook':  container.innerHTML = _perfTabFacebook(relA, relB); break;
    case 'youtube':   container.innerHTML = _perfTabYoutube(relA, relB); break;
    case 'tiktok':    container.innerHTML = _perfTabTiktok(relA, relB); break;
  }

  // Init charts after DOM
  setTimeout(() => {
    if (tab === 'instagram') _initChartIG(relA, relB);
    if (tab === 'facebook')  _initChartFB(relA, relB);
    if (tab === 'youtube')   _initChartYT(relA, relB);
    if (tab === 'tiktok')    _initChartTK(relA, relB);
  }, 100);
}

// ── Resumo ──
function _perfTabResumo(relA, relB) {
  const latest = relB || relA;
  const prev = relB ? relA : null;
  const fmtN = n => (n||0).toLocaleString('pt-BR');

  // Build summary rows per platform
  const rows = [];

  const igf = latest.instagram?.feed, igs = latest.instagram?.stories;
  if (igf || igs) {
    const alc = (igf?.alcance||0) + (igs?.alcance||0);
    const views = (igf?.visualizacoes||0) + (igs?.visualizacoes||0);
    const eng = (igf?.engajamento||0);
    const pAlc = prev ? (prev.instagram?.feed?.alcance||0) + (prev.instagram?.stories?.alcance||0) : null;
    rows.push({ icon: '📸', plat: 'Instagram', alcance: alc, views, eng, prevAlc: pAlc });
  }

  const fbp = latest.facebook?.posts;
  if (fbp) {
    const pAlc = prev?.facebook?.posts?.alcance;
    rows.push({ icon: '📘', plat: 'Facebook', alcance: fbp.alcance, views: fbp.visualizacoes, eng: fbp.engajamento, prevAlc: pAlc });
  }

  const yt = latest.youtube?.tabela;
  if (yt) {
    const pViews = prev?.youtube?.tabela?.visualizacoes;
    rows.push({ icon: '▶️', plat: 'YouTube', alcance: yt.impressoes, views: yt.visualizacoes, eng: yt.inscritos, prevAlc: pViews, alcLabel: 'Impressões', engLabel: 'Inscritos' });
  }

  const tk = latest.tiktok?.overview;
  if (tk) {
    const pViews = prev?.tiktok?.overview?.totalVideoViews;
    rows.push({ icon: '🎵', plat: 'TikTok', alcance: tk.totalVideoViews, views: tk.totalVideoViews, eng: tk.totalEngajamento, prevAlc: pViews, alcLabel: 'Video Views' });
  }

  // Highlight cards
  const highlights = rows.map(r => {
    const chg = r.prevAlc != null ? calcChange(r.alcance, r.prevAlc) : null;
    return `
      <div class="rel-highlight-card">
        <div class="rel-highlight-platform">${r.icon} ${r.plat}</div>
        <div class="rel-highlight-value" style="font-size:26px">${chg != null ? (chg>0?'+':'')+chg.toFixed(0)+'%' : fmtN(r.alcance)}</div>
        <div class="rel-highlight-sub">${r.alcLabel || 'alcance'}</div>
      </div>`;
  });

  return `
    <div class="rel-highlights-grid" style="margin-top:16px">
      ${highlights.join('')}
    </div>

    ${rows.length ? `
      <div class="rel-section">
        <div class="rel-section-header">Visão Geral por Plataforma</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Plataforma</th><th>Alcance / Views</th><th>Visualizações</th><th>Engajamento</th>${prev?'<th>Variação</th>':''}</tr></thead>
            <tbody>
              ${rows.map(r => `<tr>
                <td><strong>${r.icon} ${r.plat}</strong></td>
                <td>${fmtN(r.alcance)}</td>
                <td>${fmtN(r.views)}</td>
                <td>${fmtN(r.eng)}</td>
                ${prev && r.prevAlc != null ? `<td>${changeTag(calcChange(r.alcance, r.prevAlc))}</td>` : prev ? '<td>—</td>' : ''}
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    ${!relB ? '<div class="text-sm text-muted" style="text-align:center;padding:12px">Selecione o <strong>Mês B</strong> acima para ver comparativos detalhados.</div>' : ''}
  `;
}

// ── Instagram ──
function _perfTabInstagram(relA, relB) {
  const latest = relB || relA;
  const prev = relB ? relA : null;
  const f = latest.instagram?.feed, af = prev?.instagram?.feed;
  const s = latest.instagram?.stories, as_ = prev?.instagram?.stories;
  const acc = latest.instagram?.account, pacc = prev?.instagram?.account;
  const fmtN = n => (n||0).toLocaleString('pt-BR');
  const truncate = (s, len) => { s = (s||'').replace(/\n/g,' ').trim(); return s.length > len ? s.substring(0,len)+'...' : s; };

  let html = '';

  // Account-level metrics (from Instagram Insights CSVs)
  if (acc && Object.keys(acc).some(k => k !== 'demographics')) {
    html += '<div class="rel-subsection-title">Conta — Métricas Diárias (Insights)</div>';
    html += '<div class="rel-metrics-grid cols-4">';
    if (acc.alcance) html += metricCard('Alcance Total', acc.alcance.total, pacc?.alcance?.total);
    if (acc.visualizacoes) html += metricCard('Visualizações', acc.visualizacoes.total, pacc?.visualizacoes?.total);
    if (acc.seguidores) html += metricCard('Novos Seguidores', acc.seguidores.total, pacc?.seguidores?.total);
    if (acc.visitas) html += metricCard('Visitas ao Perfil', acc.visitas.total, pacc?.visitas?.total);
    html += '</div>';
    html += '<div class="rel-metrics-grid cols-3" style="margin-top:8px">';
    if (acc.interacoes) html += metricCard('Interações', acc.interacoes.total, pacc?.interacoes?.total);
    if (acc.cliques_link) html += metricCard('Cliques no Link', acc.cliques_link.total, pacc?.cliques_link?.total);
    if (acc.alcance) html += metricCard('Média Alcance/dia', acc.alcance.media, pacc?.alcance?.media);
    html += '</div>';

    // Demographics
    if (acc.demographics?.ageGender?.length || acc.demographics?.cities?.length) {
      html += '<div class="rel-subsection-title">Público</div>';
      html += '<div class="rel-grid-2">';

      if (acc.demographics?.ageGender?.length) {
        html += '<div class="rel-chart-wrap" style="height:250px;overflow:hidden"><div class="rel-chart-title">Faixa Etária</div><canvas id="chart-ig-age"></canvas></div>';
      }
      if (acc.demographics?.cities?.length) {
        html += '<div class="rel-chart-wrap" style="height:250px;overflow:hidden"><div class="rel-chart-title">Top Cidades</div><canvas id="chart-ig-cities"></canvas></div>';
      }

      html += '</div>';
    }
  }

  if (f) {
    html += `
      <div class="rel-subsection-title">Feed & Reels — Métricas</div>
      <div class="rel-metrics-grid cols-4">
        ${metricCard('Posts', f.posts, af?.posts)}
        ${metricCard('Alcance', f.alcance, af?.alcance)}
        ${metricCard('Visualizações', f.visualizacoes, af?.visualizacoes)}
        ${metricCard('Curtidas', f.curtidas, af?.curtidas)}
      </div>
      <div class="rel-metrics-grid cols-4" style="margin-top:8px">
        ${metricCard('Comentários', f.comentarios, af?.comentarios)}
        ${metricCard('Compartilhamentos', f.compartilhamentos, af?.compartilhamentos)}
        ${metricCard('Salvamentos', f.salvamentos, af?.salvamentos)}
        ${metricCard('Seguimentos', f.seguimentos, af?.seguimentos)}
      </div>
    `;

    if (prev && af) {
      html += renderComparisonTable('Feed — Comparativo',
        ['Posts','Alcance','Visualizações','Curtidas','Comentários','Compartilhamentos','Salvamentos','Seguimentos','Engajamento'],
        [f.posts,f.alcance,f.visualizacoes,f.curtidas,f.comentarios,f.compartilhamentos,f.salvamentos,f.seguimentos,f.engajamento],
        [af.posts,af.alcance,af.visualizacoes,af.curtidas,af.comentarios,af.compartilhamentos,af.salvamentos,af.seguimentos,af.engajamento],
        latest.mesLabel, prev.mesLabel
      );
    }

    // Content tables segmented by type
    html += _renderIGFeedContent(latest);
  }

  if (s) {
    html += `
      <div class="rel-subsection-title" style="margin-top:24px">Stories — Métricas</div>
      <div class="rel-metrics-grid cols-4">
        ${metricCard('Stories', s.posts, as_?.posts)}
        ${metricCard('Alcance', s.alcance, as_?.alcance)}
        ${metricCard('Visualizações', s.visualizacoes, as_?.visualizacoes)}
        ${metricCard('Curtidas', s.curtidas, as_?.curtidas)}
      </div>
    `;

    if (prev && as_) {
      html += renderComparisonTable('Stories — Comparativo',
        ['Stories','Alcance','Visualizações','Curtidas','Respostas','Seguimentos','Cliques no link'],
        [s.posts,s.alcance,s.visualizacoes,s.curtidas,s.respostas,s.seguimentos,s.cliquesLink],
        [as_.posts,as_.alcance,as_.visualizacoes,as_.curtidas,as_.respostas,as_.seguimentos,as_.cliquesLink],
        latest.mesLabel, prev.mesLabel
      );
    }

    // Stories content table
    const allStories = _sortArray(latest._rawPosts?.igStories || [], 'ig_stories');
    if (allStories.length) {
      const showLimit = 10;
      const stories = allStories.slice(0, showLimit);
      const remaining = allStories.length - showLimit;
      html += `<div class="rel-subsection-title">Stories — Conteúdos (Top ${Math.min(showLimit, allStories.length)} de ${allStories.length})</div>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Conteúdo</th>${_sortBtn('ig_stories','alcance','Alcance')}${_sortBtn('ig_stories','visualizacoes','Views')}${_sortBtn('ig_stories','curtidas','Curtidas')}${_sortBtn('ig_stories','respostas','Respostas')}</tr></thead>
          <tbody>${stories.map((p,i) => `<tr>
            <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
            <td style="max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(p.descricao||'').replace(/"/g,'&quot;')}">${truncate(p.descricao,55)||'<span class="text-faint">Story</span>'}</td>
            <td><strong>${fmtN(p.alcance)}</strong></td>
            <td>${fmtN(p.visualizacoes)}</td>
            <td>${fmtN(p.curtidas)}</td>
            <td>${fmtN(p.respostas)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        ${remaining > 0 ? `<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:4px">+ ${remaining} stories restantes</div>` : ''}`;
    }
  }

  html += '<div class="rel-chart-wrap" style="margin-top:16px"><div class="rel-chart-title">Comparativo Visual</div><canvas id="chart-ig"></canvas></div>';
  return html;
}

function _renderIGFeedContent(rel) {
  const igFeed = (rel._rawPosts?.igFeed || []).slice();
  if (!igFeed.length) return '';
  const fmtN = n => (n||0).toLocaleString('pt-BR');
  const trunc = (s, n) => { s=(s||'').replace(/\n/g,' ').trim(); return s.length>n?s.substring(0,n)+'...':s; };
  const engCalc = p => (p.curtidas||0)+(p.comentarios||0)+(p.compartilhamentos||0)+(p.salvamentos||0);

  const classify = p => { const t=(p.tipo||'').toLowerCase(); return t.includes('reel')?'Reels':t.includes('carrossel')?'Carrosséis':'Imagens'; };
  const groups = {};
  igFeed.forEach(p => { const c=classify(p); if(!groups[c])groups[c]=[]; groups[c].push(p); });

  const SK = 'ig_feed';
  Object.values(groups).forEach(arr => {
    const sorted = _sortArray(arr, SK, engCalc);
    arr.length = 0;
    arr.push(...sorted);
  });

  const order = ['Reels','Carrosséis','Imagens'].filter(k => groups[k]?.length);
  const icons = {Reels:'🎬','Carrosséis':'🖼️',Imagens:'📷'};

  let html = '<div class="rel-subsection-title">Feed — Conteúdos</div>';
  for (const cat of order) {
    const posts = groups[cat];
    html += `
      <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin:12px 0 6px">${icons[cat]} ${cat} (${posts.length})</div>
      <div class="table-wrap" style="margin-bottom:12px"><table>
        <thead><tr><th>#</th><th>Conteúdo</th>${_sortBtn(SK,'alcance','Alcance')}${_sortBtn(SK,'visualizacoes','Views')}${_sortBtn(SK,'curtidas','Curtidas')}${_sortBtn(SK,'engajamento','Engaj.')}<th>Salv.</th></tr></thead>
        <tbody>${posts.map((p,i) => `<tr>
          <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
          <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(p.descricao||'').replace(/"/g,'&quot;')}">${trunc(p.descricao,50)||'<span class="text-faint">—</span>'}</td>
          <td><strong>${fmtN(p.alcance)}</strong></td>
          <td>${fmtN(p.visualizacoes)}</td>
          <td>${fmtN(p.curtidas)}</td>
          <td>${fmtN(engCalc(p))}</td>
          <td>${fmtN(p.salvamentos)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
  }
  return html;
}

// ── Facebook ──
function _perfTabFacebook(relA, relB) {
  const latest = relB || relA;
  const prev = relB ? relA : null;
  const p = latest.facebook?.posts, ap = prev?.facebook?.posts;
  const v = latest.facebook?.videos, av = prev?.facebook?.videos;
  const pg = latest.facebook?.page, apg = prev?.facebook?.page;
  const fmtN = n => (n||0).toLocaleString('pt-BR');
  const truncate = (s, len) => { s = (s||'').replace(/\n/g,' ').trim(); return s.length > len ? s.substring(0,len)+'...' : s; };

  let html = '';

  if (p) {
    html += `<div class="rel-subsection-title">Posts — Métricas</div>
      <div class="rel-metrics-grid cols-4">
        ${metricCard('Posts', p.posts, ap?.posts)}
        ${metricCard('Alcance', p.alcance, ap?.alcance)}
        ${metricCard('Visualizações', p.visualizacoes, ap?.visualizacoes)}
        ${metricCard('Engajamento', p.engajamento, ap?.engajamento)}
      </div>`;

    if (prev && ap) {
      html += renderComparisonTable('Posts — Comparativo',
        ['Posts','Alcance','Visualizações','Reações','Comentários','Compartilhamentos'],
        [p.posts,p.alcance,p.visualizacoes,p.reacoes,p.comentarios,p.compartilhamentos],
        [ap.posts,ap.alcance,ap.visualizacoes,ap.reacoes,ap.comentarios,ap.compartilhamentos],
        latest.mesLabel, prev.mesLabel
      );
    }

    // FB Posts content
    const fbPosts = _sortArray(latest._rawPosts?.fbPosts||[], 'fb_posts');
    if (fbPosts.length) {
      html += `<div class="rel-subsection-title">Posts — Conteúdos</div>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Conteúdo</th><th>Tipo</th>${_sortBtn('fb_posts','alcance','Alcance')}${_sortBtn('fb_posts','visualizacoes','Views')}${_sortBtn('fb_posts','reacoes','Reações')}</tr></thead>
          <tbody>${fbPosts.map((p,i) => `<tr>
            <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
            <td style="max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(p.titulo||p.descricao||'').replace(/"/g,'&quot;')}">${truncate(p.titulo||p.descricao,55)||'—'}</td>
            <td>${(p.tipo||'').trim()}</td>
            <td><strong>${fmtN(p.alcance)}</strong></td>
            <td>${fmtN(p.visualizacoes)}</td>
            <td>${fmtN(p.reacoes)}</td>
          </tr>`).join('')}</tbody>
        </table></div>`;
    }
  }

  if (v) {
    html += `<div class="rel-subsection-title" style="margin-top:24px">Vídeos — Métricas</div>
      <div class="rel-metrics-grid cols-4">
        ${metricCard('Vídeos', v.videos, av?.videos)}
        ${metricCard('Alcance', v.alcance, av?.alcance)}
        ${metricCard('Views 3s', v.views3s, av?.views3s)}
        ${metricCard('Views 1min', v.views1min, av?.views1min)}
      </div>`;

    const fbVids = _sortArray(latest._rawPosts?.fbVideos||[], 'fb_videos');
    if (fbVids.length) {
      html += `<div class="rel-subsection-title">Vídeos — Conteúdos</div>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Conteúdo</th>${_sortBtn('fb_videos','alcance','Alcance')}${_sortBtn('fb_videos','views3s','Views 3s')}${_sortBtn('fb_videos','views1min','Views 1min')}${_sortBtn('fb_videos','reacoes','Reações')}</tr></thead>
          <tbody>${fbVids.map((p,i) => `<tr>
            <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
            <td style="max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(p.titulo||'').replace(/"/g,'&quot;')}">${truncate(p.titulo,55)||'—'}</td>
            <td><strong>${fmtN(p.alcance)}</strong></td>
            <td>${fmtN(p.views3s)}</td>
            <td>${fmtN(p.views1min)}</td>
            <td>${fmtN(p.reacoes)}</td>
          </tr>`).join('')}</tbody>
        </table></div>`;
    }
  }

  if (pg) {
    html += `<div class="rel-subsection-title" style="margin-top:24px">Engajamentos da Página</div>
      <div class="rel-metrics-grid cols-3">
        ${metricCard('Total', pg.totalEngajamentos, apg?.totalEngajamentos)}
        ${metricCard('Média/dia', pg.mediaEngajamentos, apg?.mediaEngajamentos)}
        ${metricCard('Feedbacks Neg.', pg.feedbacksNegativos, apg?.feedbacksNegativos)}
      </div>
      <div class="rel-chart-wrap" style="margin-top:12px"><div class="rel-chart-title">Engajamentos Diários</div><canvas id="chart-fb-daily"></canvas></div>`;
  }

  return html;
}

// ── YouTube ──
function _perfTabYoutube(relA, relB) {
  const latest = relB || relA;
  const prev = relB ? relA : null;
  const yt = latest.youtube?.tabela, ayt = prev?.youtube?.tabela;
  const fmtN = n => (n||0).toLocaleString('pt-BR');
  const truncate = (s, len) => { s = (s||'').replace(/\n/g,' ').trim(); return s.length > len ? s.substring(0,len)+'...' : s; };

  let html = '';

  if (yt) {
    html += `<div class="rel-metrics-grid cols-4" style="margin-top:12px">
      ${metricCard('Visualizações', yt.visualizacoes, ayt?.visualizacoes)}
      ${metricCard('Horas Exibição', yt.horasExibicao, ayt?.horasExibicao, true)}
      ${metricCard('Inscritos', yt.inscritos, ayt?.inscritos)}
      ${metricCard('Impressões', yt.impressoes, ayt?.impressoes)}
    </div>`;

    if (prev && ayt) {
      html += renderComparisonTable('YouTube — Comparativo',
        ['Visualizações','Horas Exibição','Inscritos','Impressões','CTR (%)'],
        [yt.visualizacoes,yt.horasExibicao,yt.inscritos,yt.impressoes,yt.ctr],
        [ayt.visualizacoes,ayt.horasExibicao,ayt.inscritos,ayt.impressoes,ayt.ctr],
        latest.mesLabel, prev.mesLabel
      );
    }

    const vids = _sortArray(latest._rawPosts?.ytVideos||[], 'yt_videos');
    if (vids.length) {
      html += `<div class="rel-subsection-title">Vídeos — Ranking</div>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Título</th>${_sortBtn('yt_videos','visualizacoes','Views')}${_sortBtn('yt_videos','horasExibicao','Tempo')}${_sortBtn('yt_videos','inscritos','Inscritos')}${_sortBtn('yt_videos','ctr','CTR')}</tr></thead>
          <tbody>${vids.map((v,i) => `<tr>
            <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
            <td style="max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${(v.titulo||'').replace(/"/g,'&quot;')}">${truncate(v.titulo,65)||'—'}</td>
            <td><strong>${fmtN(v.visualizacoes)}</strong></td>
            <td>${(v.horasExibicao||0).toFixed(1)}h</td>
            <td>${fmtN(v.inscritos)}</td>
            <td>${v.ctr||0}%</td>
          </tr>`).join('')}</tbody>
        </table></div>`;
    }
  }

  if (latest.youtube?.totalDiario) {
    html += '<div class="rel-chart-wrap" style="margin-top:16px"><div class="rel-chart-title">Views Diárias</div><canvas id="chart-yt-daily"></canvas></div>';
  }

  return html;
}

// ── TikTok ──
function _perfTabTiktok(relA, relB) {
  const latest = relB || relA;
  const prev = relB ? relA : null;
  const tk = latest.tiktok?.overview, atk = prev?.tiktok?.overview;
  const fmtN = n => (n||0).toLocaleString('pt-BR');

  let html = '';

  if (tk) {
    html += `<div class="rel-metrics-grid cols-4" style="margin-top:12px">
      ${metricCard('Video Views', tk.totalVideoViews, atk?.totalVideoViews)}
      ${metricCard('Curtidas', tk.totalLikes, atk?.totalLikes)}
      ${metricCard('Compartilhamentos', tk.totalShares, atk?.totalShares)}
      ${metricCard('Visitas Perfil', tk.totalProfileViews, atk?.totalProfileViews)}
    </div>`;

    if (prev && atk) {
      html += renderComparisonTable('TikTok — Comparativo',
        ['Video Views','Visitas Perfil','Curtidas','Comentários','Compartilhamentos','Engajamento'],
        [tk.totalVideoViews,tk.totalProfileViews,tk.totalLikes,tk.totalComments,tk.totalShares,tk.totalEngajamento],
        [atk.totalVideoViews,atk.totalProfileViews,atk.totalLikes,atk.totalComments,atk.totalShares,atk.totalEngajamento],
        latest.mesLabel, prev.mesLabel
      );
    }

    // Top days
    const days = _sortArray(latest._rawPosts?.tkDaily||[], 'tk_daily').slice(0,10);
    if (days.length) {
      html += `<div class="rel-subsection-title">Top 10 Dias</div>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Data</th>${_sortBtn('tk_daily','videoViews','Video Views')}${_sortBtn('tk_daily','likes','Curtidas')}${_sortBtn('tk_daily','shares','Compart.')}${_sortBtn('tk_daily','profileViews','Perfil')}</tr></thead>
          <tbody>${days.map((d,i) => `<tr>
            <td><span class="rel-rank rel-rank-${i+1}">${i+1}</span></td>
            <td>${d.data||'—'}</td>
            <td><strong>${fmtN(d.videoViews)}</strong></td>
            <td>${fmtN(d.likes)}</td>
            <td>${fmtN(d.shares)}</td>
            <td>${fmtN(d.profileViews)}</td>
          </tr>`).join('')}</tbody>
        </table></div>`;
    }

    html += '<div class="rel-chart-wrap" style="margin-top:16px"><div class="rel-chart-title">Video Views Diárias</div><canvas id="chart-tk-daily"></canvas></div>';
  }

  return html;
}

// ── Chart initializers per tab ──
function _initChartIG(relA, relB) {
  const canvas = document.getElementById('chart-ig');
  if (!canvas) return;
  const latest = relB || relA;
  const prev = relB ? relA : null;
  const f = latest.instagram?.feed, af = prev?.instagram?.feed;
  const s = latest.instagram?.stories, as_ = prev?.instagram?.stories;

  const labels = ['Alcance','Views','Curtidas','Engajamento'];
  const cur = [(f?.alcance||0)+(s?.alcance||0),(f?.visualizacoes||0)+(s?.visualizacoes||0),(f?.curtidas||0)+(s?.curtidas||0),f?.engajamento||0];
  const datasets = [{ label: latest.mesLabel, data: cur, backgroundColor: '#DD3C8C99', borderColor: '#DD3C8C', borderWidth: 1 }];
  if (prev && (af||as_)) {
    datasets.push({ label: prev.mesLabel, data: [(af?.alcance||0)+(as_?.alcance||0),(af?.visualizacoes||0)+(as_?.visualizacoes||0),(af?.curtidas||0)+(as_?.curtidas||0),af?.engajamento||0], backgroundColor: '#DD3C8C40', borderColor: '#DD3C8C80', borderWidth: 1 });
  }
  relChartInstances.push(new Chart(canvas, { type:'bar', data:{labels,datasets}, options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}} }));

  // Pie chart — Age/Gender
  const ageCanvas = document.getElementById('chart-ig-age');
  const acc = latest.instagram?.account;
  if (ageCanvas && acc?.demographics?.ageGender?.length) {
    const ag = acc.demographics.ageGender;
    const pieColors = ['#DD3C8C','#E85D9F','#F280B4','#F7A3C8','#FACFDD','#FDE5EE'];
    relChartInstances.push(new Chart(ageCanvas, {
      type: 'doughnut',
      data: {
        labels: ag.map(a => a.range),
        datasets: [{
          data: ag.map(a => +(a.homens + a.mulheres).toFixed(1)),
          backgroundColor: pieColors.slice(0, ag.length),
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 8, boxWidth: 12 } } } }
    }));
  }

  // Pie chart — Cities
  const cityCanvas = document.getElementById('chart-ig-cities');
  if (cityCanvas && acc?.demographics?.cities?.length) {
    const cities = acc.demographics.cities.slice(0, 8);
    const cityColors = ['#6b48c8','#8b6ad8','#a88ce4','#c4afef','#ddd2f7','#ece5fa','#f3effc','#f9f7fe'];
    relChartInstances.push(new Chart(cityCanvas, {
      type: 'doughnut',
      data: {
        labels: cities.map(c => c.city),
        datasets: [{
          data: cities.map(c => c.pct),
          backgroundColor: cityColors.slice(0, cities.length),
          borderWidth: 0
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 6, boxWidth: 10 } } } }
    }));
  }
}

function _initChartFB(relA, relB) {
  const canvas = document.getElementById('chart-fb-daily');
  if (!canvas) return;
  const latest = relB || relA;
  const prev = relB ? relA : null;
  const pg = latest.facebook?.page;
  if (!pg?.engajamentosDiarios) return;

  const labels = pg.engajamentosDiarios.map((_,i)=>i+1);
  const datasets = [{ label: latest.mesLabel, data: pg.engajamentosDiarios, borderColor: '#3C71DD', backgroundColor: '#3C71DD20', fill: true, tension: 0.3 }];
  if (prev?.facebook?.page?.engajamentosDiarios) {
    datasets.push({ label: prev.mesLabel, data: prev.facebook.page.engajamentosDiarios, borderColor: '#3C71DD60', backgroundColor: 'transparent', borderDash: [5,5], tension: 0.3 });
  }
  relChartInstances.push(new Chart(canvas, { type:'line', data:{labels,datasets}, options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}} }));
}

function _initChartYT(relA, relB) {
  const canvas = document.getElementById('chart-yt-daily');
  if (!canvas) return;
  const latest = relB || relA;
  const prev = relB ? relA : null;
  if (!latest.youtube?.totalDiario?.viewsDiarias) return;

  const data = latest.youtube.totalDiario.viewsDiarias;
  const labels = data.map((_,i)=>i+1);
  const datasets = [{ label: latest.mesLabel, data, borderColor: '#E83030', backgroundColor: '#E8303020', fill: true, tension: 0.3 }];
  if (prev?.youtube?.totalDiario?.viewsDiarias) {
    datasets.push({ label: prev.mesLabel, data: prev.youtube.totalDiario.viewsDiarias, borderColor: '#E8303060', backgroundColor: 'transparent', borderDash: [5,5], tension: 0.3 });
  }
  relChartInstances.push(new Chart(canvas, { type:'line', data:{labels,datasets}, options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}} }));
}

function _initChartTK(relA, relB) {
  const canvas = document.getElementById('chart-tk-daily');
  if (!canvas) return;
  const latest = relB || relA;
  const prev = relB ? relA : null;
  if (!latest.tiktok?.overview?.viewsDiarias) return;

  const data = latest.tiktok.overview.viewsDiarias;
  const labels = data.map((_,i)=>i+1);
  const datasets = [{ label: latest.mesLabel, data, borderColor: '#2EC2B3', backgroundColor: '#2EC2B315', fill: true, tension: 0.3 }];
  if (prev?.tiktok?.overview?.viewsDiarias) {
    datasets.push({ label: prev.mesLabel, data: prev.tiktok.overview.viewsDiarias, borderColor: '#2EC2B360', backgroundColor: 'transparent', borderDash: [5,5], tension: 0.3 });
  }
  relChartInstances.push(new Chart(canvas, { type:'line', data:{labels,datasets}, options:{responsive:true,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}} }));
}

// (old comparativo removed, replaced by tab system)
function _noop() { return; } void _noop; function __endOldBlock() { void 0;
  const labB = `${relB.mesLabel} ${relB.ano}`;
  const fmtNum = n => n != null ? n.toLocaleString('pt-BR') : '—';

  // Build comparison sections
  const sections = [];

  // Instagram Feed
  const igfA = relA.instagram.feed, igfB = relB.instagram.feed;
  if (igfA || igfB) {
    sections.push({
      icon: '📸', iconCls: 'rel-icon-ig', title: 'Instagram — Feed',
      rows: [
        ['Posts publicados', igfA?.posts, igfB?.posts],
        ['Alcance', igfA?.alcance, igfB?.alcance],
        ['Visualizações', igfA?.visualizacoes, igfB?.visualizacoes],
        ['Curtidas', igfA?.curtidas, igfB?.curtidas],
        ['Comentários', igfA?.comentarios, igfB?.comentarios],
        ['Compartilhamentos', igfA?.compartilhamentos, igfB?.compartilhamentos],
        ['Salvamentos', igfA?.salvamentos, igfB?.salvamentos],
        ['Seguimentos', igfA?.seguimentos, igfB?.seguimentos],
        ['Engajamento total', igfA?.engajamento, igfB?.engajamento]
      ]
    });
  }

  // Instagram Stories
  const igsA = relA.instagram.stories, igsB = relB.instagram.stories;
  if (igsA || igsB) {
    sections.push({
      icon: '📸', iconCls: 'rel-icon-ig', title: 'Instagram — Stories',
      rows: [
        ['Stories publicados', igsA?.posts, igsB?.posts],
        ['Alcance', igsA?.alcance, igsB?.alcance],
        ['Visualizações', igsA?.visualizacoes, igsB?.visualizacoes],
        ['Seguimentos', igsA?.seguimentos, igsB?.seguimentos],
        ['Cliques no link', igsA?.cliquesLink, igsB?.cliquesLink],
        ['Respostas', igsA?.respostas, igsB?.respostas]
      ]
    });
  }

  // Facebook Posts
  const fbpA = relA.facebook.posts, fbpB = relB.facebook.posts;
  if (fbpA || fbpB) {
    sections.push({
      icon: '📘', iconCls: 'rel-icon-fb', title: 'Facebook — Posts',
      rows: [
        ['Posts publicados', fbpA?.posts, fbpB?.posts],
        ['Alcance', fbpA?.alcance, fbpB?.alcance],
        ['Visualizações', fbpA?.visualizacoes, fbpB?.visualizacoes],
        ['Reações', fbpA?.reacoes, fbpB?.reacoes],
        ['Comentários', fbpA?.comentarios, fbpB?.comentarios],
        ['Compartilhamentos', fbpA?.compartilhamentos, fbpB?.compartilhamentos]
      ]
    });
  }

  // Facebook Videos
  const fbvA = relA.facebook.videos, fbvB = relB.facebook.videos;
  if (fbvA || fbvB) {
    sections.push({
      icon: '📘', iconCls: 'rel-icon-fb', title: 'Facebook — Vídeos',
      rows: [
        ['Vídeos publicados', fbvA?.videos, fbvB?.videos],
        ['Alcance', fbvA?.alcance, fbvB?.alcance],
        ['Views (3s)', fbvA?.views3s, fbvB?.views3s],
        ['Views (1 min)', fbvA?.views1min, fbvB?.views1min],
        ['Reações', fbvA?.reacoes, fbvB?.reacoes]
      ]
    });
  }

  // Facebook Page
  const fppA = relA.facebook.page, fppB = relB.facebook.page;
  if (fppA || fppB) {
    sections.push({
      icon: '📘', iconCls: 'rel-icon-fb', title: 'Facebook — Engajamentos Página',
      rows: [
        ['Total engajamentos', fppA?.totalEngajamentos, fppB?.totalEngajamentos],
        ['Média/dia', fppA?.mediaEngajamentos, fppB?.mediaEngajamentos],
        ['Feedbacks negativos', fppA?.feedbacksNegativos, fppB?.feedbacksNegativos]
      ]
    });
  }

  // YouTube
  const ytA = relA.youtube.tabela, ytB = relB.youtube.tabela;
  if (ytA || ytB) {
    sections.push({
      icon: '▶️', iconCls: 'rel-icon-yt', title: 'YouTube',
      rows: [
        ['Visualizações', ytA?.visualizacoes, ytB?.visualizacoes],
        ['Horas de exibição', ytA?.horasExibicao, ytB?.horasExibicao],
        ['Inscritos', ytA?.inscritos, ytB?.inscritos],
        ['Impressões', ytA?.impressoes, ytB?.impressoes],
        ['CTR (%)', ytA?.ctr, ytB?.ctr]
      ]
    });
  }

  // TikTok
  const tkA = relA.tiktok.overview, tkB = relB.tiktok.overview;
  if (tkA || tkB) {
    sections.push({
      icon: '🎵', iconCls: 'rel-icon-tk', title: 'TikTok',
      rows: [
        ['Video Views', tkA?.totalVideoViews, tkB?.totalVideoViews],
        ['Visitas ao perfil', tkA?.totalProfileViews, tkB?.totalProfileViews],
        ['Curtidas', tkA?.totalLikes, tkB?.totalLikes],
        ['Comentários', tkA?.totalComments, tkB?.totalComments],
        ['Compartilhamentos', tkA?.totalShares, tkB?.totalShares],
        ['Engajamento total', tkA?.totalEngajamento, tkB?.totalEngajamento]
      ]
    });
  }

  const fv = v => {
    if (v == null) return '—';
    return typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString('pt-BR') : v.toFixed(2)) : v;
  };

  container.innerHTML = `
    <div class="rel-view">
      <div class="flex-between mb-8 rel-animate">
        <div class="rel-header-label">COMPARATIVO</div>
        <button class="btn btn-ghost btn-sm rel-btn-export" onclick="exportPerfPDF('compare','${relA.id}_${relB.id}')">📄 Exportar PDF</button>
      </div>
      <h2 class="rel-header-title rel-animate rel-animate-delay-1" style="font-size:24px;margin-bottom:4px">${relA.clienteNome}</h2>
      <div class="rel-header-sub rel-animate rel-animate-delay-2 mb-20">${labA} vs ${labB}</div>

      ${sections.map((s, si) => `
        <div class="rel-section rel-animate rel-animate-delay-${Math.min(si+3, 8)}">
          <div class="rel-section-header">
            <span class="rel-platform-icon ${s.iconCls}">${s.icon}</span>
            <span>${s.title}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Métrica</th>
                  <th>${labA}</th>
                  <th>${labB}</th>
                  <th>Variação</th>
                </tr>
              </thead>
              <tbody>
                ${s.rows.map(([label, vA, vB]) => {
                  const a = vA || 0, b = vB || 0;
                  const pct = calcChange(b, a);
                  return `<tr>
                    <td><strong>${label}</strong></td>
                    <td>${fv(vA)}</td>
                    <td><strong>${fv(vB)}</strong></td>
                    <td>${changeTag(pct)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}

      ${!sections.length ? '<div class="text-muted" style="text-align:center;padding:32px">Nenhuma plataforma em comum entre os dois meses.</div>' : ''}

      ${renderTopPosts(relB)}
    </div>
  `;
}

// =====================================================
// EXPORTAR PDF
// =====================================================
// =====================================================
// COPIAR TEXTO — dados formatados para clipboard
// =====================================================
function copyPerfText(mode, ids) {
  const rels = getRelatorios();
  let relA, relB;
  if (mode === 'single') { relA = rels.find(r => r.id === ids); relB = null; }
  else { const [a,b] = ids.split('_'); relA = rels.find(r=>r.id===a); relB = rels.find(r=>r.id===b); }
  if (relA && relB && (relA.ano>relB.ano||(relA.ano===relB.ano&&relA.mes>relB.mes))) [relA,relB]=[relB,relA];
  if (!relA) return showToast('Relatório não encontrado', true);

  const latest = relB || relA;
  const prev = relB ? relA : null;
  const fN = n => n!=null ? n.toLocaleString('pt-BR') : '—';
  const pct = (a,b) => { if(!b||b===0) return a>0?'+100%':'0%'; const v=((a-b)/Math.abs(b))*100; return (v>0?'+':'')+v.toFixed(1)+'%'; };

  let txt = '';
  txt += `${'═'.repeat(50)}\n`;
  txt += `${relB ? 'COMPARATIVO DE PERFORMANCE' : 'RELATÓRIO DE PERFORMANCE'}\n`;
  txt += `${latest.clienteNome}\n`;
  txt += relB ? `${relA.mesLabel} ${relA.ano} vs ${relB.mesLabel} ${relB.ano}\n` : `${relA.mesLabel} ${relA.ano}\n`;
  txt += `${'═'.repeat(50)}\n\n`;

  // --- Instagram ---
  const igf = latest.instagram?.feed, igfp = prev?.instagram?.feed;
  const igs = latest.instagram?.stories, igsp = prev?.instagram?.stories;
  const acc = latest.instagram?.account, accp = prev?.instagram?.account;

  if (igf || igs || acc) {
    txt += `📸 INSTAGRAM\n${'─'.repeat(40)}\n`;

    if (acc) {
      txt += `\nConta (Insights):\n`;
      if (acc.alcance) txt += `  Alcance Total:    ${fN(acc.alcance.total)}${accp?.alcance ? '  ('+pct(acc.alcance.total,accp.alcance.total)+')' : ''}\n`;
      if (acc.visualizacoes) txt += `  Visualizações:    ${fN(acc.visualizacoes.total)}${accp?.visualizacoes ? '  ('+pct(acc.visualizacoes.total,accp.visualizacoes.total)+')' : ''}\n`;
      if (acc.seguidores) txt += `  Novos Seguidores: ${fN(acc.seguidores.total)}${accp?.seguidores ? '  ('+pct(acc.seguidores.total,accp.seguidores.total)+')' : ''}\n`;
      if (acc.visitas) txt += `  Visitas Perfil:   ${fN(acc.visitas.total)}${accp?.visitas ? '  ('+pct(acc.visitas.total,accp.visitas.total)+')' : ''}\n`;
      if (acc.interacoes) txt += `  Interações:       ${fN(acc.interacoes.total)}${accp?.interacoes ? '  ('+pct(acc.interacoes.total,accp.interacoes.total)+')' : ''}\n`;
      if (acc.cliques_link) txt += `  Cliques no Link:  ${fN(acc.cliques_link.total)}${accp?.cliques_link ? '  ('+pct(acc.cliques_link.total,accp.cliques_link.total)+')' : ''}\n`;
    }

    if (igf) {
      txt += `\nFeed & Reels (${igf.posts} posts):\n`;
      const m = [['Alcance',igf.alcance,igfp?.alcance],['Visualizações',igf.visualizacoes,igfp?.visualizacoes],['Curtidas',igf.curtidas,igfp?.curtidas],['Comentários',igf.comentarios,igfp?.comentarios],['Compartilhamentos',igf.compartilhamentos,igfp?.compartilhamentos],['Salvamentos',igf.salvamentos,igfp?.salvamentos],['Seguimentos',igf.seguimentos,igfp?.seguimentos],['Engajamento',igf.engajamento,igfp?.engajamento]];
      m.forEach(([l,v,p]) => { txt += `  ${l.padEnd(20)} ${fN(v).padStart(8)}${p!=null ? '  ('+pct(v,p)+')' : ''}\n`; });

      // Top posts
      const posts = (latest._rawPosts?.igFeed||[]).slice().sort((a,b)=>(b.alcance||0)-(a.alcance||0));
      if (posts.length) {
        txt += `\n  Top Conteúdos Feed:\n`;
        posts.slice(0,5).forEach((p,i) => {
          const tipo = (p.tipo||'').replace(/do Instagram/gi,'').trim();
          const desc = (p.descricao||'').replace(/\n/g,' ').substring(0,50);
          txt += `  ${i+1}. [${tipo}] ${desc}${desc.length>=50?'...':''}\n     Alcance: ${fN(p.alcance)} | Views: ${fN(p.visualizacoes)} | Curtidas: ${fN(p.curtidas)} | Salv: ${fN(p.salvamentos)}\n`;
        });
      }
    }

    if (igs) {
      txt += `\nStories (${igs.posts}):\n`;
      const m = [['Alcance',igs.alcance,igsp?.alcance],['Visualizações',igs.visualizacoes,igsp?.visualizacoes],['Curtidas',igs.curtidas,igsp?.curtidas],['Respostas',igs.respostas,igsp?.respostas],['Seguimentos',igs.seguimentos,igsp?.seguimentos],['Cliques Link',igs.cliquesLink,igsp?.cliquesLink]];
      m.forEach(([l,v,p]) => { txt += `  ${l.padEnd(20)} ${fN(v).padStart(8)}${p!=null ? '  ('+pct(v,p)+')' : ''}\n`; });
    }
    txt += '\n';
  }

  // --- Facebook ---
  const fbp = latest.facebook?.posts, fbpp = prev?.facebook?.posts;
  const fbv = latest.facebook?.videos, fbvp = prev?.facebook?.videos;
  const fbpg = latest.facebook?.page, fbpgp = prev?.facebook?.page;

  if (fbp || fbv || fbpg) {
    txt += `📘 FACEBOOK\n${'─'.repeat(40)}\n`;

    if (fbp) {
      txt += `\nPosts (${fbp.posts}):\n`;
      [['Alcance',fbp.alcance,fbpp?.alcance],['Visualizações',fbp.visualizacoes,fbpp?.visualizacoes],['Reações',fbp.reacoes,fbpp?.reacoes],['Comentários',fbp.comentarios,fbpp?.comentarios],['Compartilhamentos',fbp.compartilhamentos,fbpp?.compartilhamentos]].forEach(([l,v,p]) => { txt += `  ${l.padEnd(20)} ${fN(v).padStart(8)}${p!=null ? '  ('+pct(v,p)+')' : ''}\n`; });
    }

    if (fbv) {
      txt += `\nVídeos (${fbv.videos}):\n`;
      [['Alcance',fbv.alcance,fbvp?.alcance],['Views 3s',fbv.views3s,fbvp?.views3s],['Views 1min',fbv.views1min,fbvp?.views1min],['Reações',fbv.reacoes,fbvp?.reacoes]].forEach(([l,v,p]) => { txt += `  ${l.padEnd(20)} ${fN(v).padStart(8)}${p!=null ? '  ('+pct(v,p)+')' : ''}\n`; });
    }

    if (fbpg) {
      txt += `\nPágina:\n`;
      txt += `  Total Engajamentos: ${fN(fbpg.totalEngajamentos)}${fbpgp ? '  ('+pct(fbpg.totalEngajamentos,fbpgp.totalEngajamentos)+')' : ''}\n`;
      txt += `  Média/dia:          ${fN(fbpg.mediaEngajamentos)}\n`;
    }
    txt += '\n';
  }

  // --- YouTube ---
  const yt = latest.youtube?.tabela, ytp = prev?.youtube?.tabela;
  if (yt) {
    txt += `▶️ YOUTUBE\n${'─'.repeat(40)}\n`;
    [['Visualizações',yt.visualizacoes,ytp?.visualizacoes],['Horas Exibição',yt.horasExibicao,ytp?.horasExibicao],['Inscritos',yt.inscritos,ytp?.inscritos],['Impressões',yt.impressoes,ytp?.impressoes],['CTR (%)',yt.ctr,ytp?.ctr]].forEach(([l,v,p]) => { txt += `  ${l.padEnd(20)} ${typeof v==='number'&&!Number.isInteger(v)?v.toFixed(2):fN(v)}${p!=null ? '  ('+pct(v,p)+')' : ''}\n`; });

    const vids = (latest._rawPosts?.ytVideos||[]).slice().sort((a,b)=>(b.visualizacoes||0)-(a.visualizacoes||0));
    if (vids.length) {
      txt += `\n  Top Vídeos:\n`;
      vids.slice(0,5).forEach((v,i) => { txt += `  ${i+1}. ${(v.titulo||'').substring(0,50)}\n     Views: ${fN(v.visualizacoes)} | ${v.horasExibicao?.toFixed(1)||0}h | CTR: ${v.ctr||0}%\n`; });
    }
    txt += '\n';
  }

  // --- TikTok ---
  const tk = latest.tiktok?.overview, tkp = prev?.tiktok?.overview;
  if (tk) {
    txt += `🎵 TIKTOK\n${'─'.repeat(40)}\n`;
    [['Video Views',tk.totalVideoViews,tkp?.totalVideoViews],['Visitas Perfil',tk.totalProfileViews,tkp?.totalProfileViews],['Curtidas',tk.totalLikes,tkp?.totalLikes],['Comentários',tk.totalComments,tkp?.totalComments],['Compartilhamentos',tk.totalShares,tkp?.totalShares],['Engajamento',tk.totalEngajamento,tkp?.totalEngajamento]].forEach(([l,v,p]) => { txt += `  ${l.padEnd(20)} ${fN(v).padStart(8)}${p!=null ? '  ('+pct(v,p)+')' : ''}\n`; });
    txt += '\n';
  }

  txt += `${'─'.repeat(50)}\nProduzido por PumP · ${latest.clienteNome} · ${new Date().toLocaleDateString('pt-BR')}\n`;

  navigator.clipboard.writeText(txt).then(() => {
    showToast('Texto copiado para a área de transferência!');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Texto copiado!');
  });
}

function exportRelPDF(relId) {
  // Reuse the Performance PDF export (renders all platforms)
  exportPerfPDF('single', relId);
}

function exportPerfPDF(mode, ids) {
  const rels = getRelatorios();
  let relA, relB;

  if (mode === 'single') {
    relA = rels.find(r => r.id === ids);
    relB = null;
  } else {
    const [idA, idB] = ids.split('_');
    relA = rels.find(r => r.id === idA);
    relB = rels.find(r => r.id === idB);
    if (relA && relB && (relA.ano > relB.ano || (relA.ano === relB.ano && relA.mes > relB.mes))) {
      [relA, relB] = [relB, relA];
    }
  }

  if (!relA) return showToast('Relatório não encontrado', true);
  showToast('Preparando relatório...');

  const latest = relB || relA;
  const labA = relA ? `${relA.mesLabel} ${relA.ano}` : '';
  const labB = relB ? `${relB.mesLabel} ${relB.ano}` : '';
  const title = relB ? `${labA} vs ${labB}` : labA;

  // Step 1: Capture charts from current tab, then render remaining in hidden container
  const chartImages = {};

  // Capture any charts already visible in current tab
  document.querySelectorAll('#perf-tab-content canvas').forEach(cv => {
    try { if (cv.id) chartImages[cv.id] = cv.toDataURL('image/png'); } catch(e) {}
  });

  // Render all tabs in a hidden offscreen container with prefixed IDs to avoid conflicts
  const offscreen = document.createElement('div');
  offscreen.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;opacity:0;pointer-events:none;';
  const tabFns = { instagram: _perfTabInstagram, facebook: _perfTabFacebook, youtube: _perfTabYoutube, tiktok: _perfTabTiktok };
  let offHTML = '';
  for (const [tab, fn] of Object.entries(tabFns)) {
    let html = fn(relA, relB);
    // Prefix canvas IDs to avoid duplicating IDs in the DOM
    html = html.replace(/id="(chart-[^"]*)"/g, 'id="pdf-$1"');
    offHTML += html;
  }
  offscreen.innerHTML = offHTML;
  document.body.appendChild(offscreen);

  // Init charts on the prefixed canvases
  const prefixedCharts = [];
  function _initOffscreenChart(origId, initFn) {
    const cv = offscreen.querySelector('#pdf-' + origId);
    if (!cv) return;
    try { initFn(cv); } catch(e) {}
  }

  // Bar chart IG
  const igCv = offscreen.querySelector('#pdf-chart-ig');
  if (igCv) {
    const f = latest.instagram?.feed, af = (relB ? relA : null)?.instagram?.feed;
    const s = latest.instagram?.stories, as_ = (relB ? relA : null)?.instagram?.stories;
    const labels = ['Alcance','Views','Curtidas','Engajamento'];
    const cur = [(f?.alcance||0)+(s?.alcance||0),(f?.visualizacoes||0)+(s?.visualizacoes||0),(f?.curtidas||0)+(s?.curtidas||0),f?.engajamento||0];
    const ds = [{ label: latest.mesLabel, data: cur, backgroundColor: '#DD3C8C99', borderColor: '#DD3C8C', borderWidth: 1 }];
    if (relB && (af||as_)) ds.push({ label: relA.mesLabel, data: [(af?.alcance||0)+(as_?.alcance||0),(af?.visualizacoes||0)+(as_?.visualizacoes||0),(af?.curtidas||0)+(as_?.curtidas||0),af?.engajamento||0], backgroundColor: '#DD3C8C40', borderColor: '#DD3C8C80', borderWidth: 1 });
    prefixedCharts.push(new Chart(igCv, { type:'bar', data:{labels,datasets:ds}, options:{responsive:true,animation:false,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}} }));
  }

  // Doughnut age
  const ageCv = offscreen.querySelector('#pdf-chart-ig-age');
  const acc = latest.instagram?.account;
  if (ageCv && acc?.demographics?.ageGender?.length) {
    const ag = acc.demographics.ageGender;
    prefixedCharts.push(new Chart(ageCv, { type:'doughnut', data:{ labels:ag.map(a=>a.range), datasets:[{data:ag.map(a=>+(a.homens+a.mulheres).toFixed(1)),backgroundColor:['#DD3C8C','#E85D9F','#F280B4','#F7A3C8','#FACFDD','#FDE5EE'],borderWidth:0}]}, options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'right',labels:{font:{size:10},padding:6,boxWidth:10}}}} }));
  }

  // Doughnut cities
  const cityCv = offscreen.querySelector('#pdf-chart-ig-cities');
  if (cityCv && acc?.demographics?.cities?.length) {
    const cities = acc.demographics.cities.slice(0,8);
    prefixedCharts.push(new Chart(cityCv, { type:'doughnut', data:{ labels:cities.map(c=>c.city), datasets:[{data:cities.map(c=>c.pct),backgroundColor:['#6b48c8','#8b6ad8','#a88ce4','#c4afef','#ddd2f7','#ece5fa','#f3effc','#f9f7fe'],borderWidth:0}]}, options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'right',labels:{font:{size:9},padding:4,boxWidth:8}}}} }));
  }

  // FB daily line
  const fbCv = offscreen.querySelector('#pdf-chart-fb-daily');
  if (fbCv && latest.facebook?.page?.engajamentosDiarios) {
    const data = latest.facebook.page.engajamentosDiarios;
    prefixedCharts.push(new Chart(fbCv, { type:'line', data:{labels:data.map((_,i)=>i+1),datasets:[{label:latest.mesLabel,data,borderColor:'#3C71DD',backgroundColor:'#3C71DD20',fill:true,tension:0.3}]}, options:{responsive:true,animation:false,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}} }));
  }

  // YT daily line
  const ytCv = offscreen.querySelector('#pdf-chart-yt-daily');
  if (ytCv && latest.youtube?.totalDiario?.viewsDiarias) {
    const data = latest.youtube.totalDiario.viewsDiarias;
    prefixedCharts.push(new Chart(ytCv, { type:'line', data:{labels:data.map((_,i)=>i+1),datasets:[{label:latest.mesLabel,data,borderColor:'#E83030',backgroundColor:'#E8303020',fill:true,tension:0.3}]}, options:{responsive:true,animation:false,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}} }));
  }

  // TK daily line
  const tkCv = offscreen.querySelector('#pdf-chart-tk-daily');
  if (tkCv && latest.tiktok?.overview?.viewsDiarias) {
    const data = latest.tiktok.overview.viewsDiarias;
    prefixedCharts.push(new Chart(tkCv, { type:'line', data:{labels:data.map((_,i)=>i+1),datasets:[{label:latest.mesLabel,data,borderColor:'#2EC2B3',backgroundColor:'#2EC2B315',fill:true,tension:0.3}]}, options:{responsive:true,animation:false,plugins:{legend:{position:'top'}},scales:{y:{beginAtZero:true}}} }));
  }

  // Wait for charts to render (animation:false so instant), capture as images
  setTimeout(() => {
    offscreen.querySelectorAll('canvas').forEach(cv => {
      const origId = cv.id.replace('pdf-', '');
      try { if (!chartImages[origId]) chartImages[origId] = cv.toDataURL('image/png'); } catch(e) {}
    });

    // Cleanup offscreen
    prefixedCharts.forEach(c => { try { c.destroy(); } catch(e) {} });
    document.body.removeChild(offscreen);

    _buildAndOpenPDF(relA, relB, latest, title, chartImages);
  }, 200);
}

function _buildAndOpenPDF(relA, relB, latest, title, chartImages) {
  console.log('PDF chart images captured:', Object.keys(chartImages));
  function replaceCanvasWithImages(html) {
    // Replace <canvas id="X"></canvas> or <canvas id="X"/> with <img>
    html = html.replace(/<canvas[^>]*id="([^"]*)"[^>]*>(?:<\/canvas>)?/g, (match, id) => {
      if (chartImages[id]) return `<img src="${chartImages[id]}" style="width:100%;display:block;max-height:250px;">`;
      return '';
    });
    // Also remove any remaining empty canvas tags
    html = html.replace(/<canvas[^>]*><\/canvas>/g, '');
    return html;
  }

  let sections = _perfTabResumo(relA, relB);

  const hasIG = latest.instagram?.feed || latest.instagram?.stories || (latest.instagram?.account && Object.keys(latest.instagram.account).some(k=>k!=='demographics'));
  if (hasIG) sections += '<hr style="margin:14px 0;border:none;border-top:1px solid #cfc5b0"><h2 style="font-size:16px;margin:0 0 8px">📸 Instagram</h2>' + _perfTabInstagram(relA, relB);

  const hasFB = latest.facebook?.posts || latest.facebook?.videos || latest.facebook?.page;
  if (hasFB) sections += '<hr style="margin:14px 0;border:none;border-top:1px solid #cfc5b0"><h2 style="font-size:16px;margin:0 0 8px">📘 Facebook</h2>' + _perfTabFacebook(relA, relB);

  const hasYT = latest.youtube?.tabela || latest.youtube?.totalDiario;
  if (hasYT) sections += '<hr style="margin:14px 0;border:none;border-top:1px solid #cfc5b0"><h2 style="font-size:16px;margin:0 0 8px">▶️ YouTube</h2>' + _perfTabYoutube(relA, relB);

  const hasTK = latest.tiktok?.overview;
  if (hasTK) sections += '<hr style="margin:14px 0;border:none;border-top:1px solid #cfc5b0"><h2 style="font-size:16px;margin:0 0 8px">🎵 TikTok</h2>' + _perfTabTiktok(relA, relB);

  sections = replaceCanvasWithImages(sections);

  // Open popup
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return showToast('Popup bloqueado — permita popups', true);

  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${latest.clienteNome} — ${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #2a1f0e; background: #f4efe6; padding: 20px 28px; font-size: 13px; }
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 2px; }
  h2 { font-size: 16px; font-weight: 700; margin: 0 0 10px; }
  hr { margin: 16px 0; border: none; border-top: 1px solid #cfc5b0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { font-size: 11px; font-weight: 500; color: #7a7062; padding: 6px 10px; text-align: left; border-bottom: 1px solid #cfc5b0; }
  td { padding: 6px 10px; border-bottom: 1px solid rgba(207,197,176,0.2); }
  strong { font-weight: 700; }

  .rel-metrics-grid { display: grid; gap: 6px; margin-bottom: 8px; }
  .rel-metrics-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
  .rel-metrics-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .rel-metrics-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
  .rel-highlights-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0 12px; }
  .rel-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  .rel-metric-card { background: #fdfaf4; border: 1px solid rgba(207,197,176,0.35); border-radius: 8px; padding: 8px 12px; }
  .rel-metric-label { font-size: 10px; color: #7a7062; margin-bottom: 2px; }
  .rel-metric-value { font-size: 18px; font-weight: 800; color: #2a1f0e; }

  .rel-highlight-card { background: rgba(253,250,244,0.88); border: 1px solid rgba(207,197,176,0.35); border-radius: 8px; padding: 10px 12px; text-align: center; }
  .rel-highlight-platform { font-size: 11px; color: #7a7062; margin-bottom: 3px; }
  .rel-highlight-value { font-size: 20px; font-weight: 800; }
  .rel-highlight-sub { font-size: 10px; color: #7a7062; }

  .rel-section { background: rgba(253,250,244,0.88); border: 1px solid rgba(207,197,176,0.35); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
  .rel-section-header { font-size: 14px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
  .rel-subsection-title { font-size: 9px; font-weight: 700; color: #7a7062; text-transform: uppercase; letter-spacing: 0.8px; margin: 8px 0 4px; }

  .rel-change { font-size: 11px; font-weight: 600; }
  .rel-positive { color: #22883e; }
  .rel-negative { color: #a83428; }
  .rel-neutral { color: #7a7062; }

  .rel-platform-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; font-size: 14px; }
  .rel-icon-ig { background: rgba(221,60,140,0.12); }
  .rel-icon-fb { background: rgba(60,113,221,0.12); }
  .rel-icon-yt { background: rgba(232,48,48,0.1); }
  .rel-icon-tk { background: rgba(46,194,179,0.12); }

  .rel-chart-wrap { background: #fdfaf4; border: 1px solid rgba(207,197,176,0.35); border-radius: 8px; padding: 8px; margin-top: 6px; }
  .rel-chart-title { font-size: 9px; font-weight: 700; color: #7a7062; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
  .rel-table-title { font-size: 9px; font-weight: 700; color: #7a7062; text-transform: uppercase; letter-spacing: 0.8px; padding: 8px 10px 0; }
  .table-wrap { background: #fdfaf4; border: 1px solid rgba(207,197,176,0.35); border-radius: 8px; overflow: hidden; margin-bottom: 6px; }

  .rel-rank { font-weight: 700; font-size: 12px; }
  .rel-rank-1, .rel-rank-2, .rel-rank-3 { color: #3a7a28; }
  .sort-btn { cursor: default; }
  .sort-active { color: #6b48c8; font-weight: 700; }

  .rel-val-green { color: #22883e; }
  .rel-val-ig { color: #DD3C8C; }
  .rel-val-fb { color: #3C71DD; }
  .rel-val-yt { color: #a83428; }
  .rel-val-tk { color: #2EC2B3; }

  .rel-plat-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; color: #fff; }
  .rel-plat-ig { background: #DD3C8C; }
  .rel-plat-fb { background: #3C71DD; }

  canvas { max-width: 100%; }
  .text-faint, .text-muted { color: #7a7062; }

  @media print {
    body { padding: 12px 16px; }
    .rel-metric-card, .rel-highlight-card, .table-wrap { page-break-inside: avoid; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
  <div style="margin-bottom:12px">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#6b48c8;margin-bottom:4px">${relB ? 'COMPARATIVO DE PERFORMANCE' : 'RELATÓRIO DE PERFORMANCE'}</div>
    <h1>${latest.clienteNome}</h1>
    <div style="font-size:12px;color:#7a7062">${title}</div>
  </div>
  ${sections}
  <div style="text-align:center;font-size:10px;color:#a09888;padding-top:16px;margin-top:16px;border-top:1px solid #cfc5b0">Produzido por PumP · ${latest.clienteNome} · ${new Date().toLocaleDateString('pt-BR')}</div>
</body>
</html>`);
  win.document.close();

  // Auto-print when loaded, close popup after print/cancel
  win.onload = () => {
    setTimeout(() => {
      win.print();
      // After print dialog closes (print or cancel), close the popup
      setTimeout(() => { try { win.close(); } catch(e){} }, 500);
    }, 300);
  };
}

function _exportElementAsPDF(element, filename) {
  showToast('Gerando PDF...');

  try {
    // Step 1: Convert Chart.js canvases to static images
    const canvases = Array.from(element.querySelectorAll('canvas'));
    const canvasBackups = [];
    canvases.forEach(cv => {
      try {
        const img = document.createElement('img');
        img.src = cv.toDataURL('image/png');
        img.style.cssText = 'width:100%;height:auto;display:block;';
        canvasBackups.push({ cv, parent: cv.parentNode });
        cv.parentNode.replaceChild(img, cv);
      } catch(e) {}
    });

    // Step 2: Clone element (now with images instead of canvases)
    const clone = element.cloneNode(true);

    // Step 3: Restore canvases in original immediately
    canvasBackups.forEach(({ cv, parent }) => {
      const img = parent.querySelector('img[src^="data:image"]');
      if (img) parent.replaceChild(cv, img);
    });

    // Step 4: Clean clone
    clone.querySelectorAll('button, .perf-tabs, input').forEach(el => el.remove());

    // Step 5: Create a full-page container OUTSIDE the app layout
    // Use a hidden iframe-like approach: absolute position, scrolled to top
    const container = document.createElement('div');
    container.id = 'pdf-export-container';
    container.style.cssText = [
      'position:absolute',
      'top:0', 'left:0',
      'width:800px',
      'background:#f4efe6',
      'padding:24px',
      'z-index:99999',
      'overflow:visible'
    ].join(';');
    container.appendChild(clone);

    // Hide the app layout and show only our container
    const appLayout = document.getElementById('app-layout');
    const prevAppDisplay = appLayout.style.display;
    appLayout.style.display = 'none';
    document.body.style.overflow = 'visible';
    document.body.appendChild(container);

    // Scroll window to top
    window.scrollTo(0, 0);

    // Step 6: Capture after render
    setTimeout(() => {
      html2pdf().set({
        margin: [10, 10, 10, 10],
        filename,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }).from(container).save().then(() => {
        _cleanupExport(container, appLayout, prevAppDisplay);
        showToast('PDF exportado!');
      }).catch(err => {
        _cleanupExport(container, appLayout, prevAppDisplay);
        showToast('Erro ao exportar PDF', true);
        console.error('PDF error:', err);
      });
    }, 500);
  } catch(e) {
    showToast('Erro: ' + e.message, true);
    console.error('Export setup error:', e);
  }
}

function _cleanupExport(container, appLayout) {
  if (container?.parentNode) container.parentNode.removeChild(container);
  if (appLayout) appLayout.style.display = '';
  document.body.style.overflow = '';
}

// =====================================================
// IMPORT EM MASSA
// =====================================================
let _massFiles = []; // { file, parsed, groupKey, clientId, mes, ano, autoClient, autoDate }
let _massGroups = {}; // grouped by clientId_ano_mes

function openMassImport() {
  _massFiles = [];
  _massGroups = {};
  openModal('massa');
  document.getElementById('mass-preview').innerHTML = '';
  document.getElementById('mass-progress').style.display = 'none';
  document.getElementById('mass-actions').style.display = 'none';
}

function handleMassFolder(input) {
  _processMassFiles(input.files);
  input.value = '';
}

function handleMassFiles(input) {
  _processMassFiles(input.files);
  input.value = '';
}

function _processMassFiles(fileList) {
  const csvFiles = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.csv'));
  if (!csvFiles.length) return showToast('Nenhum CSV encontrado', true);

  const progress = document.getElementById('mass-progress');
  progress.style.display = 'block';
  let processed = 0;

  csvFiles.forEach(file => {
    readCSVFile(file, text => {
      const relativePath = file.webkitRelativePath || '';
      const parsed = processCSVFile(text, file.name, relativePath);

      if (parsed.type !== 'unknown') {
        const entry = {
          file,
          parsed,
          clientId: parsed.matchedClientId || '',
          clientName: parsed.extractedClient || '',
          mes: parsed.extractedDate?.mes || 0,
          ano: parsed.extractedDate?.ano || 0,
          autoClient: !!parsed.matchedClientId,
          autoDate: !!parsed.extractedDate
        };
        _massFiles.push(entry);
      }

      processed++;
      progress.textContent = `Processando... ${processed}/${csvFiles.length}`;

      if (processed === csvFiles.length) {
        progress.style.display = 'none';
        _buildMassGroups();
        _renderMassPreview();
      }
    });
  });
}

function _buildMassGroups() {
  _massGroups = {};
  for (const entry of _massFiles) {
    const key = `${entry.clientId || '_unknown'}_${entry.ano}_${entry.mes}`;
    if (!_massGroups[key]) {
      _massGroups[key] = {
        clientId: entry.clientId,
        clientName: entry.clientName,
        mes: entry.mes,
        ano: entry.ano,
        autoClient: entry.autoClient,
        autoDate: entry.autoDate,
        files: []
      };
    }
    _massGroups[key].files.push(entry);
  }
}

function _renderMassPreview() {
  const container = document.getElementById('mass-preview');
  const groups = Object.entries(_massGroups);
  const clients = getClients();

  if (!groups.length) {
    container.innerHTML = '<div class="text-muted" style="padding:20px;text-align:center">Nenhum CSV válido detectado.</div>';
    document.getElementById('mass-actions').style.display = 'none';
    return;
  }

  // Check if all groups have client + date
  const allReady = groups.every(([, g]) => g.clientId && g.mes && g.ano);

  container.innerHTML = `
    <div class="text-sm text-muted mb-12">${_massFiles.length} arquivo(s) em ${groups.length} grupo(s)</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Mês/Ano</th>
            <th>Arquivos</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${groups.map(([key, g]) => {
            const platforms = [...new Set(g.files.map(f => f.parsed.platform))];
            const platBadges = platforms.map(p => {
              const cls = p === 'instagram' ? 'ig' : p === 'facebook' ? 'fb' : p === 'youtube' ? 'yt' : 'tk';
              return `<span class="rel-plat-badge rel-plat-${cls}">${cls.toUpperCase()}</span>`;
            }).join(' ');

            const clientDisplay = g.clientId
              ? `<strong>${clientById(g.clientId)?.nome || g.clientId}</strong> ${g.autoClient ? '<span class="tag tag-green" style="font-size:9px">auto</span>' : ''}`
              : `<select class="input-sm" style="min-width:120px" onchange="_massUpdateClient('${key}',this.value)">
                  <option value="">Selecionar...</option>
                  ${clients.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
                </select>`;

            const dateDisplay = (g.mes && g.ano)
              ? `${MESES_PT[g.mes]} ${g.ano} ${g.autoDate ? '<span class="tag tag-green" style="font-size:9px">auto</span>' : ''}`
              : `<div style="display:flex;gap:4px">
                  <select class="input-sm" style="min-width:80px" onchange="_massUpdateDate('${key}','mes',this.value)">
                    <option value="">Mês</option>
                    ${MESES_PT.slice(1).map((m,i) => `<option value="${i+1}">${m}</option>`).join('')}
                  </select>
                  <input type="number" class="input-sm" style="width:70px" placeholder="Ano" min="2020" max="2030" onchange="_massUpdateDate('${key}','ano',this.value)">
                </div>`;

            const status = (g.clientId && g.mes && g.ano)
              ? '<span style="color:var(--green)">✓ Pronto</span>'
              : '<span style="color:var(--yellow)">⚠ Preencher</span>';

            return `<tr>
              <td>${clientDisplay}</td>
              <td>${dateDisplay}</td>
              <td>${platBadges} <span class="text-xs text-muted">(${g.files.length})</span></td>
              <td>${status}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="_massToggleDetail('${key}')">👁 Ver</button></td>
            </tr>
            <tr id="mass-detail-${key}" style="display:none">
              <td colspan="5" style="padding:8px 12px;background:var(--bg)">
                <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px">Arquivos do grupo:</div>
                ${g.files.map((f, fi) => {
                  const p = f.parsed;
                  const fIdx = _massFiles.indexOf(f);
                  const preview = (p.posts || p.daily || []).slice(0,2).map(item => {
                    const desc = item.descricao || item.titulo || item.data || '';
                    return desc.replace(/\n/g,' ').substring(0,50);
                  }).filter(Boolean).join(' | ');
                  const metrics = p.aggregated ? Object.entries(p.aggregated).filter(([k,v]) => typeof v === 'number' && k !== 'dias').slice(0,3).map(([k,v]) => k+': '+v.toLocaleString('pt-BR')).join(', ') : '';
                  const fileDateLabel = f.mes && f.ano ? `${MESES_PT[f.mes]} ${f.ano}` : '';
                  return `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                      <div style="flex:1;min-width:0">
                        <strong>${f.parsed.fileName}</strong> <span class="text-faint">· ${p.label}</span>
                        ${p.extractedClient ? '<span class="text-xs text-muted"> · '+p.extractedClient+'</span>' : ''}
                      </div>
                      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
                        <select class="input-sm" style="min-width:70px;font-size:11px;padding:2px 4px" onchange="_massUpdateFileDate(${fIdx},'mes',this.value)">
                          ${MESES_PT.slice(1).map((m,i) => `<option value="${i+1}" ${f.mes===(i+1)?'selected':''}>${m.substring(0,3)}</option>`).join('')}
                          ${!f.mes ? '<option value="" selected>Mês</option>' : ''}
                        </select>
                        <input type="number" class="input-sm" style="width:55px;font-size:11px;padding:2px 4px" value="${f.ano||''}" placeholder="Ano" min="2020" max="2030" onchange="_massUpdateFileDate(${fIdx},'ano',this.value)">
                      </div>
                    </div>
                    ${metrics ? '<div class="text-xs text-muted" style="margin-top:2px">'+metrics+'</div>' : ''}
                    ${preview ? '<div class="text-xs text-faint" style="margin-top:2px;font-style:italic">"'+preview+'"</div>' : ''}
                  </div>`;
                }).join('')}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('mass-actions').style.display = 'flex';
  document.getElementById('mass-generate-btn').disabled = !allReady;
}

function _massUpdateFileDate(fileIdx, field, value) {
  if (fileIdx < 0 || fileIdx >= _massFiles.length) return;
  _massFiles[fileIdx][field] = parseInt(value) || 0;
  _buildMassGroups();
  _renderMassPreview();
}

function _massToggleDetail(key) {
  const row = document.getElementById('mass-detail-' + key);
  if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
}

function _massUpdateClient(key, clientId) {
  if (!_massGroups[key]) return;
  // Update all files in this group
  const g = _massGroups[key];
  g.clientId = clientId;
  g.files.forEach(f => f.clientId = clientId);
  // Rebuild groups (key changes when clientId changes)
  _rebuildAndRender();
}

function _massUpdateDate(key, field, value) {
  if (!_massGroups[key]) return;
  const g = _massGroups[key];
  g[field] = parseInt(value) || 0;
  g.files.forEach(f => f[field] = g[field]);
  _rebuildAndRender();
}

function _rebuildAndRender() {
  // Re-group from _massFiles
  _buildMassGroups();
  _renderMassPreview();
}

function massImportExecute() {
  const groups = Object.values(_massGroups);
  const incomplete = groups.filter(g => !g.clientId || !g.mes || !g.ano);
  if (incomplete.length) return showToast('Preencha cliente e mês/ano de todos os grupos', true);

  const rels = getRelatorios();
  let created = 0, updated = 0;

  for (const g of groups) {
    const parsedFiles = g.files.map(f => f.parsed);
    // Check if report already exists for this client+month+year
    const existingIdx = rels.findIndex(r => r.clienteId === g.clientId && r.mes === g.mes && r.ano === g.ano);

    if (existingIdx >= 0) {
      // Merge into existing
      const rel = rels[existingIdx];
      parsedFiles.forEach(pf => mergeIntoRelatorio(rel, pf));
      rel.updatedAt = new Date().toISOString();
      rels[existingIdx] = rel;
      updated++;
    } else {
      // Create new
      const rel = buildRelatorio(g.clientId, g.ano, g.mes, parsedFiles);
      rels.push(rel);
      created++;
    }
  }

  saveRelatorios(rels);
  closeModal('massa');
  renderRelatorio();

  const msg = [];
  if (created) msg.push(`${created} relatório(s) criado(s)`);
  if (updated) msg.push(`${updated} atualizado(s)`);
  showToast(msg.join(', ') + '!');
}
