/* MTRAG reader: static public data, rendered as text, with no model calls. */
(() => {
  if (window.dsMtragInstalled) return;
  window.dsMtragInstalled = true;
  const mounted = new WeakSet();
  const downloads = new Map();
  async function load(url) {
    if (!downloads.has(url)) downloads.set(url, fetch(url).then(response => {
      if (!response.ok) throw new Error(`Data request failed (${response.status}).`);
      return response.json();
    }).then(payload => {
      if (payload.commit !== '53fef6f5917c7e10c436f697e69a955dbc795d81' || !payload.data) throw new Error('Unexpected dataset version.');
      return payload.data;
    }).catch(error => { downloads.delete(url); throw error; }));
    return downloads.get(url);
  }
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  function domain(task) {
    const name = task.collection;
    return name.includes('clapnq') ? 'ClapNQ' : name.includes('ibmcloud') ? 'Cloud' : name.includes('fiqa') ? 'FiQA' : 'Govt';
  }
  function mount(root) {
    const links = [...root.querySelectorAll('a')];
    const urls = Object.fromEntries(links.map(a => [a.textContent.trim(), a.href]));
    if (!urls['Reference tasks'] || !urls['Human ratings']) return;
    mounted.add(root);
    const source = node('details', undefined, 'mv-downloads');
    source.append(node('summary', 'Download display data'));
    const sourceBody = node('div');
    for (const link of links) { sourceBody.append(link.cloneNode(true), document.createTextNode('  ')); }
    source.append(sourceBody);
    root.replaceChildren();
    const app = node('div', undefined, 'mv-app');
    const status = node('p', 'Loading reference tasks and human-rating index…', 'mv-status');
    status.setAttribute('role', 'status');
    root.append(status, app, source);
    let tasks, human, selected, filtered = [], tab = 'evidence', sequence = 0, currentEvidence = null;
    async function start() {
      status.textContent = 'Loading reference tasks and human-rating index…';
      try {
        [tasks, human] = await Promise.all([load(urls['Reference tasks']), load(urls['Human ratings'])]);
        if (!root.isConnected) return;
        if (!Array.isArray(tasks) || tasks.length !== 842 || !human.evaluations) throw new Error('The display data is incomplete.');
        setup();
      } catch (error) {
        status.replaceChildren(node('span', 'Could not load the viewer. Check your connection and retry. '));
        const retry = node('button', 'Retry'); retry.type = 'button'; retry.onclick = start;
        status.append(retry);
      }
    }
    function setup() {
      app.innerHTML = `
        <div class="mv-filter-grid">
          <label class="mv-search">Search questions, history or task ID<input type="search" placeholder="e.g. cloud, interest rate, Cardinals" data-field="search"></label>
          <label>Collection<select data-field="collection"><option value="">All collections</option><option>ClapNQ</option><option>Cloud</option><option>FiQA</option><option>Govt</option></select></label>
          <label>Answerability<select data-field="answerability"><option value="">All labels</option><option>ANSWERABLE</option><option>PARTIAL</option><option>UNANSWERABLE</option><option>CONVERSATIONAL</option></select></label>
        </div>
        <div class="mv-filter-footer"><label class="mv-check"><input type="checkbox" data-field="rated"> Human-rated tasks only</label><button type="button" data-action="reset">Reset filters</button></div>
        <p class="mv-results" role="status" aria-live="polite"></p>
        <div class="mv-selection-grid">
          <label>Conversation<select data-field="conversation"></select></label>
          <label>Turn<select data-field="turn"></select></label>
        </div>
        <div class="mv-navigation"><button type="button" data-action="prev">← Previous match</button><span class="mv-position"></span><button type="button" data-action="next">Next match →</button></div>
        <div class="mv-task"></div>
        <div class="mv-settings"><label>Evidence setting<select data-field="setting"><option value="reference">Reference · 842 tasks</option><option value="rag">Full RAG · 842 tasks</option><option value="reference-rag">Reference + RAG · 436 tasks</option></select></label><button type="button" data-action="download">Download selected task</button></div>
        <div class="mv-tabs" role="tablist" aria-label="Task details">
          <button type="button" role="tab" id="mv-tab-evidence" aria-controls="mv-panel" data-tab="evidence">Evidence</button>
          <button type="button" role="tab" id="mv-tab-history" aria-controls="mv-panel" data-tab="history">Conversation history</button>
          <button type="button" role="tab" id="mv-tab-reference" aria-controls="mv-panel" data-tab="reference">Reference answer</button>
          <button type="button" role="tab" id="mv-tab-human" aria-controls="mv-panel" data-tab="human">Human ratings</button>
        </div>
        <div class="mv-panel" id="mv-panel" role="tabpanel" tabindex="0"></div>`;
      const fields = Object.fromEntries([...app.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
      const action = name => app.querySelector(`[data-action="${name}"]`);
      const panel = app.querySelector('.mv-panel');
      const taskBody = app.querySelector('.mv-task');
      const results = app.querySelector('.mv-results');
      const tabs = [...app.querySelectorAll('[data-tab]')];
      const indexed = tasks.map(t => ({task:t, text:[t.task_id, ...t.input.map(m=>m.text)].join(' ').toLowerCase()}));
      function updateURL() {
        const url = new URL(location.href);
        if (selected) url.searchParams.set('task', selected.task_id); else url.searchParams.delete('task');
        history.replaceState(history.state, '', url);
      }
      function options(select, values, value) {
        select.replaceChildren(...values.map(([id, label]) => {
          const option = node('option', label); option.value = id; return option;
        }));
        if (value !== undefined) select.value = value;
      }
      function applyFilters(preferred) {
        const query = fields.search.value.trim().toLowerCase();
        filtered = indexed.filter(({task:t, text}) => (!query || text.includes(query)) &&
          (!fields.collection.value || domain(t) === fields.collection.value) &&
          (!fields.answerability.value || t.answerability.includes(fields.answerability.value)) &&
          (!fields.rated.checked || human.evaluations[t.task_id])).map(x=>x.task);
        selected = filtered.find(t => t.task_id === preferred) || filtered[0];
        const groups = new Map();
        for (const t of filtered) if (!groups.has(t.conversation_id)) groups.set(t.conversation_id, t);
        options(fields.conversation, [...groups].map(([id,t]) => [id, `${domain(t)} · ${id.slice(0,8)} · ${tasks.find(x=>x.conversation_id===id).input[0].text.slice(0,75)}`]), selected?.conversation_id);
        results.textContent = `${filtered.length} of 842 tasks · ${groups.size} conversations match`;
        const empty = !selected;
        for (const el of [fields.conversation, fields.turn, fields.setting, action('download')]) el.disabled = empty;
        app.querySelector('.mv-settings').hidden = empty;
        app.querySelector('.mv-tabs').hidden = empty;
        renderTask();
      }
      function renderTask() {
        updateURL();
        const index = filtered.indexOf(selected);
        action('prev').disabled = index <= 0;
        action('next').disabled = index < 0 || index >= filtered.length - 1;
        app.querySelector('.mv-position').textContent = selected ? `${index+1} / ${filtered.length}` : '0 matches';
        taskBody.replaceChildren();
        if (!selected) {
          options(fields.turn, []); panel.replaceChildren(node('p','No tasks match these filters. Try a broader search or reset the filters.', 'mv-empty'));
          sequence++; return;
        }
        fields.conversation.value = selected.conversation_id;
        options(fields.turn, filtered.filter(t=>t.conversation_id===selected.conversation_id).sort((a,b)=>a.turn-b.turn).map(t=>[t.task_id, `Turn ${t.turn} · ${t.answerability.join(', ')}`]), selected.task_id);
        const chips = node('div',undefined,'mv-chips');
        [domain(selected), `Turn ${selected.turn}`, ...selected.answerability, ...selected.multi_turn, human.evaluations[selected.task_id] ? 'Human-rated' : 'No human ratings'].forEach(s=>chips.append(node('span',s)));
        taskBody.append(chips,node('h3',selected.input.at(-1).text,'mv-question'),node('p',`Task ID: ${selected.task_id}`,'mv-id'));
        renderPanel();
      }
      async function evidenceFor(task, setting) {
        if (setting === 'reference') return task.contexts;
        const file = setting === 'rag' ? 'Full RAG passages' : 'Reference + RAG passages';
        const data = await load(urls[file]);
        return data[task.task_id] ?? null;
      }
      function messageCard(label, text) {
        const box=node('div',undefined,'mv-message');box.append(node('div',label,'mv-label'),node('div',text,'mv-text'));return box;
      }
      async function renderPanel() {
        const run = ++sequence;
        if (!selected) return;
        const task=selected, setting=fields.setting.value;
        tabs.forEach(button=>{ const active=button.dataset.tab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1; });
        panel.setAttribute('aria-labelledby', `mv-tab-${tab}`);
        panel.replaceChildren();
        panel.removeAttribute('aria-busy');
        currentEvidence=null;
        if (tab==='history') {
          const previous=task.input.slice(0,-1);
          panel.append(node('p',`${previous.length} earlier messages · fixed supplied history`, 'mv-help'));
          if (!previous.length) panel.append(node('p','This is the first turn. There are no earlier messages.','mv-empty'));
          previous.forEach((m,i)=>panel.append(messageCard(`Turn ${Math.floor(i/2)+1} · ${m.speaker==='user'?'User':'Agent'}`,m.text)));
          return;
        }
        if (tab==='reference') {
          panel.append(node('p','Released reference answer. This is separate from a newly generated candidate response.','mv-help'));
          task.targets.forEach((m,i)=>panel.append(messageCard(`Reference ${i+1}`,m.text)));
          return;
        }
        if (tab==='human') {
          const evaluations=human.evaluations[task.task_id];
          panel.append(node('p','Human ratings use the Reference evidence setting, regardless of the evidence selector above. Scores below are individual annotations, not new model judgments.','mv-help'));
          if (!evaluations) { panel.append(node('p','This task is not in the 159-task human evaluation subset. Select “Human-rated tasks only” to browse that subset.','mv-empty'));return; }
          for (const e of evaluations) {
            const details=node('details',undefined,'mv-rating');details.open=true;
            details.append(node('summary',e.model_id));details.append(messageCard('Candidate response',e.response));
            const table=node('table');const head=node('thead');const tr=node('tr');
            ['Metric','Individual ratings','n','Scale'].forEach(x=>{const th=node('th',x);th.scope='col';tr.append(th);});head.append(tr);table.append(head);
            const body=node('tbody');
            for (const m of human.metrics) { const row=node('tr');const values=e.ratings[m.name]||[];
              [m.display_name, values.length?values.join(' · '):'Missing',String(values.length),m.name==='win-rate'?'0–100':'1–4'].forEach(x=>row.append(node('td',x)));body.append(row);
            }
            table.append(body);const wrap=node('div',undefined,'mv-table-wrap');wrap.append(table);details.append(wrap);panel.append(details);
          }
          panel.append(node('p','Rating order is local to each metric; columns do not identify a shared rater across metrics.','mv-help'));
          return;
        }
        panel.textContent='Loading passages…';panel.setAttribute('aria-busy','true');
        try {
          const evidence=await evidenceFor(task,setting);
          if (run!==sequence || !root.isConnected) return;
          currentEvidence=evidence;panel.replaceChildren();
          if (evidence===null) {panel.append(node('p','This task is not included in the 436-task Reference + RAG subset. Choose Reference or Full RAG to view its evidence.','mv-empty'));return;}
          panel.append(node('p',`${evidence.length} passages · ${fields.setting.selectedOptions[0].textContent.split(' · ')[0]}`,'mv-help'));
          if (!evidence.length) panel.append(node('p','No reference passages are supplied for this task. This is expected for unanswerable or conversational tasks in this release.','mv-empty'));
          evidence.forEach((p,i)=>{
            const details=node('details',undefined,'mv-passage');details.open=i===0;
            details.append(node('summary',`${i+1}. ${p.title || p.document_id}`));
            details.append(node('p',`Passage ID: ${p.document_id}`,'mv-id'));
            if (p.score!==undefined) details.append(node('p',`Retrieval score: ${p.score} · not a human quality rating`,'mv-help'));
            details.append(node('div',p.text,'mv-text'));panel.append(details);
          });
        } catch(error) {
          if (run!==sequence) return;
          panel.replaceChildren(node('p','Could not load passages for this setting. Your selected task is preserved.','mv-empty'));
          const retry=node('button','Retry loading passages');retry.type='button';retry.onclick=renderPanel;panel.append(retry);
        } finally { if (run===sequence) panel.removeAttribute('aria-busy'); }
      }
      let timer;
      fields.search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>applyFilters(selected?.task_id),160);});
      [fields.collection,fields.answerability,fields.rated].forEach(el=>el.addEventListener('change',()=>applyFilters(selected?.task_id)));
      fields.conversation.addEventListener('change',()=>{selected=filtered.find(t=>t.conversation_id===fields.conversation.value);renderTask();});
      fields.turn.addEventListener('change',()=>{selected=filtered.find(t=>t.task_id===fields.turn.value);renderTask();});
      fields.setting.addEventListener('change',renderPanel);
      action('prev').onclick=()=>{selected=filtered[filtered.indexOf(selected)-1];renderTask();};
      action('next').onclick=()=>{selected=filtered[filtered.indexOf(selected)+1];renderTask();};
      action('reset').onclick=()=>{clearTimeout(timer);fields.search.value='';fields.collection.value='';fields.answerability.value='';fields.rated.checked=false;applyFilters();};
      for(const button of tabs) button.onclick=()=>{tab=button.dataset.tab;renderPanel();};
      app.querySelector('.mv-tabs').addEventListener('keydown',event=>{
        const idx=tabs.indexOf(document.activeElement); if(idx<0)return;
        let next=idx;
        if(event.key==='ArrowRight')next=(idx+1)%tabs.length;
        else if(event.key==='ArrowLeft')next=(idx+tabs.length-1)%tabs.length;
        else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
        event.preventDefault();tabs[next].focus();tabs[next].click();
      });
      action('download').onclick=async()=>{
        const task=selected, setting=fields.setting.value;
        action('download').disabled=true;
        try {
          const evidence=await evidenceFor(task,setting);
          const payload={source:'IBM/mt-rag-benchmark',commit:'53fef6f5917c7e10c436f697e69a955dbc795d81',projection:true,setting,available:evidence!==null,task:{...task,contexts:evidence},human_reference_evaluations:human.evaluations[task.task_id]||[]};
          const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
          const link=node('a');link.href=url;link.download=`mtrag-${task.conversation_id}-turn-${task.turn}-${setting}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
          status.textContent='Selected task exported as JSON.';
        } catch(error) {status.textContent='Could not export this setting. Please retry after checking your connection.';}
        finally {action('download').disabled=!selected;}
      };
      status.textContent='Public MTRAG snapshot · text preserved from the pinned release';
      applyFilters(new URL(location.href).searchParams.get('task'));
    }
    start();
  }
  let queued=false;
  function scan() {
    queued=false;
    // Wait until MyST has hydrated its article outline before enhancing the page.
    if (!document.querySelector('.article.content .myst-outline-section')) return;
    document.querySelectorAll('.mtrag-viewer').forEach(root=>{if(!mounted.has(root))mount(root);});
  }
  new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(scan);}}).observe(document,{childList:true,subtree:true});
  scan();
})();
