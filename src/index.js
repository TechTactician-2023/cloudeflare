const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });

const encoder = new TextEncoder();
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const HTML_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: https:; media-src 'self' https: blob:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' https://static.cloudflareinsights.com; upgrade-insecure-requests"
};
function applyHtmlSecurityHeaders(headers) {
  for (const [name, value] of Object.entries(HTML_SECURITY_HEADERS)) headers.set(name, value);
  return headers;
}

const MEDIA_TYPES = {
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "image/avif": { ext: "avif", kind: "image" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
  "video/ogg": { ext: "ogv", kind: "video" }
};

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

async function makeToken(secret) {
  const payload = base64url(encoder.encode(JSON.stringify({
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
  })));
  return `${payload}.${await sign(payload, secret)}`;
}

async function validToken(request, secret) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer ([A-Za-z0-9_.-]+)$/);
  if (!match) return false;
  const parts = match[1].split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  try {
    const expected = await sign(payload, secret);
    if (signature.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff !== 0) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    return data.role === "admin" && Number.isFinite(data.exp) && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function validMediaUrl(value, kind) {
  if (typeof value !== "string" || !value.trim()) return true;
  const v = value.trim();
  if (/(^|\/)\.\.(?:\/|$)/.test(v) || v.includes("\\")) return false;
  if (/^\/media\/[a-z0-9-]+\.(jpg|png|webp|gif|avif)$/i.test(v) && kind === "image") return true;
  if (/^\/media\/[a-z0-9-]+\.(mp4|webm|ogv|ogg)$/i.test(v) && kind === "video") return true;
  if (/^https:\/\//i.test(v)) return true;
  if (kind === "image" && /^(\/?\.?\/?assets\/images\/)[a-z0-9_./-]+\.(jpe?g|png|webp|gif|avif)$/i.test(v)) return true;
  if (kind === "video" && /^(\/?\.?\/?assets\/videos\/)[a-z0-9_./-]+\.(mp4|m4v|webm|ogv|ogg)$/i.test(v)) return true;
  return false;
}

function validItem(body) {
  return !!body && ["experiences", "projects"].includes(body.type) &&
    typeof body.title === "string" && body.title.trim().length > 0 && body.title.length <= 300 &&
    typeof (body.description ?? "") === "string" && Array.isArray(body.bullets ?? []) &&
    Array.isArray(body.tags ?? []) && validMediaUrl(body.image ?? "", "image") &&
    validMediaUrl(body.video ?? "", "video");
}

function normalizeItem(body) {
  return {
    type: body.type,
    title: body.title.trim(),
    subtitle: String(body.subtitle ?? "").slice(0, 300),
    date: String(body.date ?? "").slice(0, 150),
    description: String(body.description ?? "").slice(0, 10000),
    bullets: (body.bullets ?? []).filter(x => typeof x === "string").slice(0, 50).map(x => x.slice(0, 1000)),
    image: String(body.image ?? "").trim().slice(0, 2000),
    video: String(body.video ?? "").trim().slice(0, 2000),
    tags: (body.tags ?? []).filter(x => typeof x === "string").slice(0, 50).map(x => x.slice(0, 100))
  };
}

function sniffMime(bytes, claimedMime) {
  const b = new Uint8Array(bytes);
  const ascii = (start, end) => String.fromCharCode(...b.slice(start, end));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (b.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "image/gif";
  if (b.length >= 12 && ascii(4, 8) === "ftyp") {
    const brands = ascii(8, Math.min(b.length, 64));
    if (brands.includes("avif") || brands.includes("avis")) return "image/avif";
    return "video/mp4";
  }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (b.length >= 4 && ascii(0, 4) === "OggS") return "video/ogg";
  return null;
}

async function serveMedia(request, env, key) {
  if (!env.PORTFOLIO_DB) return new Response("Media storage is not configured.", { status: 503 });
  if (!key || key.includes("..") || key.includes("/") || !/^[a-z0-9-]+\.(jpg|png|webp|gif|avif|mp4|webm|ogv|ogg)$/.test(key)) return new Response("Not found.", { status: 404 });
  const meta = await env.PORTFOLIO_DB.prepare("SELECT size, content_type FROM media_files WHERE key = ?").bind(key).first();
  if (!meta) return new Response("Not found.", { status: 404 });
  const size = Number(meta.size);
  const rangeHeader = request.headers.get("Range");
  let start = 0, end = size - 1, partial = false;
  if (rangeHeader) {
    const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (!match[1]) { const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix <= 0) return new Response(null, { status: 416 }); start = Math.max(0, size - suffix); }
    else { start = Number(match[1]); if (match[2]) end = Math.min(size - 1, Number(match[2])); }
    if (!Number.isSafeInteger(start) || start < 0 || start >= size || end < start) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } });
    partial = true;
  }
  end = Math.min(end, size - 1);
  const chunkSize = 256 * 1024;
  const firstChunk = Math.floor(start / chunkSize), lastChunk = Math.floor(end / chunkSize);
  const result = await env.PORTFOLIO_DB.prepare("SELECT chunk_index, data FROM media_chunks WHERE file_key = ? AND chunk_index BETWEEN ? AND ? ORDER BY chunk_index")
    .bind(key, firstChunk, lastChunk).all();
  const rows = result.results || [];
  const output = new Uint8Array(end - start + 1);
  let written = 0;
  for (let i = firstChunk; i <= lastChunk; i++) {
    const row = rows.find(r => Number(r.chunk_index) === i);
    if (!row || !row.data) return new Response("Media file is incomplete.", { status: 500 });
    const chunk = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : new Uint8Array(row.data.buffer || row.data, row.data.byteOffset || 0, row.data.byteLength || row.data.length);
    const from = i === firstChunk ? start % chunkSize : 0;
    const to = i === lastChunk ? ((end % chunkSize) + 1) : chunk.length;
    const piece = chunk.subarray(from, to); output.set(piece, written); written += piece.length;
  }
  const headers = new Headers({ "Content-Type": meta.content_type || "application/octet-stream", "Content-Length": String(output.byteLength), "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline", "Cross-Origin-Resource-Policy": "same-origin" });
  if (partial) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  return new Response(request.method === "HEAD" ? null : output, { status: partial ? 206 : 200, headers });
}

const SEO_PAGES = {
  "/": { key: "about", title: "About | Mahmood Sahebi", description: "Network Engineer experienced in ISP operations, wireless infrastructure, monitoring, and automation." },
  "/index.html": { key: "about", title: "About | Mahmood Sahebi", description: "Network Engineer experienced in ISP operations, wireless infrastructure, monitoring, and automation." },
  "/contact.html": { key: "index", title: "Contact | Mahmood Sahebi — Network Engineer", description: "Contact Mahmood Sahebi, Network Engineer specializing in ISP networks, wireless infrastructure, and automation." },
  "/about.html": { key: "about", title: "About | Mahmood Sahebi", description: "Network Engineer experienced in ISP operations, wireless infrastructure, monitoring, and automation." },
  "/expertise.html": { key: "expertise", title: "Expertise | Mahmood Sahebi", description: "Network, wireless, monitoring, troubleshooting, and automation expertise." },
  "/experience.html": { key: "experience", title: "Experience | Mahmood Sahebi", description: "Professional experience in network engineering, wireless management, ISP operations, and customer service." },
  "/projects.html": { key: "projects", title: "Projects | Mahmood Sahebi", description: "Selected network engineering, ISP infrastructure, and automation projects." }
};
const SEO_DEFAULTS = Object.fromEntries(Object.entries(SEO_PAGES).map(([path, value]) => [value.key, {
  title: value.title, description: value.description, canonical: "", ogTitle: "", ogDescription: "", ogImage: "", indexable: true
}]));
const htmlEscape = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function normalizeSeo(input) {
  const result = {};
  for (const [page, defaults] of Object.entries(SEO_DEFAULTS)) {
    const value = input && typeof input[page] === "object" && !Array.isArray(input[page]) ? input[page] : {};
    const canonical = String(value.canonical ?? "").trim().slice(0, 1000);
    const ogImage = String(value.ogImage ?? "").trim().slice(0, 1000);
    result[page] = {
      title: String(value.title ?? defaults.title).trim().slice(0, 180) || defaults.title,
      description: String(value.description ?? defaults.description).trim().slice(0, 320) || defaults.description,
      canonical: /^https:\/\//i.test(canonical) ? canonical : "",
      ogTitle: String(value.ogTitle ?? "").trim().slice(0, 180),
      ogDescription: String(value.ogDescription ?? "").trim().slice(0, 320),
      ogImage: (/^https:\/\//i.test(ogImage) || /^\/(?!\/)[a-z0-9_./-]+\.(?:png|jpe?g|webp|gif)$/i.test(ogImage)) ? ogImage : "",
      indexable: value.indexable !== false
    };
  }
  return result;
}
async function readSeo(env) {
  if (!env.PORTFOLIO_DB) return normalizeSeo({});
  const row = await env.PORTFOLIO_DB.prepare("SELECT value FROM site_settings WHERE key = 'seo'").first();
  try { return normalizeSeo(row ? JSON.parse(row.value) : {}); } catch { return normalizeSeo({}); }
}
function setMeta(html, name, content, property = false) {
  const attr = property ? "property" : "name";
  const tag = `<meta ${attr}="${name}" content="${htmlEscape(content)}">`;
  const existing = [...html.matchAll(/<meta\s+(name|property)=["']([^"']+)["'][^>]*>/gi)]
    .find(match => match[1].toLowerCase() === attr && match[2].toLowerCase() === name.toLowerCase());
  if (existing) return html.replace(existing[0], tag);
  return html.replace(/<\/head>/i, `  ${tag}\n</head>`);
}
async function serveSeoPage(request, env) {
  const url = new URL(request.url);
  const page = SEO_PAGES[url.pathname];
  const response = await env.ASSETS.fetch(request);
  const headers = applyHtmlSecurityHeaders(new Headers(response.headers));
  const isHtml = /text\/html/i.test(response.headers.get("content-type") || "");

  // The admin page and unknown HTML requests still receive the same security and no-stale-cache policy,
  // but only known public pages get SEO metadata rewritten.
  if (!response.ok || !isHtml) {
    if (isHtml) headers.set("Cache-Control", "no-store");
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  let html = await response.text();
  if (page) {
    const settings = (await readSeo(env))[page.key];
    const title = settings.title || page.title;
    const description = settings.description || page.description;
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${htmlEscape(title)}</title>`);
    html = setMeta(html, "description", description);
    html = setMeta(html, "robots", settings.indexable ? "index, follow" : "noindex, nofollow");
    html = setMeta(html, "og:type", "website", true);
    html = setMeta(html, "og:title", settings.ogTitle || title, true);
    html = setMeta(html, "og:description", settings.ogDescription || description, true);
    const canonicalCandidate = settings.canonical;
    let canonical = new URL(page.key === "index" ? "/" : url.pathname, url.origin).href;
    try { if (canonicalCandidate && new URL(canonicalCandidate).origin === url.origin) canonical = new URL(canonicalCandidate).href; } catch {}
    html = setMeta(html, "og:url", canonical, true);
    html = setMeta(html, "twitter:card", settings.ogImage ? "summary_large_image" : "summary");
    html = setMeta(html, "twitter:title", settings.ogTitle || title);
    html = setMeta(html, "twitter:description", settings.ogDescription || description);
    if (settings.ogImage) html = setMeta(html, "twitter:image", /^https:\/\//i.test(settings.ogImage) ? settings.ogImage : new URL(settings.ogImage, url.origin).href);
    if (settings.ogImage) html = setMeta(html, "og:image", /^https:\/\//i.test(settings.ogImage) ? settings.ogImage : new URL(settings.ogImage, url.origin).href, true);
    const canonicalTag = `<link rel="canonical" href="${htmlEscape(canonical)}">`;
    const canonicalMatch = html.match(/<link\s+rel=["']canonical["'][^>]*>/i);
    html = canonicalMatch ? html.replace(canonicalMatch[0], canonicalTag) : html.replace(/<\/head>/i, `  ${canonicalTag}\n</head>`);
  }
  headers.set("Cache-Control", "no-store");
  headers.delete("Content-Length");
  return new Response(request.method === "HEAD" ? null : html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
async function serveRobots(url, method = "GET") {
  const sitemap = `${url.origin}/sitemap.xml`;
  const lines = ["User-agent: *", "Allow: /", "Disallow: /api/", `Sitemap: ${sitemap}`, ""];
  return new Response(method === "HEAD" ? null : lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}
async function serveSitemap(url, env, method = "GET") {
  const seo = await readSeo(env);
  const entries = Object.entries(SEO_PAGES).filter(([path, page]) => path !== "/index.html" && seo[page.key]?.indexable);
  const unique = new Map();
  for (const [path, page] of entries) {
    let loc = new URL(path, url.origin).href;
    try { const candidate = seo[page.key]?.canonical; if (candidate && new URL(candidate).origin === url.origin) loc = new URL(candidate).href; } catch {}
    if (!unique.has(loc)) unique.set(loc, true);
  }
  const xmlEscape = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...unique.keys()].map(loc => `  <url><loc>${xmlEscape(loc)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(method === "HEAD" ? null : body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === "/api/content" && method === "GET") {
    if (!env.PORTFOLIO_DB) return json({ error: "Database binding PORTFOLIO_DB is missing." }, 503);
    const type = url.searchParams.get("type");
    if (type === "about") {
      const row = await env.PORTFOLIO_DB.prepare("SELECT value FROM site_settings WHERE key = 'about'").first();
      let about = {};
      try { about = row ? JSON.parse(row.value) : {}; } catch {}
      return json({ about }, 200, { "Cache-Control": "no-store" });
    }
    if (!["experiences", "projects"].includes(type)) return json({ error: "Invalid content type." }, 400);
    const result = await env.PORTFOLIO_DB.prepare(
      "SELECT id, type, data, sort_order, status, publish_at FROM content_items WHERE type = ? AND (status = 'published' OR (status = 'scheduled' AND publish_at IS NOT NULL AND datetime(publish_at) <= CURRENT_TIMESTAMP)) ORDER BY sort_order ASC, created_at DESC"
    ).bind(type).all();
    const items = (result.results || []).flatMap(row => {
      try { return [{ ...JSON.parse(row.data), id: row.id, type: row.type, status: row.status || 'published', publishAt: row.publish_at || null }]; } catch { return []; }
    });
    return json({ items }, 200, { "Cache-Control": "no-store" });
  }

  if (path === "/api/admin/login" && method === "POST") {
    if (!env.ADMIN_PASSWORD || !env.ADMIN_TOKEN_SECRET) {
      return json({ error: "Admin login configuration is incomplete.", checks: {
        ADMIN_PASSWORD: !!env.ADMIN_PASSWORD, ADMIN_TOKEN_SECRET: !!env.ADMIN_TOKEN_SECRET
      } }, 500);
    }
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
    if (!body || typeof body.password !== "string" || body.password.length > 1024 || body.password !== env.ADMIN_PASSWORD) {
      return json({ error: "Invalid admin password." }, 401);
    }
    return json({ token: await makeToken(env.ADMIN_TOKEN_SECRET) });
  }

  if (!path.startsWith("/api/admin/")) return json({ error: "Not found." }, 404);
  if (!env.ADMIN_TOKEN_SECRET) return json({ error: "Admin token configuration is incomplete." }, 500);
  if (!(await validToken(request, env.ADMIN_TOKEN_SECRET))) return json({ error: "Unauthorized." }, 401);
  if (!env.PORTFOLIO_DB) return json({ error: "Database binding PORTFOLIO_DB is missing." }, 503);

  const collectionPath = "/api/admin/items";

  if (path === "/api/admin/seo" && method === "GET") {
    return json({ seo: await readSeo(env), pages: Object.keys(SEO_DEFAULTS) });
  }
  if (path === "/api/admin/seo" && method === "PUT") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || !body.seo || typeof body.seo !== "object" || Array.isArray(body.seo)) return json({ error: "Invalid SEO settings." }, 400);
    const seo = normalizeSeo(body.seo);
    await env.PORTFOLIO_DB.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('seo', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP")
      .bind(JSON.stringify(seo)).run();
    return json({ seo, success: true });
  }

  if (path === "/api/admin/about" && method === "GET") {
    const row = await env.PORTFOLIO_DB.prepare("SELECT value FROM site_settings WHERE key = 'about'").first();
    let about = {};
    try { about = row ? JSON.parse(row.value) : {}; } catch {}
    return json({ about });
  }
  if (path === "/api/admin/about" && method === "PUT") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid About settings." }, 400);
    const image = String(body.image ?? "").trim().slice(0, 2000);
    const video = String(body.video ?? "").trim().slice(0, 2000);
    if (!validMediaUrl(image, "image") || !validMediaUrl(video, "video")) return json({ error: "Invalid About media URL." }, 400);
    const existingRow = await env.PORTFOLIO_DB.prepare("SELECT value FROM site_settings WHERE key = 'about'").first();
    let existingAbout = {}; try { existingAbout = existingRow ? JSON.parse(existingRow.value) : {}; } catch {}
    const defaults = [
      { title: "Wireless installations", caption: "Point-to-point links, access-point installation, alignment, and signal checks.", video: "", poster: "" },
      { title: "Network troubleshooting", caption: "Field diagnostics to identify faults and restore customer connectivity.", video: "", poster: "" },
      { title: "Network monitoring", caption: "Tracking device availability, link stability, and overall network health.", video: "", poster: "" },
      { title: "Automation in practice", caption: "Repeatable configuration changes and device management with Ansible.", video: "", poster: "" }
    ];
    const submittedSlots = Array.isArray(body.videoSlots) ? body.videoSlots.slice(0, 4) : (Array.isArray(existingAbout.videoSlots) ? existingAbout.videoSlots : []);
    const videoSlots = defaults.map((fallback, index) => {
      const slot = submittedSlots[index] && typeof submittedSlots[index] === "object" && !Array.isArray(submittedSlots[index]) ? submittedSlots[index] : {};
      return {
        title: String(slot.title ?? fallback.title).trim().slice(0, 160) || fallback.title,
        caption: String(slot.caption ?? fallback.caption).trim().slice(0, 300) || fallback.caption,
        video: String(slot.video ?? "").trim().slice(0, 2000),
        poster: String(slot.poster ?? "").trim().slice(0, 2000)
      };
    });
    if (videoSlots.some(slot => !validMediaUrl(slot.video, "video"))) return json({ error: "Invalid video URL in one of the four About video slots." }, 400);
    if (videoSlots.some(slot => !validMediaUrl(slot.poster, "image"))) return json({ error: "Invalid poster image URL in one of the four About video slots." }, 400);
    const about = { image, video, videoSlots, updatedAt: new Date().toISOString() };
    await env.PORTFOLIO_DB.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('about', ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP")
      .bind(JSON.stringify(about)).run();
    return json({ about, success: true });
  }

  if (path === "/api/admin/media" && method === "GET") {
    const used = new Set();
    const contentRows = await env.PORTFOLIO_DB.prepare("SELECT data FROM content_items").all();
    for (const row of (contentRows.results || [])) { try { const d = JSON.parse(row.data); for (const v of [d.image, d.video]) { const m = String(v || "").match(/^\/media\/([a-z0-9-]+\.(?:jpg|png|webp|gif|avif|mp4|webm|ogv|ogg))$/i); if (m) used.add(m[1]); } } catch {} }
    const aboutRow = await env.PORTFOLIO_DB.prepare("SELECT value FROM site_settings WHERE key = 'about'").first();
    try { const a = aboutRow ? JSON.parse(aboutRow.value) : {}; for (const v of [a.image, a.video, ...(Array.isArray(a.videoSlots) ? a.videoSlots.flatMap(x => x ? [x.video, x.poster] : []) : [])]) { const m = String(v || "").match(/^\/media\/([a-z0-9-]+\.(?:jpg|png|webp|gif|avif|mp4|webm|ogv|ogg))$/i); if (m) used.add(m[1]); } } catch {}
    const listing = await env.PORTFOLIO_DB.prepare("SELECT key, size, content_type, original_name, created_at FROM media_files ORDER BY created_at DESC LIMIT 200").all();
    const media = (listing.results || []).map(o => ({ key: o.key, url: `/media/${o.key}`, size: Number(o.size), uploaded: o.created_at || null, contentType: o.content_type, kind: String(o.content_type).startsWith("video/") ? "video" : "image", originalName: o.original_name || o.key, inUse: used.has(o.key) }));
    return json({ media, cursor: null, truncated: false });
  }

  const mediaMatch = path.match(/^\/api\/admin\/media\/([a-z0-9-]+\.(?:jpg|png|webp|gif|avif|mp4|webm|ogv|ogg))$/i);
  if (mediaMatch && method === "DELETE") {
    const key = mediaMatch[1];
    const contentRows = await env.PORTFOLIO_DB.prepare("SELECT data FROM content_items").all();
    for (const row of (contentRows.results || [])) { try { const d = JSON.parse(row.data); if ([d.image, d.video].includes(`/media/${key}`)) return json({ error: "This file is used by a project or work experience. Remove it there first." }, 409); } catch {} }
    const aboutRow = await env.PORTFOLIO_DB.prepare("SELECT value FROM site_settings WHERE key = 'about'").first();
    try { const a = aboutRow ? JSON.parse(aboutRow.value) : {}; if ([a.image, a.video, ...(Array.isArray(a.videoSlots) ? a.videoSlots.flatMap(x => x ? [x.video, x.poster] : []) : [])].includes(`/media/${key}`)) return json({ error: "This file is used in About. Remove it from About first." }, 409); } catch {}
    await env.PORTFOLIO_DB.prepare("DELETE FROM media_chunks WHERE file_key = ?").bind(key).run();
    await env.PORTFOLIO_DB.prepare("DELETE FROM media_files WHERE key = ?").bind(key).run();
    return json({ success: true });
  }

  if (path === collectionPath && method === "GET") {
    const type = url.searchParams.get("type");
    if (!["experiences", "projects"].includes(type)) return json({ error: "Invalid content type." }, 400);
    const result = await env.PORTFOLIO_DB.prepare(
      "SELECT id, type, data, sort_order, status, publish_at FROM content_items WHERE type = ? ORDER BY sort_order ASC, created_at DESC"
    ).bind(type).all();
    const items = (result.results || []).flatMap(row => {
      try { return [{ ...JSON.parse(row.data), id: row.id, type: row.type }]; } catch { return []; }
    });
    return json({ items });
  }

  if (path === "/api/admin/media" && method === "POST") {
    let form;
    try { form = await request.formData(); } catch { return json({ error: "Invalid multipart upload." }, 400); }
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Select an image or video file." }, 400);
    const declaredMime = String(file.type || "").toLowerCase();
    const extMime = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
      mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", ogv: "video/ogg", ogg: "video/ogg"
    };
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const expectedMime = MEDIA_TYPES[declaredMime] ? declaredMime : extMime[ext];
    const max = expectedMime?.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (!expectedMime || !MEDIA_TYPES[expectedMime]) return json({ error: "Unsupported format. Images: JPG, PNG, WebP, GIF, AVIF. Videos: MP4/M4V, WebM, OGV/OGG." }, 415);
    if (file.size <= 0 || file.size > max) return json({ error: `File too large. Maximum size is ${max / 1024 / 1024} MB for this file type.` }, 413);
    const bytes = await file.arrayBuffer();
    const actualMime = sniffMime(bytes, expectedMime);
    if (!actualMime || actualMime !== expectedMime) return json({ error: "File content does not match its format. Re-export the file and try again." }, 415);
    const info = MEDIA_TYPES[actualMime];
    const key = `${crypto.randomUUID()}.${info.ext}`;
    try {
      await env.PORTFOLIO_DB.prepare("INSERT INTO media_files (key, size, content_type, original_name) VALUES (?, ?, ?, ?)")
        .bind(key, file.size, actualMime, file.name.slice(0, 150)).run();
      const chunkSize = 256 * 1024;
      const statements = [];
      for (let offset = 0, index = 0; offset < bytes.byteLength; offset += chunkSize, index++) {
        const chunk = bytes.slice(offset, Math.min(bytes.byteLength, offset + chunkSize));
        statements.push(env.PORTFOLIO_DB.prepare("INSERT INTO media_chunks (file_key, chunk_index, data) VALUES (?, ?, ?)").bind(key, index, chunk));
      }
      for (let i = 0; i < statements.length; i += 4) await env.PORTFOLIO_DB.batch(statements.slice(i, i + 4));
    } catch (error) {
      console.error("D1 media upload failed:", error);
      await env.PORTFOLIO_DB.prepare("DELETE FROM media_chunks WHERE file_key = ?").bind(key).run().catch(() => {});
      await env.PORTFOLIO_DB.prepare("DELETE FROM media_files WHERE key = ?").bind(key).run().catch(() => {});
      return json({ error: "Upload failed while saving media to D1. Check that migration 0003_media_storage.sql has been applied and the database has enough storage." }, 502);
    }
    return json({ key, url: `/media/${key}`, mimeType: actualMime, kind: info.kind, size: file.size }, 201);
  }

  if (path === collectionPath && method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
    if (!validItem(body)) return json({ error: "Invalid item data or unsupported media URL." }, 400);
    const item = normalizeItem(body);
    const status = body.status === "draft" ? "draft" : "published";
    const publishAt = typeof body.publishAt === "string" && body.publishAt.trim() ? body.publishAt.trim().slice(0, 32) : null;
    const finalStatus = publishAt && new Date(publishAt).getTime() > Date.now() ? "scheduled" : status;
    const id = crypto.randomUUID();
    await env.PORTFOLIO_DB.prepare("INSERT INTO content_items (id, type, data, status, publish_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, item.type, JSON.stringify(item), finalStatus, publishAt).run();
    return json({ item: { ...item, id, status: finalStatus, publishAt } }, 201);
  }

  const itemMatch = path.match(/^\/api\/admin\/items\/([a-f0-9-]{36})$/i);
  if (itemMatch && method === "PUT") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
    if (!validItem(body)) return json({ error: "Invalid item data or unsupported media URL." }, 400);
    const item = normalizeItem(body);
    const status = body.status === "draft" ? "draft" : "published";
    const publishAt = typeof body.publishAt === "string" && body.publishAt.trim() ? body.publishAt.trim().slice(0, 32) : null;
    const finalStatus = publishAt && new Date(publishAt).getTime() > Date.now() ? "scheduled" : status;
    const result = await env.PORTFOLIO_DB.prepare(
      "UPDATE content_items SET type = ?, data = ?, status = ?, publish_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(item.type, JSON.stringify(item), finalStatus, publishAt, itemMatch[1]).run();
    if (!result.meta?.changes) return json({ error: "Item not found." }, 404);
    return json({ item: { ...item, id: itemMatch[1], status: finalStatus, publishAt } });
  }
  if (itemMatch && method === "DELETE") {
    const result = await env.PORTFOLIO_DB.prepare("DELETE FROM content_items WHERE id = ?").bind(itemMatch[1]).run();
    if (!result.meta?.changes) return json({ error: "Item not found." }, 404);
    return json({ success: true });
  }
  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/media/")) {
      if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed.", { status: 405 });
      return serveMedia(request, env, url.pathname.slice("/media/".length));
    }
    if (url.pathname === "/robots.txt" && ["GET", "HEAD"].includes(request.method)) return serveRobots(url, request.method);
    if (url.pathname === "/sitemap.xml" && ["GET", "HEAD"].includes(request.method)) return serveSitemap(url, env, request.method);
    if (!url.pathname.startsWith("/api/")) {
      if (!["GET", "HEAD"].includes(request.method)) return env.ASSETS.fetch(request);
      return serveSeoPage(request, env);
    }
    if (!["GET", "POST", "PUT", "DELETE"].includes(request.method)) return json({ error: "Method not allowed." }, 405, { Allow: "GET, POST, PUT, DELETE" });
    try {
      return await handleApi(request, env);
    } catch (error) {
      console.error("Portfolio API error:", error);
      return json({ error: "Internal server error. Check Worker logs and database/bucket configuration." }, 500);
    }
  }
};
