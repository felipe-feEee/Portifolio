// main.js — versão mesclada e final (sem suporte a idiomas)
// Integra: processamento de imagens, UI, busca, painel, export
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://pwshckrmqaqymngbosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c2hja3JtcWFxeW1uZ2Jvc2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjAwOTEsImV4cCI6MjA3OTkzNjA5MX0.f8iX0RoqrdxJmq-EgSyn_YWPgCHMoARQTT4ygtbcoLg'
window.supabase = createClient(supabaseUrl, supabaseKey)

// -----------------------------
// Upload helper (Supabase)
// -----------------------------
async function uploadToSupabase(file) {
  const fileName = `paste-${Date.now()}-${file.name}`
  const { data, error } = await supabase.storage
    .from('images')
    .upload(fileName, file)

  if (error) {
    console.error('Erro ao enviar para Supabase:', error)
    // mostra mensagem amigável no editor (não bloqueante)
    const editor = document.getElementById('content-body')
    if (editor) {
      const warn = document.createElement('div')
      warn.style.color = '#b33'
      warn.style.fontSize = '0.9rem'
      warn.style.margin = '0.25rem 0'
      warn.textContent = 'Falha ao enviar imagem: verifique permissões do bucket (Storage RLS).'
      editor.appendChild(warn)
    }
    return ''
  }

  return supabase.storage.from('images').getPublicUrl(fileName).data.publicUrl
}

// -----------------------------
// Utilitários
// -----------------------------
function basename(path) {
  try {
    return String(path).split('/').pop().split('?')[0]
  } catch {
    return path
  }
}

function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new File([u8arr], filename, { type: mime })
}

function insertNodeAtCursor(node) {
  const editor = document.getElementById('content-body')
  if (!editor) {
    console.warn('Editor não encontrado: #content-body')
    return
  }
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    editor.appendChild(node)
    return
  }
  const range = sel.getRangeAt(0)
  range.deleteContents()
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

// -----------------------------
// Reconstrução automática (RTF, data:, clipboard.read)
// -----------------------------
function hexToBlob(hex, mime = 'image/png') {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return new Blob([bytes], { type: mime })
}

function extractImagesFromRtf(rtfText) {
  if (!rtfText) return []
  const results = []
  const pictRegex = /\\pict[^\n]*?((?:[0-9A-Fa-f\r\n ]{20,})+?)\\par/gm
  let m
  while ((m = pictRegex.exec(rtfText)) !== null) {
    const hex = m[1].replace(/[\s\r\n]/g, '')
    const contextStart = Math.max(0, m.index - 80)
    const context = rtfText.slice(contextStart, m.index + 20).toLowerCase()
    let mime = 'image/png'
    if (context.includes('\\jpegblip')) mime = 'image/jpeg'
    if (hex.length > 20) {
      const blob = hexToBlob(hex, mime)
      const ext = mime === 'image/jpeg' ? 'jpg' : 'png'
      results.push(new File([blob], `rtf-extract-${Date.now()}.${ext}`, { type: mime }))
    }
  }
  return results
}

async function tryClipboardReadForImages() {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) return []
    const items = await navigator.clipboard.read()
    const files = []
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type)
          const ext = type.split('/')[1] || 'png'
          files.push(new File([blob], `clipboard-${Date.now()}.${ext}`, { type }))
        }
      }
    }
    return files
  } catch (err) {
    console.warn('clipboard.read() indisponível ou sem permissão:', err)
    return []
  }
}

function extractDataUrlsFromHtml(html) {
  const dataFiles = []
  const dataRegex = /src=["'](data:[^"']+)["']/ig
  let m
  while ((m = dataRegex.exec(html)) !== null) {
    const dataurl = m[1]
    try {
      const arr = dataurl.split(',')
      const mime = arr[0].match(/:(.*?);/)[1]
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) u8arr[n] = bstr.charCodeAt(n)
      const ext = mime.split('/')[1] || 'png'
      const file = new File([u8arr], `inline-${Date.now()}.${ext}`, { type: mime })
      dataFiles.push({ file, dataurl })
    } catch (err) {
      console.warn('Falha ao converter data: url', err)
    }
  }
  return dataFiles
}

// -----------------------------
// Mensagem simples para imagens não coladas
// -----------------------------
function createMissingImageMessage() {
  const msg = document.createElement('div')
  msg.className = 'missing-image-message'
  msg.textContent = 'Imagem não foi colada. Cole apenas a imagem (sem texto) para inseri-la automaticamente.'
  msg.style.color = '#666'
  msg.style.fontStyle = 'italic'
  msg.style.padding = '0.25rem 0'
  return msg
}

// -----------------------------
// Handler principal de paste (versão final simplificada)
// -----------------------------
async function handlePaste(e) {
  try {
    e.preventDefault()

    const contentBody = document.getElementById('content-body') || document.querySelector('.content-body')
    if (!contentBody) return console.warn('Editor não encontrado: #content-body')

    const target = e.target || document.activeElement
    const isTargetContentBody = contentBody && (target === contentBody || contentBody.contains(target))

    // Se o destino NÃO for o editor content-body, trate apenas como texto em inputs/textarea e saia.
    if (!isTargetContentBody) {
      // Se for textarea/input, insere texto simples no cursor
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        try {
          const plain = e.clipboardData.getData('text/plain') || ''
          const el = target
          const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length
          const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length
          el.value = el.value.slice(0, start) + plain + el.value.slice(end)
          el.selectionStart = el.selectionEnd = start + plain.length
          el.dispatchEvent(new Event('input', { bubbles: true }))
        } catch (err) {
          console.warn('Erro ao inserir texto no input/textarea:', err)
        }
      }
      // Não processamos HTML/imagens fora do content-body
      return
    }

    // A partir daqui, sabemos que o destino é o editor content-body — processamos imagens/HTML normalmente
    const items = Array.from(e.clipboardData?.items || [])
    const types = Array.from(e.clipboardData?.types || [])

    // 1) arquivos de imagem diretos no clipboard (printscreen, arquivo)
    const imageItems = items.filter(i => i.type && i.type.startsWith('image/'))
    if (imageItems.length > 0) {
      for (const it of imageItems) {
        const file = it.getAsFile()
        if (!file) continue
        console.log('📦 Blobs capturados do clipboard:', file)
        const publicUrl = await uploadToSupabase(file)
        if (publicUrl) {
          const img = document.createElement('img')
          img.src = publicUrl
          img.alt = file.name || 'pasted-image'
          img.style.maxWidth = '100%'
          insertNodeAtCursor(img)
        }
      }
      return
    }

    // 2) HTML colado (ex.: Word) — somente para content-body
    if (types.includes('text/html')) {
      const html = e.clipboardData.getData('text/html')
      const temp = document.createElement('div')
      temp.innerHTML = html

      const imgs = Array.from(temp.querySelectorAll('img'))
      if (imgs.length === 0) {
        const plain = e.clipboardData.getData('text/plain') || temp.textContent || ''
        const p = document.createElement('p')
        p.textContent = plain
        insertNodeAtCursor(p)
        return
      }

      // tenta recuperar blobs do evento (quando presentes)
      let availableFiles = items
        .filter(i => i.kind === 'file' && i.type && i.type.startsWith('image/'))
        .map(i => i.getAsFile())
        .filter(Boolean)

      console.log('📦 Blobs capturados do clipboard (evento):', availableFiles)

      // se não houver blobs, tenta navigator.clipboard.read() (requer foco/permissão)
      if (availableFiles.length === 0) {
        const readFiles = await tryClipboardReadForImages()
        if (readFiles.length > 0) {
          availableFiles = availableFiles.concat(readFiles)
          console.log('📦 Blobs capturados via navigator.clipboard.read():', readFiles)
        }
      }

      // se ainda não houver blobs, tenta extrair do RTF
      if (availableFiles.length === 0) {
        const rtf = e.clipboardData.getData('text/rtf')
        const rtfFiles = extractImagesFromRtf(rtf)
        if (rtfFiles.length > 0) {
          availableFiles = availableFiles.concat(rtfFiles)
          console.log('📦 Blobs extraídos do RTF:', rtfFiles)
        }
      }

      // se ainda não houver blobs, tenta extrair data: URIs do HTML
      if (availableFiles.length === 0) {
        const dataUrlFiles = extractDataUrlsFromHtml(html)
        if (dataUrlFiles.length > 0) {
          availableFiles = availableFiles.concat(dataUrlFiles.map(d => d.file))
          console.log('📦 Blobs extraídos de data: URIs no HTML:', dataUrlFiles)
        }
      }

      // cria mapa por nome para tentativa de match
      const fileMapByName = {}
      for (const f of availableFiles) {
        const n = (f.name || '').toLowerCase()
        if (!fileMapByName[n]) fileMapByName[n] = []
        fileMapByName[n].push(f)
      }

      function pickFileForSrc(src) {
        if (!src) return null
        if (src.startsWith('data:')) {
          const filename = `paste-inline-${Date.now()}.png`
          return dataURLtoFile(src, filename)
        }
        const base = basename(src).toLowerCase()
        if (base && fileMapByName[base] && fileMapByName[base].length > 0) {
          return fileMapByName[base].shift()
        }
        for (const key of Object.keys(fileMapByName)) {
          if (key.includes(base) && fileMapByName[key].length > 0) {
            return fileMapByName[key].shift()
          }
        }
        for (const key of Object.keys(fileMapByName)) {
          if (fileMapByName[key].length > 0) {
            return fileMapByName[key].shift()
          }
        }
        return null
      }

      // evita que o navegador tente carregar file:// — guarda src original e remove src
      for (const img of imgs) {
        const src = img.getAttribute('src') || ''
        if (src.startsWith('file:') || src.startsWith('C:\\') || src.includes('msohtmlclip')) {
          img.setAttribute('data-local-src', src)
          img.removeAttribute('src')
        }
      }

      // processa cada imagem: upload automático quando possível; caso contrário, insere mensagem simples
      for (const img of imgs) {
        const originalSrc = img.getAttribute('data-local-src') || img.getAttribute('src') || ''
        const fileToUpload = pickFileForSrc(originalSrc)

        if (fileToUpload) {
          try {
            const publicUrl = await uploadToSupabase(fileToUpload)
            if (publicUrl) {
              img.src = publicUrl
              img.style.maxWidth = '100%'
              img.removeAttribute('data-local-src')
            } else {
              console.error('Falha ao enviar imagem para Supabase:', originalSrc)
              const msg = createMissingImageMessage()
              img.replaceWith(msg)
            }
          } catch (err) {
            console.error('Erro upload imagem:', err)
            const msg = createMissingImageMessage()
            img.replaceWith(msg)
          }
        } else {
          console.warn('Imagem referenciada localmente mas nenhum blob correspondente no clipboard:', originalSrc)
          const msg = createMissingImageMessage()
          img.replaceWith(msg)
        }
      }

      // Insere o HTML processado no editor (filhos de temp)
      while (temp.firstChild) {
        insertNodeAtCursor(temp.firstChild)
      }

      console.info('Se houver mensagens indicando imagens faltantes, cole apenas a imagem (sem texto) para inseri-la automaticamente.')
      return
    }

    // 3) fallback: texto simples (somente content-body chega aqui)
    const plain = e.clipboardData.getData('text/plain')
    if (plain) {
      const p = document.createElement('p')
      p.textContent = plain
      insertNodeAtCursor(p)
    }
  } catch (err) {
    console.error('Erro no handlePaste:', err)
  }
}

// registra listener (remove duplicatas anteriores)
document.removeEventListener('paste', handlePaste)
document.addEventListener('paste', handlePaste)

// ------------------------ Estado global ------------------------
let contentData = {};
let editingCategoria = null;
let editingId = null;
let isEditingMode = false;
let sessionHasSaved = false;
if (typeof window.__objectUrlMap === 'undefined') window.__objectUrlMap = {};
// main.js
//let contentData = (typeof dataPT !== 'undefined') ? JSON.parse(JSON.stringify(dataPT)) : {};

document.addEventListener('DOMContentLoaded', async () => {
  // Opcional: estado de carregamento
  showLoading('Carregando conteúdo...')

  try {
    await carregarPostsDoBanco() // isso vai sobrescrever contentData e chamar renderMenu/renderWelcome
  } catch (e) {
    console.error(e)
    // fallback para JSON local se der erro
    renderMenu()
    renderWelcome()
    showError('Não foi possível carregar do Supabase. Exibindo conteúdo local.')
  } finally {
    hideLoading()
  }
})

function showLoading(msg) {
  let el = document.getElementById('loading')
  if (!el) {
    el = document.createElement('div')
    el.id = 'loading'
    el.style.position = 'fixed'
    el.style.top = '10px'
    el.style.right = '10px'
    el.style.background = '#333'
    el.style.color = '#fff'
    el.style.padding = '5px 10px'
    el.style.borderRadius = '4px'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.style.display = 'block'
}

function hideLoading() {
  const el = document.getElementById('loading')
  if (el) el.style.display = 'none'
}

function showError(msg) {
  let el = document.getElementById('error')
  if (!el) {
    el = document.createElement('div')
    el.id = 'error'
    el.style.position = 'fixed'
    el.style.bottom = '10px'
    el.style.right = '10px'
    el.style.background = '#c00'
    el.style.color = '#fff'
    el.style.padding = '5px 10px'
    el.style.borderRadius = '4px'
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.style.display = 'block'
}


// ------------------------ Utilitários ------------------------
function sanitizeFilename(name) {
  if (!name) name = `file-${Date.now()}`;
  name = String(name).split('/').pop().split('\\').pop();
  name = name.replace(/[^\w\-.]+/g, '_');
  if (name.length > 120) name = name.slice(0, 120);
  return name;
}

function escapeRegex(str) { return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normalizeStr(s) { return (s || '').replace(/\u00A0/g, ' ').trim(); }

function cleanWordHtmlAndInsert(rawHtml) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // 🔥 Remove elementos indesejados
    const tagsToRemove = ['meta', 'link', 'style', 'script', 'xml'];
    tagsToRemove.forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    // 🔥 Remove namespaces do Word (w:, o:, v:)
    Array.from(doc.querySelectorAll('*')).forEach(el => {
      if (/^(w:|o:|v:)/.test(el.tagName.toLowerCase())) el.remove();
    });

    // 🔥 Remove comentários
    const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_COMMENT, null, false);
    const comments = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach(c => c.parentNode?.removeChild(c));

    // 🔥 Remove atributos inúteis
    Array.from(doc.querySelectorAll('*')).forEach(el => {
      [...el.attributes].forEach(attr => {
        if (/^(class|style|lang|data-|mso|xmlns)/i.test(attr.name)) el.removeAttribute(attr.name);
      });
    });

    // ✅ Mantém apenas texto, listas e imagens
    const allowedTags = ['p', 'div', 'span', 'img', 'ul', 'ol', 'li', 'br', 'strong', 'em', 'b', 'i'];
    Array.from(doc.body.querySelectorAll('*')).forEach(el => {
      if (!allowedTags.includes(el.tagName.toLowerCase())) {
        const replacement = document.createElement('div');
        replacement.innerHTML = el.innerHTML;
        el.replaceWith(...replacement.childNodes);
      }
    });

    // ✅ Insere conteúdo limpo no ponto do cursor
    insertHtmlAtCaret(doc.body.innerHTML);

  } catch (e) {
    console.warn('Erro ao limpar HTML colado:', e);
  }
}

function enableImageSplash(containerEl) {
  if (!containerEl) containerEl = document.getElementById('article-content');
  if (!containerEl) return;

  containerEl.querySelectorAll('img').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
	  console.log(`🖱️ Imagem clicada: ${img.src}`);
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
        box-shadow:0 0 20px rgba(0,0,0,0.5);
        border-radius:8px;
      `;

      splash.appendChild(enlarged);
      splash.addEventListener('click', () => document.body.removeChild(splash));
      document.body.appendChild(splash);
    });
  });
  const imgs = containerEl.querySelectorAll('img');
  console.log(`🔍 Encontradas ${imgs.length} imagens para splash`);

}

// ------------------------ Storage helpers ------------------------

async function uploadImagemParaSupabase(img) {
  const fileName = `${Date.now()}-${sanitizeFilename(img.name)}`
  const { error } = await window.supabase.storage
    .from('images')
    .upload(fileName, img.blob)

  if (error) {
    console.error('Erro ao subir imagem:', error)
    return null
  }

  const { data: pub } = window.supabase.storage
    .from('images')
    .getPublicUrl(fileName)

  return pub.publicUrl
}

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

function extractFilenameFromPath(path) {
  try {
    return decodeURIComponent(path.split(/[\\/]/).pop().split('?')[0]);
  } catch {
    return null;
  }
}

// ------------------------ Save flow (integrado) ------------------------
async function addNewContent() {
  const titleEl = document.getElementById('content-title')
  const contentEl = document.getElementById('content-body')
  const selectEl = document.getElementById('category-select')
  const newCatEl = document.getElementById('new-category')

  if (!titleEl || !contentEl || !selectEl || !newCatEl) {
    console.error('Campos do formulário não encontrados')
    return
  }

  const title = titleEl.value.trim()
  const content = contentEl.innerHTML.trim()

  const selectedValue = (selectEl.value || '').trim()
  const newCategoryValue = (newCatEl.value || '').trim()
  const isNewCategory = selectedValue === '' // "-- Nova Categoria --" com value=""

  const categoriaFinal = isNewCategory ? (newCategoryValue || 'geral') : selectedValue

  if (!title || !content) {
    alert('Título e conteúdo são obrigatórios!')
    return
  }
  if (isNewCategory && !newCategoryValue) {
    alert('Informe o nome da nova categoria ou escolha uma existente.')
    return
  }

  const processedHtml = content

  // Upload de imagens coladas (se houver)
  let imageUrl = null
  if (typeof tempImages !== 'undefined' && Array.isArray(tempImages) && tempImages.length > 0) {
    const img = tempImages[0]
    const fileName = `${Date.now()}-${sanitizeFilename(img.name || 'image')}`
    const { error: uploadError } = await window.supabase.storage
      .from('images')
      .upload(fileName, img.blob)

    if (uploadError) {
      console.error('Erro ao subir imagem:', uploadError)
    } else {
      const { data: pub } = window.supabase.storage
        .from('images')
        .getPublicUrl(fileName)
      imageUrl = pub?.publicUrl || null
    }
  }

  // Monta payload (não sobrescreve image_url quando não há nova imagem)
  const payload = {
    title,
    content: processedHtml,
    categoria: categoriaFinal
  }
  if (imageUrl) payload.image_url = imageUrl

  const isEditing = !!window.editingPostId
  let error

  if (isEditing) {
    const resp = await window.supabase
      .from('posts')
      .update(payload)
      .eq('id', window.editingPostId)
    error = resp.error
  } else {
    const resp = await window.supabase
      .from('posts')
      .insert(payload)
    error = resp.error
  }

  if (error) {
    console.error('Erro ao salvar no Supabase:', error)
    alert('Erro ao salvar conteúdo.')
    return
  }

  await carregarPostsDoBanco()

  // Limpa formulário e estado de edição
  titleEl.value = ''
  contentEl.innerHTML = ''
  selectEl.value = ''          // volta para "-- Nova Categoria --"
  newCatEl.value = ''
  if (typeof tempImages !== 'undefined') tempImages = []
  const wasEditing = isEditing
  window.editingPostId = null  // sai do modo edição

  alert(wasEditing ? 'Conteúdo atualizado com sucesso!' : 'Conteúdo salvo com sucesso!')

  // Fecha o painel após salvar
  closeNewContentPanel()
}

//onclick do HTML
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.querySelector('#new-content-panel .save-button')
  if (saveBtn) {
    saveBtn.addEventListener('click', addNewContent)
  }
})

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('button.apply-debug')
  if (!btn) return console.warn('Botão .apply-debug não encontrado')

  // remove qualquer handler inline/antigo para evitar execução dupla
  try { btn.onclick = null } catch (e) {}

  async function onApplyClick(e) {
    e.preventDefault()
    if (btn.disabled) return
    btn.disabled = true
    const originalText = btn.textContent
    btn.textContent = 'Aplicando...'

    try {
      if (typeof applyDebugChanges === 'function') {
        await Promise.resolve(applyDebugChanges(e))
      } else {
        console.warn('applyDebugChanges não encontrada')
      }
    } catch (err) {
      console.error('Erro em applyDebugChanges:', err)
      const notice = document.createElement('div')
      notice.style.color = '#b33'
      notice.style.fontSize = '0.9rem'
      notice.textContent = 'Erro ao aplicar alterações. Veja console.'
      btn.insertAdjacentElement('afterend', notice)
      setTimeout(() => notice.remove(), 5000)
    } finally {
      btn.disabled = false
      btn.textContent = originalText
    }
  }

  btn.removeEventListener('click', onApplyClick)
  btn.addEventListener('click', onApplyClick)
})

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('button.apply-debug')
  if (!btn) return console.warn('Botão .apply-debug não encontrado')

  // remove qualquer handler inline/antigo para evitar execução dupla
  try { btn.onclick = null } catch (e) {}

  async function onApplyClick(e) {
    e.preventDefault()
    if (btn.disabled) return
    btn.disabled = true
    const originalText = btn.textContent
    btn.textContent = 'Aplicando...'

    try {
      if (typeof applyDebugChanges === 'function') {
        await Promise.resolve(applyDebugChanges(e))
      } else {
        console.warn('applyDebugChanges não encontrada')
      }
    } catch (err) {
      console.error('Erro em applyDebugChanges:', err)
      const notice = document.createElement('div')
      notice.style.color = '#b33'
      notice.style.fontSize = '0.9rem'
      notice.textContent = 'Erro ao aplicar alterações. Veja console.'
      btn.insertAdjacentElement('afterend', notice)
      setTimeout(() => notice.remove(), 5000)
    } finally {
      btn.disabled = false
      btn.textContent = originalText
    }
  }

  btn.removeEventListener('click', onApplyClick)
  btn.addEventListener('click', onApplyClick)
})

document.addEventListener('DOMContentLoaded', () => {
  const editLink = document.getElementById('edit-article-link')
  if (editLink) {
    editLink.addEventListener('click', e => {
      e.preventDefault()
      const categoria = editLink.dataset.categoria
      const id = editLink.dataset.id
      const postId = editLink.dataset.postId // id supabase

      if (!categoria || !id) {
        console.error('Categoria ou ID não definidos no link de edição')
        return
      }
      startEditing(categoria, id, postId)
    })
  }
})

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.copy-path-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const path = btn.dataset.path
      if (path) {
        try {
          await navigator.clipboard.writeText(path)
          alert('Caminho copiado para a área de transferência!')
        } catch (err) {
          console.error('Erro ao copiar caminho:', err)
          alert('Não foi possível copiar o caminho.')
        }
      }
    })
  })
})

document.addEventListener('DOMContentLoaded', () => {
  // Botões de comandos Rich Text
  document.querySelectorAll('.cmd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd
      const val = btn.dataset.value || null
      execCmd(cmd, val)
    })
  })

  // Botões de painel
  const closePanelBtn = document.getElementById('close-panel-btn')
  if (closePanelBtn) closePanelBtn.addEventListener('click', toggleNewContentPanel)

  const addContentBtn = document.getElementById('add-content-btn')
  if (addContentBtn) addContentBtn.addEventListener('click', toggleNewContentPanel)

  // Splash de imagem
  //const splash = document.getElementById('image-splash')
  //if (splash) splash.addEventListener('click', closeSplash)

  // Debug popup
  const closeDebugBtn = document.querySelector('.close-debug-btn')
  if (closeDebugBtn) closeDebugBtn.addEventListener('click', closeDebugPopup)

  const applyDebugBtn = document.getElementById('apply-debug-btn')
  if (applyDebugBtn) applyDebugBtn.addEventListener('click', applyDebugChanges)

  // Select de categoria
  //const categorySelect = document.getElementById('category-select')
  //if (categorySelect) categorySelect.addEventListener('change', handleCategoryChange)
})

// ------------------------ UI / Render ------------------------
function renderWelcome() {
  const article = document.getElementById('article-content');
  if (!article) return;
  article.innerHTML = `
    <h1>Bem-vindo</h1>
    <p>Selecione um item no menu para ver o conteúdo.</p>
  `;
}

async function carregarPostsDoBanco() {
  const { data, error } = await window.supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao carregar posts:', error)
    return
  }

  // Reorganiza em formato antigo: contentData[categoria][id]
  contentData = {}
  data.forEach(post => {
    const categoria = post.categoria || 'geral'
    const id = `post${post.id}`
    if (!contentData[categoria]) contentData[categoria] = {}
    contentData[categoria][id] = {
	  postId: post.id,
      titulo: post.title,
      conteudo: post.content,
      imagem: post.image_url || null
    }
  })

  renderMenu()
  renderWelcome()
  window.contentData = contentData
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
		link.setAttribute('data-categoria', categoria); // 👈 Adiciona categoria
		link.setAttribute('data-id', id);               // 👈 Adiciona id
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

function loadArticle(categoria, id) {
  if (!contentData[categoria] || !contentData[categoria][id]) return;

  const artigo = contentData[categoria][id];
  const container = document.getElementById('article-content');
  if (!container) return;

  const wasEditing = editingCategoria !== null && editingId !== null;
  if (wasEditing) closeNewContentPanel();

  container.style.animation = 'slideOutToLeft 0.4s ease forwards';

  setTimeout(() => {
    console.log(`🧾 Renderizando artigo ${categoria}|${id}`);

    //const imgCount = getImageCountForArticle(categoria, id);
    //const btnText = imgCount > 0 ? `Baixar imagens (${imgCount})` : 'Nenhuma imagem';
    //const btnDisabledAttr = imgCount > 0 ? '' : 'disabled';

container.innerHTML = `
  <div class="control-bar">
    <a id="edit-article-link" href="#"
       data-categoria="${categoria}"
       data-id="${id}"
       data-post-id="${artigo.postId}">Editar</a>
  </div>
  <h1>${artigo.titulo}</h1>
  <div class="article-body">${artigo.conteudo}</div>
`;


    container.style.animation = 'slideInFromLeft 0.6s ease forwards';

    // Links externos abrem em nova aba
    const links = container.querySelectorAll('a:not(#edit-article-link)');
    links.forEach(link => link.setAttribute('target', '_blank'));

    editingCategoria = categoria;
    editingId = id;

    // Splash de imagens
    console.log('🖼️ Ativando splash screen para imagens...');
    enableImageSplash(container);

    // Destaca link ativo no menu
    const menuLinks = document.querySelectorAll('#menu a');
    menuLinks.forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(
      `#menu a[data-categoria="${categoria}"][data-id="${id}"]`
    );
    if (activeLink) activeLink.classList.add('active');

    // ✅ Reata listener do link Editar
const editLink = document.getElementById('edit-article-link')
  if (editLink) {
    editLink.addEventListener('click', e => {
      e.preventDefault()
      const categoria = editLink.dataset.categoria
      const id = editLink.dataset.id
      const postId = editLink.dataset.postId // id supabase

      if (!categoria || !id) {
        console.error('Categoria ou ID não definidos no link de edição')
        return
      }
      startEditing(categoria, id, postId)
    })
  }
  }, 400);
}

function startEditing(categoria, id, postId) {
  if (!categoria || !id) return

  // Carrega dados atuais do artigo (do seu cache/estado)
  const artigo = contentData?.[categoria]?.[id]
  if (!artigo) {
    console.error('Artigo não encontrado para edição')
    return
  }

  // Guarda o id do Supabase para atualização
  window.editingPostId = postId || artigo.postId || null
  if (!window.editingPostId) {
    console.warn('editingPostId ausente. Sem ele, a edição fará insert. Garanta data-post-id no link.')
  }

  // Preenche o formulário
  const titleEl = document.getElementById('content-title')
  const contentEl = document.getElementById('content-body')
  const selectEl = document.getElementById('category-select')
  const newCatEl = document.getElementById('new-category')

  if (!titleEl || !contentEl || !selectEl || !newCatEl) {
    console.error('Campos do formulário não encontrados para edição')
    return
  }

  titleEl.value = artigo.titulo || ''
  contentEl.innerHTML = artigo.conteudo || ''

  // Categoria atual do artigo
  const catAtual = categoria || 'geral'
  // Se a categoria atual existe no select, seleciona; senão, marca como nova
  const option = Array.from(selectEl.options).find(opt => (opt.value || '').trim() === catAtual)
  if (option) {
    selectEl.value = catAtual
    newCatEl.value = '' // não é nova
  } else {
    selectEl.value = ''       // "-- Nova Categoria --"
    newCatEl.value = catAtual // preenche como nova
  }

  // Abre painel em modo edição
  openNewContentPanel({ forEdit: true, categoria, id })
}

function openNewContentPanel({ forEdit = false, categoria = null, id = null } = {}) {
  const panel = document.getElementById('new-content-panel');
  const overlay = document.getElementById('overlay');
  if (!panel || !overlay) return;

  const select = document.getElementById('category-select');
  if (select) {
    select.innerHTML = '<option value="">-- Nova Categoria --</option>';
    for (const c in contentData) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    }
  }
  const wrapper = document.getElementById('new-category-wrapper');
	if (select && wrapper) {
	  select.addEventListener('change', function () {
		const isNovaCategoria = this.selectedIndex === 0;
		wrapper.style.display = isNovaCategoria ? 'block' : 'none';
	  });
	}

  const newCatInput = document.getElementById('new-category');
  const titleInput = document.getElementById('content-title');
  const bodyInput = document.getElementById('content-body');

  if (forEdit && categoria && id && contentData[categoria] && contentData[categoria][id]) {
    isEditingMode = true;
    editingCategoria = categoria;
    editingId = id;
    if (newCatInput) newCatInput.value = categoria;
    if (titleInput) titleInput.value = contentData[categoria][id].titulo || '';
    if (bodyInput) bodyInput.innerHTML = contentData[categoria][id].conteudo || '';
  } else {
    isEditingMode = false;
    editingCategoria = null;
    editingId = null;
    if (select) select.value = '';
    if (newCatInput) newCatInput.value = '';
    if (titleInput) titleInput.value = '';
    if (bodyInput) bodyInput.innerHTML = '';
  }

  // ✅ Ativa overlay
  overlay.style.display = 'block';

  // ✅ Prepara painel para entrada com animação
  panel.style.display = 'block';
  panel.classList.remove('hidden', 'panel-slide-out-right', 'panel-slide-out-left');
  void panel.offsetWidth; // força reflow para reiniciar animação
  panel.classList.add('panel-slide-in-right');
}

function closeNewContentPanel() {
  const panel = document.getElementById('new-content-panel');
  const overlay = document.getElementById('overlay');

  if (panel) {
    panel.classList.remove('panel-slide-in-right', 'hidden');
    void panel.offsetWidth; // força reflow
    panel.classList.add('panel-slide-out-right');

    setTimeout(() => {
      panel.style.display = 'none';
      panel.classList.remove('panel-slide-out-right');
      panel.classList.add('hidden');
    }, 600);
  }

  if (overlay) overlay.style.display = 'none';

  isEditingMode = false;
  editingCategoria = null;
  editingId = null;
}

// compatibility: toggle used in some HTML
window.toggleNewContentPanel = function() {
  const panel = document.getElementById('new-content-panel');
  if (!panel) return;
  const isHidden = panel.style.display === 'none' || panel.style.display === '';
  if (isHidden) openNewContentPanel({ forEdit:false });
  else closeNewContentPanel();
};

// edit current article (works with single-language contentData)
function editCurrentArticle() {
  if (!editingCategoria || !editingId) return;

  isEditingMode = true;

  const artigo = contentData[editingCategoria] && contentData[editingCategoria][editingId]
    ? contentData[editingCategoria][editingId]
    : { titulo: '', conteudo: '' };

  document.getElementById('category-select').value = '';
  document.getElementById('new-category').value = editingCategoria;
  document.getElementById('content-title').value = artigo?.titulo || '';
  document.getElementById('content-body').innerHTML = artigo?.conteudo || '';

  document.getElementById('new-content-panel').style.display = 'block';
  document.getElementById('overlay').style.display = 'block';
  //handleCategoryChange();
}

function hasUserAddedContent() {
  try {
    const current = JSON.stringify(contentData || {});
    return current !== '{}' && current !== 'null';
  } catch (e) {
    return true;
  }
}

// ------------------------ Search input ------------------------
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
        if (
          (titulo && titulo.toLowerCase().includes(termo)) ||
          (conteudo && conteudo.toLowerCase().includes(termo))
        ) {
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

// Toggle debug mode: mostra/oculta tags HTML no content-body
window.__debugMode = window.__debugMode || false;
window.__debugModeStore = window.__debugModeStore || new Map();

// Execução de comandos Rich Text focando no #content-body
function execCmd(command, value = null) {
  const body = document.getElementById('content-body')
  if (!body) return

  // Garante que os comandos atuem no editor
  body.focus()

  switch (command) {
    case 'insertImage': {
      const url = prompt('URL da imagem:')
      if (url) document.execCommand('insertImage', false, url)
      break
    }
    case 'createLink': {
      const url = prompt('URL do link:')
      if (url) document.execCommand('createLink', false, url)
      break
    }
    case 'formatBlock': {
      // Alguns browsers exigem passar value explicitamente
      if (value) {
        document.execCommand('formatBlock', false, value)
      }
      break
    }
    case 'openDebug': {
      // Comando especial para o botão {"</>"}
      openDebugPopup()
      break
    }
    default: {
      // Comandos padrão (bold, italic, underline, etc.)
      document.execCommand(command, false, value)
      break
    }
  }
}

// Popup de debug lado a lado — não altera o content-body até Aplicar
function openDebugPopup() {
  const body = document.getElementById('content-body');
  const popup = document.getElementById('debug-popup');
  const textarea = document.getElementById('debug-code');
  const previewFrame = document.getElementById('debug-preview-frame');
  if (!body || !popup || !textarea || !previewFrame) return;

  // Carrega HTML atual do editor
  const isDebugEscaped = body.getAttribute('data-debug-mode') === '1';
  const htmlSource = isDebugEscaped
    ? (body.getAttribute('data-html-original') || '')
    : body.innerHTML;

  textarea.value = htmlSource;
  previewFrame.srcdoc = htmlSource;

  // Evita múltiplos listeners ao abrir várias vezes
  textarea.oninput = function () {
    previewFrame.srcdoc = textarea.value;
  };

  popup.style.display = 'flex';
}

function closeDebugPopup() {
  const popup = document.getElementById('debug-popup');
  if (popup) popup.style.display = 'none';
}

function applyDebugChanges() {
  const body = document.getElementById('content-body');
  const textarea = document.getElementById('debug-code');
  if (!body || !textarea) return;

  // Aplica o HTML editado ao editor
  body.innerHTML = textarea.value;

  // Limpa qualquer estado de debug antigo
  body.removeAttribute('data-debug-mode');
  body.removeAttribute('data-html-original');
  window.__debugMode = false;

  closeDebugPopup();
}

function toggleDebugMode(force) {
  try {
    const body = document.getElementById('content-body');
    if (!body) return false;

    const enable = (typeof force === 'boolean') ? force : !window.__debugMode;

    if (enable) {
      const originalHTML = body.innerHTML;
      body.setAttribute('data-html-original', originalHTML);

      const escaped = originalHTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      body.setAttribute('data-debug-mode', '1');
      body.innerHTML = `<pre style="white-space:pre-wrap;word-break:break-word;margin:0;padding:8px;background:#0f172024;border-radius:4px;">${escaped}</pre>`;
      window.__debugMode = true;
    } else {
      const saved = body.getAttribute('data-html-original');
      if (typeof saved === 'string') body.innerHTML = saved;

      body.removeAttribute('data-debug-mode');
      body.removeAttribute('data-html-original');
      window.__debugMode = false;
    }

    const btn = document.getElementById('debug-toggle-btn');
    if (btn) {
      btn.classList.toggle('active', !!window.__debugMode);
      btn.textContent = window.__debugMode ? 'Exibição' : 'HTML';
    }

    return !!window.__debugMode;
  } catch (e) {
    console.warn('toggleDebugMode erro', e);
    return false;
  }
}


// Instala listener seguro no botão (se existir) — opcional, pode ficar dentro do DOMContentLoaded
(function attachDebugToggleBtn() {
  const btn = document.getElementById('debug-toggle-btn');
  if (!btn) return;
  btn.removeAttribute('onclick');
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', () => toggleDebugMode());
  newBtn.textContent = window.__debugMode ? 'Exibição' : 'HTML';
})();


// ------------------------ Init ------------------------
window.addEventListener('DOMContentLoaded', async () => {
  sessionHasSaved = false;

  // tenta carregar do Supabase
  try {
    await carregarPostsDoBanco();
  } catch (e) {
    console.error('Erro ao carregar do Supabase, usando fallback local:', e);
    if (typeof window.dataPT !== 'undefined') {
      try {
        contentData = JSON.parse(JSON.stringify(window.dataPT));
      } catch (err) {
        contentData = window.dataPT || {};
      }
    }
    renderMenu();
    renderWelcome();
  }

  // botão de adicionar conteúdo
  const addBtn = document.getElementById('add-content-btn');
  if (addBtn && !addBtn.getAttribute('onclick')) {
    addBtn.addEventListener('click', () => openNewContentPanel({ forEdit: false }));
  }

  // botão de salvar conteúdo
  const saveBtn = document.querySelector('#new-content-panel .save-button');
  if (saveBtn && !saveBtn.getAttribute('onclick')) {
    saveBtn.addEventListener('click', addNewContent);
  }

  // botão de fechar painel
  const closeBtn = document.getElementById('close-panel-btn');
  if (closeBtn) {
    closeBtn.removeAttribute('onclick');
    const newBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newBtn, closeBtn);
    newBtn.addEventListener('click', () => closeNewContentPanel());
  }
});
