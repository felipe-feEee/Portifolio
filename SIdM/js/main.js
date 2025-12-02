// main.js — edição inline estilo Wikipédia, mantendo colagem/drag&drop, upload e sanitização
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Reutilize suas credenciais existentes
const supabaseUrl = 'https://pwshckrmqaqymngbosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c2hja3JtcWFxeW1uZ2Jvc2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjAwOTEsImV4cCI6MjA3OTkzNjA5MX0.f8iX0RoqrdxJmq-EgSyn_YWPgCHMoARQTT4ygtbcoLg'
window.supabase = createClient(supabaseUrl, supabaseKey)

// Configurações de sanitização e limites
const TITLE_MAX = 120;
const CATEGORY_MAX = 64;

// Estado global
let contentData = {};
let currentCategoria = null;
let currentId = null;
let currentPostId = null;
let isEditingInline = false;

// ========== Upload e inserção de imagens (mantido) ==========
async function uploadToSupabase(file) {
  const fileName = `paste-${Date.now()}-${sanitizeFilename(file.name)}`;
  const { data, error } = await supabase.storage.from('images').upload(fileName, file);
  if (error) {
    console.error('Erro ao enviar para Supabase:', error);
    const editor = document.getElementById('content-body');
    if (editor) {
      const warn = document.createElement('div');
      warn.style.color = '#b33';
      warn.style.fontSize = '0.9rem';
      warn.style.margin = '0.25rem 0';
      warn.textContent = 'Falha ao enviar imagem: verifique permissões do bucket (Storage RLS).';
      editor.appendChild(warn);
    }
    return '';
  }
  return supabase.storage.from('images').getPublicUrl(fileName).data.publicUrl;
}

function sanitizeFilename(name) {
  if (!name) name = `file-${Date.now()}`;
  name = String(name).split('/').pop().split('\\').pop();
  name = name.replace(/[^\w\-.]+/g, '_');
  if (name.length > 120) name = name.slice(0, 120);
  return name;
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

// ========== Sanitização de HTML e texto ==========
function sanitizePlainText(input, maxLen) {
  let s = String(input || '').replace(/\u00A0/g, ' ');
  // Remove tags e atributos
  s = s.replace(/<[^>]*>/g, '');
  // Normaliza espaços
  s = s.replace(/\s+/g, ' ').trim();
  // Limita tamanho
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

// Whitelist de tags permitidas e limpeza de atributos
const allowedTags = [
  'p','br','b','strong','i','em','u',
  'ul','ol','li',
  'h1','h2','h3','h4','h5','h6',
  'table','thead','tbody','tfoot','tr','td','th',
  'a','img'
];

function sanitizeAttributes(el) {
  const tag = el.tagName.toLowerCase();
  [...el.attributes].forEach(attr => {
    const name = attr.name.toLowerCase();
    if (tag === 'img') {
      if (name !== 'src') el.removeAttribute(attr.name);
    } else if (tag === 'a') {
      if (name !== 'href') el.removeAttribute(attr.name);
    } else {
      el.removeAttribute(attr.name);
    }
  });
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

  // Remove tags não permitidas (preserva innerHTML)
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

// ========== Colagem, HTML e drag&drop (mantido e integrado) ==========
function insertHtmlAtCaret(html) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    const cb = document.getElementById('content-body');
    if (cb) cb.insertAdjacentHTML('beforeend', html);
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const frag = document.createRange().createContextualFragment(html);
  range.insertNode(frag);
  sel.removeAllRanges();
  const newRange = document.createRange();
  newRange.setStartAfter(frag.lastChild || range.endContainer);
  newRange.collapse(true);
  sel.addRange(newRange);
}

function createMissingImageMessage() {
  const msg = document.createElement('div');
  msg.className = 'missing-image-message';
  msg.textContent = 'Imagem não foi colada. Cole apenas a imagem (sem texto) para inseri-la automaticamente.';
  msg.style.color = '#666';
  msg.style.fontStyle = 'italic';
  msg.style.padding = '0.25rem 0';
  return msg;
}

async function handlePaste(e) {
  try {
    e.preventDefault();
    const contentBody = document.getElementById('content-body');
    if (!contentBody) return;

    const target = e.target || document.activeElement;
    const isTargetContentBody = contentBody && (target === contentBody || contentBody.contains(target));

    // Fora do editor -> texto simples
    if (!isTargetContentBody) {
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        const plain = e.clipboardData.getData('text/plain') || '';
        const el = target;
        const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
        const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length;
        el.value = el.value.slice(0, start) + plain + el.value.slice(end);
        el.selectionStart = el.selectionEnd = start + plain.length;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    const items = Array.from(e.clipboardData?.items || []);
    const types = Array.from(e.clipboardData?.types || []);

    // 1) Imagens diretas
    const imageItems = items.filter(i => i.type && i.type.startsWith('image/'));
    if (imageItems.length > 0) {
      for (const it of imageItems) {
        const file = it.getAsFile();
        if (!file) continue;
        const publicUrl = await uploadToSupabase(file);
        if (publicUrl) {
          const img = document.createElement('img');
          img.src = publicUrl;
          img.style.maxWidth = '100%';
          insertNodeAtCursor(img);
        }
      }
      return;
    }

    // 2) HTML colado -> sanitiza antes de inserir
    if (types.includes('text/html')) {
      const rawHtml = e.clipboardData.getData('text/html');
      const clean = sanitizeHtml(rawHtml);
      insertHtmlAtCaret(clean);
      return;
    }

    // 3) Texto simples
    const plain = e.clipboardData.getData('text/plain');
    if (plain) {
      const p = document.createElement('p');
      p.textContent = plain;
      insertNodeAtCursor(p);
    }
  } catch (err) {
    console.error('Erro no handlePaste:', err);
  }
}

// Drag & drop de imagens
function attachDragDrop() {
  const editor = document.getElementById('content-body');
  if (!editor) return;
  editor.addEventListener('dragover', e => e.preventDefault());
  editor.addEventListener('drop', async e => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      try {
        const publicUrl = await uploadToSupabase(file);
        if (publicUrl) {
          const img = document.createElement('img');
          img.src = publicUrl;
          img.style.maxWidth = '100%';
          insertNodeAtCursor(img);
        }
      } catch (err) {
        console.error('Erro ao enviar imagem via drag&drop:', err);
        const msg = createMissingImageMessage();
        insertNodeAtCursor(msg);
      }
    }
  });
}

// ========== Toolbar de rich text (mantida) ==========
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
            img.style.maxWidth = '100%';
            insertNodeAtCursor(img);
          }
        } catch (err) {
          console.error('Erro ao enviar imagem:', err);
          const msg = createMissingImageMessage();
          insertNodeAtCursor(msg);
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

// ========== Splash de imagens ==========
function enableImageSplash(containerEl) {
  if (!containerEl) containerEl = document.getElementById('article-content');
  if (!containerEl) return;
  containerEl.querySelectorAll('img').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      const splash = document.createElement('div');
      splash.style = `
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(0,0,0,0.8);display:flex;
        align-items:center;justify-content:center;
        z-index:999999;animation:fadeIn 0.3s ease;
      `;
      const enlarged = document.createElement('img');
      enlarged.src = img.src;
      enlarged.style = `
        max-width:90%;max-height:90%;
        box-shadow:0 0 20px rgba(0,0,0,0.5); border-radius:8px;
      `;
      splash.appendChild(enlarged);
      splash.addEventListener('click', () => document.body.removeChild(splash));
      document.body.appendChild(splash);
    });
  });
}

// ========== Menu e busca ==========
function renderWelcome() {
  const article = document.getElementById('article-content');
  if (!article) return;
  article.innerHTML = `
    <h1 id="article-title">Bem-vindo</h1>
    <button id="edit-article-link" style="display:none;">Editar</button>
    <div id="content-body" contenteditable="false" data-placeholder="Digite ou cole o conteúdo aqui">
      <p>Selecione um item no menu para ver o conteúdo.</p>
    </div>
    <div id="category-wrapper" style="display:none;">
      <label for="category-select">Categoria:</label>
      <select id="category-select"><option value="">-- Nova Categoria --</option></select>
      <input type="text" id="new-category" placeholder="Nova categoria" style="display:none;"/>
    </div>
    <input type="text" id="title-input" placeholder="Título do conteúdo" style="display:none;" />
    <button id="close-edit-btn" title="Fechar" style="display:none;">×</button>
    <div class="editor-toolbar-fixed" style="display:none;">
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
      <button class="save-button">Salvar</button>
    </div>
  `;
}

async function carregarPostsDoBanco() {
  const { data, error } = await window.supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Erro ao carregar posts:', error);
    return;
  }
  contentData = {};
  data.forEach(post => {
    const categoria = post.categoria || 'geral';
    const id = `post${post.id}`;
    if (!contentData[categoria]) contentData[categoria] = {};
    contentData[categoria][id] = {
      postId: post.id,
      titulo: post.title,
      conteudo: post.content,
      imagem: post.image_url || null
    };
  });
  renderMenu();
  renderWelcome();
}

function renderMenu(openCategories = []) {
  const menu = document.getElementById('menu');
  if (!menu) return;
  menu.innerHTML = '';
  const ul = document.createElement('ul');
  for (const categoria in contentData) {
    const liCategoria = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = categoria;
    if (openCategories.includes(categoria)) liCategoria.classList.add('active');
    span.onclick = () => liCategoria.classList.toggle('active');
    liCategoria.appendChild(span);

    const ulTitulos = document.createElement('ul');
    for (const id in contentData[categoria]) {
      const artigo = contentData[categoria][id];
      const liTitulo = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = artigo.titulo;
      link.setAttribute('data-categoria', categoria);
      link.setAttribute('data-id', id);
      link.onclick = (e) => {
        e.preventDefault();
        loadArticle(categoria, id);
      };
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
        document.getElementById('search-input').value = '';
      };
      suggestions.appendChild(li);
    });
    suggestions.style.display = 'block';
  });
})();

// ========== Render do artigo e modo edição inline ==========
function loadArticle(categoria, id) {
  if (!contentData[categoria] || !contentData[categoria][id]) return;
  const artigo = contentData[categoria][id];
  const container = document.getElementById('article-content');
  if (!container) return;

  // Conteúdo visual
  container.innerHTML = `
    <h1 id="article-title">${artigo.titulo}</h1>
    <button id="edit-article-link" data-categoria="${categoria}" data-id="${id}" data-post-id="${artigo.postId}">Editar</button>
    <div id="content-body" contenteditable="false" data-placeholder="Digite ou cole o conteúdo aqui">${artigo.conteudo}</div>

    <div id="category-wrapper" style="display:none;">
      <label for="category-select">Categoria:</label>
      <select id="category-select"><option value="">-- Nova Categoria --</option></select>
      <input type="text" id="new-category" placeholder="Nova categoria" style="display:none;"/>
    </div>
    <input type="text" id="title-input" placeholder="Título do conteúdo" style="display:none;" />

    <button id="close-edit-btn" title="Fechar" style="display:none;">×</button>

    <div class="editor-toolbar-fixed" style="display:none;">
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
      <button class="save-button">Salvar</button>
    </div>
  `;

  // Preencher select de categoria
  const select = container.querySelector('#category-select');
  if (select) {
    select.innerHTML = '<option value="">-- Nova Categoria --</option>';
    for (const c in contentData) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    }
  }

  // Ativar splash em imagens e toolbar
  enableImageSplash(container);

  currentCategoria = categoria;
  currentId = id;
  currentPostId = artigo.postId || null;

  // Editar
  const editLink = document.getElementById('edit-article-link');
  if (editLink) {
    editLink.addEventListener('click', e => {
      e.preventDefault();
      startEditingInline();
    });
  }

  // Toolbar handlers
  container.querySelectorAll('.cmd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.value || null;
      execCmd(cmd, val);
    });
  });

  // Salvar
  const saveBtn = container.querySelector('.save-button');
  if (saveBtn) saveBtn.addEventListener('click', saveContentInline);

  // Fechar edição
  const closeBtn = document.getElementById('close-edit-btn');
  if (closeBtn) closeBtn.addEventListener('click', exitEditingInline);

  // Paste e drag&drop
  document.removeEventListener('paste', handlePaste);
  document.addEventListener('paste', handlePaste);
  attachDragDrop();
}

function startEditingInline() {
  const container = document.getElementById('article-content');
  if (!container) return;

  const h1 = document.getElementById('article-title');
  const titleInput = document.getElementById('title-input');
  const body = document.getElementById('content-body');
  const toolbar = container.querySelector('.editor-toolbar-fixed');
  const closeBtn = document.getElementById('close-edit-btn');
  const wrapper = document.getElementById('category-wrapper');
  const select = document.getElementById('category-select');
  const newCat = document.getElementById('new-category');

  // Título -> input
  titleInput.value = sanitizePlainText(h1.textContent, TITLE_MAX);
  h1.style.display = 'none';
  titleInput.style.display = 'block';

  // Categoria
  wrapper.style.display = 'block';
  if (currentCategoria && select) {
    const hasOption = Array.from(select.options).some(opt => opt.value === currentCategoria);
    select.value = hasOption ? currentCategoria : '';
    newCat.style.display = hasOption ? 'none' : 'block';
    newCat.value = hasOption ? '' : sanitizePlainText(currentCategoria, CATEGORY_MAX);
    select.addEventListener('change', () => {
      const isNova = select.value === '';
      newCat.style.display = isNova ? 'block' : 'none';
      if (!isNova) newCat.value = '';
    });
  }

  // Corpo editável
  body.contentEditable = 'true';

  // Mostrar toolbar e fechar
  toolbar.style.display = 'flex';
  closeBtn.style.display = 'inline-block';

  isEditingInline = true;
}

function exitEditingInline() {
  const container = document.getElementById('article-content');
  if (!container) return;

  const h1 = document.getElementById('article-title');
  const titleInput = document.getElementById('title-input');
  const body = document.getElementById('content-body');
  const toolbar = container.querySelector('.editor-toolbar-fixed');
  const closeBtn = document.getElementById('close-edit-btn');
  const wrapper = document.getElementById('category-wrapper');

  titleInput.style.display = 'none';
  h1.style.display = 'block';

  body.contentEditable = 'false';
  toolbar.style.display = 'none';
  closeBtn.style.display = 'none';
  wrapper.style.display = 'none';

  isEditingInline = false;
}

async function saveContentInline() {
  try {
    const titleInput = document.getElementById('title-input');
    const body = document.getElementById('content-body');
    const select = document.getElementById('category-select');
    const newCat = document.getElementById('new-category');

    // Sanitização de título e categoria
    const titulo = sanitizePlainText(titleInput.value, TITLE_MAX);
    const categoria = sanitizePlainText(select.value || newCat.value, CATEGORY_MAX);
    if (!titulo || !categoria) {
      alert('Título e categoria são obrigatórios.');
      return;
    }

    // Sanitização de conteúdo (whitelist)
    const conteudoLimpo = sanitizeHtml(body.innerHTML);

    const payload = {
      title: titulo,
      content: conteudoLimpo,
      categoria
    };

    let error;
    if (currentPostId) {
      const resp = await window.supabase.from('posts').update(payload).eq('id', currentPostId);
      error = resp.error;
    } else {
      const resp = await window.supabase.from('posts').insert(payload).select().single();
      error = resp.error;
      if (!error && resp.data) currentPostId = resp.data.id;
    }
    if (error) {
      console.error('Erro ao salvar no Supabase:', error);
      alert('Erro ao salvar conteúdo.');
      return;
    }

    // Atualiza cache local e UI
    await carregarPostsDoBanco();
    loadArticle(categoria, Object.keys(contentData[categoria]).find(k => contentData[categoria][k].postId === currentPostId));

    exitEditingInline();
    alert('Conteúdo salvo com sucesso!');
  } catch (e) {
    console.error('Erro ao salvar:', e);
    alert('Erro ao salvar conteúdo.');
  }
}

// ========== Inicialização ==========
window.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('initial-loading');
  try {
    await carregarPostsDoBanco();
  } catch (e) {
    console.error('Erro ao carregar do Supabase, usando fallback local:', e);
    if (typeof window.dataPT !== 'undefined') {
      try { contentData = JSON.parse(JSON.stringify(window.dataPT)); }
      catch (err) { contentData = window.dataPT || {}; }
    }
    renderMenu();
    renderWelcome();
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }

  // Hamburguer abre/fecha sidebar
  const hamburgerBtn = document.getElementById('hamburger-btn');
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.classList.toggle('open');
    });
  }
});
