"""Build display-only MTRAG projections from the pinned inspection cache.
Usage: python scripts/build_mtrag_viewer_data.py --source /path/to/mtrag-cache
Original text is preserved; author IDs, timestamps and query internals are omitted.
"""
import argparse
import json
from pathlib import Path

COMMIT = '53fef6f5917c7e10c436f697e69a955dbc795d81'

def build(source, output):
    def read(name):
        p = source / name.replace('/', '__')
        if name.endswith('.jsonl'):
            return [json.loads(line) for line in p.read_text().splitlines() if line.strip()]
        return json.loads(p.read_text())
    def passages(items):
        return [{k: p[k] for k in ('document_id', 'text', 'title', 'score', 'url') if k in p} for p in items]
    def messages(items):
        return [{**{k: m[k] for k in ('speaker', 'text')}, **({'model': m.get('metadata', {}).get('author_id')} if m.get('metadata', {}).get('author_type') == 'model' else {})} for m in items]
    def save(name, data):
        (output / name).write_text(json.dumps({'commit': COMMIT, 'data': data}, ensure_ascii=False, separators=(',', ':')) + '\n')
    output.mkdir(parents=True, exist_ok=True)
    ref = read('mtrag-human/generation_tasks/reference.jsonl')
    tasks = []
    for t in ref:
        tasks.append({'task_id': t['task_id'], 'conversation_id': t['conversation_id'], 'turn': int(t['turn']),
            'collection': t['Collection'], 'answerability': t['Answerability'],
            'question_type': t['Question Type'], 'multi_turn': t['Multi-Turn'],
            'input': messages(t['input']), 'targets': messages(t['targets']), 'contexts': passages(t['contexts'])})
    assert len(tasks) == len({t['task_id'] for t in tasks}) == 842
    save('reference.json', tasks)
    for file, out in [('RAG', 'rag.json'), ('reference+RAG', 'reference-rag.json')]:
        ts = read(f'mtrag-human/generation_tasks/{file}.jsonl')
        save(out, {t['task_id']: passages(t['contexts']) for t in ts})
    human = read('mtrag-human/evaluations/reference_subset_with_human_evaluations.json')
    metrics = [m for m in human['metrics'] if m.get('author') == 'human']
    evaluations = {}
    for e in human['evaluations']:
        ratings = {m['name']: [a['value'] for a in e['annotations'].get(m['name'], {}).values() if a.get('value') is not None] for m in metrics}
        evaluations.setdefault(e['task_id'], []).append({'model_id': e['model_id'], 'response': e['model_response'], 'ratings': ratings, 'annotator_ratings': {m['name']: {key: a['value'] for key, a in e['annotations'].get(m['name'], {}).items() if a.get('value') is not None} for m in metrics}})
    assert len(evaluations) == 159 and sum(map(len, evaluations.values())) == 477
    save('human.json', {'metrics': [{'name':m['name'], 'display_name':m['display_name']} for m in metrics], 'evaluations': evaluations})
    print(f'Wrote {len(tasks)} tasks and {len(evaluations)} human-rated tasks to {output}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--output', type=Path, default=Path('data/Research/mtrag'))
    args = parser.parse_args()
    build(args.source, args.output)
