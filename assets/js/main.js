document.addEventListener("DOMContentLoaded", () => {
  // Ano no footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Elementos principais
  const heroSection = document.getElementById("heroSection");
  const frameSection = document.getElementById("appFrameSection");
  const frame = document.getElementById("appFrame");
  const frameTitle = document.getElementById("appFrameTitle");
  const btnClose = document.getElementById("appCloseBtn");
  const btnNewTab = document.getElementById("appOpenNewTab");
  const portfolio = document.getElementById("portfolio");

  // Botões do portfólio
  const openButtons = document.querySelectorAll(".js-open-system");

  function setNewTabEnabled(enabled, url = "#") {
    if (!btnNewTab) return;
    btnNewTab.href = enabled ? url : "#";
    btnNewTab.setAttribute("aria-disabled", String(!enabled));
    btnNewTab.style.pointerEvents = enabled ? "auto" : "none";
    btnNewTab.style.opacity = enabled ? "1" : ".6";
  }

  function openSystem(url, title) {
    if (!heroSection || !frameSection || !frame) return;

    // 1) alterna visibilidade
    heroSection.classList.add("is-hidden");
    frameSection.classList.remove("is-hidden");

    // 2) atualiza título + nova aba
    if (frameTitle) frameTitle.textContent = title || "Sistema";
    setNewTabEnabled(true, url);

    // 3) carrega o sistema
    frame.src = url;

    // 4) rola para o topo
    window.scrollTo({ top: 0, behavior: "smooth" });
    history.pushState(null, "", "#top");
  }

  function closeSystem() {
    if (!heroSection || !frameSection || !frame) return;

    // 1) para o sistema e esconde o frame
    frame.src = "about:blank";
    frameSection.classList.add("is-hidden");

    // 2) mostra o hero novamente
    heroSection.classList.remove("is-hidden");

    // 3) desabilita nova aba e reseta título
    if (frameTitle) frameTitle.textContent = "—";
    setNewTabEnabled(false);

    // 4) rola para o portfólio
    if (portfolio) {
      portfolio.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", "#portfolio");
    }
  }

  // Wire: abrir sistema
  openButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-url");
      const title = btn.getAttribute("data-title");
      if (url) openSystem(url, title);
    });
  });

  // Wire: fechar
  if (btnClose) btnClose.addEventListener("click", closeSystem);

  // Estado inicial: frame escondido e Nova aba desabilitado
  setNewTabEnabled(false);

  // (Opcional) fechar com ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && frameSection && !frameSection.classList.contains("is-hidden")) {
      closeSystem();
    }
  });
});
