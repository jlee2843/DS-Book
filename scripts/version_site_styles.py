"""Give published styles and favicons content-specific browser cache keys."""
from pathlib import Path
import hashlib

root = Path('_build/html')
replacements = {}
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
    for original, name in replacements.items():
        if original in updated:
            updated = updated.replace(original, name)
            counts[original] += 1
    if updated != text:
        path.write_text(updated)

for original, name in replacements.items():
    assert counts[original], f'No references to {original} were found in the site build'
    print(f'Versioned asset: {name}; updated {counts[original]} assets')
