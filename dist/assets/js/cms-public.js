(() => {
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  // Paths entered in the admin panel are treated as site-root paths, so they
  // work consistently from index.html, projects.html, and experience.html.
  const imageSource = (value) => {
    const src = String(value ?? '').trim();
    if (!src) return '';
    if (/^https:\/\//i.test(src)) return src;
    if (/^(\/|\.\/)?assets\/images\//i.test(src)) return '/' + src.replace(/^\.\//, '').replace(/^\//, '');
    return '';
  };

  const imageMarkup = (value, alt) => {
    const src = imageSource(value);
    if (!src) return '';
    return `<div class="cms-photo-slot"><img src="${escapeHTML(src)}" alt="${escapeHTML(alt)}" loading="lazy" decoding="async"></div>`;
  };

  function experienceCard(item) {
    return `<article class="job-card">
      ${imageMarkup(item.image, item.title)}
      <div class="job-top"><div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.subtitle)}</p></div><span class="date">${escapeHTML(item.date)}</span></div>
      ${item.description ? `<p>${escapeHTML(item.description)}</p>` : ''}
      ${item.bullets?.length ? `<ul>${item.bullets.map((bullet) => `<li>${escapeHTML(bullet)}</li>`).join('')}</ul>` : ''}
    </article>`;
  }

  function projectCard(item, index) {
    return `<article class="project-card">
      ${imageMarkup(item.image, item.title)}
      <div class="project-num">PROJECT ${String(index + 1).padStart(2, '0')}</div>
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.description || item.subtitle || '')}</p>
      ${item.tags?.length ? `<div class="tag-list">${item.tags.map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}</div>` : ''}
    </article>`;
  }

  async function hydrate(type, container) {
    try {
      const response = await fetch(`/api/content?type=${encodeURIComponent(type)}`, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data.items) || data.items.length === 0) return;
      container.innerHTML = data.items.map((item, index) =>
        type === 'experiences' ? experienceCard(item) : projectCard(item, index)
      ).join('');
    } catch {
      // Keep built-in static content visible if the API is temporarily unavailable.
    }
  }

  document.querySelectorAll('[data-cms-list]').forEach((container) => {
    hydrate(container.dataset.cmsList, container);
  });

  // Hide a missing image instead of showing the browser's broken-image icon.
  document.addEventListener('error', (event) => {
    if (event.target instanceof HTMLImageElement && event.target.closest('.cms-photo-slot')) {
      event.target.closest('.cms-photo-slot').classList.add('image-unavailable');
      event.target.remove();
    }
  }, true);
})();
