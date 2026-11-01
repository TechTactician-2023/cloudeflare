/* Best-effort content copying deterrents. These are not a security boundary. */
(() => {
  'use strict';

  const editableSelector = [
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[role="textbox"]',
    '.allow-selection'
  ].join(',');

  const isEditable = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(editableSelector));
  };

  // The class is also present in each HTML document so CSS protection applies before this runs.
  document.documentElement.classList.add('protection-enabled');
  if (document.body) document.body.classList.add('protection-enabled');
  else document.addEventListener('DOMContentLoaded', () => document.body?.classList.add('protection-enabled'), { once: true });

  // Suppress the standard context menu over page content. Keep it available in form controls
  // so visitors and the administrator can use normal paste/edit workflows.
  document.addEventListener('contextmenu', (event) => {
    if (!isEditable(event.target)) event.preventDefault();
  }, true);

  // Disable common browser shortcuts for saving/printing and opening source/devtools when
  // the browser allows page scripts to intercept the key event.
  document.addEventListener('keydown', (event) => {
    const key = String(event.key || '').toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    const devtoolsModifier = event.ctrlKey || (event.metaKey && event.altKey);
    // Screenshot shortcuts are intercepted only where the OS/browser sends them to the page.
    // System-level capture tools may bypass webpage JavaScript entirely.
    const screenshotShortcut =
      key === 'printscreen' ||
      (event.shiftKey && event.metaKey && ['3', '4', '5', '6'].includes(key)) ||
      (event.shiftKey && (event.metaKey || event.ctrlKey) && key === 's');

    const blocked =
      key === 'f12' ||
      screenshotShortcut ||
      (modifier && ['s', 'u', 'p'].includes(key)) ||
      (event.ctrlKey && event.shiftKey && ['s', 'p'].includes(key)) ||
      (devtoolsModifier && event.shiftKey && ['i', 'j', 'c', 'k'].includes(key)) ||
      (event.metaKey && event.altKey && key === 'i');

    if (blocked) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
  }, true);

  // Discourage selecting/copying and dragging displayed content; editable fields remain usable.
  document.addEventListener('selectstart', (event) => {
    if (!isEditable(event.target)) event.preventDefault();
  }, true);

  for (const eventName of ['copy', 'cut']) {
    document.addEventListener(eventName, (event) => {
      if (!isEditable(event.target)) event.preventDefault();
    }, true);
  }

  document.addEventListener('dragstart', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('img, video, audio, picture, canvas')) {
      event.preventDefault();
    }
  }, true);

  // Reduce the chance of exposing the full page through ordinary print workflows.
  // Browser/OS screenshot tools and external cameras cannot be reliably disabled by a website.
  window.addEventListener('beforeprint', () => document.documentElement.classList.add('print-protected'));
  window.addEventListener('afterprint', () => document.documentElement.classList.remove('print-protected'));
})();
