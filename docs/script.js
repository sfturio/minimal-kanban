const THEME_KEY = "kanban.theme.v1";

const themeToggleButton = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const themeLabel = document.getElementById("theme-label");

initTheme();
setupCopyButtons();
setupActiveSectionNav();

themeToggleButton?.addEventListener("click", toggleTheme);

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(stored === "light" ? "light" : "dark");
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");

  if (themeIcon) themeIcon.textContent = isDark ? "dark_mode" : "light_mode";
  if (themeLabel) themeLabel.textContent = isDark ? "Dark" : "Light";
  if (themeToggleButton) themeToggleButton.setAttribute("aria-pressed", String(isDark));
}

function setupCopyButtons() {
  const codeBlocks = document.querySelectorAll(".doc-card pre > code");
  codeBlocks.forEach((code) => {
    const pre = code.parentElement;
    if (!pre || pre.parentElement?.classList.contains("code-wrap")) return;

    const wrap = document.createElement("div");
    wrap.className = "code-wrap";
    pre.parentElement.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-btn";
    button.textContent = "Copy";

    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent || "");
        const old = button.textContent;
        button.textContent = "Copied";
        setTimeout(() => {
          button.textContent = old;
        }, 1200);
      } catch {
        const old = button.textContent;
        button.textContent = "Error";
        setTimeout(() => {
          button.textContent = old;
        }, 1200);
      }
    });

    wrap.appendChild(button);
  });
}

function setupActiveSectionNav() {
  const links = Array.from(document.querySelectorAll('.doc-nav a[href^="#"]'));
  const topTarget = document.getElementById("top");
  const topLink = links.find((link) => link.getAttribute("href") === "#top");
  const sections = links
    .filter((link) => link.getAttribute("href") !== "#top")
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  if (topTarget && topLink) {
    const topObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          links.forEach((l) => l.classList.remove("active"));
          topLink.classList.add("active");
        }
      },
      { rootMargin: "-5% 0px -85% 0px", threshold: 0 },
    );

    topObserver.observe(topTarget);
  }

  if (sections.length === 0) return;

  const byId = new Map(links.map((link) => [link.getAttribute("href")?.slice(1), link]));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        const link = byId.get(id);
        if (!link) return;
        if (entry.isIntersecting) {
          links.forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
        }
      });
    },
    { rootMargin: "-35% 0px -55% 0px", threshold: 0 },
  );

  sections.forEach((section) => observer.observe(section));
}
