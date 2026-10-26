"""Prediction Studio companion kernels. Original synthetic teaching data, MIT license.

No network access. Run from the extracted learning-kit directory with Python 3.12.
The browser and this file share the same LCG, features, partitions, and manual objective.
"""
from copy import deepcopy
from dataclasses import dataclass
import json
from pathlib import Path
import numpy as np
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, HistGradientBoostingRegressor, HistGradientBoostingClassifier
from sklearn.metrics import mean_absolute_error, mean_squared_error, log_loss, brier_score_loss, average_precision_score, roc_auc_score, confusion_matrix
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator


def generator(seed):
    state = seed & 0xFFFFFFFF
    def draw():
        nonlocal state
        state = (1664525 * state + 1013904223) & 0xFFFFFFFF
        return state / 2**32
    return draw


def make_dataset(project, seed=42, shift=False):
    """A row is a day, machine snapshot, or store-week, as documented in DATA.md."""
    draw = generator(seed)
    def noise():
        return sum(draw() for _ in range(4)) - 2
    rows = []
    if project == 'energy':
        for time in range(180):
            temperature, production = 4 * draw() - 2, 4 * draw() - 2
            split = 'train' if time < 100 else 'validation' if time < 140 else 'test'
            outcome = max(1, 90 + 12 * temperature + 18 * production + 5 * noise() + (25 if shift and time >= 140 else 0))
            rows.append(dict(id=f'day-{time}', entity='factory-A', time=time, x=[temperature, production], y=outcome, baseline=0, segment='warmer days' if temperature > 0 else 'cooler days', split=split))
        baseline = np.mean([r['y'] for r in rows[:100]])
        for row in rows:
            row['baseline'] = float(baseline)
    elif project == 'maintenance':
        for machine in range(48):
            group_noise = noise() * .3
            split = 'train' if machine < 28 else 'validation' if machine < 38 else 'test'
            for visit in range(4):
                vibration, heat = 4 * draw() - 2, 4 * draw() - 2
                probability = 1 / (1 + np.exp(-(-2.5 + 1.35 * vibration + .9 * heat + group_noise + (1.3 if shift and machine >= 38 else 0))))
                rows.append(dict(id=f'm{machine}-v{visit}', entity=f'machine-{machine}', time=visit, x=[vibration, heat], y=int(draw() < probability), baseline=0, segment='line A' if machine % 2 else 'line B', split=split))
        baseline = np.mean([r['y'] for r in rows if r['split'] == 'train'])
        for row in rows:
            row['baseline'] = float(baseline)
    elif project == 'demand':
        for store in range(3):
            history = []
            for week in range(96):
                season = np.sin(2 * np.pi * week / 12)
                promotion = int(draw() < .22)
                outcome = max(0, 100 + 25 * store + .65 * week + 18 * season + 15 * promotion + 5 * noise() + (30 if shift and week >= 78 else 0))
                history.append(float(outcome))
                if week < 12:
                    continue
                split = 'train' if week < 60 else 'validation' if week < 78 else 'test'
                rows.append(dict(id=f's{store}-w{week}', entity=f'store-{store}', time=week, x=[history[week - 1], float(season), promotion], y=float(outcome), baseline=history[week - 12], segment=f'store {store + 1}', split=split))
    else:
        raise ValueError('Unknown learning project')
    return rows


def partition(rows, split):
    return [row for row in rows if row['split'] == split]


def arrays(rows, leak=False):
    if not rows:
        raise ValueError('Empty partition')
    x = np.asarray([r['x'] + ([r['y']] if leak else []) for r in rows], dtype=float)
    y = np.asarray([r['y'] for r in rows], dtype=float)
    if not np.isfinite(x).all() or not np.isfinite(y).all():
        raise ValueError('Finite model inputs required')
    return x, y


def manual_fit(rows, classification=False, leak=False, penalty=0, steps=600, rate=.15):
    """Half MSE in standardized target units, or log loss, plus λ||w||²/2."""
    x, y = arrays(rows, leak)
    means, scales = x.mean(axis=0), x.std(axis=0)
    scales[scales == 0] = 1
    design = np.column_stack([np.ones(len(x)), (x - means) / scales])
    target_mean = 0 if classification else y.mean()
    target_scale = 1 if classification else (y.std() or 1)
    target = (y - target_mean) / target_scale
    weights = np.zeros(design.shape[1])
    losses = []
    for _ in range(steps):
        score = design @ weights
        fitted = 1 / (1 + np.exp(-np.clip(score, -700, 700))) if classification else score
        gradient = design.T @ (fitted - target) / len(y)
        gradient[1:] += penalty * weights[1:]
        weights -= rate * gradient
        score = design @ weights
        loss = np.mean(np.logaddexp(0, score) - y * score) if classification else .5 * np.mean((score - target)**2)
        losses.append(float(loss + .5 * penalty * np.sum(weights[1:]**2)))
    return dict(weights=weights, means=means, scales=scales, target_mean=target_mean, target_scale=target_scale, classification=classification, leak=leak, losses=losses)


def manual_predict(model, rows):
    x, _ = arrays(rows, model['leak'])
    design = np.column_stack([np.ones(len(x)), (x - model['means']) / model['scales']])
    score = design @ model['weights']
    if model['classification']:
        return 1 / (1 + np.exp(-np.clip(score, -700, 700)))
    return score * model['target_scale'] + model['target_mean']


def pipeline_for(classification=False, penalty=.1, n_train=100):
    # sklearn uses a sum-scaled penalty; align it to the browser's mean loss.
    estimator = LogisticRegression(C=1 / (max(penalty, 1e-10) * n_train), max_iter=2000, tol=1e-10) if classification else Ridge(alpha=penalty * n_train)
    return make_pipeline(SimpleImputer(strategy='median'), StandardScaler(), estimator)


def output(model, x, classification=False):
    return model.predict_proba(x)[:, 1] if classification else model.predict(x)


def metrics(y, prediction, classification=False, threshold=.3):
    if not classification:
        return dict(mae=float(mean_absolute_error(y, prediction)), rmse=float(np.sqrt(mean_squared_error(y, prediction))), bias=float(np.mean(prediction - y)))
    tn, fp, fn, tp = confusion_matrix(y, prediction >= threshold, labels=[0, 1]).ravel()
    return dict(log_loss=float(log_loss(y, prediction, labels=[0, 1])), brier=float(brier_score_loss(y, prediction)), precision=None if tp + fp == 0 else float(tp / (tp + fp)), recall=None if tp + fn == 0 else float(tp / (tp + fn)), specificity=None if tn + fp == 0 else float(tn / (tn + fp)), average_precision=None if np.sum(y) == 0 else float(average_precision_score(y, prediction)), auc=None if len(np.unique(y)) < 2 else float(roc_auc_score(y, prediction)), cost=int(10 * fn + fp), alerts=int(tp + fp), tp=int(tp), fp=int(fp), fn=int(fn), tn=int(tn))


@dataclass
class FrozenExperiment:
    """A teaching protocol, not secure test-set access control."""
    model: object
    classification: bool
    threshold: float
    tested: bool = False
    def evaluate_once(self, rows):
        if self.tested:
            raise RuntimeError('Test already opened; do not tune this experiment again.')
        self.tested = True
        x, y = arrays(rows)
        return metrics(y, output(self.model, x, self.classification), self.classification, self.threshold)


def freeze(model, classification=False, threshold=.3):
    return FrozenExperiment(deepcopy(model), classification, float(threshold))


def development_comparison(rows, classification=False):
    train, validation = partition(rows, 'train'), partition(rows, 'validation')
    x_train, y_train = arrays(train)
    x_val, y_val = arrays(validation)
    models = {
        'linear_or_logistic': pipeline_for(classification, 0, len(train)),
        'ridge_0.1': pipeline_for(classification, .1, len(train)),
        'one_split_tree': DecisionTreeClassifier(max_depth=1, random_state=42) if classification else DecisionTreeRegressor(max_depth=1, random_state=42),
        'random_forest': RandomForestClassifier(n_estimators=60, max_depth=6, random_state=42, n_jobs=1) if classification else RandomForestRegressor(n_estimators=60, max_depth=6, random_state=42, n_jobs=1),
        'gradient_boosting': HistGradientBoostingClassifier(max_iter=60, max_leaf_nodes=7, random_state=42) if classification else HistGradientBoostingRegressor(max_iter=60, max_leaf_nodes=7, random_state=42),
    }
    results = []
    for name, model in models.items():
        model.fit(x_train, y_train)
        result = metrics(y_val, output(model, x_val, classification), classification)
        results.append(dict(model=name, **result))
    return results


def calibrate_and_select_policy(model, rows, capacity=6):
    """Use separate machines for calibration and threshold selection; no test labels."""
    calibration = [r for r in rows if int(r['entity'].split('-')[1]) < 33]
    policy = [r for r in rows if int(r['entity'].split('-')[1]) >= 33]
    x_cal, y_cal = arrays(calibration)
    x_policy, y_policy = arrays(policy)
    calibrated = CalibratedClassifierCV(FrozenEstimator(model), method='sigmoid', cv=2)
    calibrated.fit(x_cal, y_cal)
    probabilities = calibrated.predict_proba(x_policy)[:, 1]
    candidates = []
    for threshold in np.arange(.05, 1, .05):
        result = metrics(y_policy, probabilities, True, threshold)
        if result['alerts'] <= capacity:
            candidates.append((result['cost'], -threshold, float(threshold), result))
    if not candidates:
        raise ValueError('No threshold meets capacity')
    _, _, threshold, result = min(candidates)
    return calibrated, threshold, result


def rolling_backtests(rows):
    results = []
    for cut in (42, 48, 54):
        train = [r for r in rows if r['time'] < cut]
        later = [r for r in rows if cut <= r['time'] < cut + 6]
        x_train, y_train = arrays(train)
        x_val, y_val = arrays(later)
        model = pipeline_for(False, .1, len(train))
        model.fit(x_train, y_train)
        results.append(dict(cutoff=cut, n_train=len(train), n_validation=len(later), **metrics(y_val, model.predict(x_val))))
    return results


def run_project(project, seed=42):
    rows = make_dataset(project, seed)
    classification = project == 'maintenance'
    train, validation, test = (partition(rows, s) for s in ('train', 'validation', 'test'))
    x_train, y_train = arrays(train)
    x_val, y_val = arrays(validation)
    model = pipeline_for(classification, .1, len(train))
    model.fit(x_train, y_train)
    validation_result = metrics(y_val, output(model, x_val, classification), classification)
    frozen = freeze(model, classification)
    result = frozen.evaluate_once(test)
    return dict(project=project, seed=seed, validation=validation_result, test=result)


if __name__ == '__main__':
    print(json.dumps([run_project(project) for project in ('energy', 'maintenance', 'demand')], indent=2))
