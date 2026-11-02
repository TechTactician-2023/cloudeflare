(() => {
  const target = document.getElementById('aboutMedia');
  const videoGrid = document.getElementById('aboutVideoGrid');
  if (!target && !videoGrid) return;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeMediaSource = (value, kind) => {
    const src = String(value ?? '').trim();
    if (!src || /(^|\/)\.\.(?:\/|$)/.test(src) || src.includes('\\')) return '';
    if (/^https:\/\//i.test(src)) return src;
    if (kind === 'image' && /^\/media\/[a-z0-9-]+\.(jpg|png|webp|gif|avif)$/i.test(src)) return src;
    if (kind === 'video' && /^\/media\/[a-z0-9-]+\.(mp4|m4v|webm|ogv|ogg)$/i.test(src)) return src;
    const pattern = kind === 'image'
      ? /^(\/?\.?\/?assets\/images\/)[a-z0-9_./-]+\.(jpe?g|png|webp|gif|avif)$/i
      : /^(\/?\.?\/?assets\/videos\/)[a-z0-9_./-]+\.(mp4|m4v|webm|ogv|ogg)$/i;
    return pattern.test(src) ? '/' + src.replace(/^\.\//, '').replace(/^\//, '') : '';
  };
  const videoEmbed = (value, autoplay = false) => {
    try {
      const u = new URL(String(value || '').trim());
      if (u.protocol !== 'https:') return '';
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = u.pathname.split('/').filter(Boolean)[0] || '';
        return /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}${autoplay ? '?autoplay=1&rel=0' : ''}` : '';
      }
      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
        const pathParts = u.pathname.split('/').filter(Boolean);
        const id = u.searchParams.get('v') || ((pathParts[0] === 'embed' || pathParts[0] === 'shorts' || pathParts[0] === 'live') ? pathParts[1] : '');
        return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? `https://www.youtube-nocookie.com/embed/${id}${autoplay ? '?autoplay=1&rel=0' : ''}` : '';
      }
      if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        const id = u.pathname.split('/').filter(Boolean).reverse().find(part => /^\d{5,12}$/.test(part));
        return id ? `https://player.vimeo.com/video/${id}${autoplay ? '?autoplay=1' : ''}` : '';
      }
      return '';
    } catch { return ''; }
  };
  const videoType = (value) => {
    const path = String(value || '').split('?')[0].toLowerCase();
    if (/\.(mp4|m4v)$/.test(path)) return 'video/mp4';
    if (/\.webm$/.test(path)) return 'video/webm';
    if (/\.(ogv|ogg)$/.test(path)) return 'video/ogg';
    return '';
  };
  const videoMarkup = (value, title, cls = '', poster = '') => {
    const source = safeMediaSource(value, 'video');
    if (!source) return '';
    const embed = videoEmbed(source);
    if (embed) return `<iframe class="${cls}" src="${esc(embed)}" title="${esc(title || 'Video player')}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    const mime = videoType(source);
    return `<video class="${cls}" controls playsinline preload="metadata"${poster ? ` poster="${esc(poster)}"` : ''} aria-label="${esc(title || 'Video player')}" data-i18n-aria="Video player"><source src="${esc(source)}"${mime ? ` type="${mime}"` : ''}>${esc('Your browser cannot play this video. Use MP4 (H.264), WebM, or OGG/OGV, or use a public YouTube/Vimeo link.')}</video>`;
  };
  const defaultSlots = [
    { title: 'Wireless installations', caption: 'Point-to-point links, access-point installation, alignment, and signal checks.', video: '', poster: '' },
    { title: 'Network troubleshooting', caption: 'Field diagnostics to identify faults and restore customer connectivity.', video: '', poster: '' },
    { title: 'Network monitoring', caption: 'Tracking device availability, link stability, and overall network health.', video: '', poster: '' },
    { title: 'Automation in practice', caption: 'Repeatable configuration changes and device management with Ansible.', video: '', poster: '' }
  ];

  let activeIndex = 0;
  let dragState = null;
  let observer = null;
  const viewport = document.getElementById('aboutVideoViewport');
  const pagination = document.getElementById('aboutVideoPagination');
  const status = document.getElementById('aboutVideoSlideStatus');
  const prevButton = document.querySelector('[data-video-prev]');
  const nextButton = document.querySelector('[data-video-next]');
  const dialog = document.getElementById('aboutVideoDialog');
  const dialogStage = document.getElementById('aboutVideoDialogStage');
  const dialogTitle = document.getElementById('aboutVideoDialogTitle');
  const dialogCaption = document.getElementById('aboutVideoDialogCaption');
  const dialogError = document.getElementById('aboutVideoDialogError');
  const closeButton = document.querySelector('[data-video-close]');
  let lastTrigger = null;
  let currentOffset = 0;
  let suppressClickUntil = 0;

  const getSlides = () => videoGrid ? Array.from(videoGrid.querySelectorAll('.about-video-card')) : [];
  const offsetForIndex = (index) => {
    const slides = getSlides();
    if (!viewport || !videoGrid || !slides.length) return 0;
    const sideSpace = Math.max(0, Math.round((viewport.clientWidth - slides[0].getBoundingClientRect().width) / 2));
    // Symmetric end gutters let both the first and last card align centrally.
    videoGrid.style.paddingInlineStart = `${sideSpace}px`;
    videoGrid.style.paddingInlineEnd = `${sideSpace}px`;
    const safeIndex = Math.max(0, Math.min(index, slides.length - 1));
    const slide = slides[safeIndex];
    const desired = Math.round((viewport.clientWidth - slide.offsetWidth) / 2 - slide.offsetLeft);
    const minOffset = Math.min(0, Math.round(viewport.clientWidth - videoGrid.scrollWidth));
    // Clamp to the real track bounds after symmetric end gutters are applied.
    return Math.max(minOffset, Math.min(0, desired));
  };
  const applyOffset = (offset, animate = true) => {
    if (!videoGrid) return;
    videoGrid.classList.toggle('is-dragging', !animate);
    currentOffset = offset;
    videoGrid.style.transform = `translate3d(${offset}px, 0, 0)`;
  };
  const updateCarousel = (animate = true) => {
    const slides = getSlides();
    if (!slides.length) return;
    activeIndex = Math.max(0, Math.min(activeIndex, slides.length - 1));
    applyOffset(offsetForIndex(activeIndex), animate);
    slides.forEach((slide, index) => {
      slide.classList.toggle('is-active', index === activeIndex);
      slide.setAttribute('aria-label', `${index + 1} of ${slides.length}`);
      slide.setAttribute('aria-roledescription', 'slide');
    });
    if (pagination) {
      pagination.querySelectorAll('[data-video-dot]').forEach((dot, index) => {
        const selected = index === activeIndex;
        dot.classList.toggle('is-active', selected);
        if (selected) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    }
    if (status) status.textContent = `Video ${activeIndex + 1} of ${slides.length}`;
    if (prevButton) prevButton.disabled = activeIndex === 0;
    if (nextButton) nextButton.disabled = activeIndex === slides.length - 1;
  };
  const goTo = (index, animate = true) => {
    const slides = getSlides();
    if (!slides.length) return;
    activeIndex = Math.max(0, Math.min(index, slides.length - 1));
    updateCarousel(animate);
  };
  const buildPagination = () => {
    if (!pagination) return;
    const slides = getSlides();
    pagination.innerHTML = slides.map((_, index) => `<button type="button" class="about-video-dot" data-video-dot="${index}" aria-label="Go to video ${index + 1}" data-i18n-aria="Go to video ${index + 1}"><span class="sr-only">Video ${index + 1} of ${slides.length}</span></button>`).join('');
    pagination.querySelectorAll('[data-video-dot]').forEach(dot => dot.addEventListener('click', () => goTo(Number(dot.dataset.videoDot))));
  };

  const renderVideoSlots = (about = {}) => {
    const grid = document.getElementById('aboutVideoGrid');
    if (!grid) return;
    const slots = Array.isArray(about.videoSlots) ? about.videoSlots : [];
    const fragment = document.createDocumentFragment();
    defaultSlots.forEach((fallback, index) => {
      const data = slots[index] || {};
      const title = String(data.title || fallback.title).slice(0, 160);
      const caption = String(data.caption || fallback.caption).slice(0, 300);
      const video = safeMediaSource(data.video, 'video');
      const poster = safeMediaSource(data.poster, 'image');
      const article = document.createElement('article');
      article.className = 'about-video-card';
      article.dataset.videoSlot = String(index + 1);
      article.dataset.videoTitle = title;
      article.dataset.videoCaption = caption;
      article.dataset.videoUrl = video;
      article.dataset.videoPoster = poster;
      const frame = document.createElement('div');
      frame.className = 'about-video-frame';
      if (poster) {
        const posterImage = document.createElement('img');
        posterImage.className = 'about-video-poster';
        posterImage.src = poster;
        posterImage.alt = '';
        posterImage.loading = 'lazy';
        posterImage.decoding = 'async';
        posterImage.setAttribute('aria-hidden', 'true');
        posterImage.addEventListener('error', () => posterImage.remove(), { once: true });
        frame.appendChild(posterImage);
      }
      const launch = document.createElement('button');
      launch.type = 'button';
      launch.className = 'about-video-launch';
      if (!video) {
        launch.disabled = true;
        launch.setAttribute('aria-label', 'Add a video from the admin panel.');
        launch.setAttribute('data-i18n-aria', 'Add a video from the admin panel.');
        launch.innerHTML = '<span class="about-video-play-icon" aria-hidden="true">▶</span><span class="about-video-frame-hint">Add a video from the admin panel.</span>';
      } else {
        launch.setAttribute('aria-label', 'Play video');
        launch.setAttribute('data-i18n-aria', 'Play video');
        launch.innerHTML = '<span class="about-video-play-icon" aria-hidden="true">▶</span><span class="sr-only">Play video</span>';
      }
      frame.appendChild(launch);
      const info = document.createElement('div');
      info.className = 'about-video-info';
      const heading = document.createElement('h3');
      heading.textContent = title;
      const description = document.createElement('p');
      description.textContent = caption;
      info.append(heading, description);
      article.append(frame, info);
      fragment.appendChild(article);
    });
    grid.replaceChildren(fragment);
    buildPagination();
    updateCarousel(false);
  };

  const mediaFrame = (about) => {
    const videoSource = safeMediaSource(about.video, 'video');
    if (videoSource) {
      return `<figure class="about-media-frame about-video-frame">${videoMarkup(videoSource, 'Introduction video')}<figcaption>Introduction video</figcaption></figure>`;
    }
    const imageSource = safeMediaSource(about.image, 'image');
    if (imageSource) {
      return `<figure class="about-media-frame"><img src="${esc(imageSource)}" alt="Professional profile" data-i18n-aria="Professional profile" loading="lazy" decoding="async"><figcaption>About me</figcaption></figure>`;
    }
    return `<div class="about-media-placeholder" role="img" aria-label="Reserved space for an About image or video" data-i18n-aria="Reserved space for an About image or video"><span class="about-media-placeholder-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="9" r="1.5" stroke="currentColor" stroke-width="1.5"/><path d="m5 17 5-5 3 3 2-2 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="about-media-placeholder-label">MEDIA SPACE</span></div>`;
  };

  const closeModal = () => {
    if (dialogStage) {
      dialogStage.querySelectorAll('video').forEach(player => {
        try { player.pause(); player.removeAttribute('src'); player.querySelectorAll('source').forEach(source => source.removeAttribute('src')); player.load(); } catch {}
      });
      dialogStage.querySelectorAll('iframe').forEach(player => { try { player.src = 'about:blank'; } catch {} });
    }
    if (dialog && dialog.open) dialog.close();
    if (dialogStage) dialogStage.replaceChildren();
    if (dialogError) dialogError.hidden = true;
    document.body.classList.remove('about-video-modal-open');
  };
  const openModal = (trigger) => {
    if (!dialog || !dialogStage) return;
    const card = trigger.closest('.about-video-card');
    const source = safeMediaSource(card?.dataset.videoUrl, 'video');
    if (!source) return;
    const poster = safeMediaSource(card?.dataset.videoPoster, 'image');
    lastTrigger = trigger;
    if (dialogTitle) dialogTitle.textContent = card.dataset.videoTitle || 'Video';
    if (dialogCaption) dialogCaption.textContent = card.dataset.videoCaption || '';
    if (dialogError) dialogError.hidden = true;
    dialogStage.innerHTML = videoMarkup(source, card.dataset.videoTitle || 'Video player', 'about-video-player', poster);
    const iframe = dialogStage.querySelector('iframe');
    const video = dialogStage.querySelector('video');
    if (iframe) {
      const embed = videoEmbed(source, true);
      if (embed) iframe.src = embed;
      iframe.setAttribute('allow', 'autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('allowfullscreen', '');
    }
    if (video) {
      video.preload = 'metadata';
      video.autoplay = true;
      video.addEventListener('error', () => { if (dialogError) dialogError.hidden = false; }, { once: true });
    }
    try {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else { dialog.setAttribute('open', ''); dialog.classList.add('is-fallback-open'); }
    } catch { dialog.setAttribute('open', ''); dialog.classList.add('is-fallback-open'); }
    document.body.classList.add('about-video-modal-open');
    closeButton?.focus();
    if (video) video.play().catch(() => {});
  };

  const setupCarouselEvents = () => {
    if (prevButton && !prevButton.dataset.bound) { prevButton.dataset.bound = 'true'; prevButton.addEventListener('click', () => goTo(activeIndex - 1)); }
    if (nextButton && !nextButton.dataset.bound) { nextButton.dataset.bound = 'true'; nextButton.addEventListener('click', () => goTo(activeIndex + 1)); }
    if (viewport && !viewport.dataset.bound) {
      viewport.dataset.bound = 'true';
      viewport.addEventListener('keydown', event => {
        if (event.target.closest('button, video, iframe, a, input')) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(activeIndex - 1); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); goTo(activeIndex + 1); }
        else if (event.key === 'Home') { event.preventDefault(); goTo(0); }
        else if (event.key === 'End') { event.preventDefault(); goTo(getSlides().length - 1); }
      });
      viewport.addEventListener('pointerdown', event => {
        if (event.button !== undefined && event.button !== 0) return;
        if (event.target.closest('button:not(.about-video-launch), video, iframe, a, input, select, textarea')) return;
        const slides = getSlides();
        if (slides.length < 2) return;
        dragState = { pointerId: event.pointerId, x: event.clientX, delta: 0, moved: false, captured: false, startOffset: offsetForIndex(activeIndex) };
        viewport.classList.add('is-pointer-dragging');
      });
      viewport.addEventListener('pointermove', event => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        dragState.delta = event.clientX - dragState.x;
        if (Math.abs(dragState.delta) > 6) {
          dragState.moved = true;
          if (event.cancelable) event.preventDefault();
          if (!dragState.captured) { try { viewport.setPointerCapture(event.pointerId); dragState.captured = true; } catch {} }
        }
        applyOffset(dragState.startOffset + dragState.delta, false);
      });
      const finishDrag = event => {
        if (!dragState || (event && event.pointerId !== undefined && event.pointerId !== dragState.pointerId)) return;
        const delta = dragState.delta;
        const moved = Boolean(dragState.moved);
        dragState = null;
        if (moved && Math.abs(delta) > Math.max(36, viewport.clientWidth * 0.1)) suppressClickUntil = Date.now() + 450;
        viewport.classList.remove('is-pointer-dragging');
        if (Math.abs(delta) > Math.max(36, viewport.clientWidth * 0.1)) goTo(activeIndex + (delta < 0 ? 1 : -1));
        else updateCarousel(true);
      };
      // Convert mouse-wheel/trackpad movement into predictable one-card navigation.
      viewport.addEventListener('wheel', event => {
        if (getSlides().length < 2 || Math.abs(event.deltaX) + Math.abs(event.deltaY) < 8) return;
        event.preventDefault();
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        goTo(activeIndex + (delta > 0 ? 1 : -1));
      }, { passive: false });
      viewport.addEventListener('pointerup', finishDrag);
      viewport.addEventListener('pointercancel', finishDrag);
      viewport.addEventListener('lostpointercapture', finishDrag);
    }
    if (videoGrid && !videoGrid.dataset.bound) {
      videoGrid.dataset.bound = 'true';
      videoGrid.addEventListener('click', event => {
        if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        const trigger = event.target.closest('[data-video-open], .about-video-launch:not(:disabled)');
        if (trigger) { openModal(trigger); return; }
        const card = event.target.closest('.about-video-card');
        if (card) { const index = getSlides().indexOf(card); if (index >= 0 && index !== activeIndex) goTo(index); }
      });
    }
    if (closeButton && !closeButton.dataset.bound) { closeButton.dataset.bound = 'true'; closeButton.addEventListener('click', closeModal); }
    if (dialog && !dialog.dataset.bound) {
      dialog.dataset.bound = 'true';
      dialog.addEventListener('close', () => {
        if (dialogStage) dialogStage.replaceChildren();
        if (dialogError) dialogError.hidden = true;
        document.body.classList.remove('about-video-modal-open');
        if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
      });
      dialog.addEventListener('cancel', () => { document.body.classList.remove('about-video-modal-open'); });
      dialog.addEventListener('click', event => { if (event.target === dialog) closeModal(); });
      // Native <dialog> closes on Escape; this fallback covers browsers where showModal() is unavailable.
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && dialog.classList.contains('is-fallback-open')) {
          event.preventDefault();
          closeModal();
        }
      }, true);
    }
    if (observer) observer.disconnect();
    if (viewport && 'ResizeObserver' in window) {
      observer = new ResizeObserver(() => updateCarousel(false));
      observer.observe(viewport);
    } else window.addEventListener('resize', () => updateCarousel(false), { passive: true });
  };

  const render = (about = {}) => {
    if (target) {
      target.innerHTML = mediaFrame(about);
      target.hidden = false;
      target.classList.add('about-media-ready');
    }
    renderVideoSlots(about);
    setupCarouselEvents();
  };

  if (target) target.addEventListener('error', event => {
    const media = event.target;
    if (media instanceof HTMLImageElement || media instanceof HTMLVideoElement || media instanceof HTMLIFrameElement) {
      const frame = media.closest('.about-media-frame');
      if (frame) {
        const placeholder = document.createElement('div');
        placeholder.className = 'about-media-placeholder';
        placeholder.setAttribute('role', 'img');
        placeholder.setAttribute('aria-label', 'Reserved space for an About image or video');
        placeholder.setAttribute('data-i18n-aria', 'Reserved space for an About image or video');
        placeholder.textContent = 'MEDIA SPACE';
        frame.replaceWith(placeholder);
      }
    }
  }, true);

  fetch('/api/content?type=about', { headers: { Accept: 'application/json' } })
    .then(r => r.ok ? r.json() : null)
    .then(data => render(data?.about || {}))
    .catch(() => render({}));
})();
