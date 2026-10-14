import assert from "node:assert/strict";
import { test } from "node:test";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import remarkMermaid from "../src/utils/remarkMermaid.js";

const processor = await createMarkdownProcessor({
  remarkPlugins: [remarkMermaid],
});

const fence = (source, language = "mermaid") =>
  `\`\`\`${language}\n${source}\n\`\`\``;

test("Mermaid fences become readable sources, not Shiki blocks", async () => {
  const { code } = await processor.render(fence("flowchart LR\nA --> B"));
  assert.equal(
    code,
    '<div class="mermaid-diagram not-prose"><pre class="mermaid-source">flowchart LR\nA --> B</pre></div>'
  );
});

test("diagram labels are text, never injected HTML", async () => {
  const source = 'flowchart LR\nA["<script>alert(1)</script> & 中文"]';
  const { code } = await processor.render(fence(source));
  assert.ok(code.includes("&#x3C;script>"));
  assert.ok(code.includes("&#x26; 中文"));
  assert.ok(!code.includes("<script>"));
});

test("ordinary code fences still use Shiki", async () => {
  const { code } = await processor.render(fence("const value = 1;", "js"));
  assert.ok(code.includes('class="astro-code'));
  assert.ok(!code.includes("mermaid-diagram"));
});

test("nested and multiple Mermaid fences are all transformed", async () => {
  const content = `> ${fence("graph TD\nA --> B").replaceAll("\n", "\n> ")}\n\n${fence("sequenceDiagram\nA->>B: Hello")}`;
  const { code } = await processor.render(content);
  assert.equal(
    (code.match(/class="mermaid-diagram not-prose"/g) ?? []).length,
    2
  );
  assert.ok(code.includes('<blockquote>\n<div class="mermaid-diagram'));
});

test("invalid Mermaid remains readable instead of failing the build", async () => {
  const { code } = await processor.render(fence("this is not a diagram"));
  assert.ok(code.includes("this is not a diagram</pre>"));
});
