"""Inspect the pinned public MTRAG release. Python 3.9+, standard library only.
Usage: python inspect_mtrag.py --cache ./mtrag-cache
Downloads public files into the chosen cache; makes no model/API calls.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

COMMIT = '53fef6f5917c7e10c436f697e69a955dbc795d81'
BASE = f'https://raw.githubusercontent.com/IBM/mt-rag-benchmark/{COMMIT}/'
FILES = ['mtrag-human/conversations/conversations.json',
         'mtrag-human/generation_tasks/reference.jsonl',
         'mtrag-human/generation_tasks/RAG.jsonl',
         'mtrag-human/generation_tasks/reference+RAG.jsonl',
         'mtrag-human/evaluations/reference_subset_with_human_evaluations.json']

def inspect(cache):
    cache.mkdir(parents=True, exist_ok=True)
    data, manifest = {}, {}
    for name in FILES:
        path = cache / name.replace('/', '__')
        if not path.exists():
            with urlopen(BASE + name, timeout=90) as response:
                payload = response.read()
            path.write_bytes(payload)
        raw = path.read_bytes()
        manifest[name] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw)}
        data[name] = ([json.loads(line) for line in raw.splitlines() if line.strip()]
                      if name.endswith('.jsonl') else json.loads(raw))
    tasks = data[FILES[1]]
    by_id = {t['task_id']: t for t in tasks}
    assert len(by_id) == len(tasks) == 842
    assert len({(t['conversation_id'], int(t['turn'])) for t in tasks}) == len(tasks)
    assert len(data[FILES[0]]) == 110
    for task in tasks:
        assert task['input'][-1]['speaker'] == 'user'
        assert len(task['input']) == 2 * int(task['turn']) - 1
        assert task['targets']
    settings = {}
    for name in FILES[1:4]:
        rows = data[name]
        ids = {t['task_id'] for t in rows}
        assert len(ids) == len(rows)
        assert ids <= by_id.keys()
        settings[Path(name).name] = {
            'tasks': len(rows), 'context_counts': dict(Counter(len(t['contexts']) for t in rows))}
    assert len(data[FILES[2]]) == 842 and len(data[FILES[3]]) == 436
    human = data[FILES[4]]
    human_ids = {t['task_id'] for t in human['tasks']}
    assert human_ids <= by_id.keys()
    docs = {d['document_id'] for d in human['documents']}
    assert all(c['document_id'] in docs for t in human['tasks'] for c in t['contexts'])
    assert len({(e['task_id'], e['model_id']) for e in human['evaluations']}) == len(human['evaluations'])
    human_metrics = {m['name'] for m in human['metrics'] if m.get('author') == 'human'}
    ratings = []
    for evaluation in human['evaluations']:
        assert evaluation['task_id'] in human_ids
        task = by_id[evaluation['task_id']]
        for metric in sorted(human_metrics):
            for annotator, annotation in evaluation['annotations'].get(metric, {}).items():
                if annotation.get('value') is None:
                    continue
                ratings.append({'task_id': task['task_id'], 'conversation_id': task['conversation_id'],
                    'turn': int(task['turn']), 'model_id': evaluation['model_id'],
                    'metric': metric, 'annotator_id': annotator, 'value': float(annotation['value'])})
    report = {'commit': COMMIT, 'files': manifest, 'tasks': len(tasks),
        'conversations': len({t['conversation_id'] for t in tasks}),
        'collections': dict(Counter(t['Collection'] for t in tasks)),
        'answerability': dict(Counter(a for t in tasks for a in t['Answerability'])),
        'settings': settings, 'human_tasks': len(human_ids),
        'human_conversations': len({by_id[i]['conversation_id'] for i in human_ids}),
        'human_evaluations': len(human['evaluations']),
        'human_ratings': dict(Counter(r['metric'] for r in ratings))}
    (cache / 'inspection-summary.json').write_text(json.dumps(report, indent=2) + '\n')
    with (cache / 'human-ratings.jsonl').open('w') as stream:
        for row in ratings:
            stream.write(json.dumps(row) + '\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path('mtrag-cache'))
    inspect(parser.parse_args().cache)
