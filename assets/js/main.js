// main.js — navegação por menu apenas (scroll desativado entre sections)
// Funcionalidades:
// - atualiza ano no footer
// - abre/fecha demo em iframe com lock de scroll
// - dock navigation (clique apenas) para navegar entre sections
// - previne scroll/touch/wheel que mudaria a seção
// - IntersectionObserver para marcar botão ativo no dock
// - enforceStackLayout como fallback para garantir header acima e cards abaixo

document.addEventListener("DOMContentLoaded", () => {
  // Config
  const SCROLL_LOCK_CLASS = "scroll-locked";

  // DOM
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

  // Inicializações simples
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  setNewTab(false);

  // Utilitários
  function setNewTab(enabled, url = "#") {
    if (!btnNewTab) return;
    btnNewTab.href = enabled ? url : "#";
    btnNewTab.setAttribute("aria-disabled", String(!enabled));
    btnNewTab.style.pointerEvents = enabled ? "auto" : "none";
    btnNewTab.style.opacity = enabled ? "1" : ".6";
  }
  function showLoading() { if (frameStatus) frameStatus.textContent = "Carregando…"; }
  function showReady() { if (frameStatus) frameStatus.textContent = "Pronto ✅"; }

  // Lock / unlock scroll (quando iframe abre)
  let savedScrollTop = 0;
  function lockScroll() {
    if (container) savedScrollTop = container.scrollTop;
    document.body.classList.add(SCROLL_LOCK_CLASS);
    if (container) container.classList.add(SCROLL_LOCK_CLASS);
  }
  function unlockScroll() {
    document.body.classList.remove(SCROLL_LOCK_CLASS);
    if (container) container.classList.remove(SCROLL_LOCK_CLASS);
    setTimeout(() => {
      if (container) container.scrollTop = savedScrollTop || 0;
    }, 60);
  }

  // Navegação por clique (dock)
  function scrollToEl(el) {
    if (!el || !container) return;
    // usa scrollIntoView para garantir alinhamento; comportamento suave
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Abrir / fechar demo (iframe)
  function openSystem(url, title) {
    if (!heroSection || !frameSection || !frame) return;
    heroSection.classList.add("is-hidden");
    frameSection.classList.remove("is-hidden");
    if (frameTitle) frameTitle.textContent = title || "Sistema";
    setNewTab(true, url);
    showLoading();
    lockScroll();
    frame.src = url;
    // garante que o frame fique visível
    if (frameSection) frameSection.scrollIntoView({ behavior: "smooth", block: "start" });
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
    // ESC continua fechando o iframe
    if (e.key === "Escape" && frameSection && !frameSection.classList.contains("is-hidden")) {
      closeSystem();
    }
  });

  // === Desativa navegação por scroll/touch/teclado entre sections ===
  // 1) Bloqueia rolagem do container (impede mudança de seção por scroll)
  if (container) {
    container.style.overflowY = "hidden";
    // previne wheel/touchmove que poderiam afetar o scroll em alguns navegadores
    container.addEventListener("wheel", (e) => { e.preventDefault(); }, { passive: false });
    container.addEventListener("touchmove", (e) => { e.preventDefault(); }, { passive: false });
  }
  // 2) Remove/ignora teclas de navegação que mudariam a seção
  window.addEventListener("keydown", (e) => {
    const blocked = ["PageDown","PageUp","ArrowDown","ArrowUp","Home","End"];
    if (blocked.includes(e.key)) {
      // se o usuário estiver dentro de um campo de formulário, não bloquear
      const active = document.activeElement;
      const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (!isInput) e.preventDefault();
    }
  }, { passive: false });

  // === Dock: clique para navegar (único meio de mudar section) ===
  spyButtons.forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const targetId = btn.getAttribute("data-spy");
      const targetEl = document.getElementById(targetId);
      if (targetEl) scrollToEl(targetEl);
    });
  });

  // IntersectionObserver para marcar botão ativo no dock (continua útil)
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

  // === Forçar layout empilhado (header acima, cards abaixo) como fallback JS ===
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

  // reaplica correções finais após carregamento
  setTimeout(enforceStackLayout, 120);
  setTimeout(enforceStackLayout, 600);
});

// garante que o item receba classe 'keyboard-focus' quando focado por teclado
document.querySelectorAll('.dock-btn').forEach(btn => {
  btn.addEventListener('focus', () => btn.classList.add('keyboard-focus'));
  btn.addEventListener('blur', () => btn.classList.remove('keyboard-focus'));
  // opcional: abrir label ao tocar (mobile)
  btn.addEventListener('touchstart', () => btn.classList.add('touched'));
  btn.addEventListener('touchend', () => setTimeout(() => btn.classList.remove('touched'), 800));
});

