# Progress 2: human50 judge analysis

This analysis reads a frozen snapshot of `Data/mtrag/human50-deepeval`. It does not rerun a judge, change source scores, or treat errors as zero. `snapshot.json` was assembled from the canonical `scores/<hash>-<metric>.json` files for the 100 records in `inputs.json`. Retry-error files are excluded. `results.json` is incomplete, so it is not the source of truth. Provenance records exact source hashes.

## Upstream and changes

Reference: Dubois et al., *Quantifying Biases in LLM-as-a-Judge Evaluations* (2026), Sections 3.1–3.5 and Appendix A.2. Official repository: https://github.com/UKGovernmentBEIS/hibayes, inspected commit `8427f8fff48dea797fbb8cc972efda038ad736b9` (clean local checkout). The unchanged MIT-licensed source excerpts and license are in `vendor/`. Main files inspected were `src/hibayes/model/models.py` and `examples/llm-as-a-judge-usecases/custom_model.py`, together with q1–q5 YAML configurations.

`fit_models.py` is a PyMC adaptation, not a claim to have executed the HiBayES pipeline unchanged. It retains ordered logistic likelihood, N(0,1) main and interaction priors, non-centered hierarchical effects, and positive cutpoint increments `LogNormal(-0.5,0.3)+0.3`. Explicit deviations:

* Four response categories instead of the upstream 11 (0–10); primary auto cutoffs are 1/6, 1/2, 5/6, sensitivity cutoffs are 1/4, 1/2, 3/4. Boundaries enter the higher category. Human ratings retain their actual four categories. These are illustrative scale alignments, not validated calibration.
* First cutpoint prior is N(-1,0.2), rather than N(-4,0.2), recentered for four categories; intercept N(0,1). No claim of prior robustness beyond the reported mapping sensitivity.
* One auto fixed effect; partial pooling of named humans only. One auto cannot identify an autograder-population variance.
* Auto indicator 0/1; generator contrast -0.5/+0.5 (GPT/Llama). Thus the coefficients reported are full contrasts, not twice an effect-coded coefficient.
* Identified contrast interaction rather than redundant independent grader-by-model cell effects.
* Centered non-centered random effects for human, conversation, task, response, and auto-by-task variation; HalfNormal(1) SDs rather than the upstream hierarchical HalfCauchy. These are regularized descriptive extensions for dependent observations, not effects selected by LOO.
* Domain fixed effects and standardized log(1 + whitespace word count). Length is an absolute-score association, not the paper's pairwise-choice model. Word count is not tokenizer length.
* One integrated model per metric (and two mappings), rather than separate sequential Q1–Q5 model selection. No LOO/WAIC-based superiority claim; observation-wise LOO would leak repeated-response information.
* Posterior-predictive ordinal alpha uses the actual response grouping and observed human rater availability. Counterfactual subtracts the fixed auto severity only; it does not remove the interaction or all grader effects. It is conditional, in-sample, and not a deployed correction.

The four metrics are not averaged into a composite; no cross-metric population or joint covariance model is fitted. The unequal completion subsets mean that cross-metric coefficient differences are not controlled comparisons. Appropriate next steps are finish all domains, use shared rubrics, repeat judge calls, add independent judges, then validate using held-out conversations.

## Reproduce

From the Research directory, with the Python versions in `environment.json`:

```sh
python3 Code/progress2-bias/fit_models.py
python3 Code/progress2-bias/make_figures.py
python3 Code/progress2-bias/write_page.py
```

To reproduce the extended completeness fit in a fresh run, move its initial NetCDF aside and run `python3 Code/progress2-bias/fit_models.py --metric completeness --scheme quartile --draws 2000 --tune 1500`.

Models reuse existing NetCDF files; remove only the intended analysis output before refitting. All posterior draws, prior and posterior predictive samples, observation tables, diagnostics, and summary tables are saved in `Data/mtrag/progress2-analysis`. Run settings: 4 chains, 1,000 tuning and 1,000 retained draws per chain, target acceptance 0.95, seed 20261102. Completeness/quarter mapping was refit with 1,500 tuning and 2,000 retained draws per chain after an initial R-hat slightly exceeded 1.01; its per-fit environment JSON and NetCDF attributes record this. The initial posterior is retained separately for audit. Figures and notebook are generated in DS-Book. Rendering requires the site's MyST build and route installation.

The original data cover only one released response per generator per question and one successful auto score per response/metric. Human ratings are annotations, not gold truth. Dataset question IDs may share conversations; dependencies are modeled rather than counted as independent replications. Failed and not-yet-run observations can be selective, and unobserved scores are not imputed. All findings apply only to each metric's observed subset.
