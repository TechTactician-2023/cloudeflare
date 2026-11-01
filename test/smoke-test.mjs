import worker from '../src/index.js';
import assert from 'node:assert/strict';
const rows = [];
const settings = new Map();
const media = new Map();
const mediaChunks = new Map();
const db = {
  prepare(sql) {
    let values = [];
    return {
      bind(...v) { values = v; return this; },
      async all() {
        if (sql.includes('SELECT key, size, content_type, original_name, created_at FROM media_files')) return { results: [...media.values()].map(x => ({ key:x.key, size:x.size, content_type:x.type, original_name:x.originalName, created_at:x.uploaded.toISOString() })) };
        if (sql.includes('SELECT chunk_index, data FROM media_chunks')) { const [key, first, last] = values; return { results: (mediaChunks.get(key)||[]).filter(x=>x.chunk_index>=first&&x.chunk_index<=last).map(x=>({chunk_index:x.chunk_index,data:x.data})) }; }
        if (sql.includes('SELECT data FROM content_items')) return { results: rows.map(r => ({ data: r.data })) };
        const type = values[0];
        return { results: rows.filter(r => r.type === type).sort((a,b) => b.created_at.localeCompare(a.created_at)) };
      },
      async first() {
        if (sql.includes('SELECT size, content_type FROM media_files')) { const x=media.get(values[0]); return x ? {size:x.size, content_type:x.type} : null; }
        if (sql.includes("key = 'seo'")) return settings.has('seo') ? { value: settings.get('seo') } : null;
        if (sql.includes('site_settings')) return settings.has('about') ? { value: settings.get('about') } : null;
        return null;
      },
      async run() {
        if (sql.startsWith('INSERT INTO media_files')) { media.set(values[0], {key:values[0], size:values[1], type:values[2], originalName:values[3], uploaded:new Date()}); return {meta:{changes:1}}; }
        if (sql.startsWith('INSERT INTO media_chunks')) { if(!mediaChunks.has(values[0])) mediaChunks.set(values[0],[]); mediaChunks.get(values[0]).push({file_key:values[0],chunk_index:values[1],data:new Uint8Array(values[2])}); return {meta:{changes:1}}; }
        if (sql.startsWith('DELETE FROM media_chunks')) { mediaChunks.delete(values[0]); return {meta:{changes:1}}; }
        if (sql.startsWith('DELETE FROM media_files')) { media.delete(values[0]); return {meta:{changes:1}}; }
        if (sql.startsWith('INSERT INTO site_settings')) { settings.set(sql.includes("'seo'") ? 'seo' : 'about', values[0]); return { meta: { changes: 1 } }; }
        if (sql.startsWith('INSERT INTO content_items')) {
          rows.push({ id: values[0], type: values[1], data: values[2], sort_order: 0, created_at: new Date().toISOString() });
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith('UPDATE content_items')) {
          const r = rows.find(x => x.id === values[2]);
          if (!r) return { meta: { changes: 0 } };
          r.type = values[0]; r.data = values[1]; return { meta: { changes: 1 } };
        }
        if (sql.startsWith('DELETE FROM content_items')) {
          const i = rows.findIndex(x => x.id === values[0]); if (i < 0) return { meta: { changes: 0 } }; rows.splice(i, 1); return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      }
    };
  },
  async batch(stmts) { for (const stmt of stmts) await stmt.run(); return []; }
};
const env = { ADMIN_PASSWORD: 'test-password', ADMIN_TOKEN_SECRET: 'test-secret-at-least-long-enough', PORTFOLIO_DB: db, ASSETS: { fetch: async request => new Response('<!doctype html><html><head><title>Original</title><meta name="description" content="Old description"></head><body>asset</body></html>', {headers:{'Content-Type':'text/html; charset=utf-8'}}) } };
let response = await worker.fetch(new Request('https://site.test/api/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({password:'test-password'}) }), env);
assert.equal(response.status, 200); const { token } = await response.json();
const auth = { Authorization: `Bearer ${token}` };
response = await worker.fetch(new Request('https://site.test/api/admin/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: 'null' }), env);
assert.equal(response.status, 401, 'null login payload should return an auth error, not a server error');
response = await worker.fetch(new Request('https://site.test/api/admin/about', { method: 'PUT', headers: {...auth,'Content-Type':'application/json'}, body: 'null' }), env);
assert.equal(response.status, 400, 'null About payload should return a validation error');
response = await worker.fetch(new Request('https://site.test/api/admin/items', { method:'POST', headers:{...auth,'Content-Type':'application/json'}, body:JSON.stringify({type:'projects',title:'Traversal test',image:'assets/images/../videos/clip.jpg',video:'',tags:[],bullets:[]}) }), env);
assert.equal(response.status, 400, 'parent-directory media paths must be rejected');
response = await worker.fetch(new Request('https://site.test/api/admin/items', { method:'POST', headers:{...auth,'Content-Type':'application/json'}, body:JSON.stringify({type:'projects',title:'Wrong media kind',image:'/media/clip.mp4',video:'',tags:[],bullets:[]}) }), env);
assert.equal(response.status, 400, 'video media must not be accepted as an image URL');
response = await worker.fetch(new Request('https://site.test/api/admin/items', { method:'POST', headers:{...auth,'Content-Type':'application/json'}, body:JSON.stringify({type:'projects',title:'Video test',image:'',video:'',tags:[],bullets:[]}) }), env);
assert.equal(response.status, 201); const item = (await response.json()).item;
response = await worker.fetch(new Request('https://site.test/api/content?type=projects'), env);
assert.equal(response.status, 200); assert.equal((await response.json()).items.length, 1);
const png = new File([new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], 'test.png', {type:'image/png'});
const form = new FormData(); form.append('file', png);
response = await worker.fetch(new Request('https://site.test/api/admin/media', {method:'POST', headers:auth, body:form}), env);
assert.equal(response.status, 201, await response.clone().text()); const uploaded = await response.json();
response = await worker.fetch(new Request('https://site.test'+uploaded.url), env);
assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'),'image/png');
const mp4 = new File([new Uint8Array([0,0,0,24,0x66,0x74,0x79,0x70,0x69,0x73,0x6f,0x6d,0,0,0,0])], 'demo.mp4', {type:'video/mp4'});
const vf = new FormData(); vf.append('file', mp4);
response = await worker.fetch(new Request('https://site.test/api/admin/media', {method:'POST', headers:auth, body:vf}), env);
assert.equal(response.status, 201, await response.clone().text()); const video = await response.json();
response = await worker.fetch(new Request('https://site.test'+video.url, {headers:{Range:'bytes=0-5'}}), env);
assert.equal(response.status, 206); assert.equal(response.headers.get('accept-ranges'),'bytes');
response = await worker.fetch(new Request('https://site.test/api/admin/items/'+item.id, {method:'PUT',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({...item,video:video.url})}), env);
assert.equal(response.status, 200);
response = await worker.fetch(new Request('https://site.test/api/content?type=projects'), env);
assert.equal((await response.json()).items[0].video, video.url);
response = await worker.fetch(new Request('https://site.test/api/admin/about', { method:'PUT', headers:{...auth,'Content-Type':'application/json'}, body:JSON.stringify({image:uploaded.url, video:'', videoSlots:[{title:'Wireless installations',video:video.url,poster:video.url},{title:'Network troubleshooting',video:''},{title:'Network monitoring',video:''},{title:'Automation in practice',video:''}]}) }), env);
assert.equal(response.status, 400, 'video files must not be accepted as poster images');
response = await worker.fetch(new Request('https://site.test/api/admin/about', { method:'PUT', headers:{...auth,'Content-Type':'application/json'}, body:JSON.stringify({image:uploaded.url, video:'', videoSlots:[{title:'Wireless installations',video:video.url,poster:uploaded.url},{title:'Network troubleshooting',video:''},{title:'Network monitoring',video:''},{title:'Automation in practice',video:''}]}) }), env);
assert.equal(response.status, 200);
response = await worker.fetch(new Request('https://site.test/api/content?type=about'), env);
const aboutSettings = (await response.json()).about; assert.equal(aboutSettings.image, uploaded.url); assert.equal(aboutSettings.videoSlots[0].video, video.url); assert.equal(aboutSettings.videoSlots[0].poster, uploaded.url); assert.equal(aboutSettings.videoSlots.length, 4, 'About media should preserve four video slots');
response = await worker.fetch(new Request('https://site.test/api/admin/media', {headers:auth}), env);
assert.equal(response.status, 200); const mediaLibrary = (await response.json()).media; assert.ok(mediaLibrary.some(x => x.key === uploaded.key && x.inUse)); assert.ok(mediaLibrary.some(x => x.key === video.key && x.inUse), 'Video used in About should be marked in use');
response = await worker.fetch(new Request('https://site.test/api/admin/media/'+uploaded.key, {method:'DELETE', headers:auth}), env);
assert.equal(response.status, 409, 'in-use media should be protected from deletion');
response = await worker.fetch(new Request('https://site.test/api/admin/seo'), { ...env, PORTFOLIO_DB: db });
assert.equal(response.status, 401, 'SEO settings must require admin auth');
response = await worker.fetch(new Request('https://site.test/api/admin/seo'), { ...env, PORTFOLIO_DB: db, ADMIN_TOKEN_SECRET: env.ADMIN_TOKEN_SECRET });
// Valid authenticated SEO GET and update
response = await worker.fetch(new Request('https://site.test/api/admin/seo', {headers:auth}), env);
assert.equal(response.status, 200);
const initialSeo = (await response.json()).seo;
initialSeo.about.title = 'Network Engineer | About';
initialSeo.about.description = 'Professional network engineering profile.';
initialSeo.about.canonical = 'https://site.test/about.html';
initialSeo.about.ogImage = '/assets/images/profile-logo.webp';
initialSeo.about.indexable = false;
response = await worker.fetch(new Request('https://site.test/api/admin/seo', {method:'PUT',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({seo:initialSeo})}), env);
assert.equal(response.status, 200, await response.clone().text());
response = await worker.fetch(new Request('https://site.test/about.html'), env);
assert.equal(response.headers.get('cache-control'), 'no-store', 'HTML must not remain stale after a deploy');
assert.equal(response.headers.get('content-security-policy')?.includes("script-src 'self'"), true, 'Worker-served HTML must carry its CSP');
assert.equal(response.headers.get('x-frame-options'), 'DENY', 'Worker-served HTML must prohibit framing');
const html = await response.text();
assert.match(html, /<title>Network Engineer \| About<\/title>/);
assert.match(html, /name="robots" content="noindex, nofollow"/);
assert.match(html, /rel="canonical" href="https:\/\/site\.test\/about\.html"/);
response = await worker.fetch(new Request('https://site.test/admin.html'), env);
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'no-store', 'Admin HTML must also be revalidated/not cached stale');
assert.equal(response.headers.get('content-security-policy')?.includes("script-src 'self'"), true, 'Admin HTML must also receive a CSP from the Worker');
response = await worker.fetch(new Request('https://site.test/robots.txt', {method:'HEAD'}), env);
assert.equal(response.status, 200); assert.equal(await response.text(), '', 'HEAD robots response must not include a body');
response = await worker.fetch(new Request('https://site.test/robots.txt'), env);
assert.equal(response.status, 200); assert.match(await response.text(), /Sitemap: https:\/\/site\.test\/sitemap\.xml/);
response = await worker.fetch(new Request('https://site.test/sitemap.xml'), env);
const sitemap = await response.text(); assert.equal(response.status, 200); assert.doesNotMatch(sitemap, /about\.html/); assert.match(sitemap, /expertise\.html/);
console.log('Smoke tests passed: auth, content CRUD, media upload/playback, About, media protection, SEO CRUD, HTML metadata injection, robots.txt, and sitemap.xml.');
