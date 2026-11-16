/* Progress 3: enlarge the original SVG and inspect its recorded values. */
function mountProgressFigureViewer(root, svg, source) {
  const figure = svg.closest('figure');
  if (!figure || figure.dataset.figureViewer) return;
  figure.dataset.figureViewer = 'true';
  const states = mountProgressFigureViewer.states || (mountProgressFigureViewer.states = new WeakMap());
  let state = states.get(root);
  if (!state) { state = createProgressFigureViewer(root); states.set(root, state); }
  const metric = source.includes('faithfulness') ? 'Faithfulness' : 'Answer Relevancy';
  const names = {means:'Condition means', spread:'Response variation', repeatability:'Evaluation repeatability',
    completion:'Evaluation completion', repeats:'Repeated scores', diagnostics:'Regression diagnostics'};
  const kind = Object.keys(names).find(key => source.includes('-' + key));
  const title = svg.dataset.chartTitle || metric + ' / ' + (names[kind] || 'Results');
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'progress-figure-open';
  button.textContent = 'Enlarge ↗'; button.setAttribute('aria-label', 'Enlarge ' + title);
  button.setAttribute('aria-haspopup', 'dialog');
  figure.insertBefore(button, figure.firstChild);
  const entry = {figure, svg, title, button};
  state.entries.push(entry);
  button.addEventListener('click', () => state.open(entry));
  svg.classList.add('progress-figure-preview');
  svg.addEventListener('click', () => state.open(entry));
}

function createProgressFigureViewer(root) {
  const state = {entries:[], open};
  const dialog = document.createElement('dialog');
  dialog.className = 'ds-figure-dialog';
  dialog.setAttribute('aria-label', 'Progress 3 figure viewer');
  dialog.innerHTML = `
    <header class="ds-figure-heading"><div><span class="ds-figure-eyebrow">PROGRESS 03 / RESULTS</span><h2></h2></div><button type="button" data-action="close" aria-label="Close figure viewer">Close ×</button></header>
    <div class="ds-figure-toolbar">
      <div class="ds-figure-navigation"><button type="button" data-action="previous" aria-label="Previous figure">←</button><span class="ds-figure-counter" aria-live="polite"></span><button type="button" data-action="next" aria-label="Next figure">→</button></div>
      <div class="ds-figure-series" role="group" aria-label="Visible prompts"></div>
      <div class="ds-figure-zoom"><button type="button" data-action="fit">Fit</button><button type="button" data-action="out" aria-label="Zoom out">−</button><output aria-label="Zoom level">100%</output><button type="button" data-action="in" aria-label="Zoom in">+</button><button type="button" data-action="values" aria-expanded="false">Values</button></div>
    </div>
    <div class="ds-figure-content"><div class="ds-figure-viewport" tabindex="0" aria-label="Figure. Scroll to pan when zoomed."><div class="ds-figure-canvas"></div></div>
    <div class="ds-figure-values" hidden tabindex="0" aria-label="Plotted values"></div></div>
    <footer><p class="ds-figure-caption"></p><p class="ds-figure-hint">Hover or tap a point for values. Select prompts in the legend. Use + to zoom and drag to move.</p></footer>
    <div class="ds-figure-tooltip" role="status" hidden></div>`;
  const $ = selector => dialog.querySelector(selector);
  const viewport = $('.ds-figure-viewport'), canvas = $('.ds-figure-canvas');
  const valuesPanel = $('.ds-figure-values'), tooltip = $('.ds-figure-tooltip');
  const seriesBar = $('.ds-figure-series');
  let current, chart, zoom = 1, returnFocus, previousOverflow, marks = [], pinned = false, tooltipKey = '';
  let drag = null, dragged = false;
  const visible = new Set(['original','A','B','C']);
  const displayValue = value => value == null ? 'Not available' : typeof value === 'number'
    ? (Number.isInteger(value) ? String(value) : Number(value.toPrecision(6)).toString()) : String(value);
  function entries() {
    return state.entries.filter(e => e.figure.isConnected).sort((a,b) =>
      a.figure.compareDocumentPosition(b.figure) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  }
  function open(entry) {
    if (!dialog.isConnected) document.body.append(dialog);
    if (!dialog.open) {
      returnFocus = entry.button;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
    }
    current = entry;
    visible.clear(); ['original','A','B','C'].forEach(p => visible.add(p));
    render();
  }
  function cloneChart(original) {
    const copy = original.cloneNode(true), prefix = 'viewer-' + Math.random().toString(36).slice(2) + '-';
    const ids = new Map([...copy.querySelectorAll('[id]')].map(n => [n.id, prefix+n.id]));
    for (const node of copy.querySelectorAll('*')) for (const attr of [...node.attributes]) {
      let value = attr.value;
      if (attr.name === 'id') value = ids.get(value) || value;
      else {
        value = value.replace(/url\(#([^)]*)\)/g, (all,id) => ids.has(id) ? 'url(#'+ids.get(id)+')' : all);
        if (value.startsWith('#') && ids.has(value.slice(1))) value = '#'+ids.get(value.slice(1));
      }
      if (value !== attr.value) node.setAttributeNS(attr.namespaceURI, attr.name, value);
    }
    copy.classList.remove('progress-figure-preview');
    return copy;
  }
  function render() {
    zoom = 1; hideTip(); valuesPanel.hidden = true;
    $('[data-action="values"]').setAttribute('aria-expanded', 'false');
    $('.ds-figure-content').classList.remove('show-values');
    $('h2').textContent = current.title;
    $('.ds-figure-caption').textContent = current.figure.querySelector('figcaption')?.textContent.trim() || '';
    const list = entries(), index = list.indexOf(current);
    $('.ds-figure-counter').textContent = (index+1) + ' / ' + list.length;
    $('[data-action="previous"]').disabled = index === 0;
    $('[data-action="next"]').disabled = index === list.length-1;
    chart = cloneChart(current.svg); canvas.replaceChildren(chart);
    marks = [...chart.querySelectorAll('[data-value]')].map(node => ({node, data:JSON.parse(node.dataset.value)}));
    seriesBar.replaceChildren();
    for (const p of ['original','A','B','C']) {
      if (!chart.querySelector('[data-series="'+p+'"]')) continue;
      const button = document.createElement('button'); button.type = 'button'; button.dataset.series = p;
      button.textContent = ({original:'● Original', A:'■ A', B:'◆ B', C:'▲ C'})[p];
      button.setAttribute('aria-pressed', 'true');
      button.addEventListener('click', () => {
        if (visible.has(p)) visible.delete(p); else visible.add(p);
        button.setAttribute('aria-pressed', String(visible.has(p)));
        for (const node of chart.querySelectorAll('[data-series="'+p+'"]')) node.style.display = visible.has(p) ? '' : 'none';
        hideTip(); if (!valuesPanel.hidden) renderValues();
      });
      seriesBar.append(button);
    }
    // The toolbar replaces the static SVG legend only in the enlarged view.
    if (seriesBar.children.length) chart.querySelectorAll('[id*="legend_"]').forEach(n => n.remove());
    $('.ds-figure-hint').hidden = chart.getAttribute('data-chart-title')?.toLowerCase().includes('response scores') || false;
    $('.ds-figure-hint').textContent = seriesBar.children.length
      ? 'Hover or tap a point for values. Select prompts in the legend. Use + to zoom and drag to move.'
      : 'Hover or tap a point for values. Use + to zoom and drag to move.';
    requestAnimationFrame(() => { fit(); viewport.scrollTo(0,0); });
  }
  function fit() {
    if (!dialog.open || !chart) return;
    const box = chart.viewBox.baseVal, padding = 32;
    const width = Math.max(200, Math.min(viewport.clientWidth-padding, (viewport.clientHeight-padding)*box.width/box.height));
    canvas.style.width = Math.round(width*zoom) + 'px';
    canvas.style.height = Math.round(width*zoom*box.height/box.width) + 'px';
    $('output').textContent = Math.round(zoom*100)+'%';
    $('[data-action="out"]').disabled = zoom <= 1;
    $('[data-action="in"]').disabled = zoom >= 3;
    viewport.classList.toggle('is-zoomed', zoom > 1);
  }
  function hideTip() { pinned = false; tooltip.hidden = true; tooltipKey = ''; }
  function active(mark) {
    const series = mark.node.closest('[data-series]')?.dataset.series;
    return !series || visible.has(series);
  }
  function showTip(event) {
    const candidates = marks.filter(active).map(mark => {
      const rect = mark.node.getBoundingClientRect();
      const dx = Math.max(rect.left-event.clientX,0,event.clientX-rect.right);
      const dy = Math.max(rect.top-event.clientY,0,event.clientY-rect.bottom);
      return {...mark, rect, distance:Math.hypot(dx,dy)};
    }).filter(m => m.rect.width || m.rect.height).sort((a,b) => a.distance-b.distance);
    const target = event.target.closest('[data-value]');
    const nearest = candidates.find(m => m.node === target) || candidates[0];
    if (!nearest || nearest.distance > 14) { if (!pinned) hideTip(); return; }
    const hit = candidates.filter(m => m.data.kind === nearest.data.kind && m.distance <= nearest.distance+2);
    const unique = [...new Map(hit.map(m => [JSON.stringify(m.data),m.data])).values()];
    const key = JSON.stringify(unique);
    if (key !== tooltipKey) {
      tooltip.replaceChildren();
      for (const row of unique.slice(0,4)) {
        const block = document.createElement('div'), title = document.createElement('strong');
        title.textContent = row.kind; block.append(title);
        for (const [label,value] of Object.entries(row.values)) {
          const line = document.createElement('div'); line.textContent = label+': '+displayValue(value); block.append(line);
        }
        tooltip.append(block);
      }
      if (unique.length > 4) {
        const more = document.createElement('p'); more.textContent = unique.length+' overlapping values. Open Values for the full table.'; tooltip.append(more);
      }
      tooltipKey = key;
    }
    tooltip.hidden = false;
    const bounds = dialog.getBoundingClientRect();
    tooltip.style.left = Math.max(8,Math.min(event.clientX-bounds.left+18,dialog.clientWidth-tooltip.offsetWidth-12))+'px';
    tooltip.style.top = Math.max(8,Math.min(event.clientY-bounds.top+12,dialog.clientHeight-tooltip.offsetHeight-12))+'px';
  }
  function renderValues() {
    const rows = [...new Map(marks.filter(active).map(m => [JSON.stringify(m.data),m.data])).values()];
    valuesPanel.replaceChildren();
    const groups = [...new Set(rows.map(r => r.kind))];
    if (!groups.length) { valuesPanel.textContent = 'Select a prompt to show its values.'; return; }
    for (const kind of groups) {
      const records = rows.filter(r => r.kind === kind), columns = [...new Set(records.flatMap(r => Object.keys(r.values)))];
      const table = document.createElement('table'), caption = document.createElement('caption'); caption.textContent = kind;
      table.append(caption); const head = table.createTHead().insertRow();
      for (const label of columns) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; head.append(th); }
      const body = table.createTBody();
      for (const record of records) { const row = body.insertRow(); for (const label of columns) row.insertCell().textContent = displayValue(record.values[label]); }
      valuesPanel.append(table);
    }
  }
  function step(direction) {
    const list = entries(), next = list[list.indexOf(current)+direction];
    if (next) { current = next; visible.clear(); ['original','A','B','C'].forEach(p => visible.add(p)); render(); }
  }
  dialog.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'close') dialog.close();
    else if (action === 'previous' || action === 'next') step(action === 'next' ? 1 : -1);
    else if (action === 'values') {
      valuesPanel.hidden = !valuesPanel.hidden;
      $('.ds-figure-content').classList.toggle('show-values', !valuesPanel.hidden);
      $('[data-action="values"]').setAttribute('aria-expanded', String(!valuesPanel.hidden));
      hideTip(); if (!valuesPanel.hidden) renderValues(); fit();
    } else {
      zoom = action === 'fit' ? 1 : Math.max(1, Math.min(3, zoom+(action === 'in' ? .25 : -.25)));
      hideTip(); fit(); if (zoom === 1) viewport.scrollTo(0,0);
    }
  });
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      if (event.target === viewport && zoom > 1) return;
      event.preventDefault(); step(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    hideTip(); if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
    dialog.remove();
  });
  viewport.addEventListener('pointermove', event => {
    if (drag) {
      const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
      if (Math.abs(dx)+Math.abs(dy) > 4) { dragged = true; hideTip(); }
      viewport.scrollLeft = drag.left-dx; viewport.scrollTop = drag.top-dy;
    } else if (!pinned && event.pointerType !== 'touch') showTip(event);
  });
  viewport.addEventListener('pointerleave', () => { if (!pinned) hideTip(); });
  viewport.addEventListener('pointerdown', event => {
    dragged = false;
    if (zoom > 1 && event.pointerType === 'mouse' && event.button === 0) {
      drag = {x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
      viewport.setPointerCapture(event.pointerId); event.preventDefault();
    }
  });
  viewport.addEventListener('pointerup', () => { drag = null; });
  viewport.addEventListener('pointercancel', () => { drag = null; });
  viewport.addEventListener('click', event => { if (!dragged) { hideTip(); showTip(event); pinned = !tooltip.hidden; } });
  viewport.addEventListener('scroll', hideTip, {passive:true});
  new ResizeObserver(fit).observe(viewport);
  return state;
}
