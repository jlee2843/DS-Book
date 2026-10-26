"""Serve the generated book locally without browser asset caching."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import re

class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        resolved = super().translate_path(path)
        # Open tabs may still request the previous build's stylesheet.
        # The generator removes it on rebuild; serve the current theme instead.
        target = Path(resolved)
        if not target.exists() and re.fullmatch(r"myst-theme\.[a-f0-9]+\.css", target.name):
            current = target.with_name("myst-theme.css")
            if current.exists():
                return str(current)
        return resolved

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8124)
    args = parser.parse_args()
    root = Path('/tmp/ds-book-local')
    root.mkdir(exist_ok=True)
    book = root / 'DS-Book'
    if not book.exists():
        book.symlink_to(Path('_build/html').resolve(), target_is_directory=True)
    print(f'Local preview: http://127.0.0.1:{args.port}/DS-Book/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), partial(PreviewHandler, directory=str(root))).serve_forever()
