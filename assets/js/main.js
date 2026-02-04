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
  let savedScrollTop = 0;
  function lockScroll() {
    // salva posição e aplica classe para CSS controlar comportamento
    if (container && container.scrollTop !== undefined) savedScrollTop = container.scrollTop;
    document.body.classList.add(SCROLL_LOCK_CLASS);
    if (container && container.classList) container.classList.add(SCROLL_LOCK_CLASS);
    // também impede rolagem do container por segurança (se desejar)
    if (container && container.style) container.style.overflow = "hidden";
  }
  function unlockScroll() {
    document.body.classList.remove(SCROLL_LOCK_CLASS);
    if (container && container.classList) container.classList.remove(SCROLL_LOCK_CLASS);
    if (container && container.style) container.style.overflow = "";
    // restaura posição
    setTimeout(() => {
      if (container && typeof savedScrollTop === "number") {
        try { container.scrollTop = savedScrollTop || 0; } catch (_) {}
      }
    }, 60);
  }

  // rolar para elemento (usado pelo dock e links)
  function scrollToEl(el) {
    if (!el || !container) return;
    // se container for o documentElement, usa scrollIntoView
    if (container === document.documentElement || container === document.body) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // caso container seja um elemento com overflow, calcula offset relativo
    const top = el.offsetTop;
    container.scrollTo({ top, behavior: "smooth" });
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
    // garante que o frameSection fique visível
    scrollToEl(frameSection);
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
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (ev) => {
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (!target) return;
      ev.preventDefault();
      scrollToEl(target);
      history.replaceState(null, '', href);
    });
  });

  // IntersectionObserver para marcar botão ativo no dock
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
  }

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
