document.addEventListener("DOMContentLoaded", () => {
  // Ano no footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // SPA scroller
  const scroller = document.getElementById("app");

  // Demo elements
  const heroSection = document.getElementById("heroSection");
  const frameSection = document.getElementById("appFrameSection");
  const frame = document.getElementById("appFrame");
  const frameTitle = document.getElementById("appFrameTitle");
  const frameStatus = document.getElementById("appFrameStatus");
  const btnClose = document.getElementById("appCloseBtn");
  const btnNewTab = document.getElementById("appOpenNewTab");
  const portfolio = document.getElementById("portfolio");
  const openButtons = document.querySelectorAll(".js-open-system");

  // Dock spy
  const spyButtons = document.querySelectorAll(".dock-btn[data-spy]");
  const spySections = [
    document.getElementById("heroSection"),
    document.getElementById("sobre"),
    document.getElementById("portfolio"),
    document.getElementById("contato"),
  ].filter(Boolean);

  // Estado para restaurar scroll
  let savedScrollTop = 0;

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
    // salva posição do scroller e trava
    if (scroller) savedScrollTop = scroller.scrollTop;

    document.body.classList.add("scroll-locked");
    if (scroller) scroller.classList.add("scroll-locked");
  }

  function unlockScroll() {
    document.body.classList.remove("scroll-locked");
    if (scroller) scroller.classList.remove("scroll-locked");
  }

  function scrollToTop() {
    if (scroller) scroller.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToEl(el) {
    if (!el || !scroller) return;
    // rola dentro do scroller, respeitando o layout
    const top = el.offsetTop;
    scroller.scrollTo({ top, behavior: "smooth" });
  }

  function openSystem(url, title) {
    if (!heroSection || !frameSection || !frame) return;

    // troca telas
    heroSection.classList.add("is-hidden");
    frameSection.classList.remove("is-hidden");

    if (frameTitle) frameTitle.textContent = title || "Sistema";
    setNewTab(true, url);
    showLoading();

    // trava scroll do SPA
    lockScroll();

    // carrega
    frame.src = url;

    // vai pro topo (inicio)
    scrollToTop();
  }

  function closeSystem() {
    if (!heroSection || !frameSection || !frame) return;

    // para o iframe
    frame.src = "about:blank";
    frameSection.classList.add("is-hidden");
    heroSection.classList.remove("is-hidden");

    if (frameTitle) frameTitle.textContent = "—";
    if (frameStatus) frameStatus.textContent = "";
    setNewTab(false);

    // libera scroll
    unlockScroll();

    // volta para portfólio
    scrollToEl(portfolio);
  }

  // iframe load => pronto
  if (frame) {
    frame.addEventListener("load", () => {
      try {
        if (frame.src && !frame.src.includes("about:blank")) showReady();
      } catch (_) {}
    });
  }

  // Abrir demo
  openButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-url");
      const title = btn.getAttribute("data-title");
      if (url) openSystem(url, title);
    });
  });

  // Fechar demo
  if (btnClose) btnClose.addEventListener("click", closeSystem);

  // ESC fecha
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && frameSection && !frameSection.classList.contains("is-hidden")) {
      closeSystem();
    }
  });

  // ===== Dock Spy com IntersectionObserver (mais estável com seções 100vh) =====
  const io = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(en => en.isIntersecting)
      .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;
    const id = visible.target.id;

    spyButtons.forEach(b => {
      b.classList.toggle("is-active", b.getAttribute("data-spy") === id);
    });
  }, { root: scroller, rootMargin: "-35% 0px -55% 0px", threshold: [0.10, 0.20, 0.35] });

  spySections.forEach(s => io.observe(s));

  setNewTab(false);

  // ===== Navegação do dock usando scroll interno do scroller =====
  spyButtons.forEach(btn => {
    btn.addEventListener("click", (ev) => {
      // evita comportamento padrão (window)
      ev.preventDefault();
      const targetId = btn.getAttribute("data-spy");
      const targetEl = document.getElementById(targetId);
      scrollToEl(targetEl);
    });
  });
});
