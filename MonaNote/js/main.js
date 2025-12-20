/* =========================
   Supabase singleton + UI helpers (module)
   - setSupabaseConfig({ url, key, tableName, bucketName })
   - initializeSupabase(), getSupabase(), destroySupabase()
   ========================= */

let currentCategoria = null;
let currentId = null;
let currentPostId = null;
const TITLE_MAX = 160;        // ajuste conforme sua necessidade
const CATEGORY_MAX = 60;      // ajuste conforme sua necessidade

// ===== Título dinâmico aproveitando o breadcrumb já renderizado =====
const BASE_TITLE = 'Sistema Integrado de Manuais';

/** Lê o breadcrumb já existente no DOM e devolve uma string única */
function getBreadcrumbTextFromDOM() {
  const nav = document.querySelector('nav.breadcrumb');
  if (!nav) return '';

  // Pega todas as partes visíveis do breadcrumb, na ordem
  const parts = Array.from(nav.querySelectorAll('.crumb'))
    .map(el => (el.textContent || '').trim())
    .filter(Boolean);

  // Se você usa o separador "››" no DOM, aqui padronizamos para " › "
  return parts.join(' ›› ');
}

/** Atualiza o <title> usando o breadcrumb do DOM */
function setDocTitleFromBreadcrumbDOM() {
  const bc = getBreadcrumbTextFromDOM();
  // Troque "—" por "+" se preferir: `${BASE_TITLE} + ${bc}`
  document.title = bc ? `${BASE_TITLE} — ${bc}` : BASE_TITLE;
}

let _supabase = null;
let _initializing = null;
let _supabaseConfig = {
  url: null,
  key: null,
  tableName: 'monanote',
  bucketName: 'monanoteimages'
};

setSupabaseConfig({
  url: 'https://pwshckrmqaqymngbosgo.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c2hja3JtcWFxeW1uZ2Jvc2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjAwOTEsImV4cCI6MjA3OTkzNjA5MX0.f8iX0RoqrdxJmq-EgSyn_YWPgCHMoARQTT4ygtbcoLg',      // substitua pela anon key
  tableName: 'monanote',
  bucketName: 'monanoteimages'
});


/**
 * Atualiza configuração em runtime.
 * IMPORTANTE: use apenas anon key no frontend.
 */
export function setSupabaseConfig({ url, key, tableName, bucketName } = {}) {
  if (url) _supabaseConfig.url = url;
  if (key) _supabaseConfig.key = key;
  if (tableName) _supabaseConfig.tableName = tableName;
  if (bucketName) _supabaseConfig.bucketName = bucketName;
}

/** Retorna o cliente já inicializado (ou null) */
export function getSupabase() {
  return _supabase;
}

/** Limpa conexões/canais (útil em dev/HMR) */
export async function destroySupabase() {
  try {
    if (!_supabase) return;
    if (typeof _supabase.removeAllChannels === 'function') {
      _supabase.removeAllChannels();
    }
    // não chame signOut automaticamente aqui (pode afetar UX)
  } catch (e) {
    console.warn('Erro ao limpar Supabase:', e);
  } finally {
    _supabase = null;
  }
}

/**
 * Inicializa o cliente Supabase com import dinâmico, retry/backoff e proteção.
 * Retorna o cliente ou null em falha.
 */


export async function initializeSupabase({ retries = 2, retryDelay = 400, timeoutMs = 8000 } = {}) {
  if (_supabase) return _supabase;
  if (_initializing) return _initializing;

  // Loader de script UMD com cache por id
  const loadUmdOnce = (src, id = 'supabase-umd') =>
    new Promise((resolve, reject) => {
      if (document.getElementById(id)) return resolve();
      const s = document.createElement('script');
      s.id = id;
      s.src = src;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });

  _initializing = (async () => {
    const { url, key } = _supabaseConfig;
    if (!url || !key) {
      console.warn('Supabase não configurado (url/key ausentes).');
      _initializing = null;
      return null;
    }

    const UMD_CANDIDATES = [
      // Versões estáveis do bundle UMD
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.33.0/dist/umd/supabase.js',
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.35.0/dist/umd/supabase.js',
      'https://unpkg.com/@supabase/supabase-js@2.33.0/dist/umd/supabase.js',
    ];

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await destroySupabase();

        // Tenta carregar o UMD do Supabase
        let lastErr = null;
        for (const src of UMD_CANDIDATES) {
          try {
            await loadUmdOnce(src);
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        // Valida se o createClient está disponível em algum namespace
        const createClient =
          window?.Supabase?.createClient ??
          window?.supabase?.createClient ??
          null;

        if (!createClient) {
          throw new Error('createClient não encontrado após carregar UMD. Último erro: ' + (lastErr && (lastErr.message || lastErr.type)));
        }

        const supabase = createClient(_supabaseConfig.url, _supabaseConfig.key, {
          auth: { persistSession: true, autoRefreshToken: true }
        });

        // Checagem leve de sessão com timeout (não fatal)
        const sessionCheck = (async () => {
          try {
            const p = supabase.auth.getSession();
            if (timeoutMs > 0) {
              const res = await Promise.race([
                p,
                new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
              ]);
              return res;
            } else {
              return await p;
            }
          } catch (e) {
            console.debug('Supabase getSession (não fatal):', e);
            return null;
          }
        })();
        await sessionCheck;

        _supabase = supabase;
        // 🔧 expõe global para seus helpers
        window.supabase = _supabase;
        window._supabase = _supabase;

        _initializing = null;
        console.info('Supabase inicializado com sucesso (UMD).');
        return _supabase;
      } catch (err) {
        console.error(`Falha ao inicializar Supabase (tentativa ${attempt + 1}):`, err);
        if (attempt < retries) {
          const delay = retryDelay * (attempt + 1);
          await new Promise(r => setTimeout(r, delay));
          continue;
        } else {
          _initializing = null;
          return null;
        }
      }
    }

    _initializing = null;
    return null;
  })();

  return _initializing;
}

/* =========================
   Sidebar / Theme helpers (exportados)
   (mantive suas implementações com pequenas melhorias)
   ========================= */

let _sidebarAutoCloseInitialized = false;

export function toggleSidebar(open) {
  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.getElementById('hamburger-btn') || document.querySelector('.hamburger');
  if (!sidebar) return;
  if (open) {
    sidebar.classList.add('open');
    document.body.classList.add('sidebar-open');
    if (hamburger) hamburger.classList.add('open');
  } else {
    sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
    if (hamburger) hamburger.classList.remove('open');
  }
}

export function setupSidebarAutoClose() {
  if (_sidebarAutoCloseInitialized) return;
  _sidebarAutoCloseInitialized = true;

  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.getElementById('hamburger-btn') || document.querySelector('.hamburger');
  if (!sidebar || !hamburger) return;

  sidebar.addEventListener('click', (e) => e.stopPropagation());

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSidebar(!sidebar.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (hamburger && (hamburger === e.target || hamburger.contains(e.target))) return;
    if (sidebar.contains(e.target)) return;
    if (sidebar.classList.contains('open')) toggleSidebar(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && sidebar.classList.contains('open')) toggleSidebar(false);
  });

  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
  document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    if (touchStartX - touchEndX > 60) toggleSidebar(false);
    if (touchEndX - touchStartX > 60) toggleSidebar(true);
  });
}



export function setupThemeToggle() {
  // Localiza o input
  let input = document.getElementById('themeToggle');
  if (!input) return;

  // Evita múltipla inicialização
  if (input.dataset.init === '1') return;

  // Garante estrutura de switch conforme o CSS (label.theme-switch + span.slider)
  // Se o input não estiver dentro de um label.theme-switch com um span.slider, criamos.
  const parentLabel = input.closest('label.theme-switch');
  if (!parentLabel) {
    const label = document.createElement('label');
    label.className = 'theme-switch';

    // Move o input para dentro do label
    input.parentNode.insertBefore(label, input);
    label.appendChild(input);

    // Cria o trilho/knob do switch
    const slider = document.createElement('span');
    slider.className = 'slider';
    label.appendChild(slider);
  } else {
    // Se já existe label, assegura que há um span.slider
    if (!parentLabel.querySelector('.slider')) {
      const slider = document.createElement('span');
      slider.className = 'slider';
      parentLabel.appendChild(slider);
    }
  }

  // Acessibilidade
  input.setAttribute('role', 'switch');

  const KEY = 'sIdM_theme';
  const applyTheme = (theme) => {
    if (theme === 'light') document.body.setAttribute('data-theme', 'light');
    else document.body.removeAttribute('data-theme');
    input.setAttribute('aria-checked', theme === 'light' ? 'true' : 'false');
  };

  // Estado inicial
  const stored = localStorage.getItem(KEY);
  if (stored === 'light' || stored === 'dark') {
    applyTheme(stored);
    input.checked = stored === 'light';
  } else {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(prefersLight ? 'light' : 'dark');
    input.checked = prefersLight;
  }

  // Listener de mudança
  input.addEventListener('change', function () {
    const theme = this.checked ? 'light' : 'dark';
    applyTheme(theme);
    localStorage.setItem(KEY, theme);
  });

  // Reage à mudança do sistema somente se não houver preferência salva
  try {
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      (mq.addEventListener ?? mq.addListener).call(mq, (e) => {
        if (!localStorage.getItem(KEY)) {
          const newTheme = e.matches ? 'light' : 'dark';
          applyTheme(newTheme);
          input.checked = newTheme === 'light';
        }
      });
    }
  } catch (e) { /* ignore */ }

  // Marca como inicializado
  input.dataset.init = '1';
}



// Injeta (uma única vez) overrides seguros para o theme switch em desktop
function ensureThemeSwitchDesktopOverride() {
  const old = document.getElementById('theme-switch-overrides');
  if (old) old.remove();

  const css = `
/* =========================
   Theme switch (consolidado)
   - label.theme-switch
   - input#themeToggle
   - span.slider
   - suporta body[data-theme="light"]
   ========================= */

/* container do switch */
label.theme-switch {
  display: inline-block;
  position: relative;
  width: 48px;
  height: 26px;
  margin-left: 8px;
  vertical-align: middle;
  cursor: pointer;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  z-index: 1400;

  /* Nova borda tracejada branca fina */
  border: 1px;
  border-color: #fff;
  border-radius: 999px; /* mantém o formato arredondado */
}


/* input escondido de forma acessível (mantém foco e teclado) */
label.theme-switch input[type="checkbox"] {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
  opacity: 0;
  -webkit-appearance: none;
  appearance: none;
}

/* trilho do switch */
label.theme-switch .slider {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
  transition: background .28s var(--ease), box-shadow .28s var(--ease);
  display: block;
}

/* knob (bola) */
label.theme-switch .slider::before {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 4px 12px rgba(0,0,0,0.28);
  transition: transform .28s var(--ease), background .28s var(--ease), box-shadow .28s var(--ease);
  will-change: transform;
}

/* estado checked (suporta + e ~ por segurança) */
label.theme-switch input[type="checkbox"]:checked + .slider,
label.theme-switch input[type="checkbox"]:checked ~ .slider {
  background: rgba(0,0,0,0.06);
}
label.theme-switch input[type="checkbox"]:checked + .slider::before,
label.theme-switch input[type="checkbox"]:checked ~ .slider::before {
  transform: translateX(22px);
  background: var(--accent-strong);
  box-shadow: 0 6px 16px rgba(0,0,0,0.32);
}

/* foco por teclado visível */
label.theme-switch input[type="checkbox"]:focus + .slider,
label.theme-switch input[type="checkbox"]:focus ~ .slider {
  box-shadow: 0 0 0 4px rgba(37,99,235,0.12);
}

/* animação opcional: adicione classe .animate ao label para movimento sutil */
label.theme-switch.animate .slider::before {
  animation: flagWave 1.6s ease-in-out infinite;
}
@keyframes flagWave {
  0%   { transform: translateX(0) skewX(0deg); }
  50%  { transform: translateX(1px) skewX(2deg); }
  100% { transform: translateX(0) skewX(0deg); }
}

/* adaptações para tema claro */
body[data-theme="light"] label.theme-switch .slider {
  background: rgba(15,23,42,0.06);
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.02);
  border: 1px;
  border-color: #000;
}
body[data-theme="light"] label.theme-switch .slider::before {
  background: var(--accent);
  box-shadow: 0 3px 8px rgba(0,0,0,0.12);
  border: 1px;
  border-color: #000;
}

/* touch target mínimo e acessibilidade */
label.theme-switch { touch-action: manipulation; }
label.theme-switch .slider,
label.theme-switch .slider::before { pointer-events: none; }

/* responsivo: reduz tamanho em telas muito pequenas */
@media (max-width: 420px) {
  label.theme-switch { width: 42px; height: 24px; margin-left: 6px; }
  label.theme-switch .slider::before { width: 18px; height: 18px; left: 3px; top: 3px; }
  label.theme-switch input[type="checkbox"]:checked + .slider::before { transform: translateX(18px); }
}

/* utilitário para forçar visualização caso haja regras conflitantes */
label.theme-switch.force-visible { display:inline-block !important; visibility:visible !important; opacity:1 !important; }


/* ===== Override brando para o input do theme switch (acessível, invisível) ===== */

label.theme-switch input[type="checkbox"] {
  position: absolute;
  inset: 0;                /* ocupa toda a área do label */
  opacity: 0;              /* invisível */
  margin: 0;
  padding: 0;
  border: 0;
  -webkit-appearance: none;
  appearance: none;
}

   
/* ===== Theme switch — reforço desktop ===== */

/* 1) Esconde o input do switch de forma acessível e clicável (DOM nested) */
.main-header .header-actions label.theme-switch input#themeToggle[type="checkbox"] {
  position: absolute !important; /* ocupa toda a área do label */
  inset: 0 !important;
  opacity: 0 !important;         /* invisível */
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;

  -webkit-appearance: none !important;
  appearance: none !important;
  /* NÃO usar clip/rect ou width:1px;height:1px (isso costuma quebrar o toggle em alguns navegadores) */
}

/* 2) Garante que o trilho e o knob aparecem no desktop */
.main-header .header-actions label.theme-switch .slider {
  position: absolute;
  inset: 0;
  display: block !important;     /* força visibilidade */
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
  transition: background .28s var(--ease), box-shadow .28s var(--ease);
}

/* 3) Knob padrão */
.main-header .header-actions label.theme-switch .slider::before {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 4px 12px rgba(0,0,0,0.28);
  transition: transform .28s var(--ease), background .28s var(--ease), box-shadow .28s var(--ease);
}

/* 4) Estado checked no desktop (usando adjacência +) */
.main-header .header-actions label.theme-switch input#themeToggle[type="checkbox"]:checked + .slider::before {
  transform: translateX(22px);
  background: var(--accent-strong);
  box-shadow: 0 6px 16px rgba(0,0,0,0.32);
}

/* 5) Tema claro — ajustes */
body[data-theme="light"] .main-header .header-actions label.theme-switch .slider {
  background: rgba(15,23,42,0.06);
  box-shadow: inset 0 1px 0 rgba(0,0,0,0.02);
  border: 1px #000;
}
body[data-theme="light"] .main-header .header-actions label.theme-switch .slider::before {
  background: var(--accent);
  box-shadow: 0 3px 8px rgba(0,0,0,  box-shadow: 0 3px 8px rgba(0,0,0,0.12);
  border: 1px #000;
}
  `.trim();

  const style = document.createElement('style');
  style.id = 'theme-switch-overrides';
  style.textContent = css;
  document.head.appendChild(style);
}

/* =========================
   Pull-to-refresh (mantido)
   ========================= */
export function setupPullToRefresh() {
  // Se o overlay já existe, ainda assim garante o themeToggle
  const existing = document.querySelector('.pull-refresh');
  if (existing) {
    queueMicrotask(() => setupThemeToggle());
    return;
  }

  const refreshOverlay = document.createElement('div');
  refreshOverlay.className = 'pull-refresh';
  refreshOverlay.innerHTML = `
    <svg class="progress-circle" viewBox="0 0 36 36">
      <defs>
        <linearGradient id="spinnerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ff6666" />
          <stop offset="100%" stop-color="#ffcccc" />
        </linearGradient>
      </defs>
      <path class="circle-bg"
        d="M18 2.0845
           a 15.9155 15.9155 0 0 1 0 31.831
           a 15.9155 15.9155 0 0 1 0 -31.831"/>
      <path class="circle"
        stroke-dasharray="0,100"
        d="M18 2.0845
           a 15.9155 15.9155 0 0 1 0 31.831
           a 15.9155 15.9155 0 0 1 0 -31.831"/>
    </svg>
    <span>Atualizando...</span>
  `;
  document.body.appendChild(refreshOverlay);

  let touchStartY = 0;
  const onStart = (e) => { touchStartY = e.touches[0].clientY; };
  const onMove = (e) => {
    const deltaY = e.touches[0].clientY - touchStartY;
    if (deltaY > 0 && window.scrollY === 0) {
      refreshOverlay.classList.add('show');
      const circle = refreshOverlay.querySelector('.circle');
      const progress = Math.min(deltaY / 2, 100);
      circle.setAttribute('stroke-dasharray', `${progress},100`);
      if (progress >= 100) refreshOverlay.classList.add('complete');
      else refreshOverlay.classList.remove('complete');
    }
  };
  const onEnd = () => {
    if (refreshOverlay.classList.contains('complete')) {
      setTimeout(() => location.reload(), 800);
    } else {
      refreshOverlay.classList.remove('show', 'complete');
    }
  };

  // 🔧 Usa passive listeners para não interferir em outros gestos/estilos
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('touchend', onEnd, { passive: true });

  // 🔧 Garante que o theme toggle seja sempre inicializado
  queueMicrotask(() => setupThemeToggle());
}

/* =========================
   Carregar posts do banco (corrigido)
   - usa getSupabase() em vez de window.supabase
   - fallback local robusto
   - usa _supabaseConfig.tableName
   ========================= */


export async function carregarPostsDoBanco() {
  // 🔧 Garante que contentData exista antes de qualquer uso
  if (typeof window.contentData === 'undefined') {
    window.contentData = {};
  }
  // Usa a ref local para clareza
  let contentData = window.contentData;

  // garante cliente supabase
  let supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase não inicializado. Tentando inicializar...');
    supabase = await initializeSupabase();
  }

  // fallback local se supabase não estiver disponível
  if (!supabase) {
    console.warn('Supabase indisponível. Carregando dados locais se houver.');
    try {
      if (typeof window.dataPT !== 'undefined') {
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
        window.contentData = contentData; // sincroniza
      } else {
        contentData = {};
        window.contentData = contentData;
      }
    } catch (err) {
      console.error('Erro ao usar dataPT como fallback:', err);
      contentData = {};
      window.contentData = contentData;
    }

    renderMenu();
    renderWelcome();
    return;
  }

  // usa a tabela configurada
  const table = _supabaseConfig.tableName || 'posts';

  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Erro ao buscar dados da tabela "${table}":`, error);
      window.contentData = {};
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
        titulo: post.title || post.titulo || '(Sem título)',
        conteudo: post.content || post.conteudo || '',
        categoria,
        image_url: post.image_url || post.image || null,
        created_at: post.created_at || null
      };
    });

    window.contentData = contentData; // sincroniza
    renderMenu();
    renderWelcome();
  } catch (err) {
    console.error('Erro inesperado ao carregar posts:', err);
    window.contentData = {};
    renderMenu();
    renderWelcome();
  }
}

async function uploadToSupabase(file) {
  if (!file) return '';

  // Garante cliente Supabase (usa getSupabase e, se necessário, initializeSupabase)
  let supabase = (typeof getSupabase === 'function' ? getSupabase() : null) || window.supabase;
  if (!supabase) {
    supabase = await initializeSupabase();
    if (!supabase) {
      console.warn('uploadToSupabase: Supabase não inicializado.');
      return '';
    }
  }

  const bucket = (_supabaseConfig && _supabaseConfig.bucketName) || 'images';
  const filename = sanitizeFilename(file); // ex.: "paste-<timestamp>-<base>.<ext>"
  const filePath = filename.startsWith('/') ? filename.slice(1) : filename;

  try {
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (error) {
      console.error(`Erro no upload para bucket "${bucket}":`, error);
      return '';
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return urlData?.publicUrl || '';
  } catch (err) {
    console.error('uploadToSupabase erro inesperado:', err);
    return '';
  }
}


async function insertPost(payload) {
  // Garante cliente Supabase
  let supabase = (typeof getSupabase === 'function' ? getSupabase() : null) || window.supabase;
  if (!supabase) supabase = await initializeSupabase();
  if (!supabase) {
    console.warn('insertPost: Supabase não inicializado.');
    return null;
  }

  const table = (_supabaseConfig && _supabaseConfig.tableName) || 'posts';

  try {
       const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) {
      console.error(`Erro ao inserir na tabela "${table}":`, error);
      return null;
    }
    return data; // objeto da linha inserida
  } catch (err) {
    console.error('insertPost erro inesperado:', err);
    return null;
  }
}

async function updatePost(postId, payload) {
  // Garante cliente Supabase
  let supabase = (typeof getSupabase === 'function' ? getSupabase() : null) || window.supabase;
  if (!supabase) supabase = await initializeSupabase();
  if (!supabase) {
    console.warn('updatePost: Supabase não inicializado.');
    return { error: new Error('Supabase não inicializado') };
  }

  const table = (_supabaseConfig && _supabaseConfig.tableName) || 'posts';

  try {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', postId)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao atualizar na tabela "${table}":`, error);
      return { error };
    }
    return { data }; // objeto da linha atualizada
  } catch (err) {
    console.error('updatePost erro inesperado:', err);
    return { error: err };
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



/**
 * Converte um data:image para um File (para upload).
 */
function dataURLtoFile(dataurl, filename) {
  const arr  = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];   // ex.: "data:image/png;base64"
  const b64  = arr[1] || '';                 // parte base64 após a vírgula
  const bstr = atob(b64);                    // decodifica base64 em string binária

  let n = bstr.length;
  const u8 = new Uint8Array(n);

  // Preenche o buffer com cada byte da string binária
  while (n--) {
    u8[n] = bstr.charCodeAt(n);
  }

  return new File([u8], filename, { type: mime });
}

/**
 * Insere um nó na posição atual do cursor dentro do editor #content-body.
 */
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

/**
 * Detecta imagens no HTML colado do Word:
 * - ...
 * - ... (VML do Word)
 * Retorna objetos { kind: 'img'|'vml', src, tag }
 */
function detectImgsInHtml(html) {
  const matches = [];
   if (!html || typeof html !== 'string') return matches;

  // ...
  const IMG_RE = /<img\b[^>]*\bsrc="'["'][^>]*>/ig;
  let m;
  while ((m = IMG_RE.exec(html)) !== null) {
    matches.push({ kind: 'img', src: (m[1] || '').trim(), tag: m[0] });
  }

  // VML do Word: ...
  const VML_RE = /<v:imagedata\b[^>]*\bsrc="'["'][^>]*>/ig;
  while ((m = VML_RE.exec(html)) !== null) {
    matches.push({ kind: 'vml', src: (m[1] || '').trim(), tag: m[0] });
  }

  return matches;
}

/**
 * Sinaliza presença de blocos RTF \pict (imagem codificada).
 */
function detectPictInRtf(rtfText) {
  if (!rtfText || typeof rtfText !== 'string') return false;
  const PICT_RE = /\\pict[\s\S]*?\\par/gm;
  return PICT_RE.test(rtfText);
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

/**
 * Cria um bloco de mensagem para quando a imagem não puder ser incorporada.
 */

/**
 * Cria um bloco de mensagem quando a imagem não pode ser incorporada.
 */
function createMissingImageMessage(message = 'Imagem colada do Word não pôde ser incorporada') {
  const msg = document.createElement('div');
  msg.className = 'missing-image-message';
  msg.textContent = message;

  // Estilos mínimos; seu CSS pode sobrescrever
  msg.style.color = '#900';
  msg.style.fontStyle = 'italic';
  msg.style.padding = '0.25rem 0.5rem';
  msg.style.margin = '0.25rem 0';
  msg.style.backgroundColor = '#ffe0e0';
  msg.style.border = '1px solid #ff0000';
   msg.style.display = 'inline-block';

  msg.setAttribute('contenteditable', 'false');
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




/**
 * Handler de paste robusto para conteúdo colado do Word (texto + imagem).
 * Mantém nomes e fluxo do seu projeto (usa uploadToSupabase, insertNodeAtCursor, createMissingImageMessage).
 */
async function handlePaste(e) {
  try {
    const clipboard = e.clipboardData || window.clipboardData;
    if (!clipboard) return;

    const editor = document.getElementById('content-body');
    const target = e.target || document.activeElement;
    const isEditor = editor && (target === editor || editor.contains(target));
    if (!isEditor) return;

    // bloqueia apenas dentro do editor
    e.preventDefault();

    const items = clipboard.items ? Array.from(clipboard.items) : [];
    const plain = clipboard.getData('text/plain') || '';
    const html  = clipboard.getData('text/html')  || '';
    const rtf   = clipboard.getData('text/rtf')   || '';

    // (1) Arquivo-imagem real (printscreen, copiar arquivo)
    const fileItem = items.find(it => it.kind === 'file' && it.type.startsWith('image/'));
    if (fileItem) {
      const file = fileItem.getAsFile?.();
      if (file) {
        try {
          const url = typeof uploadToSupabase === 'function'
            ? await uploadToSupabase(file)
            : null;

          if (url) {
            const img = document.createElement('img');
            img.src = url; // sem atributos extras — seu CSS cuida
            insertNodeAtCursor(img);
          } else {
            insertNodeAtCursor(createMissingImageMessage(`Falha ao enviar ${file.name || 'imagem'}.`));
          }
        } catch (err) {
          console.error('Erro em uploadToSupabase:', err);
          insertNodeAtCursor(createMissingImageMessage(`Erro inesperado ao enviar ${file?.name || 'imagem'}.`));
        }
      }
      if (plain) document.execCommand('insertText', false, `\n${plain}\n`);
      return;
    }

    // (2) Inspeciona HTML/RTF colados do Word
    const refs = detectImgsInHtml(html);
    const hasPict = detectPictInRtf(rtf);

    // 2a) Se houver data:image em <img>, converter e tentar upload
    const dataImgs = refs.filter(x => x.src.startsWith('data:image/'));
    if (dataImgs.length > 0) {
      for (const d of dataImgs) {
        try {
          const ext  = (d.src.match(/^data:image\/([^;]+)/i)?.[1] || 'png');
          const file = dataURLtoFile(d.src, `paste-${Date.now()}.${ext}`);

          const url = typeof uploadToSupabase === 'function'
            ? await uploadToSupabase(file)
            : null;

          if (url) {
            const img = document.createElement('img');
            img.src = url;
            insertNodeAtCursor(img);
          } else {
            insertNodeAtCursor(createMissingImageMessage('Falha ao enviar imagem inline.'));
          }
        } catch (err) {
          console.warn('Falha ao processar data:image:', err);
          insertNodeAtCursor(createMissingImageMessage('Imagem inline não pôde ser processada.'));
        }
      }
      if (plain) document.execCommand('insertText', false, `\n${plain}\n`);
      return;
    }

    // 2b) Referências incoláveis (file://, VML, RTF \pict) → mensagem + texto
    const hasIncolavel =
      refs.some(x => x.src.startsWith('file:') || x.src.startsWith('cid:')) || // file:// e cid:
      refs.some(x => x.kind === 'vml') ||                                      // <v:imagedata ...>
      hasPict;                                                                  // RTF \pict

    if (hasIncolavel) {
      insertNodeAtCursor(createMissingImageMessage('Imagem colada do Word não pôde ser incorporada'));
      if (plain) document.execCommand('insertText', false, `\n${plain}\n`);
      return;
    }

    // (3) Apenas texto
    if (plain) {
      document.execCommand('insertText', false, plain);
    }
   } catch (err) {
    console.error('Erro no handlePaste:', err);
    insertNodeAtCursor(createMissingImageMessage('Falha ao processar conteúdo colado.'));
  }
}

// Função auxiliar para inserir texto simples
function insertPlainTextAtCursor(plain, contentBody) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    // Usa comando nativo para inserir texto cru → preserva undo/redo
    document.execCommand('insertText', false, plain);
  } else {
    // fallback: adiciona como parágrafo no fim
    const p = document.createElement('p');
    p.textContent = plain;
    contentBody.appendChild(p);
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
    <h1 id="article-title">Bem-vinda minha Deusa-Rainha!</h1>
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
    liCategoria.dataset.categoria = categoria; // << NOVO
    const span = document.createElement('span');
    span.textContent = categoria;
    span.style.cursor = 'pointer';
    span.setAttribute('tabindex', '0'); // torna focável pelo teclado

    // expandir/fechar com clique
    span.addEventListener('click', () => liCategoria.classList.toggle('active'));

    // expandir/fechar também com Enter ou Espaço
    span.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); // evita scroll da página com espaço
        liCategoria.classList.toggle('active');
      }
    });

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

      // Gera URL amigável com ?artigoID=<postId>
      const artigoId = artigo.postId;
      link.href = `?artigoID=${encodeURIComponent(String(artigoId))}`;
      link.textContent = artigo.titulo;
      link.dataset.categoria = categoria;
      link.dataset.id = id;
      link.dataset.postId = String(artigo.postId); // << NOVO

      // Mantém SPA: ao clicar, não recarrega; atualiza URL e renderiza.
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const cat = this.dataset.categoria;
        const key = this.dataset.id;
        const a = window.contentData?.[cat]?.[key];
        if (a && a.postId != null) {
          updateUrlWithArticleId(a.postId);
        }
        loadArticle(cat, key);
      });

      // Opcional: ao focar via teclado, também atualiza SPA e URL
      link.addEventListener('focus', function () {
        const cat = this.dataset.categoria;
        const key = this.dataset.id;
        const a = window.contentData?.[cat]?.[key];
        if (a && a.postId != null) {
          updateUrlWithArticleId(a.postId);
        }
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
        // Se conseguirmos o postId, atualiza a URL
        const a = window.contentData?.[categoria]?.[id];
        if (a && a.postId != null) {
          updateUrlWithArticleId(a.postId);
        }
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
 * Marca o item do menu correspondente ao artigo como ativo e expande sua categoria.
 * @param {string} idOrSelector - id do artigo (key usada em contentData[categoria][id]),
 *                                ou um seletor/href parcial para localizar o link.
 */
function setActiveArticle(idOrSelector) {
  const menu = document.getElementById('menu');
  if (!menu) return;

  // Remove estados ativos anteriores
  menu.querySelectorAll('a.active').forEach(a => {
    a.classList.remove('active');
    a.removeAttribute('aria-current');
  });

  // Nada a marcar
  if (!idOrSelector) return;
  const needle = String(idOrSelector);

  // Tenta localizar o link do artigo por diferentes pistas
  let target =
    // 1) por data attributes comuns
    Array.from(menu.querySelectorAll('a')).find(a => {
      const ds = a.dataset || {};
      return ds.id === needle ||
             ds.articleId === needle ||
             ds.postId === needle ||
             ds['article-id'] === needle;
    }) ||
    // 2) por href contendo o "needle"
    Array.from(menu.querySelectorAll('a')).find(a => {
      const href = a.getAttribute('href') || '';
      return href.includes(needle);
    }) ||
    // 3) interpretando como seletor CSS direto (ex.: '#meu-link')
    (function () {
      try { return menu.querySelector(needle); } catch { return null; }
    })();

  if (!target) {
    // Log opcional para depuração
    if (window && window.console && window.console.debug) {
      console.debug('setActiveArticle: target not found for', idOrSelector);
    }
    return;
  }

  // Marca o link como ativo
  target.classList.add('active');
  target.setAttribute('aria-current', 'true');

  // === Expande a categoria correspondente ===
  // Estrutura esperada:
  // liCategoria > span (nome da categoria) + ulTitulos > liTitulo > a(target)
  const liTitulo = target.closest('li'); // li do título
  const liCategoria = liTitulo ? liTitulo.parentElement?.closest('li') : null; // li da categoria

  if (liCategoria) {
    liCategoria.classList.add('active'); // abre a categoria

    // Acessibilidade: o span (cabeçalho da categoria) pode indicar que está expandido
    const catSpan = liCategoria.querySelector('span');
    if (catSpan) {
      catSpan.setAttribute('aria-expanded', 'true');
    }
  }

  // === Rolar suavemente para garantir visibilidade do link e da categoria ===
  const menuRect = menu.getBoundingClientRect();
  const itemRect = target.getBoundingClientRect();

  // 1) Rola o menu até o link, se ele estiver fora da viewport do menu
  const itemOutOfView = itemRect.top < menuRect.top || itemRect.bottom > menuRect.bottom;
  if (itemOutOfView && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // 2) (Opcional) Rola até o cabeçalho da categoria caso também esteja fora de vista
  if (liCategoria && typeof liCategoria.scrollIntoView === 'function') {
    const catRect = liCategoria.getBoundingClientRect();
    const catOutOfView = catRect.top < menuRect.top || catRect.bottom > menuRect.bottom;
    if (catOutOfView) {
      liCategoria.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

// Localiza um artigo pelo postId (inteiro ou string), retornando { categoria, id, artigo }.
function findArticleByPostId(postId) {
  if (!postId && postId !== 0) return null;
  const needle = String(postId);
  for (const categoria in window.contentData || {}) {
    const artigos = window.contentData[categoria] || {};
    for (const id in artigos) {
      const a = artigos[id];
      if (String(a.postId) === needle) {
        return { categoria, id, artigo: a };
      }
    }
  }
  return null;
}

// Atualiza a URL para ?artigoID=<postId> sem recarregar, preservando demais params (SPA).
function updateUrlWithArticleId(postId) {
  const url = new URL(window.location.href);
  url.searchParams.set('artigoID', String(postId));
  history.pushState({ artigoID: String(postId) }, '', url);
}

// Navega pela query string ao carregar/popstate.
// Se houver ?artigoID=<id>, abre o artigo correspondente; senão mostra a Welcome.

async function navigateByQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('artigoID');
    if (!idParam) {
      renderWelcome();
      return;
    }
    // Garante que os dados já estejam carregados
    if (!window.contentData || Object.keys(window.contentData).length === 0) {
      await carregarPostsDoBanco();
    }
    let found = findArticleByPostId(idParam);
    if (!found) {
      await carregarPostsDoBanco();
      found = findArticleByPostId(idParam);
    }
    if (found) {
      loadArticle(found.categoria, found.id);
      // Abrir sidebar para orientar o usuário (opcional)
      if (window.innerWidth >= 768) toggleSidebar(true);
    } else {
      renderWelcome();
    }
  } catch (e) {
    console.warn('navigateByQuery falhou:', e);
    renderWelcome();
   }
}

// Lida com back/forward do navegador mantendo a mesma semântica
window.addEventListener('popstate', () => {
  navigateByQuery();
});
``

function scrollContentToTop({ smooth = true } = {}) {
  // Prioriza a área central de conteúdo
  const content = document.querySelector('.content');
  const article = document.getElementById('article-content');

  const target = content || article || document.scrollingElement || document.documentElement;

  try {
    target.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto'
    });
  } catch (_) {
    // Fallback para navegadores antigos
    target.scrollTop = 0;
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
     <nav class="breadcrumb" aria-label="Você está em">
       <span class="crumb">${artigo.categoria || categoria}</span>
       <span class="sep"> ›› </span>
       <span class="crumb current">${artigo.titulo}</span>
     </nav>
      <h1 id="article-title">${artigo.titulo}</h1>
     <button id="edit-article-link" data-categoria="${categoria}" data-id="${id}" data-post-id="${artigo.postId}">Editar</button>
     <div id="content-body" contenteditable="false" data-placeholder="Digite ou cole o conteúdo aqui">${artigo.conteudo}</div>
  `;
  enableImageSplash(container);

  setDocTitleFromBreadcrumbDOM();

  currentCategoria = categoria;
  currentId = id;
  currentPostId = artigo.postId ?? null;

  // 🔗 Mantém a URL sempre alinhada ao artigo atual (SPA)
  if (currentPostId != null) {
    updateUrlWithArticleId(currentPostId);
  }

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
  toggleSidebar(false);
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
   ) ?? Object.keys(contentData[catKey]).pop();
   
   loadArticle(catKey, newKey);
   
   // 🔗 Garante que a URL reflita o artigo atual
   if (currentPostId != null) {
     updateUrlWithArticleId(currentPostId);
   }
   
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
      
          const existsAfter =
            window.contentData?.[categoria] &&
            Object.values(window.contentData[categoria] || {}).some(x => x.postId === currentPostId);
      
          if (!existsAfter) {
            alert('Erro ao salvar conteúdo.');
            return;
          }
        } else {
          const updated = resp.data; // { id, ... }
          // Se vier id, mantém coerência com seu fluxo
          if (updated?.id) currentPostId = updated.id;
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
      ) ?? Object.keys(contentData[catKey]).pop();
      
      loadArticle(catKey, savedKey);
      
      // 🔗 Garante que a URL reflita o artigo atual
      if (currentPostId != null) {
        updateUrlWithArticleId(currentPostId);
      }
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
    // cria o overlay dinamicamente
    setupPullToRefresh();

    document.addEventListener('DOMContentLoaded', setupThemeToggle);

    ensureThemeSwitchDesktopOverride();

    // Inicializa supabase e carrega dados
    await initializeSupabase();
    await carregarPostsDoBanco();
    await navigateByQuery();
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
      setupSidebarAutoClose(); // fecha a sidebar no mobile
    });
  }
});
