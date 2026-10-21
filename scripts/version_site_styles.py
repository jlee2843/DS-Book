"""Give each published stylesheet revision a distinct browser cache key."""
from pathlib import Path
import hashlib

root = Path('_build/html')
css = root / 'myst-theme.css'
version = hashlib.sha256(css.read_bytes()).hexdigest()[:16]
name = f'myst-theme.{version}.css'
(root / name).write_bytes(css.read_bytes())
count = 0
for path in root.rglob('*'):
    if path.suffix not in {'.html', '.json', '.js'}:
        continue
    text = path.read_text()
    if 'myst-theme.css' in text:
        path.write_text(text.replace('myst-theme.css', name))
        count += 1
assert count, 'No stylesheet references were found in the site build'
print(f'Versioned stylesheet: {name}; updated {count} assets')
