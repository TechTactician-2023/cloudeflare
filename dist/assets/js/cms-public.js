(() => {
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const safeSource = (value, kind) => {
    const src = String(value ?? '').trim();
    if (!src || /(^|\/)\.\.(?:\/|$)/.test(src) || src.includes('\\')) return '';
    if (/^https:\/\//i.test(src)) return src;
    if (kind === 'image' && /^\/media\/[a-z0-9-]+\.(jpg|png|webp|gif|avif)$/i.test(src)) return src;
    if (kind === 'video' && /^\/media\/[a-z0-9-]+\.(mp4|webm|ogv|ogg)$/i.test(src)) return src;
    const pattern = kind === 'image'
      ? /^(\/?\.?\/?assets\/images\/)[a-z0-9_./-]+\.(jpe?g|png|webp|gif|avif)$/i
      : /^(\/?\.?\/?assets\/videos\/)[a-z0-9_./-]+\.(mp4|m4v|webm|ogv|ogg)$/i;
    if (pattern.test(src)) return '/' + src.replace(/^\.\//, '').replace(/^\//, '');
    return '';
  };

  const videoEmbed = (value) => {
    try {
      const u = new URL(String(value || '').trim());
      if (u.protocol !== 'https:') return '';
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = u.pathname.split('/').filter(Boolean)[0] || '';
        return /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : '';
      }
      if (['youtube.com','m.youtube.com','youtube-nocookie.com'].includes(host)) {
        const parts = u.pathname.split('/').filter(Boolean);
        const id = u.searchParams.get('v') || ((['embed','shorts','live'].includes(parts[0])) ? parts[1] : '');
        return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? `https://www.youtube-nocookie.com/embed/${id}` : '';
      }
      if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        const id = u.pathname.split('/').filter(Boolean).reverse().find(part => /^\d{5,12}$/.test(part));
        return id ? `https://player.vimeo.com/video/${id}` : '';
      }
      return '';
    } catch { return ''; }
  };

  const videoMime = (value) => {
    const path = String(value || '').split('?')[0].toLowerCase();
    if (/\.(mp4|m4v)$/.test(path)) return 'video/mp4';
    if (/\.webm$/.test(path)) return 'video/webm';
    if (/\.(ogv|ogg)$/.test(path)) return 'video/ogg';
    return '';
  };

  const mediaMarkup = (item, type = 'project') => {
    // A selected video takes precedence over an image. Native video files use HTML5 controls;
    // public YouTube/Vimeo watch URLs are converted to provider embed URLs.
    const video = safeSource(item.video, 'video');
    if (video) {
      const embed = videoEmbed(video);
      const title = escapeHTML(item.title || 'Content video');
      if (embed) {
        return `<div class="cms-photo-slot cms-media-slot cms-card-media cms-embed-media"><iframe src="${escapeHTML(embed)}" title="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
      }
      const mime = videoMime(video);
      return `<div class="cms-photo-slot cms-media-slot cms-card-media"><video controls preload="metadata" playsinline aria-label="${title}"><source src="${escapeHTML(video)}"${mime ? ` type="${mime}"` : ''}>Your browser cannot play this video. Use MP4 (H.264), WebM, or OGG/OGV, or use a public YouTube/Vimeo link.</video></div>`;
    }
    const image = safeSource(item.image, 'image');
    if (image) return `<div class="cms-photo-slot cms-card-media"><img src="${escapeHTML(image)}" alt="${escapeHTML(item.title || 'Content image')}" loading="lazy" decoding="async"></div>`;
    const label = type === 'experience' ? 'Professional experience' : 'Project media';
    return `<div class="cms-photo-slot cms-media-placeholder" role="img" aria-label="${label}" data-i18n-aria="${label}"><span class="cms-placeholder-mark" aria-hidden="true">✦</span><span>${label}</span></div>`;
  };

  function experienceCard(item) {
    const logo = safeSource(item.logo, 'image');
    const website = typeof item.website === 'string' && /^https:\/\//i.test(item.website.trim()) ? item.website.trim() : '';
    return `<article class="job-card experience-story" data-cms-item="true" data-cms-title="${escapeHTML(item.title)}" data-cms-subtitle="${escapeHTML(item.subtitle)}" data-cms-date="${escapeHTML(item.date)}" data-cms-description="${escapeHTML(item.description)}" data-cms-bullets="${escapeHTML(JSON.stringify(item.bullets || []))}">
      ${mediaMarkup(item, 'experience')}
      <div class="job-top"><div class="company-heading">${logo ? `<img class="company-logo" src="${escapeHTML(logo)}" alt="${escapeHTML(item.logoAlt || `${item.subtitle || 'Company'} logo`)}" loading="lazy" decoding="async">` : ''}<div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.subtitle)}</p>${website ? `<a class="company-website-link" href="${escapeHTML(website)}" target="_blank" rel="noopener noreferrer">Visit Company Website ↗</a>` : ''}</div></div><span class="date">${escapeHTML(item.date)}</span></div>
      ${item.description ? `<p class="experience-story-text">${escapeHTML(item.description)}</p>` : ''}
      ${item.bullets?.length ? `<ul>${item.bullets.map((bullet) => `<li>${escapeHTML(bullet)}</li>`).join('')}</ul>` : ''}
    </article>`;
  }

  function projectCard(item, index) {
    return `<article class="project-card">
      ${mediaMarkup(item)}
      <div class="project-num">PROJECT ${String(index + 1).padStart(2, '0')}</div>
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.description || item.subtitle || '')}</p>
      ${item.tags?.length ? `<div class="tag-list">${item.tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}</div>` : ''}
    </article>`;
  }

  async function hydrate(type, container) {
    try {
      const response = await fetch(`/api/content?type=${encodeURIComponent(type)}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data.items) || data.items.length === 0) return;
      // Keep built-in HTML content as a fallback. CMS items update matching cards and
      // append new ones instead of unexpectedly hiding every static card after the
      // first item is saved in D1.
      const titleOf = (card) => {
        const heading = card.querySelector('h3');
        const textNode = heading && heading.firstChild;
        return String((textNode && textNode.__originalText) || heading?.textContent || '').trim().toLocaleLowerCase();
      };
      const subtitleOf = (card) => String(card.querySelector('.job-top p')?.textContent || '').trim().toLocaleLowerCase();
      const existing = [...container.children];
      const used = new Set();
      data.items.forEach((item, index) => {
        const title = String(item.title || '').trim().toLocaleLowerCase();
        let match = existing.find(oldCard => !used.has(oldCard) && titleOf(oldCard) === title);
        if (!match && type === 'experiences' && item.subtitle) {
          const subtitle = String(item.subtitle).trim().toLocaleLowerCase();
          match = existing.find(oldCard => !used.has(oldCard) && subtitleOf(oldCard) === subtitle);
        }
        // Preserve the locally configured company mark and website link on text-only edits.
        if (type === 'experiences' && match) {
          const oldLogo = match.querySelector('.company-logo');
          if (!item.logo && oldLogo) { item.logo = oldLogo.getAttribute('src') || ''; item.logoAlt = oldLogo.getAttribute('alt') || ''; }
          const oldWebsite = match.querySelector('.company-website-link');
          if (!item.website && oldWebsite) item.website = oldWebsite.getAttribute('href') || '';
        }
        // Preserve a locally configured image/video when the matching CMS record has no media URL.
        const hasCMSMedia = Boolean(safeSource(item.video, 'video') || safeSource(item.image, 'image'));
        if (match && !hasCMSMedia) {
          item.video = ''; item.image = '';
          const oldVideo = match.querySelector('.cms-photo-slot video source')?.getAttribute('src');
          const oldImage = match.querySelector('.cms-photo-slot img')?.getAttribute('src');
          if (oldVideo) item.video = oldVideo;
          else if (oldImage) item.image = oldImage;
          else if (type === 'experiences' && /mikrogate/i.test(`${item.title || ''} ${item.subtitle || ''}`)) {
            item.image = '/assets/images/experience-mikrogate.jpg';
          }
        }
        const rendered = document.createElement('template');
        rendered.innerHTML = type === 'experiences' ? experienceCard(item) : projectCard(item, index);
        const card = rendered.content.firstElementChild;
        if (!card) return;
        if (match) {
          used.add(match);
          match.replaceWith(card);
        } else {
          container.append(card);
        }
      });
      container.dispatchEvent(new CustomEvent('portfolio:cms-rendered', { bubbles: true, detail: { type, count: data.items.length } }));
    } catch {
      // Keep the built-in static content visible if the API is temporarily unavailable.
    }
  }

  document.querySelectorAll('[data-cms-list]').forEach((container) => hydrate(container.dataset.cmsList, container));
  document.addEventListener('error', (event) => {
    const target = event.target;
    if ((target instanceof HTMLImageElement || target instanceof HTMLVideoElement) && target.closest('.cms-photo-slot')) {
      const frame = target.closest('.cms-photo-slot');
      frame.classList.add('image-unavailable');
      target.remove();
    }
  }, true);
})();
