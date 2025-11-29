// main.js — versão mesclada e final (sem suporte a idiomas)
// Integra: processamento de imagens, UI, busca, painel, export
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://pwshckrmqaqymngbosgo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c2hja3JtcWFxeW1uZ2Jvc2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjAwOTEsImV4cCI6MjA3OTkzNjA5MX0.f8iX0RoqrdxJmq-EgSyn_YWPgCHMoARQTT4ygtbcoLg'
window.supabase = createClient(supabaseUrl, supabaseKey)


// ------------------------ Estado global ------------------------
let contentData = {};
let editingCategoria = null;
let editingId = null;
let isEditingMode = false;
let sessionHasSaved = false;
window._imagesForExport = window._imagesForExport || {};
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

// ------------------------ Ext derivation ------------------------
function extFromBlobOrDataUrl(blob, dataurl, fallback = 'png') {
  if (blob?.type) {
    const mime = blob.type.toLowerCase();
    if (mime.includes('jpeg')) return 'jpg';
    if (mime.includes('png')) return 'png';
    if (mime.includes('gif')) return 'gif';
    if (mime.includes('bmp')) return 'bmp';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('svg')) return 'svg';
  }

  if (dataurl?.startsWith('data:image/')) {
    const match = dataurl.match(/^data:image\/([^;]+);base64,/);
    if (match && match[1]) return match[1].toLowerCase();
  }

  return fallback;
}

// ------------------------ Blob / DataURL helpers ------------------------
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
function dataURLToBlob(dataurl) {
  const parts = dataurl.split(',');
  const meta = parts[0].match(/:(.*?);/);
  const mime = meta ? meta[1] : 'application/octet-stream';
  const binary = atob(parts[1] || '');
  const len = binary.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

// ------------------------ Storage helpers ------------------------
function dedupeImages(images) {
  if (!Array.isArray(images)) return [];
  const seenDataUrls = new Set();
  const seenBlobKeys = new Set();
  const out = [];
  for (const im of images) {
    if (!im) continue;
    const dataurl = im.dataurl || null;
    const blob = im.blob || null;
    if (dataurl) {
      if (seenDataUrls.has(dataurl)) continue;
      seenDataUrls.add(dataurl);
      out.push(im);
      continue;
    }
    if (blob) {
      const key = `${blob.size}|${blob.type}`;
      if (seenBlobKeys.has(key)) continue;
      seenBlobKeys.add(key);
      out.push(im);
      continue;
    }
    if (im.name) {
      if (out.some(x => x.name === im.name)) continue;
      out.push(im);
    } else {
      out.push(im);
    }
  }
  return out;
}

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

function storeImagesForExport(categoria, id, images) {
  if (!categoria || !id || !images || !images.length) return;

  const key = `${categoria}|${id}`;
  window._imagesForExport = window._imagesForExport || {};
  window._imagesForExport[key] = window._imagesForExport[key] || [];

  const incoming = dedupeImages(images);
  const existing = window._imagesForExport[key];

  const existingDataUrls = new Set(existing.map(i => i.dataurl).filter(Boolean));
  const existingBlobKeys = new Set(existing.map(i => i.blob ? `${i.blob.size}|${i.blob.type}` : null).filter(Boolean));
  const existingNames = new Set(existing.map(i => i.name));

  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp']);

  for (const im of incoming) {
    if (!im) continue;

    // Convert dataURL to blob if needed
    if (!im.blob && im.dataurl) {
      try { im.blob = dataURLToBlob(im.dataurl); } catch (e) { im.blob = null; }
    }

    const blob = im.blob;
    if (!blob || !allowedTypes.has(blob.type)) continue;

    // Deduplication
    if (im.dataurl && existingDataUrls.has(im.dataurl)) continue;

    const kb = `${blob.size}|${blob.type}`;
    if (existingBlobKeys.has(kb)) {
      const isFinalName = !(im.name && /^pasted[-_\s]?image/i.test(im.name));
      if (!isFinalName) continue;
    }

    // Normalize name
    const ext = blob.type.split('/').pop().toLowerCase();
    const baseName = sanitizeFilename(im.name || `img-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`);
    const finalName = existingNames.has(baseName)
      ? `${Date.now()}_${Math.floor(Math.random() * 10000)}_${baseName}`
      : baseName;

    const normalized = {
      name: finalName,
      blob,
      dataurl: im.dataurl || null,
      originalSrc: im.originalSrc || null
    };

    existing.push(normalized);

    // Update sets
    existingDataUrls.add(normalized.dataurl);
    existingBlobKeys.add(kb);
    existingNames.add(finalName);
  }
}

function getImagesForExport(categoria, id) {
  if (!categoria || !id) {
    console.warn('⚠️ getImagesForExport chamado com categoria ou id inválido:', categoria, id);
    return [];
  }
  window._imagesForExport = window._imagesForExport || {};
  const key = `${categoria}|${id}`;
  const imgs = window._imagesForExport[key] || [];
  console.log(`📦 getImagesForExport → ${key} → ${imgs.length} imagens`);
  return imgs;
}


// ------------------------ Paste handler ------------------------
function registerPasteToDataUrlHandler() {
  if (window.__pasteHandlerRegistered) return;
  window.__pasteHandlerRegistered = true;

  document.addEventListener('paste', (ev) => {
    try {
      const items = ev.clipboardData?.items || [];
      const blobs = [];
      for (const it of items) {
        if (it.type?.startsWith('image/')) {
          const blob = it.getAsFile ? it.getAsFile() : it;
          if (blob) blobs.push(blob);
        }
      }
      if (blobs.length) {
        window.__lastPastedImages = window.__lastPastedImages || [];
        window.__lastPastedImages.push(...blobs);
      }
    } catch (e) {}

    // ✅ Aguarda o conteúdo ser colado no DOM
	const panel = document.getElementById('local-image-fix-panel');
	if (panel) panel.innerHTML = '';
    setTimeout(() => {
      const html = document.getElementById('content-body')?.innerHTML || '';
      const categoria = normalizeStr(document.getElementById('new-category')?.value || '') ||
                        normalizeStr(document.getElementById('category-select')?.value || '') ||
                        (isEditingMode ? editingCategoria : '');
      const id = isEditingMode ? editingId : `titulo${(Object.keys(contentData[categoria] || {}).length + 1)}`;
    }, 100); // pequeno delay para garantir que o conteúdo foi colado
  }, false);
}
registerPasteToDataUrlHandler();

// ------------------------ Local src detection / prompt upload ------------------------
function findLocalImageSrcs(html) {
  if (!html) return [];
  const srcs = new Set();
  Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)).forEach(m=>{
    const s = m[1] || '';
    if (/^(file:|msohtmlclip|[A-Za-z]:\\|cid:|AppData|ms-word:|v:)/i.test(s)) srcs.add(s);
  });
  Array.from(html.matchAll(/<v:imagedata[^>]*src=["']([^"']+)["'][^>]*>/gi)).forEach(m=>{
    const s = m[1] || '';
    if (s) srcs.add(s);
  });
  return Array.from(srcs);
}

async function replaceLocalImageSrcsWithClipboardBlobs(html, categoria, id) {
  const pastedBlobs = window.__lastPastedImages || [];
  if (!pastedBlobs.length) return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgEls = Array.from(doc.querySelectorAll('img'));
  const updatedImages = [];

  for (let i = 0; i < imgEls.length; i++) {
    const el = imgEls[i];
    const src = el.getAttribute('src') || '';
    if (!src.startsWith('file://')) continue;

    const blob = pastedBlobs[i];
    if (!blob) continue;

    const dataurl = await blobToDataURL(blob);
    const ext = extFromBlobOrDataUrl(blob, dataurl, null);
    const name = sanitizeFilename(`${categoria}_${id}_img_${Date.now()}_${i}.${ext}`);
	const storageKey = `${categoria}_${id}`; // usado para nome


    el.setAttribute('src', dataurl);
    updatedImages.push({ name, blob, dataurl, originalSrc: src });
  }

  if (updatedImages.length) {
    storeImagesForExport(categoria, id, updatedImages);
    console.log('📦 Imagens substituídas automaticamente:', updatedImages.map(im => im.name));
  }

  return doc.body.innerHTML;
}


// Paste handler imediato para #content-body — aplica regras e mostra toast
function installContentBodyPasteHandler() {
  if (window.__contentBodyPasteHandlerInstalled) return;
  window.__contentBodyPasteHandlerInstalled = true;

  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp']);
  const contentBody = document.getElementById('content-body');
  if (!contentBody) return;

  contentBody.addEventListener('paste', async function (ev) {
  try {
    ev.preventDefault();

    const clipboard = ev.clipboardData || window.clipboardData;
    let html = clipboard?.getData?.('text/html') || '';
    const text = clipboard?.getData?.('text/plain') || '';

    if (!html && text) html = text;
    if (html) {
	  cleanWordHtmlAndInsert(html);
	}


    const items = clipboard?.items ? Array.from(clipboard.items) : [];
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp']);
    const blobs = [];

    for (const item of items) {
      if (item.type?.startsWith('image/')) {
        const blob = item.getAsFile?.();
        if (blob && allowedTypes.has(blob.type)) blobs.push(blob);
      }
    }

    // ✅ Se houver blobs, salva para processamento posterior
    if (blobs.length) {
      window.__lastPastedImages = blobs.slice();
      console.log('📦 Blobs capturados do clipboard:', blobs);
    } else {
      window.__lastPastedImages = [];
      console.log('⚠️ Nenhum blob de imagem detectado no clipboard.');
    }

  } catch (err) {
    console.warn('Erro ao colar conteúdo:', err);
  }
}, false);

}
installContentBodyPasteHandler();

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


// ------------------------ Process content for images ------------------------
async function processContentForImages(html) {
  if (!html) return { html: '', images: [] };

  const localImgSrcs = findLocalImageSrcs(html);
  const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp']);
  let clipboardBlobs = [];

  try {
    if (navigator.clipboard && navigator.clipboard.read) {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const t of item.types || []) {
          if (t.startsWith('image/') && allowedTypes.has(t)) {
            try {
              const b = await item.getType(t);
              clipboardBlobs.push(b);
            } catch (e) {}
          }
        }
      }
    }
  } catch (e) {}

  if ((!clipboardBlobs.length) && Array.isArray(window.__lastPastedImages) && window.__lastPastedImages.length) {
    clipboardBlobs = Array.from(window.__lastPastedImages);
  }

  const images = [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgEls = Array.from(doc.querySelectorAll('img'));

  if (localImgSrcs.length > 0) {
    for (let i = 0; i < localImgSrcs.length; i++) {
      const src = localImgSrcs[i];
      const el = imgEls.find(img => img.getAttribute('src') === src);
      const blob = clipboardBlobs[i] || null;

      if (blob && allowedTypes.has(blob.type)) {
        const dataurl = await blobToDataURL(blob);
        const ext = blob.type.split('/').pop().toLowerCase();
        const name = `pasted-image-${Date.now()}-${i}.${ext}`;
        images.push({ name, blob, dataurl, originalSrc: src });
        if (el) el.setAttribute('src', dataurl);
      } else {
        const placeholder = 'data:image/svg+xml;base64,' + btoa(
          '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><rect fill="#f3f3f3" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#777" font-size="14">Imagem ausente (faça upload)</text></svg>'
        );
        if (el) el.setAttribute('src', placeholder);
      }
    }
    return { html: doc.body.innerHTML, images };
  }

  if (clipboardBlobs.length > 0) {
    for (let i = 0; i < clipboardBlobs.length; i++) {
      const blob = clipboardBlobs[i];
      if (!allowedTypes.has(blob.type)) continue;

      const dataurl = await blobToDataURL(blob);
      const ext = blob.type.split('/').pop().toLowerCase();
      const name = `pasted-image-${Date.now()}-${i}.${ext}`;
      images.push({ name, blob, dataurl, originalSrc: null });
    }

    const hasAnyImg = imgEls.length > 0;
    if (!hasAnyImg) {
      const imgsHtml = images.map(im => `<img src="${im.dataurl}" alt="" />`).join('');
      html += imgsHtml;
    }

    return { html, images };
  }

  return { html, images: [] };
}

async function promptUploadForLocalImages(html, categoria, id) {
  const srcs = findLocalImageSrcs(html);
  if (!srcs.length) return html;

  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.style = 'position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:999999';

    const box = document.createElement('div');
    box.style = 'background:white;padding:16px;border-radius:6px;max-width:860px;width:92%;max-height:80%;overflow:auto;font-family:Arial,Helvetica,sans-serif';
    box.innerHTML = `<h3 style="margin:0 0 8px 0">Imagens locais detectadas</h3>
      <p style="margin:0 0 12px 0">Substitua cada caminho local arrastando ou escolhendo a imagem correspondente.</p>
      <div id="local-img-list"></div>
      <div style="margin-top:12px;text-align:right">
        <button id="local-img-skip" style="margin-right:8px">Pular</button>
        <button id="local-img-done">Concluir</button>
      </div>`;
    modal.appendChild(box);
    document.body.appendChild(modal);

    const list = box.querySelector('#local-img-list');
    const updatedImages = [];

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const imgEls = Array.from(doc.querySelectorAll('img'));
	const blobMap = new Map(); // chave: src original, valor: { blob, dataurl, ext, name }

    srcs.forEach((src, idx) => {
      const row = document.createElement('div');
      row.style = 'border:1px solid #eee;padding:8px;margin:8px 0;display:flex;gap:12px;align-items:center';
      row.dataset.src = src;

      const fullPath = src.startsWith('file:///') ? src.slice(8) : src;
      const info = document.createElement('div');
      info.style = 'flex:1';
      info.innerHTML = `
        <div style="font-size:12px;color:#333;word-break:break-all">
          <strong>${extractFilenameFromPath(src)}</strong>
        </div>
        <div style="font-size:12px;color:#666">Caminho completo:</div>
        <div style="font-size:12px;color:#444;margin-bottom:4px">
          <code>${fullPath}</code>
          <button class="copy-path-btn" style="margin-left:8px;font-size:11px" data-path="${fullPath}">Copiar caminho</button>
        </div>
        <div style="font-size:12px;color:#666">Arraste ou clique para escolher imagem</div>
        <div style="margin-top:6px">
          <img src="${src}" style="max-width:120px;max-height:80px;border:1px solid #ccc;background:#f9f9f9" onerror="this.style.opacity=0.3">
        </div>
      `;

      const drop = document.createElement('div');
      drop.style = 'width:160px;height:90px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;background:#fafafa;cursor:pointer';
      drop.textContent = 'Arraste ou escolha';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style = 'display:none';

      drop.addEventListener('click', () => fileInput.click());
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.borderColor = '#888'; });
      drop.addEventListener('dragleave', () => { drop.style.borderColor = '#ccc'; });
      drop.addEventListener('drop', (e) => {
        e.preventDefault();
        drop.style.borderColor = '#ccc';
        handleFiles(e.dataTransfer.files);
      });
      fileInput.addEventListener('change', () => handleFiles(fileInput.files));

      function handleFiles(files) {
        if (!files || !files.length) return;
        const f = files[0];
        const allowedExtensions = /\.(jpe?g|png|gif|bmp)$/i;
        if (!allowedExtensions.test(f.name)) {
          alert('Formato de imagem não suportado. Use JPG, JPEG, PNG, GIF ou BMP.');
          return;
        }

        const fr = new FileReader();
        fr.onload = () => {
		  drop.innerHTML = `<img src="${fr.result}" style="max-width:100%;max-height:100%"/>`;
		  blobMap.set(src, {
			blob: f,
			dataurl: fr.result,
			ext: f.name.split('.').pop().toLowerCase(),
			name: f.name
		  });
		};
	
        fr.readAsDataURL(f);
      }

      row.appendChild(info);
      row.appendChild(drop);
      row.appendChild(fileInput);
      list.appendChild(row);
    });

    function applySubstitutions() {
	  list.querySelectorAll('div[data-src]').forEach((r, i) => {
		const s = r.dataset.src;
		const blobInfo = blobMap.get(s);
		if (!blobInfo) return;

		const { blob, dataurl, ext } = blobInfo;
		const el = imgEls.find(img => img.getAttribute('src') === s);
		const name = sanitizeFilename(`${categoria}_${id}_img_${Date.now()}_${i}.${ext}`);
		if (el) el.setAttribute('src', `images/${name}`);
		updatedImages.push({ name, blob, dataurl, originalSrc: s });
	  });

	  const finalHtml = doc.body.innerHTML;
	  storeImagesForExport(categoria, id, updatedImages);
	  downloadAllImagesForArticle(categoria, id);
	  document.body.removeChild(modal);
	  resolve(finalHtml);
	}


    box.querySelector('#local-img-skip').addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(html);
    });

    box.querySelector('#local-img-done').addEventListener('click', applySubstitutions);
  });
}

function renderLocalImageFixPanel(html, categoria, id) {
  const container = document.getElementById('local-image-fix-panel');
  if (!container) return;

  container.innerHTML = ''; // limpa painel

  const srcs = findLocalImageSrcs(html);
  if (!srcs.length) {
    container.innerHTML = '<p style="color:green;">✅ Nenhuma imagem local detectada.</p>';
    return;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const imgEls = Array.from(doc.querySelectorAll('img'));
  const matches = imgEls
    .map((el, i) => {
      const src = el.getAttribute('src') || '';
      if (!srcs.includes(src)) return null;
      return {
        el,
        index: i,
        originalSrc: src,
        filename: extractFilenameFromPath(src),
      };
    })
    .filter(Boolean);

  const tempImages = [];

  matches.forEach((match, idx) => {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '12px';

    const label = document.createElement('label');
    label.textContent = `Imagem local detectada: ${match.filename}`;
    label.style.display = 'block';
    label.style.marginBottom = '4px';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;

      const dataurl = await blobToDataURL(file);
      match.el.setAttribute('src', dataurl);

      const ext = extFromBlobOrDataUrl(file, dataurl, 'png');
      const name = sanitizeFilename(`${categoria}_${id}_img_${Date.now()}_${idx}.${ext}`);

      tempImages.push({ name, blob: file, dataurl, originalSrc: match.originalSrc });

      // Atualiza visual
      label.textContent = `✅ Substituída: ${match.filename} → ${name}`;
      label.style.color = 'green';
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
  });

  // Botão para aplicar alterações
  const applyBtn = document.createElement('button');
  applyBtn.textContent = 'Aplicar substituições';
  applyBtn.style.marginTop = '16px';
  applyBtn.onclick = () => {
    const updatedHtml = doc.body.innerHTML;
    storeImagesForExport(categoria, id, tempImages);
    document.getElementById('content-body').innerHTML = updatedHtml;
    container.innerHTML = '<p style="color:green;">✅ Substituições aplicadas com sucesso.</p>';
  };

  container.appendChild(applyBtn);
}

function extractFilenameFromPath(path) {
  try {
    return decodeURIComponent(path.split(/[\\/]/).pop().split('?')[0]);
  } catch {
    return null;
  }
}


// ------------------------ Extract / Detach data URLs ------------------------
function extractDataUrlsFromHtml(html) {
  if (!html) return [];
  const re = /src=["'](data:image\/[^"']+)["']/gi;
  const out = [];
  let m, i = 0;
  while ((m = re.exec(html)) !== null) {
    out.push({ dataurl: m[1], index: i++ });
  }
  console.log(`🧪 extractDataUrlsFromHtml → ${out.length} dataURLs encontrados`);
  return out;
}

function detachDataUrlsFromHtml(html, categoria, id) {
  if (!html) return { html, images: [], mapping: {} };

  const re = /src=["'](data:image\/[^"']+)["']/gi;
  const maps = [];
  let m, idx = 0;

  while ((m = re.exec(html)) !== null) {
    maps.push({ dataurl: m[1], index: idx++ });
  }

  const images = [];
  const mapping = {};
  const usedNames = new Set();
  const baseTs = Date.now();

  if (!maps.length) return { html, images, mapping };

  for (let i = 0; i < maps.length; i++) {
    const d = maps[i];
    const dataurl = d.dataurl;
    const ext = extFromBlobOrDataUrl(null, dataurl, 'png');
    let rawName = `${categoria}_${id}_img_${baseTs}_${i}.${ext}`;
    let name = sanitizeFilename(rawName);

    while (usedNames.has(name)) {
      rawName = `${categoria}_${id}_img_${baseTs}_${i}_${Math.floor(Math.random() * 10000)}.${ext}`;
      name = sanitizeFilename(rawName);
    }

    usedNames.add(name);
    mapping[dataurl] = name;
    const blob = dataURLToBlob(dataurl);
    images.push({ name, blob, dataurl, originalSrc: null });
  }

  for (const durl in mapping) {
    const ref = `images/${mapping[durl]}`;
    html = html.split(durl).join(ref);
  }

  storeImagesForExport(categoria, id, images);

  return { html, images, mapping };
}

// ------------------------ Object URL linking ------------------------
function getImageBlobForPath(path) {
  if (!path) return null;
  const filename = path.split('/').pop();
  for (const key in window._imagesForExport) {
    const arr = window._imagesForExport[key] || [];
    for (const im of arr) {
      if (!im.name) continue;
      if (im.name === filename) return im.blob || (im.dataurl ? dataURLToBlob(im.dataurl) : null);
      if (('images/' + im.name) === path) return im.blob || (im.dataurl ? dataURLToBlob(im.dataurl) : null);
      if (sanitizeFilename(im.name) === sanitizeFilename(filename)) return im.blob || (im.dataurl ? dataURLToBlob(im.dataurl) : null);
      if (im.name.includes(filename) || filename.includes(im.name)) return im.blob || (im.dataurl ? dataURLToBlob(im.dataurl) : null);
    }
  }
  return null;
}

function linkArticleImagesToObjectUrls(containerEl) {
  if (!containerEl) containerEl = document.getElementById('article-content');
  if (!containerEl) {
    console.warn('⚠️ Nenhum container encontrado para vincular imagens.');
    return { linked: 0, missing: [] };
  }

  const imgs = containerEl.querySelectorAll('img');
  let linked = 0;
  const missing = [];

  window.__objectUrlMap = window.__objectUrlMap || {};

  console.log(`🔗 Iniciando vinculação de ${imgs.length} imagens...`);

  imgs.forEach(img => {
    try {
      const src = img.getAttribute('src') || '';
      if (!src) return;

      if (src.startsWith('data:') || src.startsWith('http:') || src.startsWith('https:') || src.startsWith('blob:')) {
        console.log(`⏩ Ignorando imagem externa: ${src}`);
        return;
      }

      const objKey = src;

      if (window.__objectUrlMap[objKey]) {
        img.src = window.__objectUrlMap[objKey];
        console.log(`🔁 Reutilizando URL para ${objKey}`);
        linked++;
        return;
      }

      const blob = getImageBlobForPath(src);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.__objectUrlMap[objKey] = url;
        img.src = url;
        console.log(`✅ Vinculado: ${objKey}`);
        linked++;
      } else {
        console.warn(`❌ Blob não encontrado para ${objKey}`);
        missing.push(src);
      }
    } catch (e) {
      console.error(`💥 Erro ao vincular imagem ${src}:`, e);
    }
  });

  console.log(`🔍 Vinculação concluída: ${linked} vinculadas, ${missing.length} ausentes`);
  return { linked, missing };
}


function revokeArticleObjectUrls() {
  if (!window.__objectUrlMap) return;
  for (const k in window.__objectUrlMap) {
    try { URL.revokeObjectURL(window.__objectUrlMap[k]); } catch(e){}
  }
  window.__objectUrlMap = {};
}

// ------------------------ Fix missing refs (heuristic clone) ------------------------
function fixMissingImageRefs(categoria, id) {
  try {
    const key = `${categoria}|${id}`;
    const html = (contentData[categoria] && contentData[categoria][id] && contentData[categoria][id].conteudo) || '';
    if (!html) return [];
    const refs = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)).map(m => m[1]).filter(Boolean);
    const imageRefs = refs.filter(r => r.startsWith('images/')).map(r => r.split('/').pop());
    if (!imageRefs.length) return [];
    window._imagesForExport[key] = window._imagesForExport[key] || [];
    const stored = window._imagesForExport[key];
    const storedNames = new Set(stored.map(s => s.name));
    const repairs = [];

    function findBestCandidateFor(targetName) {
      const exact = stored.find(s => s.name === targetName);
      if (exact) return exact.blob || (exact.dataurl ? dataURLToBlob(exact.dataurl) : null);
      const m = targetName.match(/^(.+?)_(\d+)(\.[^.]*)?$/);
      if (m) {
        const base = m[1];
        let list = stored.filter(s => s.name && s.name.indexOf(base) === 0);
        if (list.length) {
          const prefer0 = list.find(s => {
            const mm = s.name.match(/^(.+?)_(\d+)(\.[^.]*)?$/);
            return mm && parseInt(mm[2], 10) === 0;
          });
          if (prefer0) return prefer0.blob || (prefer0.dataurl ? dataURLToBlob(prefer0.dataurl) : null);
          list.sort((a,b) => (b.blob?.size || 0) - (a.blob?.size || 0));
          const cand = list[0];
          return cand.blob || (cand.dataurl ? dataURLToBlob(cand.dataurl) : null);
        }
      }
      const ext = (targetName.match(/\.[^.]+$/) || [])[0] || '';
      const sameExt = stored.find(s => s.blob && s.name && s.name.endsWith(ext));
      if (sameExt) return sameExt.blob || (sameExt.dataurl ? dataURLToBlob(sameExt.dataurl) : null);
      const blobs = stored.filter(s => s.blob).map(s => s.blob);
      if (blobs.length) {
        blobs.sort((a,b) => b.size - a.size);
        return blobs[0];
      }
      return null;
    }

    for (const refName of imageRefs) {
      if (storedNames.has(refName)) continue;
      const candidateBlob = findBestCandidateFor(refName);
      if (candidateBlob) {
        const newBlob = candidateBlob.slice(0, candidateBlob.size, candidateBlob.type);
        const newEntry = { name: refName, blob: newBlob, dataurl: null, originalSrc: null };
        window._imagesForExport[key].push(newEntry);
        storedNames.add(refName);
        repairs.push(refName);
      }
    }

    if (repairs.length) {
      const container = document.getElementById('article-content');
      if (container) linkArticleImagesToObjectUrls(container);
    }

    return repairs;
  } catch (e) { return []; }
}

// ------------------------ Fallback (DOM-based) local-src -> dataURL ------------------------
window.replaceLocalFileSrcsWithDataUrls = async function(processedHtml, categoria, id, tempImages = []) {
  try {
    if (!processedHtml) return processedHtml;
    const doc = new DOMParser().parseFromString(processedHtml, 'text/html');
    const imgEls = Array.from(doc.querySelectorAll('img'));
    const imgSrcs = imgEls.map(el => ({ el, src: el.getAttribute('src') || '' }))
      .filter(o => !!o.src && /^(file:|msohtmlclip|cid:|[A-Za-z]:\\|AppData|ms-word:|v:)/i.test(o.src));
    const vmlMatches = [];
    Array.from(doc.querySelectorAll('*')).forEach(node => {
      try {
        if (node.outerHTML && node.outerHTML.toLowerCase().includes('v:imagedata')) {
          const m = node.outerHTML.match(/src=["']([^"']+)["']/i);
          if (m && m[1]) vmlMatches.push({ node, src: m[1] });
        }
      } catch(e){}
    });
    const allMatches = imgSrcs.map(o => ({ type: 'img', src: o.src, node: o.el })).concat(
      vmlMatches.map(o => ({ type: 'vml', src: o.src, node: o.node }))
    );
    if (!allMatches.length) return processedHtml;

    function findBlobInStoreByOriginalSrc(src) {
      for (const key in window._imagesForExport) {
        const arr = window._imagesForExport[key] || [];
        for (const it of arr) {
          if (!it) continue;
          if (it.originalSrc && it.originalSrc === src) return it.blob || (it.dataurl ? dataURLToBlob(it.dataurl) : null);
          const base = src.split('/').pop();
          if (it.name && it.name.indexOf(base) !== -1) return it.blob || (it.dataurl ? dataURLToBlob(it.dataurl) : null);
        }
      }
      return null;
    }
    function tryLastPastedAsBlob(idx) {
      try { return (Array.isArray(window.__lastPastedImages) && window.__lastPastedImages.length > idx) ? window.__lastPastedImages[idx] : null; } catch(e){ return null; }
    }

    for (let i = 0; i < allMatches.length; i++) {
      const item = allMatches[i];
      const src = item.src;
      let replacement = null;
      const storeBlob = findBlobInStoreByOriginalSrc(src);
      if (storeBlob) {
        try { replacement = await blobToDataURL(storeBlob); } catch(e){ replacement = null; }
      }
      if (!replacement && Array.isArray(tempImages) && tempImages[i]) {
        try {
          const im = tempImages[i];
          const blob = im.blob || (im.dataurl ? dataURLToBlob(im.dataurl) : null);
          if (blob) replacement = await blobToDataURL(blob);
        } catch(e){}
      }
      if (!replacement) {
        const lastBlob = tryLastPastedAsBlob(i);
        if (lastBlob) {
          try { replacement = await blobToDataURL(lastBlob); } catch(e){ replacement = null; }
        }
      }
      if (!replacement) {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><rect width="100%" height="100%" fill="#f7f7f7"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#777" font-size="13">Imagem local não disponível (substitua)</text></svg>';
        replacement = 'data:image/svg+xml;base64,' + btoa(svg);
      }
      try {
        if (item.type === 'img' && item.node) {
          item.node.setAttribute('src', replacement);
        } else if (item.type === 'vml' && item.node) {
          const newOuter = item.node.outerHTML.replace(src, replacement);
          const wrapper = document.createElement('div');
          wrapper.innerHTML = newOuter;
          item.node.parentNode && item.node.parentNode.replaceChild(wrapper.firstChild, item.node);
        }
      } catch(e) {
        processedHtml = processedHtml.split(src).join(replacement);
      }
    }

    let outHtml;
    try {
      outHtml = (doc.body && doc.body.innerHTML) ? doc.body.innerHTML : processedHtml;
    } catch(e){ outHtml = processedHtml; }
    return outHtml;
  } catch (err) { return processedHtml; }
};

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

  // Se o select estiver no primeiro item (valor vazio) usa o campo de nova categoria
  const selectedValue = (selectEl.value || '').trim()
  const newCategoryValue = (newCatEl.value || '').trim()
  const isNewCategory = selectedValue === '' // seu primeiro option tem value=""

  const categoriaFinal = isNewCategory
    ? (newCategoryValue || 'geral')
    : selectedValue

  if (!title || !content) {
    alert('Título e conteúdo são obrigatórios!')
    return
  }
  if (isNewCategory && !newCategoryValue) {
    alert('Informe o nome da nova categoria ou escolha uma existente.')
    return
  }

  // HTML processado (se precisar transformar algo, faça aqui)
  const processedHtml = content

  // Upload de imagens coladas (se houver)
  let imageUrl = null
  if (typeof tempImages !== 'undefined' && Array.isArray(tempImages) && tempImages.length > 0) {
    const img = tempImages[0] // primeira imagem como principal
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

  // Insere no banco
  const { error } = await window.supabase
    .from('posts')
    .insert({
      title,
      content: processedHtml,
      categoria: categoriaFinal,
      image_url: imageUrl
    })

  if (error) {
    console.error('Erro ao salvar no Supabase:', error)
    alert('Erro ao salvar conteúdo.')
    return
  }

  // Atualiza lista
  await carregarPostsDoBanco()

  // Limpa formulário
  titleEl.value = ''
  contentEl.innerHTML = ''
  selectEl.value = ''          // volta para "-- Nova Categoria --"
  newCatEl.value = ''
  if (typeof tempImages !== 'undefined') tempImages = []

  alert('Conteúdo salvo com sucesso!')
}

//onclick do HTML
document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.querySelector('#new-content-panel .save-button')
  if (saveBtn) {
    saveBtn.addEventListener('click', addNewContent)
  }
})

document.addEventListener('DOMContentLoaded', () => {
  const editLink = document.getElementById('edit-article-link')
  if (editLink) {
    editLink.addEventListener('click', e => {
      e.preventDefault() // evita navegação
      const categoria = editLink.dataset.categoria
      const id = editLink.dataset.id
      if (categoria && id) {
        startEditing(categoria, id)
      } else {
        console.error('Categoria ou ID não definidos no link de edição')
      }
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

  const exportBtn = document.getElementById('export-json-btn')
  if (exportBtn) exportBtn.addEventListener('click', exportContentDataSimple)

  // Splash de imagem
  const splash = document.getElementById('image-splash')
  if (splash) splash.addEventListener('click', closeSplash)

  // Debug popup
  const closeDebugBtn = document.querySelector('.close-debug-btn')
  if (closeDebugBtn) closeDebugBtn.addEventListener('click', closeDebugPopup)

  const applyDebugBtn = document.getElementById('apply-debug-btn')
  if (applyDebugBtn) applyDebugBtn.addEventListener('click', applyDebugChanges)

  // Select de categoria
  const categorySelect = document.getElementById('category-select')
  if (categorySelect) categorySelect.addEventListener('change', handleCategoryChange)
})

// ------------------------ cleanup ------------------------
function cleanupPastedImageDuplicates() {
  for (const key in window._imagesForExport) {
    const arr = window._imagesForExport[key];
    if (!Array.isArray(arr) || arr.length <= 1) continue;
    const keep = [];
    for (let i = 0; i < arr.length; i++) {
      const im = arr[i];
      if (!im || !im.name) continue;
      if (!/^pasted[-_\s]?image/i.test(im.name)) {
        keep.push(im);
        continue;
      }
      const hasMatch = arr.some(other => {
        if (other === im) return false;
        if (other.dataurl && im.dataurl && other.dataurl === im.dataurl) return true;
        if (other.blob && im.blob && other.blob.size === im.blob.size && other.blob.type === im.blob.type) return true;
        return false;
      });
      if (!hasMatch) keep.push(im);
    }
    window._imagesForExport[key] = keep;
  }
}

// ------------------------ UI / Render ------------------------
function renderWelcome() {
  const article = document.getElementById('article-content');
  if (!article) return;
  article.innerHTML = `
    <h1>Bem-vindo</h1>
    <p>Selecione um item no menu para ver o conteúdo.</p>
  `;
}

function getImageCountForArticle(categoria, id) {
  const imgs = (window._imagesForExport && window._imagesForExport[`${categoria}|${id}`]) || [];
  return imgs.filter(i => i && i.name && !/^pasted[-_\s]?image/i.test(i.name)).length;
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
      titulo: post.title,
      conteudo: post.content,
      imagem: post.image_url || null
    }
  })

  renderMenu()
  renderWelcome()
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
  revokeArticleObjectUrls();

  const artigo = contentData[categoria][id];
  const container = document.getElementById('article-content');
  if (!container) return;

  const wasEditing = editingCategoria !== null && editingId !== null;
  if (wasEditing) closeNewContentPanel();

  container.style.animation = 'slideOutToLeft 0.4s ease forwards';

  setTimeout(() => {
    console.log(`🧾 Renderizando artigo ${categoria}|${id}`);

    const imgCount = getImageCountForArticle(categoria, id);
    const btnText = imgCount > 0 ? `Baixar imagens (${imgCount})` : 'Nenhuma imagem';
    const btnDisabledAttr = imgCount > 0 ? 'disabled' : 'disabled';

    container.innerHTML = `
		<div class="control-bar">
		  <a id="edit-article-link" href="#">Editar</a>
		  <button id="download-images-btn" ${btnDisabledAttr}>
			<span>${btnText}</span>
		  </button>
		</div>
		<h1>${artigo.titulo}</h1>
		<div class="article-body">${artigo.conteudo}</div>
    `;

    container.style.animation = 'slideInFromLeft 0.6s ease forwards';
    const links = container.querySelectorAll('a:not(#edit-article-link)');
    links.forEach(link => link.setAttribute('target', '_blank'));

    editingCategoria = categoria;
    editingId = id;

    linkArticleImagesToObjectUrls(container);

    const dlBtn = document.getElementById('download-images-btn');
    if (dlBtn) {
      dlBtn.replaceWith(dlBtn.cloneNode(true));
      const newBtn = document.getElementById('download-images-btn');
      if (imgCount > 0) {
        newBtn.addEventListener('click', () => {
          newBtn.disabled = true;
          newBtn.style.cursor = 'progress';
          downloadAllImagesForArticle(categoria, id).finally(() => {
            newBtn.disabled = false;
            newBtn.style.cursor = 'pointer';
          });
        });
      }
    }

    // ✅ Agora sim: ativar splash após renderização e vinculação
    console.log('🖼️ Ativando splash screen para imagens...');
    enableImageSplash(container);
	
	// 🔴 Destaca o link ativo no menu
	const menuLinks = document.querySelectorAll('#menu a');
	menuLinks.forEach(link => link.classList.remove('active'));

	const activeLink = document.querySelector(`#menu a[data-categoria="${categoria}"][data-id="${id}"]`);
	if (activeLink) {
	  activeLink.classList.add('active');
	}


  }, 400);
}

function startEditing(categoria, id) {
  if (!categoria || !id) return;
	  openNewContentPanel({ forEdit: true, categoria: categoria, id: id });
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

  setExportButtonVisible(sessionHasSaved);
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
  handleCategoryChange();
}

// ------------------------ Download / Export helpers ------------------------
function downloadImageByName(categoria, id, filename) {
  const imgs = getImagesForExport(categoria, id) || [];
  const im = imgs.find(x => x.name === filename || ('images/' + x.name) === filename || sanitizeFilename(x.name) === sanitizeFilename(filename));
  if (!im) return;
  const blob = im.blob || (im.dataurl ? dataURLToBlob(im.dataurl) : null);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.split('/').pop();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

async function downloadAllImagesForArticle(categoria, id) {
  const imgs = getImagesForExport(categoria, id) || [];
  if (!imgs.length) {
    console.log(`📭 Nenhuma imagem para baixar em ${categoria}|${id}`);
    return;
  }

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
	const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp'];

	const toDownload = imgs.filter(im => {
	  if (!im || !im.name || !im.blob) return false;

	  const ext = im.name.split('.').pop().toLowerCase();
	  const mime = im.blob.type;

	  const isValidExt = allowedExtensions.includes(ext);
	  const isValidMime = allowedMimeTypes.includes(mime);

	  if (!isValidExt || !isValidMime) {
		console.warn(`🚫 Ignorando arquivo inválido: ${im.name} (${mime})`);
		return false;
	  }

	  return true;
	});


  if (!toDownload.length) {
    console.log(`📭 Nenhuma imagem válida para baixar em ${categoria}|${id}`);
    return;
  }

  for (const im of toDownload) {
    const blob = im.blob || (im.dataurl ? dataURLToBlob(im.dataurl) : null);
    if (!(blob instanceof Blob) || blob.size === 0) {
      console.warn(`⚠️ Blob inválido para ${im.name}`);
      continue;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = im.name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`✅ Todos os downloads concluídos para ${categoria}|${id}`);
}

function promptUserForImageFile(src) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}


async function exportAsZip(filename = 'conteudo_pt.zip') {
  if (typeof JSZip === 'undefined') {
    alert('JSZip não encontrado. Inclua a lib JSZip para gerar ZIP com imagens.');
    return;
  }
  const zip = new JSZip();
  zip.file('conteudo_pt.js', '// Dados em português\nwindow.dataPT = ' + JSON.stringify(contentData, null, 2) + ';');
  for (const key in window._imagesForExport) {
    const parts = key.split('|'); const categoria = parts[0] || 'cat'; const id = parts[1] || 'id';
    const imgs = getImagesForExport(categoria, id) || [];
    imgs.forEach(im => {
      if (!im || !im.name) return;
      if (/^pasted[-_\s]?image/i.test(im.name)) return;
      let fname = im.name || `${categoria}_${id}_${Date.now()}.png`;
      fname = sanitizeFilename(fname);
      const zipPath = `images/${fname}`;
      if (im.blob) zip.file(zipPath, im.blob);
      else if (im.dataurl) zip.file(zipPath, dataURLToBlob(im.dataurl));
    });
  }
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// simple JSON export (user requested earlier)
function exportContentDataSimple(filename = 'conteudo_export.json') {
  try {
    const payload = {
      generatedAt: new Date().toISOString(),
      content: contentData || {}
    };
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e) {
    console.warn('exportContentDataSimple erro', e);
  }
}

// ------------------------ Export UI helpers ------------------------
function setExportButtonVisible(visible) {
  const btn = document.getElementById('export-json-btn');
  if (!btn) return;
  if (visible) {
    btn.style.display = 'inline-block'; // ou 'block', dependendo do layout
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
    btn.style.display = 'none';
  }
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
  const body = document.getElementById('content-body');
  if (!body) return;

  // Garante que comandos atuem no editor
  body.focus();

  if (command === 'insertImage') {
    const url = prompt('URL da imagem:');
    if (url) document.execCommand(command, false, url);
    return;
  }
  if (command === 'createLink') {
    const url = prompt('URL do link:');
    if (url) document.execCommand(command, false, url);
    return;
  }

  // Alguns browsers exigem passarmos value quando formatBlock
  if (command === 'formatBlock' && value) {
    document.execCommand(command, false, value);
  } else {
    document.execCommand(command, false, value);
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
  setExportButtonVisible(false);
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

  // handler de colar imagens
  if (typeof registerPasteToDataUrlHandler === 'function') {
    try { registerPasteToDataUrlHandler(); } catch (e) {}
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
