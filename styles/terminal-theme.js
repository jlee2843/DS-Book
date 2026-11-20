/* Add console framing without replacing notebook content or canonical links. */
(() => {
 if(window.dsTerminalInstalled)return;
 window.dsTerminalInstalled=true;
 let queued=false;
 function command(text){const el=document.createElement('div');el.className='ds-terminal-command';el.append('jenny@notebook:~');const dollar=document.createElement('b');dollar.textContent='$';const code=document.createElement('span');code.textContent=text;el.append(dollar,code);return el;}
 function update(){
  queued=false;
  const article=document.querySelector('.article.content');if(!article)return;
  const home=article.querySelector('.home-pixel');
  const base=dsBasePath();
  const path=decodeURI(location.pathname).slice(base.length).replace(/^\/+|\/+$/g,'');
  const key=home?'home':path;
  const navigation=document.querySelector('.ds-site-navigation');
  if(navigation){
   const homeLink=navigation.querySelector(':scope > a');
   if(homeLink){if(home&&!homeLink.hasAttribute('aria-current'))homeLink.setAttribute('aria-current','page');else if(!home&&homeLink.hasAttribute('aria-current'))homeLink.removeAttribute('aria-current');}
   navigation.querySelectorAll('.ds-nav-group>button').forEach(button=>{
    const active=path.startsWith(button.textContent.includes('Learning')?'Learning-Notes/':'Research/');
    if(button.dataset.sectionActive!==String(active))button.dataset.sectionActive=String(active);
   });
  }

  const terminalPath=path.replace(/^Learning-Notes/,'notes').replace(/^Research/,'research');
  let session=article.querySelector(':scope > .ds-terminal-session');
  if(!session){session=document.createElement('div');session.className='ds-terminal-session';session.innerHTML='<span>jenny@notebook: ~</span><span>THE STATISTICS NOTEBOOK</span>';article.prepend(session);}
  let cmd=article.querySelector(':scope > .ds-terminal-command');
  if(!cmd||cmd.dataset.path!==key){cmd?.remove();cmd=command(home?'cat about.txt':(article.querySelector('.myst-grid')?'tree ':'cat ')+(terminalPath||'notebook')+(article.querySelector('.myst-grid')?'/':'.md'));cmd.dataset.path=key;session.after(cmd);}
  if(home){
   const label=home.querySelector('.home-chapter-label p');if(label&&label.textContent!=='notebook/')label.textContent='notebook/';
   const chapters=home.querySelector('.home-chapters');if(chapters&&!chapters.previousElementSibling?.classList.contains('ds-terminal-command'))chapters.before(command('tree notebook/'));
   const sources=home.querySelector('.home-lecture-sources');
   if(sources&&!sources.querySelector('details')){const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='└── lecture-sources.txt [+]';const columns=sources.querySelector('.home-source-columns');if(columns){details.append(summary,columns);sources.replaceChildren(details);}}
  }
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
 new MutationObserver(schedule).observe(document,{childList:true,subtree:true});schedule();
})();
