// main.js — reescrito
document.addEventListener("DOMContentLoaded", () => {
  /* -------------------------
     Helpers e elementos DOM
     ------------------------- */
  const yearEl = document.getElementById("year");
  const container = document.querySelector(".wrap.spa") || document.getElementById("app");
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

  // estado
  let savedScrollTop = 0;
  let isLocked = false;

  /* -------------------------
     Ano no footer
     ------------------------- */
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* -------------------------
     Utilitários de UI
     ------------------------- */
  function setNewTab(enabled, url = "#") {
    if (!btnNewTab) return;
    btnNewTab.href = enabled ? url : "#";
    btnNewTab.setAttribute("aria-disabled", String(!enabled));
    btnNewTab.style.pointerEvents = enabled ? "auto" : "none";
    btnNewTab.style.opacity = enabled ? "1" : ".6";
  }

  function showLoading() { if (frameStatus) frameStatus.textContent = "Carregando…"; }
  function showReady() { if (frameStatus) frameStatus.textContent = "Pronto ✅"; }

  function lockScroll() {
    if (container) savedScrollTop = container.scrollTop;
    document.body.classList.add("scroll-locked");
    if (container) container.classList.add("scroll-locked");
    isLocked = true;
  }

  function unlockScroll() {
    document.body.classList.remove("scroll-locked");
    if (container) container.classList.remove("scroll-locked");
    // restaura posição com pequeno delay para evitar "jump"
    setTimeout(() => {
      if (container) container.scrollTop = savedScrollTop || 0;
      isLocked = false;
    }, 60);
  }

  function scrollToTop() {
    if (!container) return;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToEl(el) {
    if (!el || !container) return;
    const top = el.offsetTop;
    container.scrollTo({ top, behavior: "smooth" });
  }

  /* -------------------------
     Abrir / fechar demo (iframe)
     ------------------------- */
  function openSystem(url, title) {
    if (!heroSection || !frameSection || !frame) return;
    heroSection.classList.add("is-hidden");
    frameSection.classList.remove("is-hidden");
    if (frameTitle) frameTitle.textContent = title || "Sistema";
    setNewTab(true, url);
    showLoading();
    lockScroll();
    frame.src = url;
    scrollToTop();
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
    // volta para portfólio (se existir)
    if (portfolio) scrollToEl(portfolio);
  }

  if (frame) {
    frame.addEventListener("load", () => {
      try {
        if (frame.src && !frame.src.includes("about:blank")) showReady();
      } catch (_) {}
    });
  }

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
    if (e.key === "Escape" && frameSection && !frameSection.classList.contains("is-hidden")) {
      closeSystem();
    }
  });

  /* -------------------------
     Forçar layout empilhado (header acima, cards abaixo)
     - corrige casos onde CSS externo força row
     - aplica classes e estilos inline seguros
     ------------------------- */
  function enforceStackLayout() {
    // 1) header das seções (title + lead) — força coluna
    document.querySelectorAll(".section-head").forEach(head => {
      head.style.display = "flex";
      head.style.flexDirection = "column";
      head.style.alignItems = head.classList.contains("center") ? "center" : "flex-start";
      head.style.textAlign = head.classList.contains("center") ? "center" : "left";
      head.style.gap = "12px";
      head.style.marginBottom = "18px";
    });

    // 2) garante que cards e projects fiquem abaixo do header
    document.querySelectorAll(".cards-2, .projects").forEach(grid => {
      grid.style.clear = "both";
      grid.style.width = "100%";
      // usa grid responsivo: se for um grid com 2 colunas, deixa, mas força quebra em telas pequenas
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(260px, 1fr))";
      grid.style.gap = "16px";
      grid.style.marginTop = "8px";
    });

    // 3) força empilhamento dentro de cada project/card (thumb acima, body abaixo)
    document.querySelectorAll(".project, .card").forEach(card => {
      card.style.display = "block";
      card.style.boxSizing = "border-box";
      // thumb e body: garantir largura 100%
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

  // aplica no load e resize
  enforceStackLayout();
  window.addEventListener("resize", () => {
    // reaplica com debounce simples
    clearTimeout(window.__enforceStackLayoutTimer);
    window.__enforceStackLayoutTimer = setTimeout(enforceStackLayout, 120);
  });

  /* -------------------------
     Dock spy com IntersectionObserver
     ------------------------- */
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
    }, { root: container, rootMargin: "-35% 0px -55% 0px", threshold: [0.10, 0.20, 0.35] });

    spySections.forEach(s => io.observe(s));
  }

  setNewTab(false);

  // dock click navigation
  spyButtons.forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const targetId = btn.getAttribute("data-spy");
      const targetEl = document.getElementById(targetId);
      scrollToEl(targetEl);
    });
  });

  /* -------------------------
     Scroll snap + "força" detection (wheel + touch)
     - permite pular para próxima seção quando o usuário rolar com força
     ------------------------- */
  (function enableSectionScroller() {
    if (!container) return;
    const pages = Array.from(document.querySelectorAll(".page"));
    if (!pages.length) return;

    let locked = false;
    const lockDuration = 600;
    const wheelThreshold = 90; // ajuste: maior = precisa de mais força
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function currentIndex() {
      const top = container.scrollTop;
      let best = 0, bestDiff = Infinity;
      pages.forEach((p, i) => {
        const diff = Math.abs(p.offsetTop - top);
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      });
      return best;
    }

    function goTo(index) {
      index = Math.max(0, Math.min(pages.length - 1, index));
      locked = true;
      pages[index].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setTimeout(() => { locked = false; }, lockDuration);
    }

    function onWheel(e) {
      if (reduceMotion) return;
      if (locked) return;
      const delta = e.deltaY;
      if (Math.abs(delta) < wheelThreshold) return;
      e.preventDefault();
      const idx = currentIndex();
      if (delta > 0) goTo(idx + 1);
      else goTo(idx - 1);
    }

    // touch swipe
    let touchStartY = 0, touchStartTime = 0;
    function onTouchStart(e) {
      if (!e.touches || !e.touches.length) return;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
    function onTouchEnd(e) {
      if (reduceMotion) return;
      if (locked) return;
      const touchEndY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : 0;
      const dy = touchStartY - touchEndY;
      const dt = Date.now() - touchStartTime;
      if (Math.abs(dy) < 40) return;
      const idx = currentIndex();
      if (dy > 0) goTo(idx + 1);
      else goTo(idx - 1);
    }

    // keyboard
    function onKey(e) {
      if (locked) return;
      const idx = currentIndex();
      if (e.key === 'PageDown' || e.key === 'ArrowDown') { e.preventDefault(); goTo(idx + 1); }
      else if (e.key === 'PageUp' || e.key === 'ArrowUp') { e.preventDefault(); goTo(idx - 1); }
      else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
      else if (e.key === 'End') { e.preventDefault(); goTo(pages.length - 1); }
    }

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKey, { passive: false });

    // garante snap inicial
    window.addEventListener('load', () => {
      const idx = currentIndex();
      pages[idx].scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  })();

  /* -------------------------
     Final
     ------------------------- */
  // reaplica layout após pequenos delays (algumas regras CSS podem carregar depois)
  setTimeout(enforceStackLayout, 120);
  setTimeout(enforceStackLayout, 600);
});
