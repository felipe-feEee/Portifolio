document.addEventListener("DOMContentLoaded", () => {
  // Ano no footer
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Frame demo
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

  function showLoading() { if (frameStatus) frameStatus.textContent = "Carregando…"; }
  function showReady() { if (frameStatus) frameStatus.textContent = "Pronto ✅"; }

  function openSystem(url, title) {
    if (!heroSection || !frameSection || !frame) return;

    heroSection.classList.add("is-hidden");
    frameSection.classList.remove("is-hidden");

    if (frameTitle) frameTitle.textContent = title || "Sistema";
    setNewTab(true, url);
    showLoading();

    frame.src = url;

    // rola para o topo
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

    if (portfolio) portfolio.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // iframe load -> status "Pronto"
  if (frame) {
    frame.addEventListener("load", () => {
      try {
        if (frame.src && !frame.src.includes("about:blank")) showReady();
      } catch (_) {}
    });
  }

  openButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-url");
      const title = btn.getAttribute("data-title");
      if (url) openSystem(url, title);
    });
  });

  if (btnClose) btnClose.addEventListener("click", closeSystem);

  // ESC fecha demo
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && frameSection && !frameSection.classList.contains("is-hidden")) {
      closeSystem();
    }
  });

  // Dock active spy (marca seção atual como ativa)
  const spyButtons = document.querySelectorAll(".dock-btn[data-spy]");
  const sections = ["top","sobre","portfolio","contato"]
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const io = new IntersectionObserver((entries) => {
    const visible = entries.filter(en => en.isIntersecting).sort((a,b)=> b.intersectionRatio-a.intersectionRatio)[0];
    if (!visible) return;
    const id = visible.target.id;

    spyButtons.forEach(b => b.classList.toggle("is-active", b.getAttribute("data-spy") === id));
  }, { rootMargin: "-40% 0px -55% 0px", threshold: [0.05, 0.15, 0.25] });

  sections.forEach(s => io.observe(s));

  setNewTab(false);
});
