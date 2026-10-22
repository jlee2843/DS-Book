/* Progressive enhancement: keep the original outline as the no-JS fallback. */
(() => {
  if (window.dsSectionsInstalled) return;
  window.dsSectionsInstalled = true;
  let current, signature = '', queued = false;
  function refresh() {
    queued = false;
    const article = document.querySelector('.article.content');
    if (!article || article.querySelector('.intro-author')) {
      current?.remove(); current = null; signature = ''; return;
    }
    // MyST creates this outline only after client hydration.
    if (!article.querySelector('.myst-outline-section')) return;
    const proposal = article.querySelector('details.proposal-toc');
    const source = proposal || article.querySelector('.myst-outline-section');
    if (!source) return;
    const entries = proposal
      ? [...proposal.querySelectorAll('a[href*="#"]')].map(a => [a.getAttribute('href'), a.textContent.trim()])
      : [...article.querySelectorAll('h2[id]')].map(h => ['#' + h.id, h.textContent.replace(/¶/g, '').trim()]);
    if (!entries.length) return;
    const key = location.pathname + JSON.stringify(entries);
    if (current?.isConnected && signature === key) return;
    current?.remove(); signature = key;
    const wrapper = document.createElement('div');
    wrapper.className = 'ds-sections';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'ds-sections-trigger';
    button.textContent = 'Sections'; button.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('nav');
    menu.id = 'ds-sections-menu'; menu.className = 'ds-sections-menu';
    menu.hidden = true; menu.setAttribute('aria-label', 'Sections');
    button.setAttribute('aria-controls', menu.id);
    for (const [href, label] of entries) {
      const link = document.createElement('a'); link.href = href; link.textContent = label;
      link.addEventListener('click', () => close());
      menu.append(link);
    }
    function close() { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); }
    button.addEventListener('click', () => {
      const open = menu.hidden;
      menu.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) {
        const headings = [...article.querySelectorAll('h2[id]')];
        const active = headings.filter(h => h.getBoundingClientRect().top <= 130).at(-1) || headings[0];
        for (const a of menu.querySelectorAll('a')) {
          if (a.hash === '#' + active?.id || (!active && a.hash === location.hash)) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        }
      }
    });
    wrapper.addEventListener('keydown', event => {
      if (event.key === 'Escape') { close(); button.focus(); }
    });
    wrapper.addEventListener('focusout', event => {
      if (!wrapper.contains(event.relatedTarget)) close();
    });
    wrapper.append(button, menu);
    source.before(wrapper); source.classList.add('ds-sections-source');
    current = wrapper;
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(refresh); } }
  new MutationObserver(schedule).observe(document, {childList: true, subtree: true});
  function dismiss() {
    const menu = current?.querySelector('.ds-sections-menu');
    if (menu) menu.hidden = true;
    current?.querySelector('button')?.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('pointerdown', event => { if (!current?.contains(event.target)) dismiss(); });
  addEventListener('resize', dismiss);
  schedule();
})();

