import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../dist/assets/js/app.js', import.meta.url), 'utf8');
const localeMatch = app.match(/^const LANGS=(.*?);\nconst TRANSLATIONS=(.*?);\n/s);
assert.ok(localeMatch, 'Language dictionary must be parseable');
const langs = vm.runInNewContext('(' + localeMatch[1] + ')');
const translations = JSON.parse(localeMatch[2]);
assert.deepEqual(Object.keys(langs).sort(), ['de','en','fa','hi','nl'].sort());
const visibleKeys = [
  'WORK AVAILABILITY','Open to National & International Opportunities','Available for suitable roles and collaborations in Afghanistan and internationally, including remote and on-site opportunities.',
  'Contact','About','Expertise','Experience','Projects','LET’S CONNECT','EMAIL','Network & Wireless Professional','Herat, Afghanistan','All rights reserved.',
  'Building networks people can rely on.','Network operations, wireless connectivity, and automation—with a practical, service-first mindset.',
  'Devices in managed network','Network sites supported','Access points in automation project','Years of networking experience','Contracts secured in 1.5 months as a manager','Successful installations & troubleshooting across Herat city, nearby areas, and districts',
  'What I value','Service reliability','Problem solving','Automation','Team support','Technical expertise','Routing & ISP Networks','Wireless Infrastructure','Monitoring & Visibility','Network Automation','Troubleshooting & Security','Service & Customer Support',
  'CAREER JOURNEY','Experience that keeps systems moving.','SELECTED WORK','Projects & achievements','Multi-site network automation','Network monitoring workflow','Wireless service support',
  'Choose language','Say hello on LinkedIn','Connect professionally','Network Engineer','Sales Manager','Current','Visit Company Website ↗',
  'Video highlights','Selected examples of installations, network troubleshooting, monitoring, and automation.','Wireless installations','Network troubleshooting','Network monitoring','Automation in practice','Add a video from the admin panel.',
  'Previous video','Next video','Choose a video','Video viewer','Close video','Play video','This video could not be played. Check the file format or link in the admin panel.'
];
for (const key of visibleKeys) {
  assert.ok(translations[key], `Missing visible dictionary key ${key}`);
  for (const locale of Object.keys(langs).filter(code => code !== 'en')) {
    assert.equal(typeof translations[key][locale], 'string', `Missing ${locale} translation for visible key ${key}`);
    assert.ok(translations[key][locale].trim(), `Empty ${locale} translation for visible key ${key}`);
  }
}
for (const [key, entry] of Object.entries(translations)) {
  for (const locale of Object.keys(langs).filter(code => code !== 'en')) {
    assert.equal(typeof entry[locale], 'string', `Missing ${locale} translation for dictionary key ${key}`);
    assert.ok(entry[locale].trim(), `Empty ${locale} translation for dictionary key ${key}`);
  }
}
const expMatch = app.match(/const experienceCopy = (\{.*?\});\n   experienceCopy\.ps=/s);
assert.ok(expMatch, 'Experience copy must be parseable');
const experience = vm.runInNewContext('(' + expMatch[1] + ')');
for (const locale of ['en','fa','de']) {
  assert.equal(experience[locale]?.entries?.length, 4, `Four role entries required for ${locale}`);
}
assert.doesNotMatch(app, /experienceCopy\.(ru|fr)=/);
assert.doesNotMatch(app, /\"(ru|fr)\":\"(Русский|Français)\"/);

assert.equal(experience.fa.entries[3][2], 'فبروری ۲۰۲۲ تا دسمبر ۲۰۲۴');
assert.doesNotMatch(app, /Verband Kundenbetreuung mit Netzwerkbetrieb/);
assert.equal(translations['Network Engineer'].fa, 'مهندس شبکه');
assert.equal(translations['Wireless APs'].fa, 'اکسس‌پوینت‌های بی‌سیم');
for (const key of [
  'Choose a video to see practical examples of network installation, troubleshooting, monitoring, and automation.',
  'Previous video', 'Next video', 'Choose a video', 'Video viewer', 'Close video', 'Play video',
  'Go to video 1', 'Go to video 2', 'Go to video 3', 'Go to video 4',
  'Video 1 of 4', 'Video 2 of 4', 'Video 3 of 4', 'Video 4 of 4',
  'This video could not be played. Check the file format or link in the admin panel.'
]) {
  assert.ok(translations[key], `Video interface needs a translation entry for ${key}`);
  for (const locale of Object.keys(langs).filter(code => code !== 'en')) {
    assert.ok(translations[key][locale]?.trim(), `Video interface text ${key} must be translated into ${locale}`);
  }
}
console.log(`Translation review passed: ${visibleKeys.length} visible strings and all ${Object.keys(translations).length} dictionary keys have entries for all ${Object.keys(langs).length} active locales; four complete experience entries are present per locale.`);
