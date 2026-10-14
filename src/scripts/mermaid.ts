// Load the renderer only on pages containing Mermaid fences.
const attempts = new WeakMap<HTMLElement, string>();
let nextId = 0;
let queued = false;
let rendering = Promise.resolve();

function currentTheme(): "dark" | "default" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "default";
}

async function renderDiagrams(): Promise<void> {
  const theme = currentTheme();
  const diagrams = Array.from(
    document.querySelectorAll<HTMLElement>(".mermaid-diagram")
  ).filter(element => attempts.get(element) !== theme);
  if (!diagrams.length) return;

  const { default: mermaid } = await import("mermaid");
  await document.fonts.ready;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    htmlLabels: false,
    theme,
  });

  for (const diagram of diagrams) {
    if (!diagram.isConnected || currentTheme() !== theme) continue;
    const source = diagram.querySelector<HTMLElement>(".mermaid-source");
    if (!source) continue;
    attempts.set(diagram, theme);
    const id = `mermaid-diagram-${nextId++}`;

    try {
      const { svg } = await mermaid.render(id, source.textContent ?? "");
      if (!diagram.isConnected || currentTheme() !== theme) continue;

      const output = document.createElement("div");
      output.className = "mermaid-output";
      output.innerHTML = svg;
      diagram.querySelector(".mermaid-output")?.remove();
      diagram.append(output);
      source.hidden = true;
      diagram.querySelector(".mermaid-error")?.remove();
    } catch (error) {
      // Never leave Mermaid's temporary error SVG elsewhere in the page.
      document.getElementById(`d${id}`)?.remove();
      if (!diagram.isConnected || currentTheme() !== theme) continue;
      diagram.querySelector(".mermaid-output")?.remove();
      source.hidden = false;
      if (!diagram.querySelector(".mermaid-error")) {
        const message = document.createElement("p");
        message.className = "mermaid-error";
        message.setAttribute("role", "status");
        message.textContent = "图表渲染失败，以下为 Mermaid 源码。";
        diagram.prepend(message);
      }
      // Keep syntax diagnostics available without interrupting the article.
      // eslint-disable-next-line no-console
      console.warn("Mermaid diagram could not be rendered:", error);
    }
  }
}

// Serialize rendering: Mermaid's configuration is global, including its theme.
function scheduleRender(): void {
  if (queued) return;
  queued = true;
  rendering = rendering
    .then(async () => {
      queued = false;
      await renderDiagrams();
    })
    .catch(error => {
      // eslint-disable-next-line no-console
      console.warn("Mermaid could not be loaded:", error);
    });
}

new MutationObserver(scheduleRender).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});
document.addEventListener("astro:page-load", scheduleRender);
scheduleRender();
