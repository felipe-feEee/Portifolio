// main.js — versão unificada e compatível com tabela "posts" e bucket "images"

// ---------- Sidebar / Hamburger (inicialização única) ----------
let _sidebarAutoCloseInitialized = false;

function closeSidebarIfMobile() {
  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.getElementById('hamburger-btn') || document.querySelector('.hamburger');
  if (!sidebar) return;
  if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
    if (hamburger) hamburger.classList.remove('open');
  }
}

function setupSidebarAutoClose() {
  if (_sidebarAutoCloseInitialized) return;
  _sidebarAutoCloseInitialized = true;

  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.getElementById('hamburger-btn') || document.querySelector('.hamburger');

  if (!sidebar || !hamburger) return;

  // evita que cliques dentro da sidebar fechem ela
  sidebar.addEventListener('click', (e) => e.stopPropagation());

  // hamburger abre/fecha (apenas um listener)
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open');
    if (opening) {
      hamburger.classList.add('open');
      document.body.classList.add('sidebar-open');
    } else {
      hamburger.classList.remove('open');
      document.body.classList.remove('sidebar-open');
    }
  });

  // clique fora fecha
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (hamburger && (hamburger === target || hamburger.contains(target))) return;
    if (sidebar.contains(target)) return;
    if (sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      document.body.classList.remove('sidebar-open');
      if (hamburger) hamburger.classList.remove('open');
    }
  });

  // fecha ao redimensionar para desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      document.body.classList.remove('sidebar-open');
      if (hamburger) hamburger.classList.remove('open');
    }
  });
}

// Chame setupSidebarAutoClose() uma vez na inicialização do app
window.addEventListener('DOMContentLoaded', () => {
  setupSidebarAutoClose();
});

function scrollContentToTop({ smooth = true } = {}) {
  const content = document.getElementById('content') 
                || document.querySelector('.content');
  if (!content) return;

  if (smooth && 'scrollTo' in content) {
    content.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    content.scrollTop = 0;
  }
}

/* ============================
   Configurações e estado
   ============================ */
const TITLE_MAX = 120;
const CATEGORY_MAX = 64;

let contentData = {};        // estrutura: { categoria: { key: { postId, titulo, conteudo, categoria } } }
let currentCategoria = null;
let currentId = null;
let currentPostId = null;

/* ============================
  Configurador dinâmico do Supabase
  Permite alterar: supabaseUrl, supabaseKey, tableName, bucketName
  Uso:
    setSupabaseConfig({
      supabaseUrl: 'https://...supabase.co',
      supabaseKey: 'public-or-service-key',
      tableName: 'posts',
      bucketName: 'images'
    });
    await initializeSupabase();
  Ou em runtime:
    window.configureSupabase({ ... });
  ============================ */

const SupabaseConfig = {
  supabaseUrl: 'https://pwshckrmqaqymngbosgo.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c2hja3JtcWFxeW1uZ2Jvc2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjAwOTEsImV4cCI6MjA3OTkzNjA5MX0.f8iX0RoqrdxJmq-EgSyn_YWPgCHMoARQTT4ygtbcoLg',
  tableName: 'posts',   // padrão: posts
  bucketName: 'images'  // padrão: images
};

// Função pública para configurar em runtime
function setSupabaseConfig({ supabaseUrl, supabaseKey, tableName, bucketName } = {}) {
  if (supabaseUrl) SupabaseConfig.supabaseUrl = supabaseUrl;
  if (supabaseKey) SupabaseConfig.supabaseKey = supabaseKey;
  if (tableName) SupabaseConfig.tableName = tableName;
  if (bucketName) SupabaseConfig.bucketName = bucketName;
  // expõe globalmente para conveniência (opcional)
  window.SupabaseConfig = SupabaseConfig;
}
window.configureSupabase = setSupabaseConfig;

// Inicializa o cliente Supabase usando a configuração atual
async function initializeSupabase() {
  // Se já existir window.supabase, respeita (não re-cria)
  if (window.supabase) {
    console.info('Supabase já inicializado (window.supabase).');
    return;
  }

  // Se não houver URL/KEY na config, tenta variáveis globais antigas (compatibilidade)
  const url = SupabaseConfig.supabaseUrl || window.supabaseUrl || window.SUPABASE_URL || null;
  const key = SupabaseConfig.supabaseKey || window.supabaseKey || window.SUPABASE_KEY || null;

  if (!url || !key) {
    console.warn('Supabase: credenciais não configuradas. Use setSupabaseConfig(...) antes de inicializar.');
    return;
  }

  try {
    // Import dinâmico do cliente (ESM CDN)
    const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    const { createClient } = mod;
    window.supabase = createClient(url, key);
    console.info('Supabase inicializado com sucesso.');
  } catch (err) {
    console.error('Falha ao importar/inicializar Supabase:', err);
  }
}

/* ============================
  Funções utilitárias que usam a configuração
  - carregarPostsDoBanco
  - uploadToSupabase
  - insertPost
  - updatePost
  Observação: todas usam SupabaseConfig.tableName / bucketName
  ============================ */

async function carregarPostsDoBanco() {
  // tenta inicializar se necessário
  if (!window.supabase) {
    console.warn('Supabase indisponível. Tentando inicializar automaticamente...');
    await initializeSupabase();
  }

  // fallback local se supabase não estiver disponível
  if (!window.supabase) {
    console.warn('Supabase indisponível. Carregando dados locais se houver.');
    if (typeof window.dataPT !== 'undefined') {
      try {
        if (Array.isArray(window.dataPT)) {
          contentData = {};
          window.dataPT.forEach(post => {
            const categoria = post.categoria || 'geral';
            const key = `${post.id || Date.now()}`;
            if (!contentData[categoria]) contentData[categoria] = {};
            contentData[categoria][key] = {
              postId: post.id || Date.now(),
              titulo: post.title || post.titulo || '(Sem título)',
              conteudo: post.content || post.conteudo || '',
              categoria
            };
          });
        } else {
          contentData = JSON.parse(JSON.stringify(window.dataPT));
        }
      } catch (err) {
        console.error('Erro ao usar dataPT como fallback:', err);
        contentData = {};
      }
    } else {
      contentData = {};
    }
    renderMenu();
    renderWelcome();
    return;
  }

  // usa a tabela configurada
  const table = SupabaseConfig.tableName || 'posts';

  try {
    const { data, error } = await window.supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Erro ao buscar dados da tabela "${table}":`, error);
      contentData = {};
      renderMenu();
      renderWelcome();
      return;
    }

    // normaliza para contentData
    contentData = {};
    (data || []).forEach(post => {
      const categoria = post.categoria || post.category || 'geral';
      const key = `${post.id}`;
      if (!contentData[categoria]) contentData[categoria] = {};
      contentData[categoria][key] = {
        postId: post.id,
        // tenta mapear campos comuns (title / titulo), ajuste se necessário
        titulo: post.title || post.titulo || '(Sem título)',
        conteudo: post.content || post.conteudo || '',
        categoria,
        image_url: post.image_url || post.image || null,
        created_at: post.created_at || null
      };
    });

    renderMenu();
    renderWelcome();
  } catch (err) {
    console.error('Erro inesperado ao carregar posts:', err);
    contentData = {};
    renderMenu();
    renderWelcome();
  }
}

async function uploadToSupabase(file) {
  if (!file) return '';
  if (!window.supabase) {
    console.warn('uploadToSupabase: Supabase não inicializado.');
    return '';
  }

  const bucket = SupabaseConfig.bucketName || 'images';
  const safeName = sanitizeFilename(file);
  const filePath = `${safeName.startsWith('/') ? safeName.slice(1) : safeName}`;

  try {
    const { data, error } = await window.supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });
    if (error) {
      console.error(`Erro no upload para bucket "${bucket}":`, error);
      return '';
    }
    const { data: urlData } = window.supabase.storage.from(bucket).getPublicUrl(filePath);
    return urlData?.publicUrl || '';
  } catch (err) {
    console.error('uploadToSupabase erro inesperado:', err);
    return '';
  }
}

async function insertPost(payload) {
  if (!window.supabase) {
    console.warn('insertPost: Supabase não inicializado. Fallback local.');
    return null;
  }
  const table = SupabaseConfig.tableName || 'posts';
  try {
    const resp = await window.supabase.from(table).insert(payload).select().single();
    if (resp.error) {
      console.error(`Erro ao inserir na tabela "${table}":`, resp.error);
      return null;
    }
    return resp.data;
  } catch (err) {
    console.error('insertPost erro inesperado:', err);
    return null;
  }
}

async function updatePost(postId, payload) {
  if (!window.supabase) {
    console.warn('updatePost: Supabase não inicializado. Fallback local.');
    return null;
  }
  const table = SupabaseConfig.tableName || 'posts';
  try {
    const resp = await window.supabase.from(table).update(payload).eq('id', postId);
    if (resp.error) {
      console.error(`Erro ao atualizar na tabela "${table}":`, resp.error);
      return null;
    }
    return resp.data;
  } catch (err) {
    console.error('updatePost erro inesperado:', err);
    return null;
  }
}

/* ============================
  Exemplo rápido de uso (opcional)
  Você pode chamar isso antes do DOMContentLoaded:
    setSupabaseConfig({ supabaseUrl: 'https://...', supabaseKey: '...', tableName: 'posts', bucketName: 'images' });
    await initializeSupabase();
  Ou em runtime no console:
    window.configureSupabase({ supabaseUrl: '...', supabaseKey: '...', tableName: 'posts', bucketName: 'images' });
  ============================ */

// expõe utilitários para debug/uso externo
window.setSupabaseConfig = setSupabaseConfig;
window.initializeSupabase = initializeSupabase;
window.insertPost = insertPost;
window.updatePost = updatePost;
window.uploadToSupabase = uploadToSupabase;

/* ============================
   Sanitização
   ============================ */
function sanitizePlainText(input, maxLen) {
  let s = String(input || '').replace(/\u00A0/g, ' ');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

// Atualize allowedTags para incluir 'div' (substitua a declaração existente)
const allowedTags = [
  'div','p','br','b','strong','i','em','u',
  'ul','ol','li',
  'h1','h2','h3','h4','h5','h6',
  'table','thead','tbody','tfoot','tr','td','th',
  'a','img'
];

// Substitua a função sanitizeAttributes existente por esta versão
function sanitizeAttributes(el) {
  const tag = el.tagName.toLowerCase();
  // iterar com for...of para permitir continue/skip corretamente
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();

    if (tag === 'img') {
      // permite apenas atributos seguros para imagens
      if (!['src', 'alt', 'width', 'height'].includes(name)) {
        el.removeAttribute(attr.name);
      }
      continue;
    }

    if (tag === 'a') {
      // permite href, target, rel, data-* e aria-*
      if (name === 'href' || name === 'target' || name === 'rel' || name.startsWith('data-') || name.startsWith('aria-')) {
        // preserva
      } else {
        el.removeAttribute(attr.name);
      }
      continue;
    }

    // para outras tags: preserva class, data-* e aria-*; remove o resto
    if (name === 'class' || name.startsWith('data-') || name.startsWith('aria-')) {
      // preserva
    } else {
      el.removeAttribute(attr.name);
    }
  }

  if (tag === 'a') el.setAttribute('target', '_blank');
}

function sanitizeHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || '', 'text/html');

  // Remove comentários
  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT, null, false);
  const comments = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach(c => c.parentNode?.removeChild(c));

  // Remove tags não permitidas e limpa atributos
  Array.from(doc.body.querySelectorAll('*')).forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (!allowedTags.includes(tag)) {
      const replacement = document.createElement('div');
      replacement.innerHTML = el.innerHTML;
      el.replaceWith(...replacement.childNodes);
    } else {
      sanitizeAttributes(el);
    }
  });

  return doc.body.innerHTML.trim();
}

/* ============================
   Utilitários de arquivo / nome
   ============================ */
function sanitizeFilename(file, prefix = 'paste') {
  // Se vier só o nome, trata como string
  let name = typeof file === 'string' ? file : (file?.name || 'image');

  // Normaliza base name
  name = String(name).split('/').pop().split('\\').pop();
  name = name.replace(/[^\w\-.]+/g, '_').toLowerCase();

  // Garante extensão
  let ext = 'png';
  if (file?.type && file.type.startsWith('image/')) {
    ext = file.type.split('/')[1];
  } else if (name.includes('.')) {
    ext = name.split('.').pop();
    name = name.replace(/\.[^.]+$/, ''); // remove extensão antiga
  }

  // Timestamp único
  const timestamp = Date.now();

  // Limita tamanho
  if (name.length > 80) name = name.slice(0, 80);

  // Nome final
  return `${prefix}-${timestamp}-${name}.${ext}`;
}

function insertHtmlAtCaret(html) {
  const cb = document.getElementById('content-body');
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    if (cb) cb.insertAdjacentHTML('beforeend', html);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const frag = document.createRange().createContextualFragment(html);
  range.insertNode(frag);
  sel.removeAllRanges();
  const newRange = document.createRange();
  const last = frag.lastChild;
  if (last) newRange.setStartAfter(last);
  else { newRange.selectNodeContents(cb); newRange.collapse(false); }
  newRange.collapse(true);
  sel.addRange(newRange);
}

/* ---------- Helpers de imagem e paste (importados do MonaNote) ---------- */

function extractDataUrlsFromHtml(html) {
  const dataFiles = [];
  const dataRegex = /src=["'](data:[^"']+)["']/ig;
  let m;
  while ((m = dataRegex.exec(html)) !== null) {
    const dataurl = m[1];
    try {
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const ext = mime.split('/')[1] || 'png';
      const file = new File([u8arr], `inline-${Date.now()}.${ext}`, { type: mime });
      dataFiles.push({ file, dataurl });
    } catch (err) {
      console.warn('Falha ao converter data: url', err);
    }
  }
  return dataFiles;
}

function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

function insertNodeAtCursor(node) {
  const editor = document.getElementById('content-body');
  if (!editor) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    editor.appendChild(node);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function hexToBlob(hex, mime = 'image/png') {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return new Blob([bytes], { type: mime });
}

function extractImagesFromRtf(rtfText) {
  if (!rtfText) return [];
  const results = [];
  const pictRegex = /\\pict[^\n]*?((?:[0-9A-Fa-f\r\n ]{20,})+?)\\par/gm;
  let m;
  while ((m = pictRegex.exec(rtfText)) !== null) {
    const hex = m[1].replace(/[\s\r\n]/g, '');
    const contextStart = Math.max(0, m.index - 80);
    const context = rtfText.slice(contextStart, m.index + 20).toLowerCase();
    let mime = 'image/png';
    if (context.includes('\\jpegblip')) mime = 'image/jpeg';
    if (hex.length > 20) {
      const blob = hexToBlob(hex, mime);
      const ext = mime === 'image/jpeg' ? 'jpg' : 'png';
      results.push(new File([blob], `rtf-extract-${Date.now()}.${ext}`, { type: mime }));
    }
  }
  return results;
}

async function tryClipboardReadForImages() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) return [];
    const items = await navigator.clipboard.read();
    const files = [];
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const ext = type.split('/')[1] || 'png';
          files.push(new File([blob], `clipboard-${Date.now()}.${ext}`, { type }));
        }
      }
    }
    return files;
  } catch (err) {
    console.warn('clipboard.read() indisponível ou sem permissão:', err);
    return [];
  }
}

function createMissingImageMessage() {
  const msg = document.createElement('div');
  msg.className = 'missing-image-message';
  msg.textContent = '';
  msg.style.color = '#666';
  msg.style.fontStyle = 'italic';
  msg.style.padding = '0.25rem 0';

  // Torna o bloco atômico dentro do contenteditable
  msg.setAttribute('contenteditable', 'false');
  // Permite foco por teclado (opcional, melhora acessibilidade)
  msg.setAttribute('tabindex', '0');

  return msg;
}

function generateUniqueImageName(file, prefix = 'paste') {
  // 1. Determina extensão
  let ext = 'png';
  if (file.type && file.type.startsWith('image/')) {
    ext = file.type.split('/')[1];
  } else if (file.name && file.name.includes('.')) {
    ext = file.name.split('.').pop();
  }

  // 2. Base name normalizado
  const base = (file.name ? file.name.split('.')[0] : 'image')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();

  // 3. Timestamp único
  const timestamp = Date.now();

  // 4. Nome final
  return `${prefix}-${timestamp}-${base}.${ext}`;
}

/* Handler de paste (integra com uploadToSupabase e insertNodeAtCursor) */
// Substitua a função handlePaste existente por esta
async function handlePaste(e) {
  try {
    e.preventDefault();
    const clipboard = e.clipboardData || window.clipboardData;
    if (!clipboard) return;

    const contentBody = document.getElementById('content-body');
    const target = e.target || document.activeElement;
    const isEditor = contentBody && (target === contentBody || contentBody.contains(target));

    if (!isEditor) return;

    // 1) Arquivos diretos (printscreen, copiar arquivo)
    const items = clipboard.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const publicUrl = await uploadToSupabase(file);
          if (publicUrl) {
            const img = document.createElement('img');
            img.src = publicUrl;
            img.alt = file.name;
            insertNodeAtCursor(img);
            return;
          }
        }
      }
    }

    // 2) Data URLs (Word/Outlook/Excel colam base64)
    const html = clipboard.getData('text/html') || '';
    if (html.includes('data:image')) {
      const files = extractDataUrlsFromHtml(html);
      for (const { file } of files) {
        const publicUrl = await uploadToSupabase(file);
        if (publicUrl) {
          const img = document.createElement('img');
          img.src = publicUrl;
          insertNodeAtCursor(img);
        }
      }
      return;
    }

    // 3) RTF (Word/Outlook)
    const rtf = clipboard.getData('text/rtf');
    if (rtf) {
      const files = extractImagesFromRtf(rtf);
      for (const file of files) {
        const publicUrl = await uploadToSupabase(file);
        if (publicUrl) {
          const img = document.createElement('img');
          img.src = publicUrl;
          insertNodeAtCursor(img);
        }
      }
      return;
    }

    // 4) Texto simples
    const plain = clipboard.getData('text/plain') || '';
    if (plain) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const safeText = plain.replace(/\n/g, '<br>');
        const fragToInsert = range.createContextualFragment(safeText);
        range.deleteContents();
        range.insertNode(fragToInsert);
        sel.collapse(range.endContainer, range.endOffset);
      } else {
        const p = document.createElement('p');
        p.textContent = plain;
        contentBody.appendChild(p);
      }
    }
  } catch (err) {
    console.error('Erro no handlePaste:', err);
  }
}

// Chame attachDragDropHandlers() sempre que o editor for renderizado (ex: no final de renderEditorUI)
function attachDragDropHandlers() {
  const editor = document.getElementById('content-body');
  if (!editor) return;

  // remove listeners antigos
  editor.removeEventListener('dragover', onEditorDragOver);
  editor.removeEventListener('drop', onEditorDrop);

  editor.addEventListener('dragover', onEditorDragOver);
  editor.addEventListener('drop', onEditorDrop);

  function onEditorDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy'; // feedback visual
  }

  async function onEditorDrop(e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));

    if (files.length === 0) {
      insertNodeAtCursor(createMissingImageMessage('Nenhuma imagem válida foi arrastada.'));
      return;
    }

    for (const file of files) {
      try {
        const publicUrl = await uploadToSupabase(file);
        if (publicUrl) {
          const img = document.createElement('img');
          img.src = publicUrl;
          img.alt = file.name;
          img.style.maxWidth = '100%';
          insertNodeAtCursor(img);
        } else {
          insertNodeAtCursor(createMissingImageMessage(`Falha ao enviar ${file.name}.`));
        }
      } catch (err) {
        console.error('Erro ao enviar imagem via drag&drop:', err);
        insertNodeAtCursor(createMissingImageMessage(`Erro inesperado ao enviar ${file.name}.`));
      }
    }
  }
}

/* Instala listeners de paste/drag apenas uma vez */
document.removeEventListener('paste', handlePaste);
document.getElementById('content-body').addEventListener('paste', handlePaste);

/* ============================
   Toolbar (execCommand + insertImage)
   ============================ */
function execCmd(command, value = null) {
  const body = document.getElementById('content-body');
  if (!body) return;
  body.focus();
  switch (command) {
  case 'insertImage': {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
  
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
  
      try {
        const publicUrl = await uploadToSupabase(file);
        if (publicUrl) {
          const img = document.createElement('img');
          img.src = publicUrl;
          img.alt = file.name;
          img.style.maxWidth = '100%';
          insertNodeAtCursor(img);
        } else {
          insertNodeAtCursor(createMissingImageMessage(`Falha ao enviar ${file.name}.`));
        }
      } catch (err) {
        console.error('Erro ao enviar imagem via botão:', err);
        insertNodeAtCursor(createMissingImageMessage(`Erro inesperado ao enviar ${file.name}.`));
      }
    });
  
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
    break;
  }
    case 'createLink': {
      const url = prompt('URL do link:');
      if (url) document.execCommand('createLink', false, url);
      break;
    }
    case 'formatBlock': {
      if (value) document.execCommand('formatBlock', false, value);
      break;
    }
    default: {
      document.execCommand(command, false, value);
      break;
    }
  }
}

/* ============================
   Splash de imagem (ampliar)
   ============================ */
function enableImageSplash(containerEl) {
  const container = containerEl || document.getElementById('article-content');
  if (!container) return;
  container.querySelectorAll('img').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      const splash = document.createElement('div');
      splash.style = `
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(0,0,0,0.85);display:flex;
        align-items:center;justify-content:center;
        z-index:9999;
      `;
      const enlarged = document.createElement('img');
      enlarged.src = img.src;
      enlarged.style = `
        max-width:90%;max-height:90%;
        border-radius:12px;box-shadow:0 0 20px rgba(255,255,255,0.2);
      `;
      splash.appendChild(enlarged);
      splash.addEventListener('click', () => document.body.removeChild(splash));
      document.body.appendChild(splash);
    });
  });
}

/* ============================
   Render / Menu / Busca / Artigo
   ============================ */
function renderWelcome() {
  const article = document.getElementById('article-content');
  if (!article) return;
  article.innerHTML = `
    <h1 id="article-title">Bem-vindo</h1>
    <button id="edit-article-link" style="display:none;">Editar</button>
    <div id="content-body" contenteditable="false" data-placeholder="Digite ou cole o conteúdo aqui">
      <p>Selecione um item no menu para ver o conteúdo.</p>
    </div>
  `;
}

function renderMenu() {
  const menu = document.getElementById('menu');
  if (!menu) return;
  menu.innerHTML = '';
  const ul = document.createElement('ul');

  // ordenar categorias alfabeticamente
  const categoriasOrdenadas = Object.keys(contentData).sort((a, b) =>
    a.localeCompare(b, 'pt', { sensitivity: 'base' })
  );

  for (const categoria of categoriasOrdenadas) {
    const liCategoria = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = categoria;
    span.style.cursor = 'pointer';
    span.onclick = () => liCategoria.classList.toggle('active');
    liCategoria.appendChild(span);

    const ulTitulos = document.createElement('ul');

    // ordenar títulos alfabeticamente dentro da categoria
    const titulosOrdenados = Object.entries(contentData[categoria])
      .sort(([, artigoA], [, artigoB]) =>
        artigoA.titulo.localeCompare(artigoB.titulo, 'pt', { sensitivity: 'base' })
      );

    for (const [id, artigo] of titulosOrdenados) {
      const liTitulo = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = artigo.titulo;
      link.dataset.categoria = categoria;
      link.dataset.id = id;
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const cat = this.dataset.categoria;
        const key = this.dataset.id;
        loadArticle(cat, key);
      });
      liTitulo.appendChild(link);
      ulTitulos.appendChild(liTitulo);
    }

    liCategoria.appendChild(ulTitulos);
    ul.appendChild(liCategoria);
  }

  menu.appendChild(ul);
}

(function attachSearchHandler() {
  const el = document.getElementById('search-input');
  if (!el) return;
  el.addEventListener('input', function () {
    const termo = this.value.toLowerCase();
    const suggestions = document.getElementById('search-suggestions');
    if (!suggestions) return;
    suggestions.innerHTML = '';
    if (!termo) {
      suggestions.style.display = 'none';
      return;
    }
    const matches = [];
    for (const categoria in contentData) {
      const artigos = contentData[categoria];
      for (const id in artigos) {
        const { titulo, conteudo } = artigos[id];
        if ((titulo && titulo.toLowerCase().includes(termo)) ||
            (conteudo && conteudo.toLowerCase().includes(termo))) {
          matches.push({ categoria, id, titulo });
        }
      }
    }
    if (matches.length === 0) {
      suggestions.style.display = 'none';
      return;
    }
    matches.slice(0, 10).forEach(({ categoria, id, titulo }) => {
      const li = document.createElement('li');
      li.textContent = titulo;
      li.onclick = () => {
        loadArticle(categoria, id);
        suggestions.style.display = 'none';
        el.value = '';
      };
      suggestions.appendChild(li);
    });
    suggestions.style.display = 'block';
  });
})();

/**
 * Marca o item do menu correspondente ao artigo como ativo.
 * @param {string} idOrSelector - id do artigo, ou seletor/href parcial para localizar o link.
 */
function setActiveArticle(idOrSelector) {
  const menu = document.getElementById('menu');
  if (!menu) return;

  // remove active de todos
  menu.querySelectorAll('a.active').forEach(a => {
    a.classList.remove('active');
    a.removeAttribute('aria-current');
  });

  if (!idOrSelector) {
    // não faz fallback automático quando id inválido
    return;
  }

  // normaliza para string
  const needle = String(idOrSelector);

  // helpers
  const tryQuery = (sel) => {
    try { return menu.querySelector(sel); } catch (e) { return null; }
  };

  // 1) procura por atributos de dataset comuns (data-id, data-article-id, data-post-id)
  let target = Array.from(menu.querySelectorAll('a')).find(a => {
    const ds = a.dataset || {};
    return ds.id === needle || ds.articleId === needle || ds.postId === needle || ds['article-id'] === needle;
  });

  // 2) se não encontrou, tenta data-article-id com escape (caso o id contenha caracteres especiais)
  if (!target) {
    try {
      target = tryQuery(`a[data-article-id="${CSS.escape(needle)}"]`);
    } catch (e) { /* ignore */ }
  }

  // 3) tenta localizar por href que contenha o id (apenas se o href for usado no seu app)
  if (!target) {
    target = Array.from(menu.querySelectorAll('a')).find(a => {
      const href = a.getAttribute('href') || '';
      return href.includes(needle);
    });
  }

  // 4) tenta encontrar por postId armazenado em data attributes com variações
  if (!target) {
    target = Array.from(menu.querySelectorAll('a')).find(a => {
      const ds = a.dataset || {};
      return Object.values(ds).some(v => String(v) === needle);
    });
  }

  // 5) se ainda não encontrou, tenta interpretar idOrSelector como seletor CSS (ex: '#foo' ou '.bar')
  if (!target) {
    target = tryQuery(needle);
  }

  // se não encontrou nada, não faz fallback para o primeiro link
  if (!target) {
    // opcional: log temporário para depuração
    if (window && window.console && window.console.debug) {
      console.debug('setActiveArticle: target not found for', idOrSelector);
    }
    return;
  }

  // marca o target
  target.classList.add('active');
  target.setAttribute('aria-current', 'true');

  // rola suavemente apenas se estiver fora da viewport do menu
  if (typeof target.scrollIntoView === 'function') {
    const menuRect = menu.getBoundingClientRect();
    const itemRect = target.getBoundingClientRect();
    if (itemRect.top < menuRect.top || itemRect.bottom > menuRect.bottom) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

function loadArticle(categoria, id) {
  if (!contentData[categoria] || !contentData[categoria][id]) return;
  const artigo = contentData[categoria][id];
  const container = document.getElementById('article-content');
  if (!container) return;

  // após renderizar:
  setActiveArticle(id);

  container.innerHTML = `
    <h1 id="article-title">${artigo.titulo}</h1>
    <button id="edit-article-link" data-categoria="${categoria}" data-id="${id}" data-post-id="${artigo.postId}">Editar</button>
    <div id="content-body" contenteditable="false" data-placeholder="Digite ou cole o conteúdo aqui">${artigo.conteudo}</div>
  `;

  enableImageSplash(container);

  currentCategoria = categoria;
  currentId = id;
  currentPostId = artigo.postId || null;

  const editLink = document.getElementById('edit-article-link');
  if (editLink) {
    editLink.addEventListener('click', (e) => {
      e.preventDefault();
      renderEditorUI({
        mode: 'edit',
        titulo: artigo.titulo,
        conteudo: artigo.conteudo,
        categoria: artigo.categoria
      });
    });
  }
  closeSidebarIfMobile();
  scrollContentToTop({ smooth: true });
}

/* ============================
   Editor unificado (Adicionar / Editar)
   ============================ */
function renderEditorUI({ mode = "add", titulo = "", conteudo = "", categoria = "" }) {
  const container = document.getElementById("article-content");
  if (!container) return;

  container.innerHTML = `

    <button id="close-edit-btn" title="Fechar">×</button>
    
    <div id="category-wrapper">
      <label for="category-select">Categoria:</label>
      <select id="category-select"><option value="">-- Nova Categoria --</option></select>
      <input type="text" id="new-category" placeholder="Nova categoria" style="display:none;"/>
    </div>

    <input type="text" id="title-input" placeholder="Título do conteúdo" />

    <div id="content-body" contenteditable="true" data-placeholder="Digite ou cole o conteúdo aqui"></div>

    <div class="editor-toolbar-fixed">
      <button class="cmd-btn" data-cmd="bold" title="Negrito"><b>B</b></button>
      <button class="cmd-btn" data-cmd="italic" title="Itálico"><i>I</i></button>
      <button class="cmd-btn" data-cmd="underline" title="Sublinhado"><u>U</u></button>
      <button class="cmd-btn" data-cmd="strikeThrough" title="Tachado"><s>S</s></button>
      <span class="sep"></span>
      <button class="cmd-btn" data-cmd="justifyLeft" title="Esquerda">⯇</button>
      <button class="cmd-btn" data-cmd="justifyCenter" title="Centro">≡</button>
      <button class="cmd-btn" data-cmd="justifyRight" title="Direita">⯈</button>
      <span class="sep"></span>
      <button class="cmd-btn" data-cmd="insertOrderedList" title="Lista numerada">1.</button>
      <button class="cmd-btn" data-cmd="insertUnorderedList" title="Lista">•</button>
      <button class="cmd-btn" data-cmd="formatBlock" data-value="h2" title="Título H2">H2</button>
      <button class="cmd-btn" data-cmd="removeFormat" title="Limpar">⨉</button>
      <span class="sep"></span>
      <button class="cmd-btn" data-cmd="createLink" title="Link">🔗</button>
      <button class="cmd-btn" data-cmd="insertImage" title="Imagem">🖼️</button>
      <span class="sep"></span>
      <button class="save-button">${mode === "edit" ? "Salvar" : "Adicionar"}</button>
    </div>
  `;

  // Referências
  const titleInput = document.getElementById("title-input");
  const contentBody = document.getElementById("content-body");
  const select = document.getElementById("category-select");
  const newCat = document.getElementById("new-category");

  // Preencher campos
  if (titleInput) titleInput.value = titulo || "";
  if (contentBody) contentBody.innerHTML = conteudo || "";

  // Preencher categorias existentes
  if (select) {
    // limpa e adiciona opção padrão
    select.innerHTML = '<option value="">-- Nova Categoria --</option>';
    for (const c in contentData) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    }

    // Se vier uma categoria (modo edit), seleciona-a; caso contrário, em modo add mostramos newCat
    if (categoria) {
      const hasOption = Array.from(select.options).some(opt => opt.value === categoria);
      if (hasOption) {
        select.value = categoria;
        newCat.style.display = "none";
        newCat.value = "";
      } else {
        // categoria passada que não existe: preenche newCat e mostra
        select.value = "";
        newCat.style.display = "block";
        newCat.value = categoria;
      }
    } else {
      // sem categoria passada: se estamos em modo add, mostramos newCat por padrão
      if (mode === "add") {
        select.value = "";            // garante que a opção Nova Categoria esteja selecionada
        newCat.style.display = "block";
        newCat.value = "";
      } else {
        // modo edit sem categoria: mantém nova categoria visível para o usuário decidir
        select.value = "";
        newCat.style.display = "block";
        newCat.value = "";
      }
    }

    // Listener de mudança: mostra/oculta newCat conforme seleção
    select.addEventListener("change", () => {
      const isNova = select.value === "";
      newCat.style.display = isNova ? "block" : "none";
      if (!isNova) newCat.value = "";
      // foco no campo apropriado para melhor UX
      if (isNova) newCat.focus();
      else titleInput && titleInput.focus();
    });
  }

  // Foco inicial: se newCat visível, foca nele; senão foca no título
  if (newCat && newCat.style.display !== "none") {
    newCat.focus();
  } else if (titleInput) {
    titleInput.focus();
  }

  // Toolbar handlers
  container.querySelectorAll(".cmd-btn").forEach(btn => {
    btn.addEventListener("click", () => execCmd(btn.dataset.cmd, btn.dataset.value || null));
  });

  // Salvar
  const saveBtn = container.querySelector(".save-button");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (mode === "edit") saveContentInline();
      else saveNewContent();
    });
  }

  // Fechar
  const closeBtn = document.getElementById("close-edit-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (mode === "edit") exitEditingInline();
      else cancelAddingContent();
    });
  }

  // Paste & drag&drop
  document.removeEventListener("paste", handlePaste);
  document.addEventListener("paste", handlePaste);
  attachDragDropHandlers();
}

/* ============================
   Salvar novo / salvar edição
   ============================ */
function showLoadingMessage(msg) {
  const loadingEl = document.getElementById('initial-loading');
  if (loadingEl) {
    const p = loadingEl.querySelector('p');
    if (p) p.textContent = msg;
    loadingEl.style.display = 'flex'; // ou 'block', conforme seu CSS
  }
}

function hideLoadingMessage() {
  const loadingEl = document.getElementById('initial-loading');
  if (loadingEl) {
    loadingEl.style.display = 'none';
  }
}

async function saveNewContent() {
  try {
    showLoadingMessage("Salvando alterações...");
    const titleInput = document.getElementById('title-input');
    const body = document.getElementById('content-body');
    const select = document.getElementById('category-select');
    const newCat = document.getElementById('new-category');

    const titulo = sanitizePlainText(titleInput.value, TITLE_MAX);
    const categoria = sanitizePlainText(select.value || newCat.value, CATEGORY_MAX);

    if (!titulo || !categoria) {
      alert('Título e categoria são obrigatórios.');
      return;
    }

    const conteudoLimpo = sanitizeHtml(body.innerHTML);
    const payload = { title: titulo, content: conteudoLimpo, categoria };

    if (!window.supabase) {
      // fallback local
      const key = `${Date.now()}`;
      if (!contentData[categoria]) contentData[categoria] = {};
      contentData[categoria][key] = { postId: Date.now(), titulo, conteudo: conteudoLimpo, categoria };
    } else {
      const resp = await insertPost(payload);
      if (!resp) {
        alert('Erro ao adicionar conteúdo.');
        return;
      }
      currentPostId = resp.id;
    }

    await carregarPostsDoBanco();

    const catKey = categoria;
    const newKey = Object.keys(contentData[catKey]).find(
      k => contentData[catKey][k].postId === currentPostId
    ) || Object.keys(contentData[catKey]).pop();

    loadArticle(catKey, newKey);
    //alert('Conteúdo adicionado com sucesso!');
  } catch (e) {
    console.error('Erro ao adicionar:', e);
    alert('Erro ao adicionar conteúdo.');
  }
  hideLoadingMessage();
}

async function saveContentInline() {
  try {
    showLoadingMessage("Salvando alterações...");
    const titleInput = document.getElementById('title-input');
    const body = document.getElementById('content-body');
    const select = document.getElementById('category-select');
    const newCat = document.getElementById('new-category');

    const titulo = sanitizePlainText(titleInput.value, TITLE_MAX);
    const categoria = sanitizePlainText(select.value || newCat.value, CATEGORY_MAX);

    if (!titulo || !categoria) {
      alert('Título e categoria são obrigatórios.');
      return;
    }

    const conteudoLimpo = sanitizeHtml(body.innerHTML);
    const payload = { title: titulo, content: conteudoLimpo, categoria };

    if (!window.supabase) {
      // fallback local
      const key = currentId || `${Date.now()}`;
      if (!contentData[categoria]) contentData[categoria] = {};
      contentData[categoria][key] = {
        postId: contentData[currentCategoria]?.[currentId]?.postId || Date.now(),
        titulo, conteudo: conteudoLimpo, categoria
      };
      if (currentCategoria && currentCategoria !== categoria && currentId) {
        delete contentData[currentCategoria][currentId];
      }
    } else {
      if (currentPostId) {
        const resp = await updatePost(currentPostId, payload);
        if (!resp || resp.error) {
          console.warn('DBG updatePost returned error or falsy', resp);
          if (typeof carregarPostsDoBanco === 'function') await carregarPostsDoBanco();
          const existsAfter = contentData?.[categoria] && Object.values(contentData[categoria] || {}).some(x => x.postId === currentPostId);
          if (!existsAfter) {
            alert('Erro ao salvar conteúdo.');
            return;
          }
        } else {
          currentPostId = resp.id || (resp.data && (resp.data.id || resp.data.postId)) || currentPostId;
        }
      } else {
        const resp = await insertPost(payload);
        if (!resp || resp.error) {
          console.warn('DBG insertPost returned error or falsy', resp);
          if (typeof carregarPostsDoBanco === 'function') await carregarPostsDoBanco();
          const maybeId = resp && (resp.id || (resp.data && (resp.data.id || resp.data.postId)));
          if (maybeId) {
            currentPostId = maybeId;
          } else {
            alert('Erro ao salvar conteúdo.');
            return;
          }
        } else {
          currentPostId = resp.id || (resp.data && (resp.data.id || resp.data.postId)) || currentPostId;
        }
      }
    }

    await carregarPostsDoBanco();

    const catKey = categoria;
    const savedKey = Object.keys(contentData[catKey]).find(
      k => contentData[catKey][k].postId === currentPostId
    ) || Object.keys(contentData[catKey]).pop();

    loadArticle(catKey, savedKey);
    //alert('Conteúdo salvo com sucesso!');
  } catch (e) {
    console.error('Erro ao salvar:', e);
    // tenta revalidar antes de notificar o usuário
    try { if (typeof carregarPostsDoBanco === 'function') await carregarPostsDoBanco(); } catch(e2){ console.warn('revalidação falhou', e2); }
    alert('Erro ao salvar conteúdo.');
  }
  hideLoadingMessage();
}

function exitEditingInline() {
  if (currentCategoria && currentId) loadArticle(currentCategoria, currentId);
  else renderWelcome();
}

function cancelAddingContent() {
  renderWelcome();
}

/* ============================
   Inicialização do app
   ============================ */
window.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('initial-loading');

  try {
    // Inicializa supabase e carrega dados
    await initializeSupabase();
    await carregarPostsDoBanco();
  } catch (e) {
    console.error('Erro na inicialização:', e);
    // tenta carregar dados locais/fallback mesmo em erro
    await carregarPostsDoBanco();
  } finally {
    // Esconde o loading uma única vez
    if (loadingEl) loadingEl.style.display = 'none';
  }

  // Configura o sidebar/hamburger (registra listeners uma vez)
  setupSidebarAutoClose();

  // Botão adicionar (registrado uma vez)
  const addBtn = document.getElementById('add-content-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      renderEditorUI({ mode: 'add' });
      closeSidebarIfMobile(); // fecha a sidebar no mobile
    });
  }
});
