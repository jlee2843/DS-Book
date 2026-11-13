/* Progress 3: recorded responses and evaluation scores, with no model calls. */
(() => {
  if (window.dsProgressScoresInstalled) return;
  window.dsProgressScoresInstalled = true;
  const mounted = new WeakSet();
  const metrics = [['faithfulness', 'Faithfulness'], ['answer_relevancy', 'Answer Relevancy']];
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const label = p => p === 'original' ? 'Original' : p;
  const fmt = v => v == null ? 'Failed' : v.toFixed(3);
  function summary(rows) {
    if (rows.length !== 3 || rows.some(r => r.status !== 'completed')) return null;
    const mean = rows.reduce((s, r) => s + r.score, 0) / 3;
    const sd = Math.sqrt(rows.reduce((s, r) => s + (r.score - mean) ** 2, 0) / 2);
    return {mean, sd};
  }
  function button(text, action, cls) {
    const b = el('button', text, cls); b.type = 'button'; b.addEventListener('click', action); return b;
  }
  function disclosure(title, content) {
    const d = el('details'); d.append(el('summary', title), content); return d;
  }
  function table(headers) {
    const wrap = el('div', undefined, 'ps-table-scroll'), t = el('table'), head = el('thead'), tr = el('tr'), body = el('tbody');
    wrap.tabIndex = 0; wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', headers[0] === 'Metric' ? 'Scores for the selected response' : 'Scores for all responses');
    for (const title of headers) { const th = el('th', title); th.scope = 'col'; tr.append(th); }
    head.append(tr); t.append(head, body); wrap.append(t); return {wrap, body};
  }
  async function mount(root) {
    const source = root.querySelector('a[href*="scores"]');
    if (!source) return;
    mounted.add(root);
    try {
      const response = await fetch(source.href);
      if (!response.ok) throw new Error('The recorded scores could not be loaded.');
      const data = await response.json();
      if (data.schema_version !== 1 || data.responses.length !== 36) throw new Error('Unexpected score data.');
      if (!root.isConnected) return;
      const responses = data.responses;
      let selected = responses[0], metric = 'faithfulness', repeat = 1;
      function readHash() {
        const params = new URLSearchParams(location.hash.slice(1));
        selected = responses.find(r => r.answer_id === params.get('response')) || selected;
        if (metrics.some(([key]) => key === params.get('metric'))) metric = params.get('metric');
        if (['1', '2', '3'].includes(params.get('repeat'))) repeat = Number(params.get('repeat'));
      }
      readHash();
      root.replaceChildren();
      const settings = el('div', undefined, 'ps-settings');
      settings.append(el('span', 'Generator: Qwen3 4B'), el('span', 'Qwen temperatures: 0.3 / 0.6 / 0.9'),
        el('span', 'Evaluator: Llama 3.1 8B'), el('strong', `Evaluator temperature: ${data.judge_temperature} (fixed)`));
      const filters = el('div', undefined, 'ps-filters');
      const controls = [];
      function group(title, key, values, getLabel = String) {
        const field = el('fieldset'), legend = el('legend', title), choices = el('div', undefined, 'ps-choices');
        field.append(legend, choices);
        for (const value of values) {
          const b = button(getLabel(value), () => {
            selected = responses.find(r => r[key] === value &&
              ['prompt', 'temperature', 'generation_repeat'].every(k => k === key || r[k] === selected[k]));
            render(true);
          });
          controls.push({b, key, value}); choices.append(b);
        }
        filters.append(field);
      }
      group('Prompt wording', 'prompt', ['original', 'A', 'B', 'C'], label);
      group('Qwen temperature', 'temperature', [.3, .6, .9]);
      group('Generated response', 'generation_repeat', [1, 2, 3], r => `Response ${r}`);
      const status = el('p', undefined, 'ps-selection'); status.setAttribute('role', 'status');
      const question = el('p', undefined, 'ps-question');
      const answer = el('div', undefined, 'ps-answer');
      const meta = el('p', undefined, 'ps-meta');
      const scoreTable = table(['Metric', 'Evaluation 1', 'Evaluation 2', 'Evaluation 3', 'Mean', 'SD']);
      const detail = el('section', undefined, 'ps-detail');
      const all = table(['Prompt', 'Qwen temp.', 'Response', 'Faithfulness (1 / 2 / 3)', 'Answer Relevancy (1 / 2 / 3)']);
      const overview = disclosure('All 36 responses and their repeated scores', all.wrap);
      for (const r of responses) {
        const tr = el('tr'); tr.dataset.response = r.answer_id;
        tr.append(el('td', label(r.prompt)), el('td', String(r.temperature)));
        const cell = el('td'); cell.append(button(String(r.generation_repeat), () => {
          selected = r; render(true); filters.scrollIntoView({block:'start', behavior:'instant'});
          controls.find(c => c.key === 'generation_repeat' && c.value === r.generation_repeat).b.focus({preventScroll:true});
        }, 'ps-response-link')); tr.append(cell);
        for (const [key] of metrics) tr.append(el('td', r.evaluations[key].map(e => fmt(e.score)).join(' / ')));
        all.body.append(tr);
      }
      const evidence = el('div');
      for (const passage of data.reference_excerpts) evidence.append(el('h3', passage.title || passage.document_id), el('p', passage.text, 'ps-verbatim'));
      const input = el('div'); input.append(el('p', 'The evaluator input used the Original question for every prompt wording.'), el('p', data.evaluator_question));
      root.append(settings, filters, status, meta, el('h2', 'Question wording'), question, el('h2', 'Qwen response'), answer,
        el('h2', 'Repeated evaluation scores'), scoreTable.wrap,
        el('p', 'Mean and sample SD use the three evaluations of this response. Failed evaluations have no score. Select a score to inspect its recorded judgement.', 'ps-caption'),
        detail, overview, disclosure('Evaluator question', input), disclosure('Reference excerpts', evidence));
      function render(updateHash) {
        if (updateHash) history.replaceState(null, '', '#' + new URLSearchParams({response:selected.answer_id, metric, repeat}));
        for (const c of controls) c.b.setAttribute('aria-pressed', String(selected[c.key] === c.value));
        status.textContent = `${label(selected.prompt)} / Qwen temperature ${selected.temperature} / Response ${selected.generation_repeat}`;
        meta.textContent = `Response ID: ${selected.answer_id}, generation seed: ${selected.generation_seed}`;
        question.textContent = data.prompts[selected.prompt]; answer.textContent = selected.answer;
        scoreTable.body.replaceChildren();
        for (const [key, title] of metrics) {
          const tr = el('tr'); const th = el('th', title); th.scope = 'row'; tr.append(th);
          for (const row of selected.evaluations[key]) {
            const td = el('td'), b = button(fmt(row.score), () => {
              metric = key; repeat = row.evaluation_repeat; render(true);
              scoreTable.body.querySelector('[aria-pressed="true"]').focus({preventScroll:true});
            });
            b.setAttribute('aria-pressed', String(metric === key && repeat === row.evaluation_repeat));
            b.setAttribute('aria-label', `${title}, evaluation ${row.evaluation_repeat}: ${fmt(row.score)}`);
            b.title = row.score == null ? row.error : String(row.score);
            if (row.score == null) b.classList.add('ps-failed'); td.append(b); tr.append(td);
          }
          const s = summary(selected.evaluations[key]);
          tr.append(el('td', s ? fmt(s.mean) : 'Unavailable'), el('td', s ? fmt(s.sd) : 'Unavailable'));
          scoreTable.body.append(tr);
        }
        for (const tr of all.body.rows) tr.classList.toggle('ps-current', tr.dataset.response === selected.answer_id);
        const row = selected.evaluations[metric][repeat - 1];
        const metricName = metrics.find(([key]) => key === metric)[1];
        detail.replaceChildren(el('h2', 'Evaluation detail'), el('h3', `${metricName} / Evaluation ${repeat}`));
        detail.append(el('p', `Score: ${fmt(row.score)}, evaluator temperature: ${row.judge_options.temperature}, output limit: ${row.judge_options.num_predict} tokens`, 'ps-detail-meta'));
        if (row.status !== 'completed') {
          detail.append(el('p', row.error || 'This evaluation did not produce a valid score.', 'ps-error'));
        } else {
          const passed = row.items.filter(i => i.verdict === 'yes' || i.verdict === 'borderline').length;
          detail.append(el('p', `Score calculation: ${passed} / ${row.items.length} = ${fmt(row.score)}. The recorded scoring rule counts yes and borderline; no contributes zero.`, 'ps-caption'));
          if (row.reason) detail.append(el('p', row.reason, 'ps-reason'));
        }
        detail.append(el('h3', metric === 'faithfulness' ? 'Sentence judgements' : 'Extracted statement judgements'));
        if (row.status !== 'completed') detail.append(el('p', 'Intermediate records from the failed evaluation. These records do not constitute a valid metric score.', 'ps-caption'));
        for (const item of row.items) {
          const section = el('div', undefined, 'ps-judgement'), head = el('div', undefined, 'ps-judgement-head');
          head.append(el('span', item.id), el('strong', item.verdict || 'No verified judgement', 'ps-verdict'));
          section.append(head, el('p', item.text));
          if (item.reason) section.append(el('p', item.reason, 'ps-reason'));
          detail.append(section);
        }
        if (row.truths?.length) {
          const list = el('ul'); for (const truth of row.truths) list.append(el('li', truth));
          detail.append(disclosure('Extracted reference facts', list));
        }
        const execution = el('div');
        execution.append(el('p', `Started (UTC): ${row.started_at}`), el('p', `Finished (UTC): ${row.finished_at}`),
          el('p', `Duration: ${row.seconds.toFixed(2)} seconds, internal model calls: ${row.judge_calls}`));
        detail.append(disclosure('Evaluation execution record', execution));
      }
      render(false);
      window.addEventListener('hashchange', () => {if (root.isConnected) {readHash(); render(false);}});
    } catch (error) {
      root.prepend(el('p', error.message, 'ps-error'));
    }
  }
  let queued = false;
  function scan() {queued = false; document.querySelectorAll('.progress-score-viewer').forEach(root => {if (!mounted.has(root)) mount(root);});}
  new MutationObserver(() => {if (!queued) {queued = true; requestAnimationFrame(scan);}}).observe(document, {childList:true, subtree:true});
  scan();
})();
