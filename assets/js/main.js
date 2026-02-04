// main.js — navegação por clique (dock) e rolagem dentro de cada .page sem trocar de seção
// - rolagem interna por .page
// - evita vazamento de wheel/touch que trocaria de seção
// - navegação por clique no dock e links com hash
// - gerencia abertura/fechamento de demo em iframe com lock de scroll
// - sincroniza estado ativo do dock via âncoras (determinístico)
// - bloqueia teclas de navegação apenas quando não estiver em campo de formulário

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

  // Dock element (helper)
  const dock = document.querySelector('.dock');

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

  // --- lock / unlock scroll (quando iframe abre) com preservação do overflow anterior
  let savedOverflow = null;
  let savedScrollTop = 0;
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

  // rolar para elemento (robusto para container rolável ou document)
  // headerOffset: ajuste se houver header fixo (px)
  function scrollToEl(el, behavior = 'smooth', headerOffset = 0) {
    if (!el || !container) return;
    if (container === document.documentElement || container === document.body) {
      const top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
      window.scrollTo({ top, behavior });
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const targetRect = el.getBoundingClientRect();
    const top = targetRect.top - containerRect.top + container.scrollTop - headerOffset;
    container.scrollTo({ top, behavior });
  }

  // --- Dock helpers: esconder/mostrar e setActive ---
  function setActiveDock(id) {
    spyButtons.forEach(btn => btn.classList.toggle('is-active', String(btn.getAttribute('data-spy')) === String(id)));
  }

  function setDockHidden(hidden) {
    if (!dock) return;
    if (hidden) {
      dock.classList.add('dock-hidden');
      dock.setAttribute('aria-hidden', 'true');
      if ('inert' in HTMLElement.prototype) {
        dock.inert = true;
      } else {
        dock.querySelectorAll('a, button').forEach(el => {
          el.dataset._savedTabindex = el.getAttribute('tabindex') ?? '';
          el.setAttribute('tabindex', '-1');
        });
      }
    } else {
      dock.classList.remove('dock-hidden');
      dock.removeAttribute('aria-hidden');
      if ('inert' in HTMLElement.prototype) {
        dock.inert = false;
      } else {
        dock.querySelectorAll('a, button').forEach(el => {
          const saved = el.dataset._savedTabindex;
          if (saved === '') el.removeAttribute('tabindex');
          else if (saved != null) el.setAttribute('tabindex', saved);
          delete el.dataset._savedTabindex;
        });
      }
    }
  }

  // abrir / fechar demo (iframe) — integrado com dock hide/show e lock scroll
  function openSystem(url, title) {
    if (!heroSection || !frameSection || !frame) return;
    heroSection.classList.add("is-hidden");
    frameSection.classList.remove("is-hidden");
    if (frameTitle) frameTitle.textContent = title || "Sistema";
    setNewTab(true, url);
    showLoading();
    lockScroll();
    frame.src = url;
    // esconde dock e limpa active
    setDockHidden(true);
    spyButtons.forEach(b => b.classList.remove('is-active'));
    // garante que o frameSection fique visível
    scrollToEl(frameSection);
    // foco no botão fechar para acessibilidade
    setTimeout(() => { if (btnClose) btnClose.focus(); }, 120);
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
    // restaura active para a seção correspondente ao hash atual ou para o primeiro botão
    const currentHash = window.location.hash.replace('#', '');
    if (currentHash) {
      const btn = spyButtons.find(b => b.dataset.spy === currentHash);
      if (btn) setActiveDock(currentHash);
      else setActiveDock(spyButtons[0] && spyButtons[0].dataset.spy);
    } else {
      setActiveDock(spyButtons[0] && spyButtons[0].dataset.spy);
    }
    // rola para portfolio (opcional)
    if (portfolio) scrollToEl(portfolio);
    // restaura foco para botão ativo do dock
    const activeBtn = dock ? dock.querySelector('.dock-btn.is-active') : null;
    if (activeBtn) activeBtn.focus();
  }

  // frame load status
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

  if (btnClose) btnClose.addEventListener("click", (ev) => { ev.preventDefault(); closeSystem(); });

  // ESC fecha iframe se aberto
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && frameSection && !frameSection.classList.contains("is-hidden")) {
      closeSystem();
    }
  });

  // === Navegação por clique no dock ===
  spyButtons.forEach(btn => {
    // remove handler duplicado se existir (idempotência)
    if (btn.__dockHandler) btn.removeEventListener('click', btn.__dockHandler);
    const handler = (ev) => {
      ev.preventDefault();
      const targetId = btn.getAttribute('data-spy');
      const targetEl = document.getElementById(targetId);
      if (targetEl) scrollToEl(targetEl);
      if (targetId) history.replaceState(null, "", `#${targetId}`);
      setActiveDock(targetId);
    };
    btn.addEventListener('click', handler);
    btn.__dockHandler = handler;
  });

  // === Anchor + Dock sync (single consolidated handler) ===
  (function anchorDockSync() {
    const anchorLinks = Array.from(document.querySelectorAll('a[href^="#"]'));
    // idempotência
    if (anchorLinks.__anchorsBound) return;
    anchorLinks.__anchorsBound = true;

    function findDockButton(id) {
      return spyButtons.find(b => String(b.dataset.spy) === String(id));
    }

    function handleAnchorClick(ev, href) {
      if (ev) ev.preventDefault();
      if (!href || !href.startsWith('#')) return;
      const id = href.slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      scrollToEl(target);
      history.replaceState(null, '', `#${id}`);
      const btn = findDockButton(id);
      if (btn) setActiveDock(id);
    }

    anchorLinks.forEach(a => {
      if (a.__anchorHandler) a.removeEventListener('click', a.__anchorHandler);
      const handler = (ev) => handleAnchorClick(ev, a.getAttribute('href'));
      a.addEventListener('click', handler);
      a.__anchorHandler = handler;
    });

    // on load / hashchange: set active dock based on hash (or fallback to first)
    function activateFromHashOrDefault() {
      const id = window.location.hash.replace('#', '');
      if (id) {
        const target = document.getElementById(id);
        if (target) {
          const btn = findDockButton(id);
          if (btn) setActiveDock(id);
          return;
        }
      }
      if (spyButtons.length) setActiveDock(spyButtons[0].dataset.spy);
    }

    window.addEventListener('load', activateFromHashOrDefault, { passive: true });
    window.addEventListener('hashchange', activateFromHashOrDefault, { passive: true });

    // expõe utilitário se necessário
    window.__setActiveDock = setActiveDock;
  })();

  // === Teclas de navegação: bloqueia apenas se não estiver em campo de formulário ===
  window.addEventListener("keydown", (e) => {
    const blocked = ["PageDown","PageUp","ArrowDown","ArrowUp","Home","End"];
    if (!blocked.includes(e.key)) return;
    const active = document.activeElement;
    const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
    if (!isInput) {
      e.preventDefault();
    }
  }, { passive: false });

  // === Interceptadores de wheel / touch (capture) para evitar que eventos dentro de uma .page
  // sejam entregues a outros handlers que poderiam trocar de seção.
  function findPageAncestor(el) {
    while (el && el !== document && el !== container) {
      if (el.classList && el.classList.contains('page')) {
        if (el.scrollHeight > el.clientHeight + 1) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  // WHEEL (desktop)
  // Se pretende prevenir scroll do container quando fora de .page, use passive: false e preventDefault.
  (container || document).addEventListener('wheel', function (e) {
    const page = findPageAncestor(e.target);
    if (!page) {
      // evento fora de uma .page rolável: evita que o container role (opcional)
      // e.preventDefault(); // descomente se quiser bloquear totalmente
      return;
    }
    // dentro de .page: evita que o evento "vaze" para handlers externos
    e.stopPropagation();
  }, { passive: true, capture: true });

  // TOUCH (mobile)
  let touchStartY = 0;
  (container || document).addEventListener('touchstart', function (e) {
    if (e.touches && e.touches.length) touchStartY = e.touches[0].clientY;
  }, { passive: true, capture: true });

  (container || document).addEventListener('touchmove', function (e) {
    const touch = (e.touches && e.touches[0]) || null;
    if (!touch) return;
    const page = findPageAncestor(e.target);
    if (!page) {
      // swipe fora de uma .page: evita que o container mude section (opcional)
      // e.preventDefault(); // descomente se quiser bloquear totalmente
      return;
    }
    e.stopPropagation();
  }, { passive: true, capture: true });

  // === Enforce layout fallback (aplica apenas quando necessário) ===
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
  let enforceTimer = null;
  function scheduleEnforceStackLayout() {
    clearTimeout(enforceTimer);
    enforceTimer = setTimeout(enforceStackLayout, 120);
  }
  enforceStackLayout();
  window.addEventListener("resize", scheduleEnforceStackLayout);
  setTimeout(enforceStackLayout, 120);
  setTimeout(enforceStackLayout, 600);

  // keyboard focus class for dock buttons (mantém comportamento existente)
  document.querySelectorAll('.dock-btn').forEach(btn => {
    btn.addEventListener('focus', () => btn.classList.add('keyboard-focus'));
    btn.addEventListener('blur', () => btn.classList.remove('keyboard-focus'));
    btn.addEventListener('touchstart', () => btn.classList.add('touched'));
    btn.addEventListener('touchend', () => setTimeout(() => btn.classList.remove('touched'), 800));
  });

  // scroll to hash target on load / hashchange (mantém comportamento para links diretos)
  function scrollToHashTarget() {
    const hash = window.location.hash;
    if (!hash) return;
    const target = document.querySelector(hash);
    if (!target) return;
    scrollToEl(target, 'auto');
  }
  window.addEventListener('load', scrollToHashTarget);
  window.addEventListener('hashchange', scrollToHashTarget);

}); // end DOMContentLoaded
