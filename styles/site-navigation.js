/* Shared document navigation: hover, keyboard focus and touch use the same menus. */
(() => {
  if (window.dsNavigationInstalled) return;
  window.dsNavigationInstalled = true;
  let queued=false;
  function mount() {
    queued=false;
    const top=document.querySelector('.myst-top-nav');
    if (!top || document.querySelector('.ds-site-navigation')) return;
    document.documentElement.classList.add('ds-monochrome');
    const home=document.querySelector('.myst-home-link');
    const base=home ? new URL(home.href).pathname.replace(/\/$/,'') : '/DS-Book';
    const nav=document.createElement('nav');nav.className='ds-site-navigation';nav.setAttribute('aria-label','Site navigation');
    function link(label,path){const a=document.createElement('a');a.textContent=label;a.href=base+path;return a;}
    nav.append(link('Home','/'));
    function group(label,entries){
      const wrap=document.createElement('div');wrap.className='ds-nav-group';
      const button=document.createElement('button');button.type='button';button.textContent=label+' ⌄';button.setAttribute('aria-expanded','false');
      const menu=document.createElement('div');menu.className='ds-nav-menu';menu.id='ds-menu-'+label.toLowerCase().replaceAll(' ','-');menu.hidden=true;button.setAttribute('aria-controls',menu.id);
      entries.forEach(([name,path])=>menu.append(link(name,path)));
      let timer;
      function set(open){clearTimeout(timer);menu.hidden=!open;button.setAttribute('aria-expanded',String(open));}
      wrap.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')set(true);});
      wrap.addEventListener('pointerleave',()=>{timer=setTimeout(()=>{if(!wrap.contains(document.activeElement))set(false);},140);});
      button.addEventListener('click',event=>set(event.pointerType==='mouse' ? true : menu.hidden));
      button.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();set(true);menu.querySelector('a').focus();}});
      wrap.addEventListener('keydown',e=>{if(e.key==='Escape'){set(false);button.focus();}});
      wrap.addEventListener('focusout',e=>{if(!wrap.contains(e.relatedTarget))set(false);});
      document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))set(false);});
      menu.addEventListener('click',()=>set(false));wrap.append(button,menu);nav.append(wrap);
    }
    group('Learning Notes',[
      ['Foundations','/foundations'],['Classification','/classification'],
      ['Regression','/regression'],['Statistical Experiments','/statistical-experiments']
    ]);
    group('Research',[
      ['Proposal','/proposal'],
      ['MTRAG: Dataset guide','/mtrag-inspection'],
      ['MTRAG: Data viewer','/mtrag-viewer']
    ]);
    const explore=document.querySelector('.myst-top-nav-menu-button');
    if(explore)explore.setAttribute('aria-label','Explore');
    top.append(nav);
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(mount);}}
  new MutationObserver(schedule).observe(document,{childList:true,subtree:true});
  schedule();
})();

/* Home profile links retain accessible names while displaying compact icons. */
(() => {
 const icons={
  'linkedin.com':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="2" fill="currentColor"/><path d="M7 10v8m0-11v.1M11 18v-8m0 3c0-4 6-4 6 0v5" fill="none" stroke="var(--ds-paper)" stroke-width="2.2"/></svg>',
  'jennydatascience.com':'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12c6 4 12 4 18 0M10 14h4"/></svg>'
 };
 function update(){document.querySelectorAll('.home-profile-links a').forEach(a=>{if(a.dataset.profileIcon)return;const domain=Object.keys(icons).find(d=>a.href.includes(d));if(!domain)return;a.dataset.profileIcon='true';a.setAttribute('aria-label',domain==='linkedin.com'?'LinkedIn':'Portfolio');a.title=a.getAttribute('aria-label');a.innerHTML=icons[domain];});}
 new MutationObserver(update).observe(document,{childList:true,subtree:true});update();
})();

/* Show topic menus as children of their subject, above the document title. */
(() => {
 let queued=false;
 function update(){queued=false;document.querySelectorAll('.submenu-parent').forEach(label=>{
  const article=label.closest('.article.content');const heading=article?.querySelector('h1');
  if(!heading)return;
  const a=label.querySelector('a');const home=document.querySelector('.myst-home-link');
  if(a&&!a.dataset.parentReady){const base=home?new URL(home.href).pathname.replace(/\/$/,''):'/DS-Book';a.href=base+(a.textContent.trim()==='Regression'?'/regression/':'/statistical-experiments/');a.dataset.parentReady='true';}
  if(label.nextElementSibling!==heading)heading.before(label);
 });}
 function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
 new MutationObserver(schedule).observe(document,{childList:true,subtree:true});schedule();
})();

/* Keep the subject and topic visible above individual note titles. */
(() => {
 const paths={"basic": [["Foundations", "foundations"]], "preprocessing": [["Foundations", "foundations"]], "logistic-regression": [["Classification", "classification"]], "k-nn": [["Classification", "classification"]], "naive-bayes": [["Classification", "classification"]], "trees": [["Classification", "classification"]], "random-forest": [["Classification", "classification"]], "boosting": [["Classification", "classification"]], "svm": [["Classification", "classification"]], "predictive-modelling": [["Regression", "regression"], ["Predictive Modelling", "predictive-modelling-topics"]], "prediction-error": [["Regression", "regression"], ["Predictive Modelling", "predictive-modelling-topics"]], "optimism-and-complexity": [["Regression", "regression"], ["Predictive Modelling", "predictive-modelling-topics"]], "cross-validation": [["Regression", "regression"], ["Predictive Modelling", "predictive-modelling-topics"]], "loo-and-gcv": [["Regression", "regression"], ["Predictive Modelling", "predictive-modelling-topics"]], "regularization-and-penalized-regression": [["Regression", "regression"], ["Regularization & Penalized Regression", "regularization-and-penalized-regression-topics"]], "least-squares": [["Regression", "regression"], ["Regularization & Penalized Regression", "regularization-and-penalized-regression-topics"]], "spectral-analysis": [["Regression", "regression"], ["Regularization & Penalized Regression", "regularization-and-penalized-regression-topics"]], "ridge-regression": [["Regression", "regression"], ["Regularization & Penalized Regression", "regularization-and-penalized-regression-topics"]], "ridge-tuning": [["Regression", "regression"], ["Regularization & Penalized Regression", "regularization-and-penalized-regression-topics"]], "nonlinearregression": [["Regression", "regression"], ["Nonlinear Regression", "nonlinearregression-topics"]], "functionspaces": [["Regression", "regression"], ["Nonlinear Regression", "nonlinearregression-topics"]], "splinebases": [["Regression", "regression"], ["Nonlinear Regression", "nonlinearregression-topics"]], "penalizedsplines": [["Regression", "regression"], ["Nonlinear Regression", "nonlinearregression-topics"]], "splinetuning": [["Regression", "regression"], ["Nonlinear Regression", "nonlinearregression-topics"]], "sparseregression": [["Regression", "regression"], ["Sparse Regression and Trees", "sparseregression-topics"]], "lasso": [["Regression", "regression"], ["Sparse Regression and Trees", "sparseregression-topics"]], "coordinatedescent": [["Regression", "regression"], ["Sparse Regression and Trees", "sparseregression-topics"]], "lassopaths": [["Regression", "regression"], ["Sparse Regression and Trees", "sparseregression-topics"]], "regressiontrees": [["Regression", "regression"], ["Sparse Regression and Trees", "sparseregression-topics"]], "regressiondiagnostics": [["Regression", "regression"], ["Sparse Regression and Trees", "sparseregression-topics"]], "experimental-design": [["Statistical Experiments", "statistical-experiments"], ["Design & Mean Comparisons", "design-and-comparisons"]], "two-group-comparisons": [["Statistical Experiments", "statistical-experiments"], ["Design & Mean Comparisons", "design-and-comparisons"]], "paired-and-randomization-tests": [["Statistical Experiments", "statistical-experiments"], ["Design & Mean Comparisons", "design-and-comparisons"]], "one-way-anova": [["Statistical Experiments", "statistical-experiments"], ["Design & Mean Comparisons", "design-and-comparisons"]], "contrasts-and-multiple-comparisons": [["Statistical Experiments", "statistical-experiments"], ["Design & Mean Comparisons", "design-and-comparisons"]], "blocking-designs": [["Statistical Experiments", "statistical-experiments"], ["Blocking & Nuisance Variation", "blocking-and-nuisance-variation"]], "blocking-factorials": [["Statistical Experiments", "statistical-experiments"], ["Blocking & Nuisance Variation", "blocking-and-nuisance-variation"]], "factorial-experiments": [["Statistical Experiments", "statistical-experiments"], ["Factorials & Screening", "factorials-and-screening"]], "two-level-factorials": [["Statistical Experiments", "statistical-experiments"], ["Factorials & Screening", "factorials-and-screening"]], "fractional-factorials": [["Statistical Experiments", "statistical-experiments"], ["Factorials & Screening", "factorials-and-screening"]], "saturated-designs-and-foldovers": [["Statistical Experiments", "statistical-experiments"], ["Factorials & Screening", "factorials-and-screening"]], "center-points-and-curvature": [["Statistical Experiments", "statistical-experiments"], ["Response Surfaces & Optimization", "response-surfaces-and-optimization"]], "response-surfaces-and-steepest-ascent": [["Statistical Experiments", "statistical-experiments"], ["Response Surfaces & Optimization", "response-surfaces-and-optimization"]], "quadratic-response-surfaces": [["Statistical Experiments", "statistical-experiments"], ["Response Surfaces & Optimization", "response-surfaces-and-optimization"]], "robust-parameter-design": [["Statistical Experiments", "statistical-experiments"], ["Response Surfaces & Optimization", "response-surfaces-and-optimization"]], "random-effects-and-mixed-models": [["Statistical Experiments", "statistical-experiments"], ["Random Effects & Hierarchies", "random-effects-and-hierarchies"]], "nested-designs": [["Statistical Experiments", "statistical-experiments"], ["Random Effects & Hierarchies", "random-effects-and-hierarchies"]]};
 let queued=false;
 function update(){
  queued=false;
  const slug=location.pathname.replace(/\/$/,'').split('/').pop();
  const parents=paths[slug];
  const article=document.querySelector('.article.content');
  const heading=article?.querySelector('h1');
  if(!heading)return;
  let label=article.querySelector('.note-parent');
  if(!parents){label?.remove();return;}
  const signature=JSON.stringify(parents);
  if(label?.dataset.path!==signature){
   label?.remove();label=document.createElement('nav');label.className='note-parent';
   label.setAttribute('aria-label','Note hierarchy');label.dataset.path=signature;
   const home=document.querySelector('.myst-home-link');
   const base=home?new URL(home.href).pathname.replace(/\/$/,''):'/DS-Book';
   parents.forEach(([title,path],i)=>{
    if(i){const separator=document.createElement('span');separator.textContent=' / ';separator.setAttribute('aria-hidden','true');label.append(separator);}
    const a=document.createElement('a');a.textContent=title;a.href=base+'/'+path+'/';label.append(a);
   });
  }
  if(label.nextElementSibling!==heading)heading.before(label);
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
 new MutationObserver(schedule).observe(document,{childList:true,subtree:true});schedule();
})();
