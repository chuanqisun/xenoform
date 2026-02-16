#!/usr/bin/env node
import markdownIt from "markdown-it";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const docsDir = resolve(rootDir, "docs");
const outDir = resolve(rootDir, "dist/docs");
const cssSource = resolve(rootDir, "node_modules/github-markdown-css/github-markdown.css");

mkdirSync(outDir, { recursive: true });
rmSync(join(outDir, "index.html"), { force: true });

// Copy the CSS file into the output directory
copyFileSync(cssSource, join(outDir, "github-markdown.css"));

const md = markdownIt({ html: true, linkify: true, typographer: true });

const mdFiles = readdirSync(docsDir).filter((f) => f.endsWith(".md"));

function htmlPage(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Xenoform</title>
  <link rel="stylesheet" href="github-markdown.css">
  <style>
    body {
      box-sizing: border-box;
      min-width: 200px;
      max-width: 980px;
      margin: 0 auto;
      padding: 45px;
      background-color: #0d1117;
      color: #e6edf3;
    }
    @media (max-width: 767px) {
      body { padding: 15px; }
    }
  </style>
</head>
<body class="markdown-body">
${body}
</body>
</html>`;
}

// Convert each markdown file to HTML
for (const file of mdFiles) {
  const src = readFileSync(join(docsDir, file), "utf-8");
  const rendered = md.render(src);
  const name = basename(file, ".md");
  const title = name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  writeFileSync(join(outDir, `${name}.html`), htmlPage(title, rendered));
  console.log(`  docs/${file} -> dist/docs/${name}.html`);
}

console.log(`Built ${mdFiles.length} doc pages`);
