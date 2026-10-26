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
    const status = node('p', 'Loading data…', 'mv-status');
    status.setAttribute('role', 'status');
    root.append(status, app, source);
    let tasks, human, selected, filtered = [], tab = 'human', sequence = 0, currentEvidence = null;
    async function start() {
      status.textContent = 'Loading data…';
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
        <p class="mv-help">Read the complete conversation and select a turn to inspect its evidence, saved responses and human annotations. The selected turn is highlighted below.</p>
        <div class="mv-filter-grid">
          <label class="mv-search">Search questions, history or ID<input type="search" placeholder="e.g. cloud, interest rate, Cardinals" data-field="search"></label>
          <label>Collection<select data-field="collection"><option value="">All collections</option><option>ClapNQ</option><option>Cloud</option><option>FiQA</option><option>Govt</option></select></label>
          <label>Answerability<select data-field="answerability"><option value="">All labels</option><option>ANSWERABLE</option><option>PARTIAL</option><option>UNANSWERABLE</option><option>CONVERSATIONAL</option></select></label>
        </div>
        <div class="mv-filter-grid"><label>Human Evaluation<select data-field="rated"><option value="">All tasks</option><option value="yes">With human evaluation (159)</option><option value="no">Without human evaluation</option></select></label><label>Conversation role<select data-field="multi"><option value="">All turns</option><option>Follow-up</option><option>Clarification</option><option>N/A</option></select></label><label>Question type<select data-field="question"><option value="">All question types</option></select></label></div><div class="mv-filter-footer"><button type="button" data-action="reset">Reset filters</button></div>
        <p class="mv-results" role="status" aria-live="polite"></p>
        <div class="mv-selection-grid">
          <label>Conversation<select data-field="conversation"></select></label>
        </div>
        <div class="mv-navigation"><button type="button" data-action="prev">← Previous match</button><span class="mv-position"></span><button type="button" data-action="next">Next match →</button></div>
        <div class="mv-task"></div>
        <div class="mv-settings"><label>Documents supplied for this question<select data-field="setting"><option value="reference">Selected reference documents</option><option value="rag">Retrieved documents (RAG)</option><option value="reference-rag">Reference + retrieved documents</option></select></label><button type="button" data-action="download">Download task JSON</button></div>
        <div class="mv-tabs" role="tablist" aria-label="Task details">
          <button type="button" role="tab" id="mv-tab-evidence" aria-controls="mv-panel" data-tab="evidence">Supporting documents</button>
          <button type="button" role="tab" id="mv-tab-human" aria-controls="mv-panel" data-tab="human">Human Evaluation</button>
        </div>
        <div class="mv-panel" id="mv-panel" role="tabpanel" tabindex="0"></div>`;
      const fields = Object.fromEntries([...app.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
      const action = name => app.querySelector(`[data-action="${name}"]`) || settings.querySelector(`[data-action="${name}"]`);
      const panel = app.querySelector('.mv-panel');
      const tablist=app.querySelector('.mv-tabs');
      const taskBody = app.querySelector('.mv-task');
      const settings=app.querySelector('.mv-settings');settings.remove();
      const results = app.querySelector('.mv-results');
      const tabs = [...app.querySelectorAll('[data-tab]')];
      const annotators=[...new Set(Object.values(human.evaluations).flatMap(es=>es.flatMap(e=>Object.values(e.annotator_ratings||{}).flatMap(r=>Object.keys(r)))))].sort();
      const raterName=id=>`Annotator ${annotators.indexOf(id)+1}`;
      [...new Set(tasks.flatMap(t=>t.question_type))].sort().forEach(q=>{const o=node('option',q);o.value=q;fields.question.append(o);});
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
          (!fields.rated.value || Boolean(human.evaluations[t.task_id])===(fields.rated.value==='yes')) &&
          (!fields.multi.value || t.multi_turn.includes(fields.multi.value)) &&
          (!fields.question.value || t.question_type.includes(fields.question.value))).map(x=>x.task);
        selected = filtered.find(t => t.task_id === preferred) || filtered[0];
        const groups = new Map();
        for (const t of filtered) if (!groups.has(t.conversation_id)) groups.set(t.conversation_id, t);
        options(fields.conversation, [...groups].map(([id,t]) => [id, `${domain(t)} · ${id.slice(0,8)} · ${tasks.find(x=>x.conversation_id===id).input[0].text.slice(0,75)}`]), selected?.conversation_id);
        results.textContent = `${filtered.length} of 842 tasks · ${groups.size} conversations match`;
        const empty = !selected;
        for (const el of [fields.conversation, fields.setting, action('download')]) el.disabled = empty;
        tablist.hidden = empty;
        renderTask();
      }
      function renderTask() {
        updateURL();
        const index = filtered.indexOf(selected);
        action('prev').disabled = index <= 0;
        action('next').disabled = index < 0 || index >= filtered.length - 1;
        app.querySelector('.mv-position').textContent = selected ? `${index+1} / ${filtered.length}` : '0 matches';
        tablist.remove();panel.remove();
        taskBody.replaceChildren();
        if (!selected) {
          panel.replaceChildren(node('p','No matching tasks. Change the search or reset filters.', 'mv-empty'));
          taskBody.append(panel);sequence++; return;
        }
        fields.conversation.value = selected.conversation_id;
        const conversation=tasks.filter(t=>t.conversation_id===selected.conversation_id).sort((a,b)=>a.turn-b.turn);
        const fullInput=conversation.at(-1).input;
        const timeline=node('div',undefined,'mv-conversation');

        conversation.forEach(t=>{
          const active=t.task_id===selected.task_id;
          const item=node('section',undefined,'mv-conversation-turn'+(active?' is-current':''));
          const button=node('button',`Turn ${t.turn}${active?' · Selected':''}`,'mv-turn-select');button.type='button';button.setAttribute('aria-pressed',String(active));
          const selectTurn=()=>{selected=t;renderTask();};
          button.onclick=event=>{event.stopPropagation();selectTurn();};
          item.addEventListener('click',event=>{if(event.target.closest('a,button,input,select,summary,.mv-panel,.mv-response-options')||window.getSelection()?.toString())return;selectTurn();});

          const labels=node('div',undefined,'mv-chips');[...t.answerability,...t.question_type,...t.multi_turn.filter(x=>x!=='N/A')].forEach(v=>labels.append(node('span',v)));
          item.append(button,labels,messageCard('User',t.input.at(-1).text));
          const reply=fullInput[2*t.turn-1];
          const responses=node('div',undefined,'mv-response-options');
          const evaluations=human.evaluations[t.task_id]||[];
          const reference=evaluations.find(e=>e.model_id==='reference');
          const referenceText=reference?.response || t.targets.map(m=>m.text).join('\n\n');
          const responseTabs=node('div',undefined,'mv-response-tabs');responseTabs.setAttribute('role','tablist');responseTabs.setAttribute('aria-label',`Turn ${t.turn} responses`);
          const responseBody=node('div',undefined,'mv-response-body');responseBody.setAttribute('role','tabpanel');
          responses.append(responseTabs,responseBody);
          function responseCard(label,text,note){
            const choice=node('button',label);choice.type='button';choice.setAttribute('role','tab');
            const choose=()=>{[...responseTabs.children].forEach(x=>x.setAttribute('aria-selected',String(x===choice)));responseBody.replaceChildren(node('div',text,'mv-text'));};
            choice.onclick=event=>{event.stopPropagation();choose();};responseTabs.append(choice);
            if(responseTabs.children.length===1)choose();else choice.setAttribute('aria-selected','false');
          }
          responseCard('Reference · human-reviewed',referenceText,'Dataset comparison answer, prepared with model assistance and human review.');
          if(reply && reply.text!==referenceText)responseCard(reply.model||'Conversation response',''+reply.text,'Response recorded in the original conversation; it may differ from the reviewed reference.');
          evaluations.filter(e=>e.model_id!=='reference').forEach(e=>responseCard(e.model_id,e.response,'Answer to this same question, generated using reference documents.'));
          item.append(responses);
          if(!evaluations.length){['llama-3.1-405b-instruct','gpt-4o'].forEach(label=>{const missing=node('button',label+' · unavailable');missing.type='button';missing.disabled=true;responseTabs.append(missing);});item.append(node('p','Only the reference answer is released for this turn. Llama and GPT-4o answers are available on tasks with human evaluation.','mv-help'));}
          if(active)item.append(tablist,panel);
          timeline.append(item);
        });
        taskBody.append(timeline);
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
        if (tab==='human') {
          const evaluations=human.evaluations[task.task_id];
          panel.append(node('p',`This release contains ${annotators.length} distinct evaluator IDs. Each response has ratings from three evaluators. Annotator 2, 5 or 6 identifies a person’s evaluator ID, not a score or a count. The same number always refers to the same evaluator in this viewer; names are not provided.`,'mv-help'));
          panel.append(messageCard('Rating scales','Naturalness, Appropriateness, Completeness and Faithfulness: 1 = No, 2 = Mostly No, 3 = Mostly Yes, 4 = Yes. Pairwise preference rate: 0–100, showing how often this response was preferred over other responses to the same question. Head-to-head means comparing two responses at a time; it is not factual accuracy. Missing means no rating was recorded.'));
          if (!evaluations) { panel.append(node('p','No human ratings for this task. Choose “With human evaluation” in the filter.','mv-empty'));return; }
          for (const e of evaluations) {
            const details=node('details',undefined,'mv-rating');details.open=true;
            details.append(node('summary',e.model_id==='reference'?'Reference answer':e.model_id));
            const table=node('table');const head=node('thead');const tr=node('tr');
            details.append(messageCard('Response being rated',e.response));
            const ids=[...new Set(Object.values(e.annotator_ratings||{}).flatMap(r=>Object.keys(r)))].sort();
            ['Metric',...ids.map(raterName)].forEach(x=>{const th=node('th',x);th.scope='col';tr.append(th);});head.append(tr);table.append(head);
            const body=node('tbody');
            for (const m of human.metrics) { const row=node('tr');const values=e.annotator_ratings?.[m.name]||{};
              [m.name==='win-rate'?'Pairwise preference (%)':m.display_name, ...ids.map(id=>values[id]===undefined?'Missing':String(values[id]))].forEach(x=>row.append(node('td',x)));body.append(row);
            }
            table.append(body);const wrap=node('div',undefined,'mv-table-wrap');wrap.append(table);details.append(wrap);panel.append(details);
          }
          panel.append(node('p','Each column follows the same annotator across all metrics and responses. Different annotator labels mean different evaluator IDs.','mv-help'));
          return;
        }
        panel.append(node('h4','Supporting documents for the selected question'),settings,node('p','These document excerpts were supplied for this question. Choose reference documents, search results, or a mixture of both.','mv-help'));
        const loading=node('p','Loading passages…');panel.append(loading);panel.setAttribute('aria-busy','true');
        try {
          const evidence=await evidenceFor(task,setting);
          if (run!==sequence || !root.isConnected) return;
          currentEvidence=evidence;loading.remove();
          if (evidence===null) {panel.append(node('p','This question has no mixed document set. Choose selected reference documents or retrieved documents (RAG).','mv-empty'));return;}
          panel.append(node('p',`${evidence.length} document excerpts supplied for this question`,'mv-help'));
          if (!evidence.length) panel.append(node('p','No reference passages. This task is labeled unanswerable or conversational.','mv-empty'));
          evidence.forEach((p,i)=>{
            const details=node('details',undefined,'mv-passage');details.open=i===0;
            details.append(node('summary',`Document ${i+1} · ${p.title||p.text.split('\n').find(x=>x.trim())?.slice(0,100)||p.document_id}`));
            const metadata=node('details',undefined,'mv-document-metadata');metadata.append(node('summary','Document metadata'));
            details.append(node('p',`Source: ${domain(task)} · Document excerpt`,'mv-help'),node('p',`Document / passage ID: ${p.document_id}`,'mv-id'));
            details.append(node('p','Original file name: not provided in this dataset.','mv-help'));
            if(p.url){const link=node('a','Original source ↗');link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';details.append(link);}
            if(p.score!==undefined)metadata.append(node('p',`Search relevance score: ${p.score}. This is not an answer-quality score.`,'mv-help'));
            details.append(metadata);
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
      [fields.collection,fields.answerability,fields.rated,fields.multi,fields.question].forEach(el=>el.addEventListener('change',()=>applyFilters(selected?.task_id)));
      fields.conversation.addEventListener('change',()=>{selected=filtered.find(t=>t.conversation_id===fields.conversation.value);renderTask();});
      fields.setting.addEventListener('change',renderPanel);
      action('prev').onclick=()=>{selected=filtered[filtered.indexOf(selected)-1];renderTask();};
      action('next').onclick=()=>{selected=filtered[filtered.indexOf(selected)+1];renderTask();};
      action('reset').onclick=()=>{clearTimeout(timer);fields.search.value='';fields.collection.value='';fields.answerability.value='';fields.rated.value='';fields.multi.value='';fields.question.value='';applyFilters();};
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
      status.textContent='';
      applyFilters(new URL(location.href).searchParams.get('task'));
    }
    start();
  }
  let queued=false, ready=false;
  function scan() {
    queued=false;
    // The compact viewer has no outline; initialize after the page loads.
    if (!ready || !document.querySelector('.article.content')) return;
    document.querySelectorAll('.mtrag-viewer').forEach(root=>{if(!mounted.has(root))mount(root);});
  }
  new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(scan);}}).observe(document,{childList:true,subtree:true});
  const begin = () => requestAnimationFrame(() => requestAnimationFrame(() => { ready=true; scan(); }));
  if (document.readyState === 'complete') begin();
  else addEventListener('load', begin, {once:true});
})();
