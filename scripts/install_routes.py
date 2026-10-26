"""Give the generated MyST site canonical hierarchical URLs and legacy redirects."""
from pathlib import Path
import json,re,html,os

def install_routes(root):
    base=os.environ.get('BASE_URL', '/DS-Book').rstrip('/')
    routes=json.loads(Path('styles/page-routes.json').read_text())
    # MyST stores nested page slugs with dots, and resolves them to slash URLs.
    def rewrite(text):
        for old,new in sorted(routes.items(),key=lambda x:-len(x[0])):
            dot=new.replace('/','.')
            for q in ['"','\\"']:
                text=text.replace(q+'slug'+q+':'+q+old+q,q+'slug'+q+':'+q+dot+q)
            text=re.sub(r'(/(?:DS-Book/)?)'+re.escape(old)+r'(?=(?:/)?(?:["\'?#<\\]|$))',lambda m:m[1]+new,text)
            text=re.sub(r'(/(?:DS-Book/)?)'+re.escape(old)+r'\.json(?=["\'?#\\]|$)',lambda m:m[1]+dot+'.json',text)
        return text
    # HTML contains both rendered links and hydration data. Page JSON contains cross-links.
    for p in list(root.rglob('*.html'))+list(root.glob('*.json'))+list(root.glob('*.xml')):
        text=p.read_text();updated=rewrite(text)
        if updated!=text:p.write_text(updated)
    for old,new in routes.items():
        oldhtml=root/old/'index.html'
        if not oldhtml.exists():raise RuntimeError(f'Missing source route: {old}')
        target=root/new/'index.html';target.parent.mkdir(parents=True,exist_ok=True)
        if 'http-equiv="refresh"' not in oldhtml.read_text():target.write_bytes(oldhtml.read_bytes())
        elif not target.exists():raise RuntimeError(f'Missing canonical page: {new}')
        oldjson=root/(old+'.json');(root/(new.replace('/','.')+'.json')).write_bytes(oldjson.read_bytes())
        url=base+'/'+new+'/'
        oldhtml.write_text('<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url='+html.escape(url)+'"><link rel="canonical" href="'+html.escape(url)+'"><script>location.replace('+json.dumps(url)+'+location.search+location.hash)</script></head><body><a href="'+html.escape(url)+'">Continue</a></body></html>')
    print(f'Installed {len(routes)} hierarchical routes and legacy redirects')
