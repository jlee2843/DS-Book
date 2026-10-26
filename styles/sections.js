/* Persistent right-hand document outline; never replace article content. */
(() => {
  if (window.dsSectionsInstalled) return;
  window.dsSectionsInstalled=true;
  let signature='',toc=null,queued=false;
  function refresh(){
    queued=false;
    const article=document.querySelector('.article.content');
    if(!article)return;
    const headings=[...article.querySelectorAll('h2[id],h3[id]')].filter(h=>!h.closest('.mtrag-viewer')&&!h.closest('.home-profile'));
    const key=location.pathname+JSON.stringify(headings.map(h=>[h.id,h.textContent]));
    if(key===signature&&toc?.isConnected)return;
    signature=key;toc?.remove();
    if(!headings.length)return;
    toc=document.createElement('nav');toc.className='ds-document-toc';toc.setAttribute('aria-label','Table of contents');
    const title=document.createElement('div');title.className='ds-document-toc-title';title.textContent='Table of Contents';toc.append(title);
    for(const h of headings){const a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent.replace(/¶/g,'').trim();if(h.tagName==='H3')a.className='ds-toc-subheading';toc.append(a);}
    article.append(toc);
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(refresh);}}
  new MutationObserver(schedule).observe(document,{childList:true,subtree:true});
  schedule();
})();
