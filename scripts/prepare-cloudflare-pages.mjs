#!/usr/bin/env node
import { access, copyFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const distDir = resolveRoot("dist");
const redirectsSource = resolveRoot("public/_redirects.txt");
const redirectsTarget = resolveRoot("dist/_redirects");
const legacySitemapSource = resolveRoot("public/legacy-sitemap.xml.txt");
const legacySitemapTarget = resolveRoot("dist/legacy-sitemap.xml");

await assertExists(
  distDir,
  "Run astro build before preparing Cloudflare Pages assets."
);
await assertExists(
  redirectsSource,
  "Missing Cloudflare Pages redirects source."
);
await assertExists(legacySitemapSource, "Missing legacy sitemap source.");
await copyFile(redirectsSource, redirectsTarget);
await copyFile(legacySitemapSource, legacySitemapTarget);

console.log(
  "prepared Cloudflare Pages assets: dist/_redirects, dist/legacy-sitemap.xml"
);

async function assertExists(file, message) {
  try {
    await access(file);
  } catch {
    throw new Error(message);
  }
}

function resolveRoot(relPath) {
  const resolved = path.resolve(root, relPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes repository root: ${relPath}`);
  }
  return resolved;
}
