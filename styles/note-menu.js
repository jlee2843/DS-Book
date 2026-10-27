/* Notebook navigation uses one RPG selection window instead of individual cards. */
(() => {
  if (window.dsNoteMenusInstalled) return;
  window.dsNoteMenusInstalled = true;
  const mounted = new WeakMap();
  let queued = false;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function update() {
    queued = false;
    document.querySelectorAll('.article.content .myst-grid').forEach(grid => {
      if (grid.closest('.home-pixel')) return;
      const cards = [...grid.children].filter(e => e.matches('a.myst-card'));
      if (!cards.length) return;
      const entries = cards.map(card => ({
        name: card.querySelector('.myst-card-title,.myst-card-header')?.textContent.trim() || card.textContent.trim(),
        description: [...card.querySelectorAll('p')].map(p => p.textContent.trim()).join(' '),
        href: card.href
      }));
      const signature = JSON.stringify(entries);
      if (mounted.get(grid) === signature && grid.querySelector('.rpg-note-window')) return;
      mounted.set(grid, signature);
      grid.querySelector('.rpg-note-window')?.remove();
      grid.classList.add('rpg-note-grid');
      const base = new URL(document.querySelector('.myst-home-link')?.href || location.origin).pathname.replace(/\/$/, '');
      const segments = location.pathname.slice(base.length).split('/').filter(Boolean);
      const submenu = segments.length > 2;
      const windowEl = document.createElement('section');
      windowEl.className = 'rpg-note-window' + (submenu ? ' rpg-note-submenu' : '');
      windowEl.setAttribute('aria-label', 'Select a note');
      windowEl.innerHTML = '<div class="rpg-note-caption">SELECT A NOTE</div><div class="rpg-note-inner"><nav class="rpg-note-choices" aria-label="Notes"></nav><section class="rpg-note-preview" aria-live="polite"></section></div>';
      const choices = windowEl.querySelector('.rpg-note-choices');
      const preview = windowEl.querySelector('.rpg-note-preview');
      entries.forEach((entry, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'rpg-note-choice';
        button.innerHTML = `<span class="rpg-note-cursor" aria-hidden="true">▶</span><span class="rpg-note-index">${String(index + 1).padStart(2,'0')}</span><span>${escape(entry.name)}</span>`;
        button.addEventListener('click', () => select(index));
        choices.append(button);
      });
      function select(index) {
        [...choices.children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
        const entry = entries[index];
        preview.innerHTML = `<div class="rpg-note-number" aria-hidden="true">${String(index + 1).padStart(2,'0')}</div><div class="rpg-note-title">${escape(entry.name)}</div>${entry.description ? `<p>${escape(entry.description)}</p>` : ''}<a class="rpg-note-open" href="${escape(entry.href)}">OPEN NOTE →</a>`;
      }
      select(0);
      grid.append(windowEl);
    });
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(update); } }
  new MutationObserver(schedule).observe(document, {childList:true,subtree:true});
  schedule();
})();
