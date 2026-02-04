document.addEventListener("DOMContentLoaded", () => {
  // Ano no footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Menu mobile
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const open = navMenu.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
    });

    // Fecha menu ao clicar num link
    navMenu.querySelectorAll("a").forEach(a => {
      a.addEventListener("click", () => {
        navMenu.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Frame demo behavior
  const heroSection = document.getElementById("heroSection");
  const frameSection = document.getElementById("appFrameSection");
  const frame = document.getElementById("appFrame");
  const frameTitle = document.getElementById("appFrameTitle");
  const frameStatus = document.getElementById("appFrameStatus");
  const btnClose = document.getElementById("appCloseBtn");
  const btnNewTab = document.getElementById("appOpenNewTab");
  const portfolio = document.getElementById("portfolio");
  const openButtons = document.querySelectorAll(".js-open-system");

  function setNewTab(enabled, url = "#") {
    if (!btnNewTab) return;
    btnNewTab.href = enabled ? url : "#";
    btnNewTab.setAttribute("aria-disabled", String(!enabled));
    btnNewTab.style.pointerEvents = enabled ? "auto" : "none";
    btnNewTab.style.opacity = enabled ? "1" : ".6";
  }

  function showLoading() {
    if (frameStatus) frameStatus.textContent = "Carregando…";
  }
  function showReady() {
    if (frameStatus) frameStatus.textContent = "Pronto ✅";
  }

  function openSystem(url, title) {
    if (!heroSection || !frameSection || !frame) return;

    // alterna visibilidade
    heroSection.classList.add("is-hidden");
    frameSection.classList.remove("is-hidden");

    // título + link nova aba
    if (frameTitle) frameTitle.textContent = title || "Sistema";
    setNewTab(true, url);

    // status
    showLoading();

    // carrega
    frame.src = url;

    // rola topo
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeSystem() {
    if (!heroSection || !frameSection || !frame) return;

    frame.src = "about:blank";
    frameSection.classList.add("is-hidden");
    heroSection.classList.remove("is-hidden");

    if (frameTitle) frameTitle.textContent = "—";
    if (frameStatus) frameStatus.textContent = "";
    setNewTab(false);

    // volta para portfolio
    if (portfolio) {
      portfolio.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // iframe load
  if (frame) {
    frame.addEventListener("load", () => {
      // Evita marcar "Pronto" quando está em about:blank
      try {
        if (frame.src && !frame.src.includes("about:blank")) showReady();
      } catch (_) {}
    });
  }

  // wire buttons
  openButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-url");
      const title = btn.getAttribute("data-title");
      if (url) openSystem(url, title);
    });
  });

  if (btnClose) btnClose.addEventListener("click", closeSystem);

  // ESC fecha
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && frameSection && !frameSection.classList.contains("is-hidden")) {
      closeSystem();
    }
  });

  // estado inicial
  setNewTab(false);
});
