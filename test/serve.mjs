// Local test server: proxies https://www.vandejong.com and swaps the Webflow
// custom code for webflow/head.html + webflow/footer.html, with the
// vdj_assets files served from this repo (dist/). Simulates the new setup.
//   npm run serve   ->  http://localhost:8787
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const ORIGIN = "https://www.vandejong.com";
const PORT = Number(process.env.PORT || 8787);
const ROOT = new URL("..", import.meta.url).pathname;
const MIN = process.env.MIN !== "0"; // MIN=0 serves the readable dist/vdj.js

const types = { ".js": "text/javascript", ".css": "text/css", ".avif": "image/avif", ".json": "application/json" };

function localAssets(html) {
  return html
    .replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/WESSELKRAMER\/vdj_assets@COMMIT\//g, "/")
    .replace("/dist/vdj.min.js", MIN ? "/dist/vdj.min.js" : "/dist/vdj.js");
}

function transform(html) {
  const head = localAssets(readFileSync(join(ROOT, "webflow/head.html"), "utf8"));
  const footer = localAssets(readFileSync(join(ROOT, "webflow/footer.html"), "utf8"));

  // 1. site-wide head code -> new head snippet
  const hs = html.indexOf("<!-- Preconnect -->");
  const he = html.indexOf("</head>");
  if (hs > -1 && he > hs) html = html.slice(0, hs) + head + html.slice(he);

  // 2. footer code (+ page-level body code after it) -> new footer snippet
  const fs = html.indexOf("<!-- Lenis JS -->");
  const fe = html.lastIndexOf("</body>");
  if (fs > -1 && fe > fs) html = html.slice(0, fs) + footer + html.slice(fe);

  // 3. what you'll set in Webflow: data-barba="container" on the page wrapper
  html = html.replace(/data-transition-container=""/, 'data-barba="container" data-transition-container=""');

  // 4. keep requests on localhost so Barba can fetch pages
  html = html.replace(/https:\/\/www\.vandejong\.com\//g, "/");
  return html;
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // repo files (dist/, animations/)
    const local = normalize(join(ROOT, url.pathname));
    if (local.startsWith(ROOT) && /^\/(dist|animations)\//.test(url.pathname) && existsSync(local)) {
      res.writeHead(200, { "content-type": types[extname(local)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(readFileSync(local));
      return;
    }

    try {
      const upstream = await fetch(ORIGIN + url.pathname + url.search, { redirect: "follow" });
      const type = upstream.headers.get("content-type") || "";
      if (type.includes("text/html")) {
        res.writeHead(upstream.status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(transform(await upstream.text()));
      } else {
        res.writeHead(upstream.status, { "content-type": type });
        res.end(Buffer.from(await upstream.arrayBuffer()));
      }
    } catch (err) {
      res.writeHead(502);
      res.end(String(err));
    }
  })
  .listen(PORT, () => console.log(`VDJ test server on http://localhost:${PORT}`));
