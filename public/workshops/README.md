# Prediction Studio — runnable learning kit

Extract the entire archive into one directory. Use Python 3.12 and an isolated environment:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m unittest discover -s . -p 'test_workshop.py' -v
python workshop.py
```

Open energy.ipynb, maintenance.ipynb, or demand.ipynb in your notebook editor. Their saved outputs were executed top-to-bottom. public-bike.ipynb transfers the workflow to a licensed historical dataset. No external service, account, or runtime download is needed after the packages and this kit are present. Full observed transitive package versions are in requirements-lock.txt; requirements.txt pins the direct, portable tutorial dependencies. The Python code is MIT licensed; UCI data has its separate CC BY 4.0 attribution.

For command-line execution (with an installed notebook-capable kernel):

```sh
python -m jupyter nbconvert --execute --to notebook --inplace energy.ipynb
```

Start with the prediction contract and training-only data inspection. Attempt each decision before reading worked results. The browser's final-test guard models good workflow but is not secure access control. Repeatedly inspecting a final test to make revisions turns it into development feedback. A new random seed is another sample of one synthetic generator, not external operational validation.

The browser uses hand-written linear/logistic gradients and a one-split tree. The notebooks also use scikit-learn pipelines, calibrated probabilities, forests, boosting, learning curves, SVD/PCA checks, rolling forecasts, and seed sensitivity. Hyperparameters and partitions are explicit. Calibration and threshold selection use separate validation machines; the sample is intentionally small and does not establish safety or stable calibration.

Each notebook finishes with a transfer task and an open capstone. Write a model card and decision record using TEMPLATES.md. Worked explanations are in a separate solutions folder so an instructor can assign a fresh seed before sharing them. Your free-text reasoning needs human feedback; a passed numeric check does not prove mastery.

References: scikit-learn official common-pitfalls, cross-validation, calibration, model-evaluation, pipeline, and decomposition documentation; Hyndman and Athanasopoulos, Forecasting: Principles and Practice, chapter 5. Links and exact data provenance are in DATA.md.
