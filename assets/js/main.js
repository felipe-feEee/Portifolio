// main.js — navegação por clique (dock) e rolagem dentro de cada .page sem trocar de seção
// - permite rolar o conteúdo dentro de cada .page
// - evita que eventos de wheel/touch vazem para outros handlers que poderiam trocar de seção
// - mantém navegação por clique no dock e links com hash
// - gerencia abertura/fechamento de demo em iframe com lock de scroll
// - marca item ativo no dock via IntersectionObserver
// - bloqueia teclas de navegação apenas quando não estiver em um campo de formulário

document.addEventListener("DOMContentLoaded", () => {
  const SCROLL_LOCK_CLASS = "scroll-locked";

  // DOM
  const yearEl = document.getElementById("year");
  const container = document.querySelector(".wrap.spa") || document.getElementById("app") || document.documentElement;
  const heroSection = document.getElementById("heroSection");
  const frameSection = document.getElementById("appFrameSection");
  const frame = document.getElementById("appFrame");
  const frameTitle = document.getElementById("appFrameTitle");
  const frameStatus = document.getElementById("appFrameStatus");
  const btnClose = document.getElementById("appCloseBtn");
  const btnNewTab = document.getElementById("appOpenNewTab");
  const portfolio = document.getElementById("portfolio");
  const openButtons = Array.from(document.querySelectorAll(".js-open-system"));
  const spyButtons = Array.from(document.querySelectorAll(".dock-btn[data-spy]"));
  const spySections = [
    document.getElementById("heroSection"),
    document.getElementById("sobre"),
    document.getElementById("portfolio"),
    document.getElementById("contato"),
  ].filter(Boolean);

  // ano no footer
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // utilitários de UI
  function setNewTab(enabled, url = "#") {
    if (!btnNewTab) return;
    btnNewTab.href = enabled ? url : "#";
    btnNewTab.setAttribute("aria-disabled", String(!enabled));
    btnNewTab.style.pointerEvents = enabled ? "auto" : "none";
    btnNewTab.style.opacity = enabled ? "1" : ".6";
  }
  function showLoading() { if (frameStatus) frameStatus.textContent = "Carregando…"; }
  function showReady() { if (frameStatus) frameStatus.textContent = "Pronto ✅"; }

  // lock / unlock scroll (quando iframe abre)
let savedOverflow = null;
function lockScroll() {
  if (container && container.scrollTop !== undefined) savedScrollTop = container.scrollTop;
  document.body.classList.add(SCROLL_LOCK_CLASS);
  if (container && container.classList) container.classList.add(SCROLL_LOCK_CLASS);
  if (container && container.style) {
    savedOverflow = container.style.overflow || '';
    container.style.overflow = "hidden";
  }
}
function unlockScroll() {
  document.body.classList.remove(SCROLL_LOCK_CLASS);
  if (container && container.classList) container.classList.remove(SCROLL_LOCK_CLASS);
  if (container && container.style) {
    container.style.overflow = savedOverflow || "";
    savedOverflow = null;
  }
  setTimeout(() => {
    if (container && typeof savedScrollTop === "number") {
      try { container.scrollTop = savedScrollTop || 0; } catch (_) {}
    }
  }, 60);
}

// rolar para elemento (usado pelo dock e links) - versão robusta
function scrollToEl(el) {
  if (!el || !container) return;
  // se container for o documentElement, usa scrollIntoView
  if (container === document.documentElement || container === document.body) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  // caso container seja um elemento com overflow, calcula offset relativo via getBoundingClientRect
  const containerRect = container.getBoundingClientRect();
  const targetRect = el.getBoundingClientRect();
  const top = targetRect.top - containerRect.top + container.scrollTop;
  container.scrollTo({ top, behavior: 'smooth' });
}

  // abrir / fechar demo (iframe)
function openSystem(url, title) {
  if (!heroSection || !frameSection || !frame) return;
  heroSection.classList.add("is-hidden");
  frameSection.classList.remove("is-hidden");
  if (frameTitle) frameTitle.textContent = title || "Sistema";
  setNewTab(true, url);
  showLoading();
  lockScroll();
  frame.src = url;
  // esconde dock
  setDockHidden(true);
  // garante que o frameSection fique visível
  scrollToEl(frameSection);
  // opcional: atualiza active do dock para nenhum (ou para 'demo' se quiser)
  spyButtons.forEach(b => b.classList.remove('is-active'));
}

function closeSystem() {
  if (!heroSection || !frameSection || !frame) return;
  frame.src = "about:blank";
  frameSection.classList.add("is-hidden");
  heroSection.classList.remove("is-hidden");
  if (frameTitle) frameTitle.textContent = "—";
  if (frameStatus) frameStatus.textContent = "";
  setNewTab(false);
  unlockScroll();
  // mostra dock novamente
  setDockHidden(false);
  // restaura active para a seção portfolio (ou para a que preferir)
  setActiveDock('portfolio'); // ajuste o id conforme preferir
  if (portfolio) scrollToEl(portfolio);
}

  if (frame) {
    frame.addEventListener("load", () => {
      try {
        if (frame.src && !frame.src.includes("about:blank")) showReady();
      } catch (_) {}
    });
  }

  // botões de abrir demo
  openButtons.forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const url = btn.getAttribute("data-url");
      const title = btn.getAttribute("data-title");
      if (url) openSystem(url, title);
    });
  });

  if (btnClose) btnClose.addEventListener("click", closeSystem);
  document.addEventListener("keydown", (e) => {
    // ESC fecha iframe se aberto
    if (e.key === "Escape" && frameSection && !frameSection.classList.contains("is-hidden")) {
      closeSystem();
    }
  });

  // === Navegação por clique no dock ===
  spyButtons.forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const targetId = btn.getAttribute("data-spy");
      const targetEl = document.getElementById(targetId);
      if (targetEl) scrollToEl(targetEl);
      // atualiza hash sem pular
      if (targetId) history.replaceState(null, "", `#${targetId}`);
    });
  });

  // Links com hash (qualquer link interno) — rola o container
  /* document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (ev) => {
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (!target) return;
      ev.preventDefault();
      scrollToEl(target);
      history.replaceState(null, '', href);
    });
  }); */

  /*/ IntersectionObserver para marcar botão ativo no dock
  if (spySections.length && container) {
    const io = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(en => en.isIntersecting)
        .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const id = visible.target.id;
      spyButtons.forEach(b => {
        b.classList.toggle("is-active", b.getAttribute("data-spy") === id);
      });
    }, { root: container === document.documentElement ? null : container, rootMargin: "-35% 0px -55% 0px", threshold: [0.10, 0.20, 0.35] });

    spySections.forEach(s => io.observe(s));
  } */

  // === Teclas de navegação: bloqueia apenas se não estiver em campo de formulário ===
  window.addEventListener("keydown", (e) => {
    const blocked = ["PageDown","PageUp","ArrowDown","ArrowUp","Home","End"];
    if (!blocked.includes(e.key)) return;
    const active = document.activeElement;
    const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
    if (!isInput) {
      // evita que teclas naveguem a página inteira e mudem de section
      e.preventDefault();
    }
  }, { passive: false });

  // === Interceptadores de wheel / touch (capture) para evitar que eventos dentro de uma .page
  // sejam entregues a outros handlers que poderiam trocar de seção.
  // NÃO chamamos preventDefault aqui (permitimos o scroll nativo), apenas stopPropagation
  // quando o evento ocorre dentro de uma .page que pode rolar.

  function findPageAncestor(el) {
    while (el && el !== document && el !== container) {
      if (el.classList && el.classList.contains('page')) {
        // considera rolável se houver overflow vertical real
        if (el.scrollHeight > el.clientHeight + 1) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  // WHEEL (desktop) — capture para interceptar antes de outros listeners
  (container || document).addEventListener('wheel', function (e) {
    const page = findPageAncestor(e.target);
    if (!page) return; // fora de uma .page rolável: deixa propagar
    const delta = e.deltaY;
    // se a page tem espaço para rolar na direção do delta, impedimos que outros handlers recebam o evento
    if ((delta > 0 && page.scrollTop + page.clientHeight < page.scrollHeight - 1) ||
        (delta < 0 && page.scrollTop > 1)) {
      e.stopPropagation();
      // não chamamos preventDefault: permitimos o scroll nativo
    } else {
      // se a page está no limite, deixamos o evento propagar (caso queira permitir outras ações)
      // mas, por segurança, também stopPropagation para evitar trocas acidentais:
      e.stopPropagation();
    }
  }, { passive: true, capture: true });

  // TOUCH (mobile) — captura direção e aplica mesma lógica
  let touchStartY = 0;
  (container || document).addEventListener('touchstart', function (e) {
    if (e.touches && e.touches.length) touchStartY = e.touches[0].clientY;
  }, { passive: true, capture: true });

  (container || document).addEventListener('touchmove', function (e) {
    const touch = (e.touches && e.touches[0]) || null;
    if (!touch) return;
    const page = findPageAncestor(e.target);
    if (!page) return;
    const dy = touchStartY - touch.clientY; // positivo = swipe para cima (scroll down)
    if ((dy > 0 && page.scrollTop + page.clientHeight < page.scrollHeight - 1) ||
        (dy < 0 && page.scrollTop > 1)) {
      e.stopPropagation();
    } else {
      e.stopPropagation();
    }
  }, { passive: true, capture: true });

  // === Enforce layout fallback (mantém seu código original) ===
  function enforceStackLayout() {
    document.querySelectorAll(".section-head").forEach(head => {
      head.style.display = "flex";
      head.style.flexDirection = "column";
      head.style.alignItems = head.classList.contains("center") ? "center" : "flex-start";
      head.style.textAlign = head.classList.contains("center") ? "center" : "left";
      head.style.gap = "12px";
      head.style.marginBottom = "18px";
    });

    document.querySelectorAll(".cards-2, .projects").forEach(grid => {
      grid.style.clear = "both";
      grid.style.width = "100%";
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(260px, 1fr))";
      grid.style.gap = "16px";
      grid.style.marginTop = "8px";
    });

    document.querySelectorAll(".project, .card").forEach(card => {
      card.style.display = "block";
      card.style.boxSizing = "border-box";
      const thumb = card.querySelector(".thumb");
      const body = card.querySelector(".project-body, .card > *:not(.thumb)");
      if (thumb) {
        thumb.style.width = "100%";
        thumb.style.display = "block";
        thumb.style.minHeight = "140px";
      }
      if (body) {
        body.style.width = "100%";
        body.style.display = "block";
      }
    });
  }
  enforceStackLayout();
  window.addEventListener("resize", () => {
    clearTimeout(window.__enforceStackLayoutTimer);
    window.__enforceStackLayoutTimer = setTimeout(enforceStackLayout, 120);
  });
  setTimeout(enforceStackLayout, 120);
  setTimeout(enforceStackLayout, 600);

  // keyboard focus class for dock buttons (keeps your existing behavior)
  document.querySelectorAll('.dock-btn').forEach(btn => {
    btn.addEventListener('focus', () => btn.classList.add('keyboard-focus'));
    btn.addEventListener('blur', () => btn.classList.remove('keyboard-focus'));
    btn.addEventListener('touchstart', () => btn.classList.add('touched'));
    btn.addEventListener('touchend', () => setTimeout(() => btn.classList.remove('touched'), 800));
  });

  // scroll to hash target on load / hashchange
  function scrollToHashTarget() {
    const hash = window.location.hash;
    if (!hash) return;
    const target = document.querySelector(hash);
    if (!target) return;
    scrollToEl(target);
  }
  window.addEventListener('load', scrollToHashTarget);
  window.addEventListener('hashchange', scrollToHashTarget);

});

// --- Dock helpers: esconder/mostrar e setActive ---
const dock = document.querySelector('.dock');

function setActiveDock(id) {
  // atualiza classe is-active nos botões do dock
  spyButtons.forEach(btn => btn.classList.toggle('is-active', btn.getAttribute('data-spy') === id));
}

function setDockHidden(hidden) {
  if (!dock) return;
  if (hidden) {
    dock.classList.add('dock-hidden'); // adicione a classe no CSS para animar/ocultar
    dock.setAttribute('aria-hidden', 'true');
    // fallback para remover foco/tabindex em navegadores sem inert
    dock.querySelectorAll('a, button').forEach(el => {
      el.dataset._savedTabindex = el.getAttribute('tabindex') ?? '';
      el.setAttribute('tabindex', '-1');
    });
  } else {
    dock.classList.remove('dock-hidden');
    dock.removeAttribute('aria-hidden');
    dock.querySelectorAll('a, button').forEach(el => {
      const saved = el.dataset._savedTabindex;
      if (saved === '') el.removeAttribute('tabindex');
      else el.setAttribute('tabindex', saved);
      delete el.dataset._savedTabindex;
    });
  }
}

// Detecta touch e evita hover "preso" em mobile para os botões do dock
(function () {
  const body = document.body;
  const dockButtons = Array.from(document.querySelectorAll('.dock-btn'));

  if (!dockButtons.length) return;

  // Marca o body como touch na primeira interação touch
  function enableTouchMode() {
    if (!body.classList.contains('is-touch')) body.classList.add('is-touch');
  }

  // Ao tocar em um botão: adiciona classe .touched temporária e remove foco/hover depois
  function handleTouchStart(ev) {
    enableTouchMode();
    const btn = ev.currentTarget;
    // adiciona classe que ativa o estado visual em touch
    btn.classList.add('touched');
    // garante que o elemento não fique com :focus permanente
    try { btn.blur(); } catch (_) {}
  }

  function handleTouchEnd(ev) {
    const btn = ev.currentTarget;
    // mantém o estado por um curto período para o usuário ver a label, depois remove
    window.setTimeout(() => {
      btn.classList.remove('touched');
      try { btn.blur(); } catch (_) {}
    }, 420); // ajuste o tempo se quiser mais/menos persistência
  }

  // Também remove foco ao clicar (desktop/touch híbrido)
  function handleClick(ev) {
    const btn = ev.currentTarget;
    try { btn.blur(); } catch (_) {}
    // remove qualquer classe touched remanescente
    btn.classList.remove('touched');
  }

  // Registra listeners
  dockButtons.forEach(btn => {
    btn.addEventListener('touchstart', handleTouchStart, { passive: true });
    btn.addEventListener('touchend', handleTouchEnd, { passive: true });
    btn.addEventListener('click', handleClick, { passive: true });
    // opcional: blur ao perder foco por teclado
    btn.addEventListener('blur', () => btn.classList.remove('touched'));
  });

  // Detecta primeiro touch globalmente para ativar is-touch (fallback)
  window.addEventListener('touchstart', enableTouchMode, { passive: true, once: true });
})();

// Bloqueia troca de section por scroll/swipe.
// Regras:
// - container (.wrap.spa ou #app) fica com overflow:hidden (CSS acima).
// - cada .page rola internamente.
// - interceptamos wheel/touch no container e prevenimos qualquer tentativa de rolar o container.
// - permitimos scroll nativo dentro da .page (não chamamos preventDefault quando o evento é para a própria .page).
(function () {
  const container = document.querySelector('.wrap.spa') || document.getElementById('app') || document.documentElement;
  if (!container) return;

  // Helper: encontra a .page ancestral (se houver)
  function findPageAncestor(el) {
    while (el && el !== document && el !== container) {
      if (el.classList && el.classList.contains('page')) return el;
      el = el.parentElement;
    }
    return null;
  }

  // WHEEL: se o evento não for destinado a uma .page rolável, previne para evitar troca de section
  container.addEventListener('wheel', function (e) {
    const page = findPageAncestor(e.target);
    if (!page) {
      // evento fora de uma .page: impede rolagem do container
      e.preventDefault();
      return;
    }
    // se veio de dentro de uma .page, deixamos o navegador tratar o scroll interno normalmente
    // mas evitamos que o evento "vaze" para outros handlers que poderiam trocar section
    e.stopPropagation();
  }, { passive: false, capture: true });

  // TOUCH: impede swipe no container; permite scroll dentro da .page
  let touchStartY = 0;
  container.addEventListener('touchstart', function (e) {
    if (e.touches && e.touches.length) touchStartY = e.touches[0].clientY;
  }, { passive: true, capture: true });

  container.addEventListener('touchmove', function (e) {
    const page = findPageAncestor(e.target);
    if (!page) {
      // swipe fora de uma .page: evita que o container mude section
      e.preventDefault();
      return;
    }
    // dentro de .page: permite scroll nativo, mas impede propagação para evitar troca de section
    e.stopPropagation();
  }, { passive: false, capture: true });

  // Bloqueio de teclas de navegação que poderiam mudar a página inteira
  window.addEventListener('keydown', function (e) {
    const blocked = ["PageDown","PageUp","ArrowDown","ArrowUp","Home","End"];
    if (!blocked.includes(e.key)) return;
    const active = document.activeElement;
    const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
    if (!isInput) {
      e.preventDefault(); // evita navegação por teclado que mudaria section
    }
  }, { passive: false });

})();

// Simple anchor-based active link (no IntersectionObserver)
(function () {
  const container = document.querySelector('.wrap.spa') || document.getElementById('app') || document.documentElement;
  const spyButtons = Array.from(document.querySelectorAll('.dock-btn[data-spy]'));
  const spySections = spyButtons
    .map(b => document.getElementById(b.dataset.spy))
    .filter(Boolean);

  if (!spyButtons.length || !spySections.length) return;

  function setActive(id) {
    spyButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.spy === id));
  }

  // Click handler: scroll to target and update hash
  spyButtons.forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const targetId = btn.dataset.spy;
      const target = document.getElementById(targetId);
      if (!target) return;

      // Scroll the container or document to the target
      if (container === document.documentElement || container === document.body) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - containerRect.top + container.scrollTop;
        container.scrollTo({ top: offset, behavior: 'smooth' });
      }

      // Update URL hash without jumping
      history.replaceState(null, '', `#${targetId}`);
      // Immediate visual feedback
      setActive(targetId);
    });
  });

  // On load or hashchange: set active based on hash (or default to first)
  function activateFromHashOrDefault() {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const target = document.getElementById(hash);
      if (target) {
        setActive(hash);
        return;
      }
    }
    // fallback: mark first section/button
    const first = spySections[0];
    if (first && first.id) setActive(first.id);
  }

  window.addEventListener('load', activateFromHashOrDefault);
  window.addEventListener('hashchange', activateFromHashOrDefault);

  // Optional: if you programmatically change sections elsewhere, call setActive(id)
})();

// Sincroniza âncoras com o dock (marca .is-active no botão correto)
// Requer: botões do dock com data-spy="sectionId" e sections com id="sectionId"
/* (function () {
  const container = document.querySelector('.wrap.spa') || document.getElementById('app') || document.documentElement;
  const dockButtons = Array.from(document.querySelectorAll('.dock-btn[data-spy]'));
  const anchorLinks = Array.from(document.querySelectorAll('a[href^="#"]'));

  if (!dockButtons.length) return;

  function setActiveDock(id) {
    dockButtons.forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.spy === id);
    });
  } */

  // Unified anchor handler: scroll + update hash + update dock
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (ev) => {
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    const id = href.slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    ev.preventDefault();
    scrollToEl(target);
    history.replaceState(null, '', `#${id}`);
    // update dock if matching button exists
    setActiveDock(id);
  });
});


  // Scroll para target considerando container rolável
  function scrollToSection(target) {
    if (!target) return;
    if (container === document.documentElement || container === document.body) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offset = targetRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
  }

  // Intercepta cliques em links de âncora para sincronizar o dock
  anchorLinks.forEach(a => {
    a.addEventListener('click', (ev) => {
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      // evita comportamento padrão que pode rolar o documento em vez do container
      ev.preventDefault();

      // rola e atualiza hash sem pular
      scrollToSection(target);
      history.replaceState(null, '', `#${id}`);

      // atualiza o dock imediatamente para feedback visual
      setActiveDock(id);
    });
  });

  // Quando a hash mudar (ex.: back/forward ou link externo), atualiza o dock
  function activateFromHash() {
    const id = window.location.hash.replace('#', '');
    if (!id) {
      // fallback: marca o primeiro botão (opcional)
      const first = dockButtons[0];
      if (first && first.dataset.spy) setActiveDock(first.dataset.spy);
      return;
    }
    // se existir botão correspondente, marca; se não, não faz nada
    const btn = dockButtons.find(b => b.dataset.spy === id);
    if (btn) setActiveDock(id);
  }

  window.addEventListener('hashchange', activateFromHash, { passive: true });
  window.addEventListener('load', activateFromHash, { passive: true });

  // opcional: se você tiver lógica que muda seção por JS, chame setActiveDock(id) quando mudar
})();

