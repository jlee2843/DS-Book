"""Check canonical routes, page-data slugs and internal HTML links after building."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json
root=Path('_build/html');routes=json.loads(Path('styles/page-routes.json').read_text())
class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':self.links.extend(v for k,v in attrs if k=='href' and v)
errors=[]
for old,new in routes.items():
    page=root/new/'index.html';assert page.exists(),new
    data=json.loads((root/(new.replace('/','.')+'.json')).read_text());assert data['slug']==new.replace('/','.')
    parser=Links();parser.feed(page.read_text())
    for href in parser.links:
        path=unquote(urlsplit(href).path)
        if not path.startswith('/DS-Book/'):continue
        rel=path[len('/DS-Book/'):].strip('/')
        if rel in routes:errors.append((new,'legacy link',href))
        target=root/rel
        if not (target.is_file() or (target/'index.html').is_file()):errors.append((new,'missing target',href))
assert not errors,errors[:20]
hidden = {'Research.Literature-Review', 'Research.Literature-Review.Reliable-decision-support-with-LLMs', 'Research.Data.LLM-Consistency'}
assert {p['slug'] for p in json.loads((root/'config.json').read_text())['projects'][0]['pages']} == {p.replace('/','.') for p in routes.values()} - hidden
print(f'Validated {len(routes)} canonical pages, page data and internal links')
