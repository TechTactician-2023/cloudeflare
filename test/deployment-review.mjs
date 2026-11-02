import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const wrangler = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
const headers = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
const pages = ['index.html','about.html','contact.html','experience.html','expertise.html','projects.html','admin.html'];
const workerRoutes = ['/api/*','/media/*','/','/index.html','/about.html','/contact.html','/experience.html','/expertise.html','/projects.html','/admin.html','/robots.txt','/sitemap.xml'];
assert.match(wrangler, /directory\s*=\s*["']?\.\/dist\/?["']?/, 'Cloudflare Worker must publish the dist directory');
assert.match(wrangler, /binding\s*=\s*["']ASSETS["']/, 'Worker must bind its static assets as ASSETS');
assert.match(wrangler, /binding\s*=\s*["']PORTFOLIO_DB["']/, 'D1 binding must remain PORTFOLIO_DB');
assert.match(wrangler, /database_id\s*=\s*["'][0-9a-f-]{36}["']/, 'D1 database id must be configured');
assert.match(wrangler, /migrations_dir\s*=\s*["']migrations["']/, 'D1 migrations folder must be configured');
const routesLine = wrangler.split(/\r?\n/).find(line => line.includes('run_worker_first')) || '';
for (const route of workerRoutes) assert.ok(routesLine.includes(`"${route}"`), `Worker-first routing must include ${route}`);
assert.match(headers, /Content-Security-Policy:[^\n]*script-src 'self' https:\/\/static\.cloudflareinsights\.com/, 'CSP should allow same-origin scripts and the configured Cloudflare Analytics beacon only');
assert.match(headers, /\/assets\/js\/\*\n\s+Cache-Control: no-cache, must-revalidate/, 'JS must revalidate after deployments rather than remain immutable');
assert.match(headers, /\/assets\/css\/style\.css\n\s+Cache-Control: no-cache, must-revalidate/, 'CSS must revalidate after deployments');
assert.match(headers, /\/\*\.html\n\s+Cache-Control: no-cache, must-revalidate/, 'HTML must not be cached stale');
for (const name of pages) {
  const file = path.join(dist, name);
  assert.ok(fs.existsSync(file), `Missing deployable page ${name}`);
  const html = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(html, /<script>(?!\s*<\/script>)[\s\S]*?<\/script>/i, `${name} must not contain inline scripts blocked by CSP`);
  assert.match(html, /<html[^>]*class="[^"]*protection-enabled/, `${name} must enable protection CSS before scripts execute`);
  assert.match(html, /assets\/js\/protect\.js\?v=20261029b/, `${name} must load the current protection script`);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${name} must not contain inline event handlers blocked by CSP`);
  for (const [, rawUrl] of html.matchAll(/\b(?:src|href|action)\s*=\s*["']([^"']+)["']/gi)) {
    const url = rawUrl.split('#')[0].split('?')[0];
    if (!url || ['#','http:','https:','mailto:','tel:','data:','blob:','javascript:','//'].some(prefix => url.startsWith(prefix))) continue;
    if (url === '/') { assert.ok(fs.existsSync(path.join(dist,'index.html')), 'Root landing page requires index.html'); continue; }
    const local = path.join(dist, url.replace(/^\//,''));
    assert.ok(fs.existsSync(local), `${name} references missing local asset: ${url}`);
  }
}
assert.equal(fs.readFileSync(path.join(dist,'index.html'),'utf8'), fs.readFileSync(path.join(dist,'about.html'),'utf8'), 'Root index and About landing content must stay in sync');
for (const rel of ['src/index.js','dist/assets/js/app.js','dist/assets/js/about-media.js','dist/assets/js/cms-public.js','dist/assets/js/admin.js']) {
  const target = fs.readFileSync(path.join(root,rel),'utf8');
  assert.doesNotMatch(target, /\.(?:avi|mkv|wmv|flv)\b/i, `${rel} must not advertise unsupported browser video containers as universally supported`);
}
assert.ok(fs.existsSync(path.join(dist,'assets/videos/README.txt')), 'Local video directory must include deploy/setup guidance');
const aboutMedia = fs.readFileSync(path.join(dist,'assets/js/about-media.js'),'utf8');
const cmsPublic = fs.readFileSync(path.join(dist,'assets/js/cms-public.js'),'utf8');
for (const source of [aboutMedia, cmsPublic]) {
  assert.match(source, /\.mp4|mp4/, 'All browser video frontends must support MP4');
  assert.match(source, /\.webm|webm/, 'All browser video frontends must support WebM');
  assert.match(source, /\.ogv|ogv/, 'All browser video frontends must support OGV/OGG where available');
  assert.doesNotMatch(source, /\.mov\$|\.avi\$|\.mkv\$/i, 'Unsupported containers must not be presented as universally supported');
}
assert.match(fs.readFileSync(path.join(root,'package.json'),'utf8'), /test:deployment/, 'Deployment config review must be part of the npm scripts');
console.log('Deployment review passed: Wrangler/D1/static asset config, Worker-first HTML/API routes, cache policy, CSP, and local asset paths.');
