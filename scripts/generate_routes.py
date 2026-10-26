from pathlib import Path
import json,re,yaml
c=json.load(open('_build/html/config.json'));pages=c['projects'][0]['pages'];toc=yaml.safe_load(Path('myst.yml').read_text())['project']['toc'];entries=[]
def seg(n):return re.sub(r'[^A-Za-z0-9-]+','-',n.replace('&','and')).strip('-')
def walk(nodes,parents=[]):
 for n in nodes:
  if n['file'].endswith('Introduction.ipynb'):continue
  title=n.get('title',Path(n['file']).stem)
  if n['file'].endswith('MTRAG-Inspection.ipynb'):title='Dataset-Guide'
  if n['file'].endswith('MTRAG-Viewer.ipynb'):title='Data-Viewer'
  path=parents+[seg(title)]
  if not parents:path=['Learning-Notes' if n['file'].startswith('notes/Learning/') else 'Research']+path
  entries.append((n['file'],'/'.join(path)))
  walk(n.get('children',[]),path)
walk(toc)
assert len(entries)==len(pages),(len(entries),len(pages))
routes={page['slug']:route for page,(_,route) in zip(pages,entries)}
assert routes['progress-1']=='Research/Progress/1'
Path('styles/page-routes.json').write_text(json.dumps(routes,indent=2)+'\n')
js='const DS_PAGE_ROUTES='+json.dumps(routes)+';\n'
js+='''function dsRoute(slug){const clean=slug.replace(/^\\/|\\/$/g,'');return DS_PAGE_ROUTES[clean]||clean;}
function dsCurrentSlug(){const p=decodeURI(location.pathname).replace(/\\/$/,'');return Object.keys(DS_PAGE_ROUTES).find(k=>p.endsWith('/'+DS_PAGE_ROUTES[k]))||p.split('/').pop();}
'''
Path('styles/page-routes.js').write_text(js)
