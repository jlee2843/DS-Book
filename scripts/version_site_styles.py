"""Give published styles and favicons content-specific browser cache keys."""
from pathlib import Path
import hashlib
import re
from install_sections import install

root = Path('_build/html')
replacements = {}
# Version the whole module graph so cached importers cannot load old chunks.
install(root)
modules = [p for p in root.rglob('*.js') if '.reader-' not in p.name and '.sections-' not in p.name]
# CSS references are embedded in the module graph, so CSS changes must also
# invalidate JavaScript importers held by open browser tabs.
release = hashlib.sha256((root / 'myst-theme.css').read_bytes() + b''.join(p.read_bytes() for p in sorted(modules))).hexdigest()[:16]
for asset in modules:
    name = f'{asset.stem}.reader-{release}.js'
    asset.with_name(name).write_bytes(asset.read_bytes())
    replacements[asset.name] = name
for original in ('myst-theme.css', 'favicon.ico'):
    asset = (Path('data/favicon-options/chart-bell-curve.png')
             if original == 'favicon.ico' else root / original)
    version = hashlib.sha256(asset.read_bytes()).hexdigest()[:16]
    name = f'{asset.stem}.{version}{asset.suffix}'
    (root / name).write_bytes(asset.read_bytes())
    replacements[original] = name

counts = dict.fromkeys(replacements, 0)
for path in root.rglob('*'):
    if path.suffix not in {'.html', '.json', '.js'}:
        continue
    text = path.read_text()
    updated = text
    def replace_module(match):
        original = match.group(0)
        if original in replacements:
            counts[original] += 1
            return replacements[original]
        return original
    updated = re.sub(r"(?<=[/\"'])[-\w$.]+\.js", replace_module, updated)
    for original in ('myst-theme.css', 'favicon.ico'):
        if original in updated:
            updated = updated.replace(original, replacements[original])
            counts[original] += 1
    if updated != text:
        path.write_text(updated)

for original, name in replacements.items():
    if original in {'myst-theme.css', 'favicon.ico'}:
        assert counts[original], f'No references to {original} were found in the site build'
    if original in {'myst-theme.css', 'favicon.ico'}:
        print(f'Versioned asset: {name}; updated {counts[original]} assets')
print(f'Versioned {len(modules)} JavaScript modules: {release}')
