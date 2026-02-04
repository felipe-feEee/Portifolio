// main.js — versão reescrita e consolidada
// Funcionalidades:
// - atualiza ano no footer
// - abre/fecha demo em iframe com lock de scroll
// - dock spy com IntersectionObserver
// - força layout empilhado (header acima, cards abaixo) como fallback
// - scroll-snap por seção com detecção de "força" (acumulação) e sensibilidade ajustável
// - suporte a touch (swipe), teclado e prefers-reduced-motion

document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Configurações ajustáveis
     ========================= */
  const SCROLL_LOCK_CLASS = "scroll-locked";
  const SNAP_LOCK_DURATION = 800; // ms que bloqueia novos saltos após snap
  const WHEEL_ACCUM_WINDOW = 220; // ms para acumular deltaY
  const WHEEL_REQUIRED_ACC = 420; // px acumulados necessários para disparar
  const WHEEL_SINGLE_THRESHOLD = 320; // px: pico único que dispara imediatamente
  const TOUCH_MIN_DISTANCE = 120; // px: swipe mínimo para mobile
  const TOUCH_MAX_TIME = 450; // ms: swipe deve ser relativamente rápido

  /* =========================
     Elementos DOM
     ========================= */
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

  /* =========================
     Inicializações simples
     ========================= */
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  setNewTab(false);

  /* =========================
     Utilitários UI
     ========================= */
  function setNewTab(enabled, url = "#") {
    if (!btnNewTab) return;
    btnNewTab.href = enabled ? url : "#";
    btnNewTab.setAttribute("aria-disabled", String(!enabled));
    btnNewTab.style.pointerEvents = enabled ? "auto" : "none";
    btnNewTab.style.opacity = enabled ? "1" : ".6";
  }

  function showLoading() { if (frameStatus) frameStatus.textContent = "Carregando…"; }
  function showReady() { if (frameStatus) frameStatus.textContent = "Pronto ✅"; }

  /* =========================
     Scroll lock (quando iframe abre)
     ========================= */
  let savedScrollTop = 0;
  function lockScroll() {
    if (container) savedScrollTop = container.scrollTop;
    document.body.classList.add(SCROLL_LOCK_CLASS);
    if (container) container.classList.add(SCROLL_LOCK_CLASS);
  }
  function unlockScroll() {
    document.body.classList.remove(SCROLL_LOCK_CLASS);
    if (container) container.classList.remove(SCROLL_LOCK_CLASS);
    // restaura posição com pequeno delay para evitar "jump"
    setTimeout(() => {
      if (container) container.scrollTop = savedScrollTop || 0;
    }, 60);
  }

  /* =========================
     Rolagem dentro do container SPA
     ========================= */
  function scrollToTop() {
    if (!container) return;
    container.scrollTo({ top: 0, behavior: "smooth" });
  }
  function scrollToEl(el) {
    if (!el || !container) return;
    const top = el.offsetTop;
    container.scrollTo({ top, behavior: "smooth" });
  }

  /* =========================
     Abrir / fechar demo (iframe)
     ========================= */
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

  /* =========================
     Forçar layout empilhado (fallback JS)
     - aplica estilos inline seguros para garantir header em coluna
     - usado como correção rápida quando CSS externo conflita
     ========================= */
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

  /* =========================
     Dock spy (IntersectionObserver)
     ========================= */
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

  spyButtons.forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const targetId = btn.getAttribute("data-spy");
      const targetEl = document.getElementById(targetId);
      scrollToEl(targetEl);
    });
  });

  /* =========================
     Scroll snap + "força" detection (acumulação)
     - menos sensível: exige acumulação de deltaY
     - evita pular múltiplas seções por evento
     ========================= */
  (function enableSectionScroller() {
    if (!container) return;
    const pages = Array.from(document.querySelectorAll(".page"));
    if (!pages.length) return;

    let locked = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // acumulação
    let acc = 0;
    let accTimer = null;
    let lastTrigger = 0;

    function resetAcc() {
      acc = 0;
      if (accTimer) { clearTimeout(accTimer); accTimer = null; }
    }

    function scheduleAccReset() {
      if (accTimer) clearTimeout(accTimer);
      accTimer = setTimeout(() => { acc = 0; accTimer = null; }, WHEEL_ACCUM_WINDOW);
    }

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
      setTimeout(() => { locked = false; }, SNAP_LOCK_DURATION);
    }

    function onWheel(e) {
      if (reduceMotion) return;
      if (locked) return;

      const delta = e.deltaY || 0;
      if (!delta) return;

      const now = Date.now();

      // pico único muito grande dispara imediatamente
      if (Math.abs(delta) >= WHEEL_SINGLE_THRESHOLD) {
        e.preventDefault();
        const idx = currentIndex();
        if (delta > 0) goTo(idx + 1);
        else goTo(idx - 1);
        resetAcc();
        lastTrigger = now;
        return;
      }

      // acumula
      acc += delta;
      scheduleAccReset();

      // só dispara se acumulado ultrapassar limiar e não disparou recentemente
      if (Math.abs(acc) >= WHEEL_REQUIRED_ACC && (now - lastTrigger) > 120) {
        e.preventDefault();
        const idx = currentIndex();
        if (acc > 0) goTo(idx + 1);
        else goTo(idx - 1);
        resetAcc();
        lastTrigger = now;
      }
    }

    // touch swipe (mobile)
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
      if (Math.abs(dy) < TOUCH_MIN_DISTANCE) return;
      if (dt > TOUCH_MAX_TIME && Math.abs(dy) < TOUCH_MIN_DISTANCE * 1.5) return;
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

    // snap inicial
    window.addEventListener('load', () => {
      const idx = currentIndex();
      pages[idx].scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  })();

  /* =========================
     Reaplica correções finais
     ========================= */
  setTimeout(enforceStackLayout, 120);
  setTimeout(enforceStackLayout, 600);
});
