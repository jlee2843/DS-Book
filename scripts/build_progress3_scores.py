"""Export retained Progress 3 evaluations for the static score explorer.

Usage: python3 scripts/build_progress3_scores.py --source /path/to/experiment
This reads recorded outputs only and never invokes a model.
"""
import argparse
import hashlib
import json
from pathlib import Path


def export(source):
    read = lambda name: json.loads((source / name).read_text())
    manifest, answers, scores = map(read, ("manifest.json", "answers.json", "scores.json"))
    index = {(r["answer_id"], r["metric"], r["evaluation_repeat"]): r for r in scores}
    expected = {(a["answer_id"], m, j) for a in answers
                for m in manifest["metrics"] for j in range(1, 4)}
    assert len(index) == len(scores) == 216 and set(index) == expected
    assert len(answers) == 36 and len({a["answer_id"] for a in answers}) == 36
    output = []
    for answer in answers:
        item = {k: answer[k] for k in ("answer_id", "prompt", "temperature",
                                      "generation_repeat", "generation_seed", "answer")}
        item["evaluations"] = {}
        for metric in manifest["metrics"]:
            evaluations = []
            for repeat in range(1, 4):
                row = index[answer["answer_id"], metric, repeat]
                assert all(row[k] == answer[k] for k in ("prompt", "temperature", "generation_repeat", "generation_seed"))
                valid = row["status"] == "completed"
                assert (valid and isinstance(row["score"], (int, float)) and 0 <= row["score"] <= 1) or (not valid and row["score"] is None)
                folder = source / f'{answer["answer_id"]}--{metric}--{repeat}'
                request = json.loads((folder / "call-01.request.json").read_text())
                entry = {k: row.get(k) for k in ("evaluation_repeat", "status", "score", "reason",
                                                "error", "started_at", "finished_at", "seconds", "judge_calls")}
                entry.update(judge=request["model"], judge_options=request["options"])
                details = row.get("details") or {}
                if metric == "faithfulness":
                    verdicts = {v["sentence_id"]: v for v in (details.get("sentence_verdicts") or [])}
                    entry["items"] = [dict(id=r["sentence_id"], text=r["text"],
                                            verdict=verdicts.get(r["sentence_id"], {}).get("verdict"),
                                            reason=verdicts.get(r["sentence_id"], {}).get("reason"))
                                      for r in (details.get("records") or [])]
                    entry["truths"] = details.get("truths") or []
                else:
                    statements, verdicts = details.get("statements") or [], details.get("verdicts") or []
                    # A failed count check has no verified statement/verdict mapping.
                    matched = valid and len(statements) == len(verdicts)
                    entry["items"] = [dict(id=f"S{i+1}", text=s,
                                            verdict=verdicts[i].get("verdict") if matched else None,
                                            reason=verdicts[i].get("reason") if matched else None)
                                      for i, s in enumerate(statements)]
                if valid:
                    assert entry["items"] and all(i["verdict"] in ("yes", "no", "borderline") for i in entry["items"])
                    calculated = sum(i["verdict"] != "no" for i in entry["items"]) / len(entry["items"])
                    assert abs(calculated - entry["score"]) < 1e-12
                evaluations.append(entry)
            item["evaluations"][metric] = evaluations
        output.append(item)
    return dict(schema_version=1, experiment=source.name, generator="qwen3:4b",
                judge=manifest["judge"], judge_temperature=manifest["judge_options"]["temperature"],
                prompts=manifest["prompts"], evaluator_question=manifest["question"],
                reference_excerpts=manifest["reference_excerpts"], responses=output,
                source_sha256={name: hashlib.sha256((source / name).read_bytes()).hexdigest()
                               for name in ("manifest.json", "answers.json", "scores.json")})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("notes/data/Research/progress3/scores.json"))
    args = parser.parse_args()
    data = export(args.source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Exported {len(data['responses'])} responses and 216 retained evaluations to {args.output}")
