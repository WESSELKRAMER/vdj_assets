// Build: concatenates src/ into dist/vdj.js and minifies to dist/vdj.min.js
// and dist/vdj.min.css.   Run: npm run build
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { transform } from "esbuild";

// Order matters: core first, barba (boot) last
const JS_FILES = [
  "src/core.js",
  "src/modules/text.js",
  "src/modules/globals.js",
  "src/modules/pages.js",
  "src/modules/media.js",
  "src/modules/gallery.js",
  "src/modules/home.js",
  "src/modules/about.js",
  "src/barba.js"
];

const banner = `/*! Vandejong site scripts | built ${new Date().toISOString().slice(0, 10)} */\n`;

mkdirSync("dist", { recursive: true });

const js = JS_FILES.map((f) => `/* ---- ${f} ---- */\n` + readFileSync(f, "utf8")).join("\n");
writeFileSync("dist/vdj.js", banner + js);

const minJs = await transform(js, { minify: true, target: "es2019", loader: "js" });
writeFileSync("dist/vdj.min.js", banner + minJs.code);

const css = readFileSync("src/vdj.css", "utf8");
const minCss = await transform(css, { minify: true, loader: "css" });
writeFileSync("dist/vdj.min.css", banner + minCss.code);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + " KB";
console.log(`dist/vdj.js      ${kb(js)}`);
console.log(`dist/vdj.min.js  ${kb(minJs.code)}`);
console.log(`dist/vdj.min.css ${kb(minCss.code)}`);
