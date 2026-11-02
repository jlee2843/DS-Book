/* Persistent right-hand document outline; never replace article content. */
(() => {
  if (window.dsSectionsInstalled) return;
  window.dsSectionsInstalled=true;
  let signature='',toc=null,queued=false,items=[],positionQueued=false;
  function updatePosition(){
    positionQueued=false;
    const visible=items.filter(({heading})=>heading.isConnected&&heading.getClientRects().length);
    if(!visible.length)return;
    const threshold=Math.min(240,Math.max(160,window.innerHeight*0.25));
    let current=visible[0];
    for(const item of visible){if(item.heading.getBoundingClientRect().top<=threshold)current=item;else break;}
    const page=document.scrollingElement;
    if(page&&page.scrollHeight>page.clientHeight&&page.scrollTop+page.clientHeight>=page.scrollHeight-2)current=visible[visible.length-1];
    for(const item of items){
      if(item===current){if(item.link.getAttribute('aria-current')!=='location')item.link.setAttribute('aria-current','location');}
      else item.link.removeAttribute('aria-current');
    }
  }
  function schedulePosition(){if(!positionQueued){positionQueued=true;requestAnimationFrame(updatePosition);}}
  window.addEventListener('scroll',schedulePosition,{passive:true});
  window.addEventListener('resize',schedulePosition,{passive:true});
  window.addEventListener('hashchange',schedulePosition);
  document.addEventListener('load',schedulePosition,true);
  function refresh(){
    queued=false;
    const article=document.querySelector('.article.content');
    if(!article)return;
    const headings=[...article.querySelectorAll('h2[id],h3[id]')].filter(h=>!h.closest('.mtrag-viewer')&&!h.closest('.home-profile'));
    const key=location.pathname+JSON.stringify(headings.map(h=>[h.id,h.textContent]));
    if(key===signature&&toc?.isConnected){schedulePosition();return;}
    signature=key;toc?.remove();items=[];
    if(!headings.length)return;
    toc=document.createElement('nav');toc.className='ds-document-toc';toc.setAttribute('aria-label','Table of contents');
    const title=document.createElement('div');title.className='ds-document-toc-title';title.textContent='Table of Contents';toc.append(title);
    for(const h of headings){const a=document.createElement('a');a.href='#'+h.id;a.textContent=h.textContent.replace(/¶/g,'').trim();if(h.tagName==='H3')a.className='ds-toc-subheading';a.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();h.scrollIntoView({block:'start',behavior:'instant'});history.pushState(null,'','#'+encodeURIComponent(h.id));schedulePosition();});toc.append(a);items.push({heading:h,link:a});}
    article.append(toc);schedulePosition();
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(refresh);}}
  new MutationObserver(schedule).observe(document,{childList:true,subtree:true});
  schedule();
})();
