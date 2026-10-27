"""Preserve three prior releases' JS/CSS for cached HTML and open tabs."""
from pathlib import Path, PurePosixPath
import json
import os
import shutil
import tarfile
import tempfile
import urllib.request
import zipfile


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
            raise RuntimeError('Previous Pages artifact unavailable; refusing to drop cached assets')
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
