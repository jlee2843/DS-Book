"""Preserve three prior releases' JS/CSS for cached HTML and open tabs."""
from pathlib import Path, PurePosixPath
import json
import os
import re
import shutil
import tarfile
import tempfile
import urllib.request
import urllib.parse
import zipfile
from concurrent.futures import ThreadPoolExecutor


def linked_assets(text, source_url, site_url):
    """Find same-origin JS/CSS references in HTML and the imported module graph."""
    origin = urllib.parse.urlsplit(site_url)
    found = set()
    for _, value in re.findall(r'''(["'`])([^"'`\s<>{}]+?\.(?:js|css)(?:\?[^"'`\s<>{}]*)?)\1''', text):
        # Relative imports use ./ or ../; MyST manifest entries and stylesheet
        # hrefs without that prefix are relative to the published site root.
        base = source_url if value.startswith('.') else site_url
        parsed = urllib.parse.urlsplit(urllib.parse.urljoin(base, value))
        if (parsed.scheme, parsed.netloc) != (origin.scheme, origin.netloc):
            continue
        path = PurePosixPath(parsed.path.lstrip('/'))
        if '..' in path.parts or path.suffix not in {'.js', '.css'}:
            continue
        # Runtime package names and code examples are not published assets.
        if '.reader-' not in path.name and not path.name.startswith(('myst-theme', 'site-enhancements')):
            continue
        found.add(str(path))
    # MyST loads these two runtimes relative to BASE_URL via a template literal.
    for name in re.findall(r'\$\{[^{}]*\}/(thebe-(?:core|lite)\.min\.reader-[a-f0-9]+\.js)', text):
        found.add(urllib.parse.urlsplit(urllib.parse.urljoin(site_url, name)).path.lstrip('/'))
    return found


def merge_live_site(root, site_url, read=None):
    """Recover the live module graph when GitHub's older artifacts have expired."""
    site_url = site_url.rstrip('/') + '/'
    if read is None:
        def read(url):
            request = urllib.request.Request(url, headers={'User-Agent': 'DS-Book-asset-retention'})
            try:
                with urllib.request.urlopen(request, timeout=45) as response:
                    return response.read()
            except urllib.error.HTTPError as error:
                raise RuntimeError(f'Published asset unavailable: {url} (HTTP {error.code})') from error
    manifest_path = root / 'retained-assets.json'
    ages = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    previous = json.loads(read(site_url + 'retained-assets.json'))
    pending = {name: 1 for name in linked_assets(read(site_url).decode(), site_url, site_url)}
    if not pending:
        raise RuntimeError('No published module references found; refusing to drop cached assets')
    for name, age in previous.items():
        path = PurePosixPath(name)
        parsed = urllib.parse.urlsplit(name)
        if parsed.scheme or parsed.netloc or path.is_absolute() or '..' in path.parts or path.suffix not in {'.js', '.css'}:
            continue
        if age + 1 <= 3:
            pending[name] = min(pending.get(name, 3), age + 1)
    seen, recovered = {}, {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        while pending:
            batch = pending
            pending = {}
            urls = [urllib.parse.urljoin(site_url, name) for name in batch]
            for (name, age), url, content in zip(batch.items(), urls, pool.map(read, urls)):
                seen[name] = min(seen.get(name, 3), age)
                recovered[name] = content
                for dependency in linked_assets(content.decode('utf-8'), url, site_url):
                    if dependency not in seen or age < seen[dependency]:
                        pending[dependency] = min(pending.get(dependency, 3), age)
    # Do not leave a partial retention manifest if a dependency cannot be recovered.
    for name, content in recovered.items():
        target = root / name
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            ages[name] = seen[name]
        elif name in ages:
            ages[name] = min(ages[name], seen[name])
    manifest_path.write_text(json.dumps(ages, sort_keys=True))
    print(f'Recovered {len(ages)} retained assets from the published site; checked {len(seen)} live dependencies')
    return len(ages)


def merge_archive(root, archive, fallback_age=1):
    manifest_path = root / 'retained-assets.json'
    ages = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    with tarfile.open(archive, 'r:*') as tar:
        members = {m.name.removeprefix('./'): m for m in tar if m.isfile()}
        previous = {}
        if 'retained-assets.json' in members:
            previous = json.load(tar.extractfile(members['retained-assets.json']))
        for name, member in members.items():
            path = PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts or path.suffix not in {'.js', '.css'}:
                continue
            target = root / path
            age = previous.get(name, 0) + fallback_age
            if target.exists() or age > 3:
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(member) as source, target.open('wb') as output:
                shutil.copyfileobj(source, output)
            ages[name] = age
    manifest_path.write_text(json.dumps(ages, sort_keys=True))
    return bool(previous), len(ages)


def main():
    root = Path('_build/html')
    repo = os.environ['GITHUB_REPOSITORY']
    token = os.environ['GH_TOKEN']
    api = f'https://api.github.com/repos/{repo}'

    class ArtifactRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, request, fp, code, message, headers, url):
            redirected = super().redirect_request(request, fp, code, message, headers, url)
            redirected.remove_header('Authorization')
            return redirected

    opener = urllib.request.build_opener(ArtifactRedirect)

    def get(url):
        request = urllib.request.Request(url, headers={
            'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'})
        return opener.open(request)

    runs = json.load(get(api + '/actions/workflows/deploy.yml/runs?status=success&per_page=3'))['workflow_runs']
    for age, run in enumerate(runs, 1):
        artifacts = json.load(get(api + f"/actions/runs/{run['id']}/artifacts"))['artifacts']
        artifact = next((a for a in artifacts if a['name'] == 'github-pages' and not a['expired']), None)
        if artifact is None:
            print('Previous Pages artifact expired; recovering assets from the published site')
            merge_live_site(root, os.environ.get('PUBLISHED_SITE_URL', 'https://thestatsbook.com'))
            break
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / 'artifact.zip'
            with get(artifact['archive_download_url']) as response, archive.open('wb') as output:
                shutil.copyfileobj(response, output)
            with zipfile.ZipFile(archive) as zipped:
                tar_path = Path(temporary) / 'artifact.tar'
                with zipped.open('artifact.tar') as source, tar_path.open('wb') as output:
                    shutil.copyfileobj(source, output)
            has_history, count = merge_archive(root, tar_path, age)
        print(f'Retained {count} previous JS/CSS assets')
        if has_history:
            break


if __name__ == '__main__':
    main()
