#!/usr/bin/env node
// يصدّر نسخ PNG من ملفات SVG في assets/brand — اختياري، يحتاج Playwright:
//   node tools/render_brand_png.js
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BRAND = path.join(__dirname, "..", "assets", "brand");
const OUT = path.join(BRAND, "png");

// [ملف المصدر, ملف الناتج, العرض بالبكسل]
const JOBS = [
  ["deem-logo.svg", "png/deem-logo.png", 1600],
  ["deem-logo-white.svg", "png/deem-logo-white.png", 1600],
  ["deem-logo-stacked.svg", "png/deem-logo-stacked.png", 1000],
  ["deem-logo-stacked-white.svg", "png/deem-logo-stacked-white.png", 1000],
  ["deem-wordmark.svg", "png/deem-wordmark.png", 1000],
  ["deem-wordmark-white.svg", "png/deem-wordmark-white.png", 1000],
  ["deem-avatar.svg", "png/deem-avatar.png", 1024],
  ["deem-avatar-ink.svg", "png/deem-avatar-ink.png", 1024],
  ["deem-icon.svg", "png/deem-icon-512.png", 512],
  ["deem-icon-square.svg", "apple-touch-icon.png", 180],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [src, dst, width] of JOBS) {
    const svg = fs.readFileSync(path.join(BRAND, src), "utf8");
    const [, , , w, h] = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/).map(Number);
    const height = Math.round((width * h) / w);
    await page.setViewportSize({ width, height });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}img{display:block;width:${width}px;height:${height}px}</style>` +
        `<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}">`
    );
    await page.waitForFunction(() => document.images[0].complete);
    await page.screenshot({ path: path.join(BRAND, dst), omitBackground: true, clip: { x: 0, y: 0, width, height } });
    console.log(dst, `${width}x${height}`);
  }
  await browser.close();
})();
