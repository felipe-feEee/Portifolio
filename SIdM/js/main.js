// main.js — edição inline estilo Wikipédia, com sanitização, colagem/drag&drop, upload de imagens e busca

// Supabase: inicializa se não estiver pronto
(async function initSupabase() {
  try {
    if (!window.supabase) {
      // Se já possuir suas credenciais globais, use-as aqui:
      const supabaseUrl = window.supabaseUrl || 'https://pwshckrmqaqymngbosgo.supabase.co';
      const supabaseKey = window.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c2hja3JtcWFxeW1uZ2Jvc2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjAwOTEsImV4cCI6MjA3OTkzNjA5MX0.f8iX0RoqrdxJmq-EgSyn_YWPgCHMoARQTT4ygtbcoLg';
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
      window.supabase = createClient(supabaseUrl, supabaseKey);
    }
  } catch (e) {
    console.warn('Supabase não inicializado via CDN. Certifique-se de carregar o cliente antes do main.js.');
  }
})();

// Limites
const TITLE_MAX = 120;
const CATEGORY_MAX = 64;

// Estado global
let contentData = {};
let currentCategoria = null;
let currentId = null;
let currentPostId = null;

// ========== Sanitização ==========
function sanitizePlainText(input, maxLen) {
  let s = String(input || '').replace(/\u00A0/g, ' ');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

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

// ========== Upload/Imagens ==========
function sanitizeFilename(name) {
  if (!name) name = `file-${Date.now()}`;
  name = String(name).split('/').pop().split('\\').pop();
  name = name.replace(/[^\w\-.]+/g, '_');
  if (name.length > 120) name = name.slice(0, 120);
  return name;
}

async function uploadToSupabase(file) {
  if (!window.supabase) return '';
  const fileName = `paste-${Date.now()}-${sanitizeFilename(file.name)}`;
  const { data, error } = await window.supabase.storage.from('images').upload(fileName, file);
  if (error) {
    console.error('Erro ao enviar para Supabase Storage:', error);
    return '';
  }
  const { data: urlData } = window.supabase.storage.from('images').getPublicUrl(fileName);
  return urlData?.publicUrl || '';
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
  if (last) {
    newRange.setStartAfter(last);
  } else {
    newRange.selectNodeContents(cb);
    newRange.collapse(false);
  }
  newRange.collapse(true);
  sel.addRange(newRange);
}

function createImagePasteHint(message = 'Imagem não foi inserida.') {
  const msg = document.createElement('div');
  msg.style.color = '#666';
  msg.style.fontStyle = 'italic';
  msg.style.padding = '0.25rem 0';
  msg.textContent = message;
  return msg;
}

// ========== Eventos de colagem e drag&drop ==========
async function handlePaste(e) {
  try {
    e.preventDefault();
    const editor = document.getElementById('content-body');
    if (!editor) return;

    const target = e.target || document.activeElement;
    const inEditor = editor && (target === editor || editor.contains(target));

    // Fora do editor: cola como texto em inputs/textarea
    if (!inEditor) {
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

    // Imagens diretas
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
        } else {
          insertNodeAtCursor(createImagePasteHint('Falha ao enviar imagem.'));
        }
      }
      return;
    }

    // HTML colado
    if (types.includes('text/html')) {
      const rawHtml = e.clipboardData.getData('text/html');
      const clean = sanitizeHtml(rawHtml);
      insertHtmlAtCaret(clean);
      return;
    }

    // Texto simples
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
        } else {
          insertNodeAtCursor(createImagePasteHint('Falha ao enviar imagem via drag&drop.'));
        }
      } catch (err) {
        console.error('Erro ao enviar imagem via drag&drop:', err);
        insertNodeAtCursor(createImagePasteHint('Erro no upload de imagem.'));
      }
    }
  });
}

// ========== Toolbar ==========
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
        const publicUrl = await uploadToSupabase(file);
        if (publicUrl) {
          const img = document.createElement('img');
          img.src = publicUrl;
          img.style.maxWidth = '100%';
          insertNodeAtCursor(img);
        } else {
          insertNodeAtCursor(createImagePasteHint('Falha ao enviar imagem.'));
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

// ========== Menu, busca e render ==========
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

async function carregarPostsDoBanco() {
  if (!window.supabase) {
    console.warn('Supabase indisponível. Carregando dados locais se houver.');
    if (typeof window.dataPT !== 'undefined') {
      try { contentData = JSON.parse(JSON.stringify(window.dataPT)); }
      catch (err) { contentData = window.dataPT || {}; }
    }
    renderMenu();
    renderWelcome();
    return;
  }

  const { data, error } = await window.supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar posts:', error);
    if (typeof window.dataPT !== 'undefined') {
      try { contentData = JSON.parse(JSON.stringify(window.dataPT)); }
      catch (err) { contentData = window.dataPT || {}; }
    }
  } else {
    contentData = {};
    (data || []).forEach(post => {
      const categoria = post.categoria || 'geral';
      const key = `post-${post.id}`;
      if (!contentData[categoria]) contentData[categoria] = {};
      contentData[categoria][key] = {
        postId: post.id,
        titulo: post.title || '(Sem título)',
        conteudo: post.content || '',
        categoria
      };
    });
  }

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
      link.dataset.categoria = categoria;
      link.dataset.id = id;
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
        el.value = '';
      };
      suggestions.appendChild(li);
    });
    suggestions.style.display = 'block';
  });
})();

function loadArticle(categoria, id) {
  if (!contentData[categoria] || !contentData[categoria][id]) return;
  const artigo = contentData[categoria][id];
  const container = document.getElementById('article-content');
  if (!container) return;

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
}

// ========== Editor unificado (Adicionar/Editar) ==========
function renderEditorUI({ mode = "add", titulo = "", conteudo = "", categoria = "" }) {
  const container = document.getElementById("article-content");
  if (!container) return;

  container.innerHTML = `
    <div id="category-wrapper">
      <label for="category-select">Categoria:</label>
      <select id="category-select"><option value="">-- Nova Categoria --</option></select>
      <input type="text" id="new-category" placeholder="Nova categoria" style="display:none;"/>
    </div>

    <input type="text" id="title-input" placeholder="Título do conteúdo" />

    <button id="close-edit-btn" title="Fechar">×</button>

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

  // Preencher campos
  document.getElementById("title-input").value = titulo || "";
  document.getElementById("content-body").innerHTML = conteudo || "";

  // Preencher categorias
  const select = document.getElementById("category-select");
  const newCat = document.getElementById("new-category");
  if (select) {
    select.innerHTML = '<option value="">-- Nova Categoria --</option>';
    for (const c in contentData) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    }
    if (categoria) {
      const hasOption = Array.from(select.options).some(opt => opt.value === categoria);
      select.value = hasOption ? categoria : "";
      newCat.style.display = hasOption ? "none" : "block";
      if (!hasOption) newCat.value = categoria;
    }
    select.addEventListener('change', () => {
      const isNova = select.value === '';
      newCat.style.display = isNova ? 'block' : 'none';
      if (!isNova) newCat.value = '';
    });
  }

  // Toolbar
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

  // Colagem e drag&drop
  document.removeEventListener("paste", handlePaste);
  document.addEventListener("paste", handlePaste);
  attachDragDrop();
}

// ========== Salvar (Adicionar/Editar) ==========
async function saveNewContent() {
  try {
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
      // Fallback local (sem Supabase): atualiza contentData
      const key = `post-${Date.now()}`;
      if (!contentData[categoria]) contentData[categoria] = {};
      contentData[categoria][key] = { postId: Date.now(), titulo, conteudo: conteudoLimpo, categoria };
    } else {
      const resp = await window.supabase.from('posts').insert(payload).select().single();
      if (resp.error) {
        console.error('Erro ao adicionar conteúdo:', resp.error);
        alert('Erro ao adicionar conteúdo.');
        return;
      }
      currentPostId = resp.data.id;
    }

    await carregarPostsDoBanco();

    const catKey = categoria;
    const newKey = Object.keys(contentData[catKey]).find(
      k => contentData[catKey][k].postId === currentPostId
    ) || Object.keys(contentData[catKey]).pop();

    loadArticle(catKey, newKey);
    alert('Conteúdo adicionado com sucesso!');
  } catch (e) {
    console.error('Erro ao adicionar:', e);
    alert('Erro ao adicionar conteúdo.');
  }
}

async function saveContentInline() {
  try {
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
      // Fallback local
      const key = currentId;
      if (!contentData[categoria]) contentData[categoria] = {};
      contentData[categoria][key] = {
        postId: contentData[currentCategoria][currentId].postId || Date.now(),
        titulo, conteudo: conteudoLimpo, categoria
      };
      if (currentCategoria !== categoria) {
        delete contentData[currentCategoria][currentId];
      }
    } else {
      if (currentPostId) {
        const resp = await window.supabase.from('posts').update(payload).eq('id', currentPostId);
        if (resp.error) {
          console.error('Erro ao salvar no Supabase:', resp.error);
          alert('Erro ao salvar conteúdo.');
          return;
        }
      } else {
        const resp = await window.supabase.from('posts').insert(payload).select().single();
        if (resp.error) {
          console.error('Erro ao criar novo post:', resp.error);
          alert('Erro ao salvar conteúdo.');
          return;
        }
        currentPostId = resp.data.id;
      }
    }

    await carregarPostsDoBanco();

    // Localiza o item após salvar
    const catKey = categoria;
    const savedKey = Object.keys(contentData[catKey]).find(
      k => contentData[catKey][k].postId === currentPostId
    ) || Object.keys(contentData[catKey]).pop();

    loadArticle(catKey, savedKey);
    alert('Conteúdo salvo com sucesso!');
  } catch (e) {
    console.error('Erro ao salvar:', e);
    alert('Erro ao salvar conteúdo.');
  }
}

function exitEditingInline() {
  // Volta para o artigo atual
  if (currentCategoria && currentId) {
    loadArticle(currentCategoria, currentId);
  } else {
    renderWelcome();
  }
}

function cancelAddingContent() {
  renderWelcome();
}

// ========== Inicialização ==========
window.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('initial-loading');
  try {
    await carregarPostsDoBanco();
  } catch (e) {
    console.error('Erro ao carregar posts:', e);
    renderWelcome();
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
  }

  // Hamburguer: abre/fecha sidebar
  const hamburgerBtn = document.getElementById('hamburger-btn');
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) sidebar.classList.toggle('open');
    });
  }

  // Botão de adicionar conteúdo (sidebar)
  const addBtn = document.getElementById('add-content-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      renderEditorUI({ mode: 'add' });
    });
  }
});
