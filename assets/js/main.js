document.addEventListener("DOMContentLoaded", () => {
  // Ano no footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Viewer elements
  const viewer = document.querySelector(".viewer");
  const viewerTitle = document.getElementById("viewerTitle");
  const viewerFrame = document.getElementById("viewerFrame");
  const openNewTab = document.getElementById("openNewTab");
  const closeViewer = document.getElementById("closeViewer");

  const topAnchor = document.getElementById("top");          // <main id="top" ...>
  const portfolioSection = document.getElementById("portfolio");

  const buttons = document.querySelectorAll(".js-open-in-hero");

  function setViewerEnabled(enabled) {
    if (!openNewTab || !closeViewer) return;
    openNewTab.setAttribute("aria-disabled", String(!enabled));
    openNewTab.style.pointerEvents = enabled ? "auto" : "none";
    openNewTab.style.opacity = enabled ? "1" : ".6";
    closeViewer.disabled = !enabled;
  }

  function scrollToTop() {
    // rolar para o topo da página (início)
    // Preferimos scrollIntoView no #top para manter consistência
    if (topAnchor) {
      topAnchor.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", "#top");
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function scrollToPortfolio() {
    if (portfolioSection) {
      portfolioSection.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", "#portfolio");
    }
  }

  function openInViewer(url, title) {
    if (!viewer || !viewerFrame || !viewerTitle || !openNewTab) return;

    // 1) rola para o topo
    scrollToTop();

    // 2) atualiza UI
    viewerTitle.textContent = title || "Sistema";
    viewer.classList.add("is-active");

