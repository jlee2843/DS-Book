"""Install the same Sections enhancement in MyST preview and published bundles.

Preview: python3 scripts/install_sections.py --preview (after myst start).
Release: called by version_site_styles.py after myst build --html.
"""
from pathlib import Path
import sys
import hashlib
import re

MARKER = '\n/* DS_SECTIONS_ENHANCEMENT */\n'

def install(root):
    script = Path('styles/sections.js').read_text() + '\n' + Path('styles/mtrag-viewer.js').read_text() + '\n' + Path('styles/site-navigation.js').read_text()
    matches = []
    for path in root.rglob('*.js'):
        if 'node_modules' in path.parts:
            continue
        text = path.read_text()
        if 'myst-outline-collapsible' not in text:
            continue
        original = text.split(MARKER)[0]
        path.write_text(original + MARKER + script)
        matches.append(path)
    if not matches:
        raise RuntimeError(f'No MyST outline bundle found in {root}')
    return matches

if __name__ == '__main__':
    root = Path('_build/templates/site/myst/book-theme/public/build') if '--preview' in sys.argv else Path('_build/html')
    changed = install(root)
    if '--preview' in sys.argv:
        # Bust immutable development module caches, including SSR preload URLs.
        version = hashlib.sha256(Path('styles/sections.js').read_bytes() + Path('styles/mtrag-viewer.js').read_bytes() + Path('styles/site-navigation.js').read_bytes()).hexdigest()[:12]
        targets = list(root.rglob('*.js')) + [root.parents[1] / 'build/index.js']
        names = {p.name for p in root.rglob('*.js')}
        pattern = re.compile(r'([\w$.-]+\.js)(?:\?sections=[a-f0-9]+)?')
        for target in targets:
            text = target.read_text()
            text = pattern.sub(lambda m: m.group(1) + '?sections=' + version if m.group(1) in names else m.group(0), text)
            target.write_text(text)
    for path in changed:
        print(f'Installed Sections enhancement: {path}')
