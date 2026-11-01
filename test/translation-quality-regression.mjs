import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../dist/assets/js/app.js', import.meta.url), 'utf8');
const match = app.match(/^const LANGS=(.*?);\nconst TRANSLATIONS=(.*?);\n/s);
assert.ok(match, 'Language dictionary must be parseable');
const langs = vm.runInNewContext('(' + match[1] + ')');
const translations = JSON.parse(match[2]);
assert.equal(translations['Contracts secured in 1.5 months as a manager'].fa, 'قراردادهای جذب‌شده طی یک‌ونیم ماه در سمت مدیر فروش');
assert.equal(translations['Say hello on LinkedIn'].nl, 'Neem contact op via LinkedIn');
assert.match(app, /contactCopy/); assert.match(app, /pageCopy/); assert.match(app, /experienceCopy/); assert.match(app, /pageMeta/);
assert.doesNotMatch(app, /experienceCopy\.(ru|fr)=/); assert.doesNotMatch(app, /pageMeta\.(ru|fr)=/);
assert.doesNotMatch(app, /contactCopy\.(ru|fr)=/);

assert.match(app, /document\.documentElement\.dir=code==='fa'\?'rtl':'ltr'/);
assert.match(app, /lang==='hi'\?'hi-IN':lang==='nl'\?'nl-NL'/, 'Counter formatting should honor every active locale');
assert.equal(translations['Recent role'].de, 'Zuletzt ausgeübte Position');
assert.equal(translations['4+ Years Experience'].de, 'Mehr als 4 Jahre Erfahrung');
assert.equal(translations['Switch theme'].nl, 'Thema wijzigen');
assert.equal(translations['Video'].hi, 'वीडियो');
assert.doesNotMatch(app, /Verband Kundenbetreuung mit Netzwerkbetrieb/);
assert.match(app, /Zahlungen und Rückerstattungen bearbeiten sowie präzise Betriebsberichte erstellen\./);
for (const page of ['index.html','about.html','expertise.html','experience.html','projects.html','contact.html']) {
  const html = fs.readFileSync(new URL('../dist/' + page, import.meta.url), 'utf8');
  assert.match(html, /assets\/js\/app\.js\?v=/, `${page} must load the versioned translation engine`);
}
console.log(`Translation quality regression passed: ${Object.keys(translations).length} dictionary keys and six public-page locale bundles checked.`);
