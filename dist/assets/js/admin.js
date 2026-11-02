(() => {
  const $ = (id) => document.getElementById(id);
  let token = sessionStorage.getItem('portfolio_admin_token') || '';
  let type = 'experiences';
  let items = [];
  let seoSettings = {};
  let aboutSettings = { image: '', video: '', videoSlots: [] };
  const seoDefaults = {
    index: {title:'Contact | Mahmood Sahebi — Network Engineer',description:'Contact Mahmood Sahebi, Network Engineer specializing in ISP networks, wireless infrastructure, and automation.'},
    about: {title:'About | Mahmood Sahebi',description:'Network Engineer experienced in ISP operations, wireless infrastructure, monitoring, and automation.'},
    expertise: {title:'Expertise | Mahmood Sahebi',description:'Network, wireless, monitoring, troubleshooting, and automation expertise.'},
    experience: {title:'Experience | Mahmood Sahebi',description:'Professional experience in network engineering, wireless management, ISP operations, and customer service.'},
    projects: {title:'Projects | Mahmood Sahebi',description:'Selected network engineering, ISP infrastructure, and automation projects.'}
  };
  const api = async (path, opts = {}) => {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`/api/${path}`, { ...opts, headers });
    let data = {}; try { data = await response.json(); } catch {}
    if (!response.ok) {
      if (path === 'admin/login' && data.checks) {
        const missing = Object.entries(data.checks).filter(([, configured]) => !configured).map(([name]) => name);
        throw new Error(`Admin login is not configured on this Cloudflare Worker. Missing secret${missing.length === 1 ? '' : 's'}: ${missing.join(', ') || 'unknown'}. Add them under Workers & Pages → cloudeflare → Settings → Variables and Secrets, then deploy again.`);
      }
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  };
  const msg = (id, value) => { $(id).textContent = value; };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function reset() {
    ['itemId','title','subtitle','date','description','bullets','tags','imageUrl','videoUrl','publishAt'].forEach(id => { if($(id)) $(id).value = ''; });
    if ($('contentMediaFile')) $('contentMediaFile').value = '';
    $('formTitle').textContent = `Add ${type === 'experiences' ? 'work experience' : 'project'}`;
    msg('saveMsg','');
  }
  function fill(item) {
    $('itemId').value = item.id || ''; $('title').value = item.title || '';
    $('subtitle').value = item.subtitle || ''; $('date').value = item.date || '';
    $('description').value = item.description || ''; $('bullets').value = (item.bullets || []).join('\n');
    $('tags').value = (item.tags || []).join(', '); $('imageUrl').value = item.image || ''; $('videoUrl').value = item.video || ''; $('publishAt').value = item.publishAt ? new Date(item.publishAt).toISOString().slice(0,16) : ''; $('contentMediaFile').value = ''; $('formTitle').textContent = 'Edit item'; msg('saveMsg','');
  }
  function render() {
    $('itemsList').innerHTML = items.length ? items.map(item => `<article class="admin-item"><strong>${esc(item.title)}</strong><p>${esc(item.subtitle)} ${esc(item.date)}</p><p class="admin-item-media-note">Status: <strong>${esc(item.status || 'published')}</strong> ${item.publishAt ? '· Scheduled: '+esc(item.publishAt) : ''}</p><p class="admin-item-media-note">${item.video ? 'Video attached' : (item.image ? 'Image attached' : 'No media attached')}</p><div class="admin-actions"><button type="button" data-edit="${esc(item.id)}">Edit</button><button type="button" data-delete="${esc(item.id)}">Delete</button></div></article>`).join('') : '<p>No saved items yet. The built-in site content remains visible until content is added here.</p>';
    $('itemsList').querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => { const item=items.find(x=>x.id===button.dataset.edit); if(item) fill(item); }));
    $('itemsList').querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
      if (!confirm('Delete this item?')) return;
      try { await api(`admin/items/${encodeURIComponent(button.dataset.delete)}`, {method:'DELETE'}); await load(); reset(); }
      catch(e) { alert(e.message); }
    }));
  }
  async function load() { const data = await api(`admin/items?type=${encodeURIComponent(type)}`); items=data.items||[]; render(); }
  function show() { $('loginLayout').classList.add('admin-hidden'); $('loginPanel').classList.add('admin-hidden'); $('workspace').classList.remove('admin-hidden'); load().catch(e=>{msg('saveMsg',e.message); if(e.message.includes('Unauthorized')) logout();}); loadSeo().catch(e=>msg('seoMsg',e.message)); loadAboutMedia().catch(e=>msg('aboutMediaMsg',e.message)); }
  function logout() { token=''; sessionStorage.removeItem('portfolio_admin_token'); $('workspace').classList.add('admin-hidden'); $('loginLayout').classList.remove('admin-hidden'); $('loginPanel').classList.remove('admin-hidden'); msg('loginMsg','You have signed out.'); }
  document.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => { type=button.dataset.type; document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b===button)); $('formTitle').textContent=`Add ${type==='experiences'?'work experience':'project'}`; reset(); load().catch(e=>msg('saveMsg',e.message)); }));
  $('loginForm').addEventListener('submit', async event => { event.preventDefault(); try { const data=await api('admin/login',{method:'POST',body:JSON.stringify({password:$('password').value})}); token=data.token; sessionStorage.setItem('portfolio_admin_token',token); msg('loginMsg',''); show(); } catch(e) { msg('loginMsg',e.message); } });
  async function normalizeAboutImage(file) {
    if (!file) throw new Error('Select an image file first.');
    if (!String(file.type || '').startsWith('image/')) throw new Error('Choose an image file for the About image.');
    if (!('createImageBitmap' in window)) return file;
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error('The selected image could not be opened. Try JPG, PNG, WebP, or AVIF.'); }
    try {
      const width = 1200;
      const height = 900;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Image resizing is not supported by this browser.');
      // A consistent neutral canvas; fit the complete original image without stretching or cropping.
      context.fillStyle = '#f2f0e9';
      context.fillRect(0, 0, width, height);
      const scale = Math.min(width / bitmap.width, height / bitmap.height);
      const drawWidth = Math.round(bitmap.width * scale);
      const drawHeight = Math.round(bitmap.height * scale);
      const x = Math.round((width - drawWidth) / 2);
      const y = Math.round((height - drawHeight) / 2);
      context.drawImage(bitmap, x, y, drawWidth, drawHeight);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.88));
      if (!blob) throw new Error('The image could not be converted. Please try another image.');
      return new File([blob], 'about-profile-1200x900.webp', { type: 'image/webp', lastModified: Date.now() });
    } finally { bitmap.close?.(); }
  }
  async function uploadFile(file) {
    if (!file) throw new Error('Select a file first.');
    const form = new FormData(); form.append('file', file);
    const response = await fetch('/api/admin/media', { method:'POST', headers: token ? { Authorization:`Bearer ${token}` } : {}, body:form });
    let data = {}; try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || `Upload failed (${response.status})`);
    return data;
  }

  $('uploadContentMediaBtn').addEventListener('click', async () => {
    try {
      const result = await uploadFile($('contentMediaFile').files?.[0]);
      if (result.kind === 'video') { $('videoUrl').value = result.url; $('imageUrl').value = ''; }
      else { $('imageUrl').value = result.url; $('videoUrl').value = ''; }
      msg('saveMsg', `Upload complete (${Math.round(result.size/1024)} KB). Save the item to publish this media.`);
    } catch (e) { msg('saveMsg', e.message); }
  });

  $('itemForm').addEventListener('submit', async event => {
    event.preventDefault();
    const item={type,status:'published',publishAt:$('publishAt').value ? new Date($('publishAt').value).toISOString() : null,title:$('title').value.trim(),subtitle:$('subtitle').value.trim(),date:$('date').value.trim(),description:$('description').value.trim(),bullets:$('bullets').value.split('\n').map(x=>x.trim()).filter(Boolean),tags:$('tags').value.split(',').map(x=>x.trim()).filter(Boolean),image:$('imageUrl').value.trim(),video:$('videoUrl').value.trim()};
    try { const id=$('itemId').value; await api(`admin/items${id?`/${encodeURIComponent(id)}`:''}`,{method:id?'PUT':'POST',body:JSON.stringify(item)}); msg('saveMsg','Content and media saved. Refresh the public page to see the update.'); reset(); await load(); }
    catch(e) { msg('saveMsg',e.message); }
  });

  $('saveDraftBtn').addEventListener('click', async () => {
    const item={type,status:'draft',publishAt:null,title:$('title').value.trim(),subtitle:$('subtitle').value.trim(),date:$('date').value.trim(),description:$('description').value.trim(),bullets:$('bullets').value.split('\n').map(x=>x.trim()).filter(Boolean),tags:$('tags').value.split(',').map(x=>x.trim()).filter(Boolean),image:$('imageUrl').value.trim(),video:$('videoUrl').value.trim()};
    if(!item.title){msg('saveMsg','Add a title before saving the draft.');return;}
    try { const id=$('itemId').value; await api(`admin/items${id?`/${encodeURIComponent(id)}`:''}`,{method:id?'PUT':'POST',body:JSON.stringify(item)}); msg('saveMsg','Draft saved privately. It will not appear on the public site.'); reset(); await load(); } catch(e){msg('saveMsg',e.message);}
  });

  const defaultAboutSlots = [
    { title:'Wireless installations', caption:'Point-to-point links, access-point installation, alignment, and signal checks.', video:'', poster:'' },
    { title:'Network troubleshooting', caption:'Field diagnostics to identify faults and restore customer connectivity.', video:'', poster:'' },
    { title:'Network monitoring', caption:'Tracking device availability, link stability, and overall network health.', video:'', poster:'' },
    { title:'Automation in practice', caption:'Repeatable configuration changes and device management with Ansible.', video:'', poster:'' }
  ];
  function fillAboutMedia(value = {}) {
    aboutSettings = { image:String(value.image || ''), video:String(value.video || ''), videoSlots:Array.isArray(value.videoSlots)?value.videoSlots:[] };
    $('aboutImageUrl').value = aboutSettings.image;
    $('aboutIntroVideoUrl').value = aboutSettings.video;
    if ($('aboutImageFile')) $('aboutImageFile').value = '';
    if ($('aboutIntroVideoFile')) $('aboutIntroVideoFile').value = '';
    defaultAboutSlots.forEach((slot, index) => {
      const saved = aboutSettings.videoSlots[index] || {};
      $(`aboutSlotTitle${index+1}`).value = saved.title || slot.title;
      $(`aboutSlotCaption${index+1}`).value = saved.caption || slot.caption;
      $(`aboutSlotVideo${index+1}`).value = saved.video || '';
      $(`aboutSlotPoster${index+1}`).value = saved.poster || '';
      $(`aboutSlotFile${index+1}`).value = '';
      $(`aboutSlotPosterFile${index+1}`).value = '';
    });
  }
  async function loadAboutMedia() {
    const result = await api('admin/about');
    fillAboutMedia(result.about || {});
    msg('aboutMediaMsg','Saved About media loaded.');
  }
  $('saveAboutMediaBtn').addEventListener('click', async () => {
    const videoSlots = defaultAboutSlots.map((slot, index) => ({ title:$(`aboutSlotTitle${index+1}`).value.trim() || slot.title, caption:$(`aboutSlotCaption${index+1}`).value.trim() || slot.caption, video:$(`aboutSlotVideo${index+1}`).value.trim(), poster:$(`aboutSlotPoster${index+1}`).value.trim() }));
    const payload = { image:$('aboutImageUrl').value.trim(), video:$('aboutIntroVideoUrl').value.trim(), videoSlots };
    try {
      const result = await api('admin/about',{method:'PUT',body:JSON.stringify(payload)});
      fillAboutMedia(result.about || payload);
      msg('aboutMediaMsg','About media and all four video slots saved. Refresh the About page to publish changes.');
    } catch(e) { msg('aboutMediaMsg',e.message); }
  });
  $('uploadAboutImageBtn').addEventListener('click', async () => {
    try {
      const sourceFile = $('aboutImageFile').files?.[0];
      const normalizedFile = await normalizeAboutImage(sourceFile);
      const result = await uploadFile(normalizedFile);
      if (result.kind !== 'image') throw new Error('Choose an image file for the About image.');
      $('aboutImageUrl').value = result.url;
      $('aboutIntroVideoUrl').value = '';
      msg('aboutMediaMsg', `About image resized to 1200 × 900 and uploaded (${Math.round(result.size/1024)} KB). Click Save About media to publish it.`);
    } catch (e) { msg('aboutMediaMsg', e.message); }
  });
  $('uploadAboutVideoBtn').addEventListener('click', async () => {
    try {
      const result = await uploadFile($('aboutIntroVideoFile').files?.[0]);
      if (result.kind !== 'video') throw new Error('Choose a video file for the About introduction.');
      $('aboutIntroVideoUrl').value = result.url;
      $('aboutImageUrl').value = '';
      msg('aboutMediaMsg', `About video uploaded (${Math.round(result.size/1024)} KB). Click Save About media to publish it.`);
    } catch (e) { msg('aboutMediaMsg', e.message); }
  });
  $('reloadAboutMediaBtn').addEventListener('click', () => loadAboutMedia().catch(e=>msg('aboutMediaMsg',e.message)));
  document.querySelectorAll('[data-upload-about-slot]').forEach(button => button.addEventListener('click', async () => {
    const slotNumber = button.dataset.uploadAboutSlot;
    try {
      const file = $(`aboutSlotFile${slotNumber}`).files?.[0];
      const result = await uploadFile(file);
      if (result.kind !== 'video') throw new Error('Choose a video file for this slot.');
      $(`aboutSlotVideo${slotNumber}`).value = result.url;
      msg('aboutMediaMsg',`Video uploaded to slot ${slotNumber}. Click Save About media to publish it.`);
    } catch(e) { msg('aboutMediaMsg',e.message); }
  }));
  document.querySelectorAll('[data-upload-about-poster]').forEach(button => button.addEventListener('click', async () => {
    const slotNumber = button.dataset.uploadAboutPoster;
    try {
      const file = $(`aboutSlotPosterFile${slotNumber}`).files?.[0];
      const result = await uploadFile(file);
      if (result.kind !== 'image') throw new Error('Choose an image file for this poster.');
      $(`aboutSlotPoster${slotNumber}`).value = result.url;
      msg('aboutMediaMsg',`Poster image uploaded to slot ${slotNumber}. Click Save About media to publish it.`);
    } catch(e) { msg('aboutMediaMsg',e.message); }
  }));

  function selectedSeo() {
    const page = $('seoPage').value;
    return seoSettings[page] || { ...seoDefaults[page], canonical:'', ogTitle:'', ogDescription:'', ogImage:'', indexable:true };
  }
  function renderSeo() {
    const value = selectedSeo();
    $('seoTitle').value = value.title || '';
    $('seoDescription').value = value.description || '';
    $('seoCanonical').value = value.canonical || '';
    $('seoOgTitle').value = value.ogTitle || '';
    $('seoOgDescription').value = value.ogDescription || '';
    $('seoOgImage').value = value.ogImage || '';
    $('seoIndexable').checked = value.indexable !== false;
    updateSeoPreview();
  }
  function updateSeoPreview() {
    if (!$('seoPreviewTitle')) return;
    const title = $('seoTitle').value.trim() || 'SEO title preview';
    const description = $('seoDescription').value.trim() || 'Meta description preview';
    const page = $('seoPage').value;
    const paths = {index:'/',about:'/about.html',expertise:'/expertise.html',experience:'/experience.html',projects:'/projects.html'};
    let url = $('seoCanonical').value.trim();
    if (!url) url = new URL(paths[page], location.origin).href;
    $('seoPreviewTitle').textContent = title;
    $('seoPreviewUrl').textContent = url;
    $('seoPreviewDescription').textContent = description;
  }
  async function loadSeo() {
    const data = await api('admin/seo');
    seoSettings = data.seo || {};
    Object.keys(seoDefaults).forEach(page => { seoSettings[page] = { ...seoDefaults[page], canonical:'', ogTitle:'', ogDescription:'', ogImage:'', indexable:true, ...(seoSettings[page] || {}) }; });
    renderSeo();
  }
  $('seoPage').addEventListener('change', renderSeo);
  ['seoTitle','seoDescription','seoCanonical'].forEach(id => $(id).addEventListener('input', updateSeoPreview));
  $('reloadSeoBtn').addEventListener('click', () => loadSeo().then(()=>msg('seoMsg','Saved SEO settings reloaded.')).catch(e=>msg('seoMsg',e.message)));
  $('saveSeoBtn').addEventListener('click', async () => {
    const page = $('seoPage').value;
    seoSettings[page] = {
      title: $('seoTitle').value.trim(), description: $('seoDescription').value.trim(), canonical: $('seoCanonical').value.trim(),
      ogTitle: $('seoOgTitle').value.trim(), ogDescription: $('seoOgDescription').value.trim(), ogImage: $('seoOgImage').value.trim(), indexable: $('seoIndexable').checked
    };
    try {
      const result = await api('admin/seo', { method:'PUT', body:JSON.stringify({seo:seoSettings}) });
      seoSettings = result.seo || seoSettings;
      renderSeo(); msg('seoMsg','SEO settings saved. Refresh the public page to see the updated metadata.');
    } catch(e) { msg('seoMsg',e.message); }
  });

  $('newBtn').addEventListener('click',reset); $('logoutBtn').addEventListener('click',logout);

  // Progressive admin shell: reorganizes the existing functional panels without changing API contracts.
  function mountAdminShell() {
    const workspace = $('workspace');
    if (!workspace || workspace.dataset.redesigned === 'true') return;
    workspace.dataset.redesigned = 'true';
    const originalPanels = Array.from(workspace.children).filter(el => el.classList.contains('admin-panel') || el.id === 'aboutMediaPanel' || el.id === 'seoPanel' || el.id === 'publishedPanel');
    const navPanel = originalPanels.find(el => el.querySelector('[data-type]'));
    const formPanel = originalPanels.find(el => el.querySelector('#itemForm'));
    const mediaPanel = $('aboutMediaPanel');
    const seoPanel = $('seoPanel');
    const libraryPanel = $('publishedPanel');
    if (!navPanel || !formPanel || !mediaPanel || !seoPanel || !libraryPanel) return;

    workspace.innerHTML = '';
    const layout = document.createElement('div'); layout.className = 'admin-layout';
    const sidebar = document.createElement('aside'); sidebar.className = 'admin-sidebar'; sidebar.setAttribute('aria-label','Admin navigation');
    sidebar.innerHTML = `<div class="admin-sidebar-brand"><span class="admin-brand-mark">MS</span><span><strong>Portfolio CMS</strong><small>Control center</small></span></div>
      <div class="admin-nav-group"><span class="admin-nav-label">WORKSPACE</span>
      <button type="button" class="admin-nav-link is-active" data-view="overview"><span class="admin-nav-icon">⌂</span>Overview</button>
      <button type="button" class="admin-nav-link" data-view="content" data-content-type="experiences"><span class="admin-nav-icon">▤</span>Experience</button>
      <button type="button" class="admin-nav-link" data-view="content" data-content-type="projects"><span class="admin-nav-icon">◇</span>Projects</button>
      <button type="button" class="admin-nav-link" data-view="media"><span class="admin-nav-icon">▷</span>About & media</button>
      <button type="button" class="admin-nav-link" data-view="seo"><span class="admin-nav-icon">◎</span>SEO settings</button>
      <button type="button" class="admin-nav-link" data-view="library"><span class="admin-nav-icon">▦</span>Content library</button></div>
      <div class="admin-sidebar-bottom"><span class="admin-secure-dot"></span><span><strong>Protected workspace</strong><small>Changes use the existing API</small></span></div>`;
    const main = document.createElement('div'); main.className = 'admin-workspace-main';
    const top = document.createElement('div'); top.className = 'admin-workspace-topbar';
    top.innerHTML = `<div><span class="admin-top-kicker">CONTENT MANAGEMENT</span><h2 id="adminCurrentTitle">Overview</h2></div><div class="admin-top-actions"><a class="admin-site-link" href="about.html" target="_blank" rel="noopener">↗ View website</a><button type="button" id="adminThemeToggle" class="admin-utility-btn" aria-label="Toggle light and dark theme" title="Toggle theme">◐ <span>Theme</span></button><button type="button" id="adminMobileNav" class="admin-utility-btn" aria-label="Open navigation">☰</button></div>`;
    const viewHost = document.createElement('div'); viewHost.className = 'admin-view-host';
    const overview = document.createElement('section'); overview.className = 'admin-overview admin-view'; overview.dataset.adminView = 'overview';
    overview.innerHTML = `<div class="admin-welcome"><div><span class="admin-eyebrow">YOUR WEBSITE, ORGANIZED</span><h3>Manage your portfolio with confidence.</h3><p>Update professional experience, projects, About-page media, and search appearance from one workspace.</p></div><div class="admin-welcome-mark" aria-hidden="true">MS<span>.</span></div></div>
      <div class="admin-section-heading"><div><h3>Quick actions</h3><p>Jump directly to the area you want to update.</p></div></div>
      <div class="admin-quick-grid"><button type="button" class="admin-quick-card" data-view="content" data-content-type="experiences"><span class="admin-quick-icon">▤</span><strong>Work experience</strong><small>Manage roles, dates, achievements, and skills.</small><span class="admin-quick-arrow">→</span></button><button type="button" class="admin-quick-card" data-view="content" data-content-type="projects"><span class="admin-quick-icon">◇</span><strong>Projects</strong><small>Edit project descriptions, tags, and media.</small><span class="admin-quick-arrow">→</span></button><button type="button" class="admin-quick-card" data-view="media"><span class="admin-quick-icon">▷</span><strong>About & media</strong><small>Update the introduction and four highlight videos.</small><span class="admin-quick-arrow">→</span></button><button type="button" class="admin-quick-card" data-view="seo"><span class="admin-quick-icon">◎</span><strong>SEO settings</strong><small>Manage search metadata and social previews.</small><span class="admin-quick-arrow">→</span></button></div>
      <div class="admin-note-panel"><span class="admin-note-symbol">i</span><div><strong>Safe editing workflow</strong><p>Use <b>Save draft</b> to keep an item private. Publishing and media changes are confirmed by the existing server API; always check the status message after saving.</p></div></div>`;
    const contentView = document.createElement('section'); contentView.className = 'admin-view'; contentView.dataset.adminView = 'content';
    const contentHeader = document.createElement('div'); contentHeader.className = 'admin-view-intro'; contentHeader.innerHTML = '<span class="admin-eyebrow">CONTENT EDITOR</span><h3 id="adminContentHeading">Work experience</h3><p>Edit structured content and manage saved items.</p>';
    // Keep existing handlers and all original IDs intact; only move their containers.
    navPanel.classList.add('admin-content-switcher');
    contentView.append(contentHeader, navPanel, formPanel, libraryPanel);
    const mediaView = document.createElement('section'); mediaView.className = 'admin-view'; mediaView.dataset.adminView = 'media'; mediaView.append(mediaPanel);
    const seoView = document.createElement('section'); seoView.className = 'admin-view'; seoView.dataset.adminView = 'seo'; seoView.append(seoPanel);
    const libraryView = document.createElement('section'); libraryView.className = 'admin-view'; libraryView.dataset.adminView = 'library';
    const libraryIntro = document.createElement('div'); libraryIntro.className = 'admin-view-intro'; libraryIntro.innerHTML = '<span class="admin-eyebrow">PUBLISHING</span><h3>Content library</h3><p>Review saved, draft, scheduled, and published entries. Select an item to edit or remove it.</p>';
    libraryView.append(libraryIntro, libraryPanel);
    viewHost.append(overview, contentView, mediaView, seoView, libraryView);
    main.append(top, viewHost); layout.append(sidebar, main); workspace.append(layout);

    function activate(view, contentType) {
      if (contentType) {
        type = contentType;
        document.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('active', b.dataset.type === type));
        $('formTitle').textContent = `Add ${type === 'experiences' ? 'work experience' : 'project'}`;
        $('adminContentHeading').textContent = type === 'experiences' ? 'Work experience' : 'Projects';
        reset(); load().catch(e => msg('saveMsg', e.message));
      }
      viewHost.querySelectorAll('[data-admin-view]').forEach(el => el.classList.toggle('is-current', el.dataset.adminView === view));
      sidebar.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('is-active', el.dataset.view === view && (!el.dataset.contentType || el.dataset.contentType === (contentType || type))));
      $('adminCurrentTitle').textContent = ({overview:'Overview',content:type === 'experiences' ? 'Work experience' : 'Projects',media:'About & media',seo:'SEO settings',library:'Content library'})[view] || 'Overview';
      sidebar.classList.remove('is-open');
      window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
    sidebar.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.view, btn.dataset.contentType)));
    viewHost.querySelectorAll('.admin-quick-card').forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.view, btn.dataset.contentType)));
    $('adminThemeToggle').addEventListener('click', () => {
      const root = document.documentElement; const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next; try { localStorage.setItem('portfolio_admin_theme', next); } catch {}
      $('adminThemeToggle').setAttribute('aria-label', `Switch to ${next === 'dark' ? 'dark' : 'light'} theme`);
    });
    try { const savedTheme = localStorage.getItem('portfolio_admin_theme'); if (savedTheme === 'dark' || savedTheme === 'light') document.documentElement.dataset.theme = savedTheme; } catch {}
    $('adminMobileNav').addEventListener('click', () => sidebar.classList.toggle('is-open'));
    const oldLogout = $('logoutBtn'); if (oldLogout) { oldLogout.textContent = 'Sign out'; oldLogout.classList.add('admin-signout'); sidebar.append(oldLogout); }
    const oldViewSite = document.querySelector('.topbar nav a'); if (oldViewSite) { oldViewSite.setAttribute('href','about.html'); oldViewSite.setAttribute('target','_blank'); oldViewSite.setAttribute('rel','noopener'); }
    activate('overview');
  }
  const originalShow = show;
  show = function() { mountAdminShell(); originalShow(); };
  if(token) show();
})();
