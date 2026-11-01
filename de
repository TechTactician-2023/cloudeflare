
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });

const encoder = new TextEncoder();

function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return base64url(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(payload)
      )
    )
  );
}

async function makeToken(secret) {
  const payload = base64url(
    encoder.encode(
      JSON.stringify({
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
      })
    )
  );

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
    for (let i = 0; i < signature.length; i++) {
      diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }

    if (diff !== 0) return false;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));

    return (
      data.role === "admin" &&
      Number.isFinite(data.exp) &&
      data.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

function validItem(body) {
  return !!body &&
    ["experiences", "projects"].includes(body.type) &&
    typeof body.title === "string" &&
    body.title.trim().length > 0 &&
    body.title.length <= 300 &&
    typeof (body.description ?? "") === "string" &&
    Array.isArray(body.bullets ?? []) &&
    Array.isArray(body.tags ?? []);
}

function normalizeItem(body) {
  return {
    type: body.type,
    title: body.title.trim(),
    subtitle: String(body.subtitle ?? "").slice(0, 300),
    date: String(body.date ?? "").slice(0, 150),
    description: String(body.description ?? "").slice(0, 10000),
    bullets: (body.bullets ?? [])
      .filter(x => typeof x === "string")
      .slice(0, 50),
    image: String(body.image ?? "").slice(0, 2000),
    tags: (body.tags ?? [])
      .filter(x => typeof x === "string")
      .slice(0, 50)
  };
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Login does not require the database binding.
  if (path === "/api/admin/login" && method === "POST") {
    if (!env.ADMIN_PASSWORD || !env.ADMIN_TOKEN_SECRET) {
      return json({
        error: "Admin login configuration is incomplete.",
        checks: {
          ADMIN_PASSWORD: !!env.ADMIN_PASSWORD,
          ADMIN_TOKEN_SECRET: !!env.ADMIN_TOKEN_SECRET
        }
      }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }

    if (
      typeof body.password !== "string" ||
      body.password.length > 1024 ||
      body.password !== env.ADMIN_PASSWORD
    ) {
      return json({ error: "Invalid admin password." }, 401);
    }

    return json({
      token: await makeToken(env.ADMIN_TOKEN_SECRET)
    });
  }

  if (!path.startsWith("/api/admin/")) {
    return json({ error: "Not found." }, 404);
  }

  if (!env.ADMIN_TOKEN_SECRET) {
    return json({ error: "Admin token configuration is incomplete." }, 500);
  }

  if (!(await validToken(request, env.ADMIN_TOKEN_SECRET))) {
    return json({ error: "Unauthorized." }, 401);
  }

  // Database is required only for content management.
  if (!env.PORTFOLIO_DB) {
    return json({
      error: "Database binding PORTFOLIO_DB is missing."
    }, 500);
  }

  const collectionPath = "/api/admin/items";

  if (path === collectionPath && method === "GET") {
    const type = url.searchParams.get("type");

    if (!["experiences", "projects"].includes(type)) {
      return json({ error: "Invalid content type." }, 400);
    }

    const result = await env.PORTFOLIO_DB.prepare(
      "SELECT id, type, data, sort_order FROM content_items WHERE type = ? ORDER BY sort_order, created_at DESC"
    ).bind(type).all();

    const items = (result.results || []).map(row => {
      try {
        return {
          ...JSON.parse(row.data),
          id: row.id,
          type: row.type
        };
      } catch {
        return { id: row.id, type: row.type };
      }
    });

    return json({ items });
  }

  if (path === collectionPath && method === "POST") {
    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }

    if (!validItem(body)) {
      return json({ error: "Invalid item data." }, 400);
    }

    const item = normalizeItem(body);
    const id = crypto.randomUUID();

    await env.PORTFOLIO_DB.prepare(
      "INSERT INTO content_items (id, type, data) VALUES (?, ?, ?)"
    ).bind(id, item.type, JSON.stringify(item)).run();

    return json({ item: { ...item, id } }, 201);
  }

  const itemMatch = path.match(
    /^\/api\/admin\/items\/([a-f0-9-]{36})$/i
  );

  if (itemMatch && method === "PUT") {
    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON." }, 400);
    }

    if (!validItem(body)) {
      return json({ error: "Invalid item data." }, 400);
    }

    const item = normalizeItem(body);

    const result = await env.PORTFOLIO_DB.prepare(
      "UPDATE content_items SET type = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(
      item.type,
      JSON.stringify(item),
      itemMatch[1]
    ).run();

    if (!result.meta?.changes) {
      return json({ error: "Item not found." }, 404);
    }

    return json({ item: { ...item, id: itemMatch[1] } });
  }

  if (itemMatch && method === "DELETE") {
    const result = await env.PORTFOLIO_DB.prepare(
      "DELETE FROM content_items WHERE id = ?"
    ).bind(itemMatch[1]).run();

    if (!result.meta?.changes) {
      return json({ error: "Item not found." }, 404);
    }

    return json({ success: true });
  }

  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (!["GET", "POST", "PUT", "DELETE"].includes(request.method)) {
      return json({ error: "Method not allowed." }, 405);
    }

    try {
      return await handleApi(request, env);
    } catch (error) {
      // Log details in Cloudflare runtime logs without exposing secrets.
      console.error("Portfolio API error:", error);

      return json({
        error: "Internal server error. Check Worker configuration and database schema."
      }, 500);
    }
  }
};
