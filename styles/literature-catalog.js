/* Progressive enhancement: source table and review links remain usable without JS. */
(() => {
 if(window.dsLiteratureCatalogInstalled)return;
 window.dsLiteratureCatalogInstalled=true;
 let queued=false;
 function mount(){
  queued=false;
  document.querySelectorAll('.literature-catalog').forEach(root=>{
   const table=root.querySelector('table');
   if(!table||root.querySelector('.literature-filters'))return;
   const allRows=[...table.rows];
   const header=allRows.shift();
   if(!header)return;
   [...header.cells].forEach(cell=>{const th=document.createElement('th');th.scope='col';while(cell.firstChild)th.append(cell.firstChild);cell.replaceWith(th);});
   table.createTHead().append(header);
   const rows=allRows;
   if(!rows.length)return;
   const topics={
    'Quantifying Biases in LLM-as-a-Judge Evaluations':['JUDGE BIAS','How biased is an LLM judge?'],
    'Reliable decision support with LLMs':['CONSISTENCY','Will it give the same answer twice?']
   };
   const notes=document.createElement('div');notes.className='literature-notes';
   const entries=rows.map(row=>{
    const link=row.cells[0].querySelector('a');
    const author=row.cells[0].querySelector('strong');
    const title=link?.textContent.trim()||'';
    const topic=topics[title]||['RESEARCH NOTE',title];
    const entry=document.createElement('article');entry.className='literature-note';
    const meta=document.createElement('div');meta.className='literature-note-meta';
    [topic[0],row.cells[1].textContent.trim(),row.cells[2].textContent.trim()].forEach((text,index)=>{
     const item=document.createElement(index===0?'strong':'span');item.textContent=text;meta.append(item);
    });
    const body=document.createElement('div');body.className='literature-note-body';
    const paper=document.createElement('p');paper.className='literature-note-title';paper.setAttribute('role','heading');paper.setAttribute('aria-level','2');if(link)paper.append(link.cloneNode(true));
    const byline=document.createElement('p');byline.className='literature-note-author';byline.textContent=author?.textContent||'';
    const description=row.cells[0].cloneNode(true);description.querySelectorAll('a,strong').forEach(node=>node.remove());
    const summary=document.createElement('p');summary.className='literature-note-summary';summary.textContent=description.textContent.trim();
    body.append(paper,byline,summary);entry.append(meta,body);notes.append(entry);return entry;
   });
   table.hidden=true;table.after(notes);
   const controls=document.createElement('div');controls.className='literature-filters';
   function select(label,index,all){
    const wrap=document.createElement('label'),name=document.createElement('span'),input=document.createElement('select');
    name.textContent=label;input.setAttribute('aria-label',label==='YEAR'?'Year':'Journal');
    input.add(new Option(all,''));
    const values=[...new Set(rows.map(r=>r.cells[index].textContent.trim()))];
    values.sort((a,b)=>index===1?b.localeCompare(a):a.localeCompare(b));
    values.forEach(v=>input.add(new Option(v,v)));wrap.append(name,input);controls.append(wrap);return input;
   }
   const year=select('YEAR',1,'All years'),journal=select('JOURNAL',2,'All journals');
   const status=document.createElement('p');status.className='literature-result-count';status.setAttribute('aria-live','polite');
   const empty=document.createElement('p');empty.className='literature-empty';empty.textContent='No reviews match these filters.';empty.hidden=true;
   function update(){let count=0;rows.forEach((row,index)=>{const match=(!year.value||row.cells[1].textContent.trim()===year.value)&&(!journal.value||row.cells[2].textContent.trim()===journal.value);row.hidden=!match;entries[index].hidden=!match;if(match)count++;});status.textContent=count+' review'+(count===1?'':'s')+', '+(year.value||'All years')+', '+(journal.value||'All journals');empty.hidden=count!==0;}
   year.addEventListener('change',update);journal.addEventListener('change',update);
   const filterBox=document.createElement('fieldset');filterBox.className='literature-filter-box';
   const legend=document.createElement('legend');legend.textContent='Filter';
   filterBox.append(legend,controls,status);root.prepend(filterBox);root.append(empty);update();
  });
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(mount);}}
 new MutationObserver(schedule).observe(document,{childList:true,subtree:true});schedule();
})();
