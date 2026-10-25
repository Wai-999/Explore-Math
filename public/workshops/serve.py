"""Local batch scoring and delayed-label review for Prediction Studio JSON artifacts.

Uses Python's standard library. No fitting, network calls, or executable-model loading.
Clock values are elapsed hours relative to the batch, not calendar timestamps.
"""
import argparse
from copy import deepcopy
import json
import math
from pathlib import Path
import re
import sys

FEATURES = {
    'energy': ['temperature', 'planned_production'],
    'maintenance': ['vibration', 'heat'],
    'demand': ['previous_week', 'calendar_season', 'approved_promotion'],
}
HORIZONS = {'energy': 24, 'maintenance': 48, 'demand': 168}


def finite(value, low=-1e9, high=1e9):
    return (type(value) in (int, float) and math.isfinite(value)
            and low <= value <= high)


def identifier(value):
    return isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_.-]{1,80}', value) is not None


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate_artifact(value):
    require(isinstance(value, dict) and type(value.get('schemaVersion')) is int
            and value['schemaVersion'] == 1
            and isinstance(value.get('project'), str) and value['project'] in FEATURES, 'Unsupported model artifact or project.')
    a = deepcopy(value)
    keys = FEATURES[a['project']]
    require(isinstance(a.get('softwareVersion'), str) and 1 <= len(a['softwareVersion']) <= 80
            and a.get('dataVersion') == 'synthetic-v1'
            and type(a.get('seed')) is int and 0 <= a['seed'] <= 9007199254740991
            and a.get('clock') == 'elapsed hours'
            and finite(a.get('threshold'), 0, 1)
            and finite(a.get('horizonHours')) and a['horizonHours'] == HORIZONS[a['project']]
            and isinstance(a.get('units'), str) and len(a['units']) <= 150
            and isinstance(a.get('features'), list) and len(a['features']) == len(keys),
            'Invalid model metadata or input schema.')
    for feature, key in zip(a['features'], keys):
        require(isinstance(feature, dict) and feature.get('key') == key
                and isinstance(feature.get('label'), str) and len(feature['label']) <= 150
                and finite(feature.get('min')) and finite(feature.get('max'))
                and feature['min'] <= feature['max'], 'Invalid feature schema or training range.')
    p = a.get('predictor')
    require(isinstance(p, dict), 'Missing fitted predictor.')
    if p.get('kind') == 'stump':
        require(type(p.get('feature')) is int and 0 <= p['feature'] < len(keys)
                and all(finite(p.get(k)) for k in ('cut', 'left', 'right'))
                and (a['project'] != 'maintenance' or all(finite(p[k], 0, 1) for k in ('left', 'right'))),
                'Invalid fitted tree.')
    else:
        expected = 'logistic' if a['project'] == 'maintenance' else 'linear'
        require(p.get('kind') == expected, 'Unsupported predictor for this project.')
        def vector(key, length, low=-1e9, high=1e9):
            return isinstance(p.get(key), list) and len(p[key]) == length and all(finite(v, low, high) for v in p[key])
        require(vector('weights', len(keys) + 1, -1e5, 1e5)
                and vector('means', len(keys)) and vector('scales', len(keys), 1e-12)
                and finite(p.get('targetMean')) and finite(p.get('targetScale'), 1e-12)
                and (expected != 'logistic' or (p['targetMean'] == 0 and p['targetScale'] == 1)),
                'Invalid fitted scaling or coefficients.')
    return a


def score_batch(artifact, inputs):
    """Validate the whole batch before returning any predictions; never refit."""
    a = validate_artifact(artifact)
    require(isinstance(inputs, list) and 1 <= len(inputs) <= 250, 'Provide 1–250 batch rows.')
    seen, rows = set(), []
    for row in inputs:
        require(isinstance(row, dict) and identifier(row.get('id')) and row['id'] not in seen
                and finite(row.get('predictionTime')) and isinstance(row.get('features'), dict),
                'Each row needs a unique ID, finite predictionTime, and features.')
        seen.add(row['id'])
        require(set(row['features']) == set(FEATURES[a['project']]),
                f"{row['id']}: use exactly the declared features; do not include the target.")
        x = []
        for feature in a['features']:
            key = feature['key']
            value = row['features'][key]
            require(isinstance(value, dict) and finite(value.get('value')) and finite(value.get('availableAt')),
                    f"{row['id']}: {key} needs a finite value and availableAt.")
            require(value['availableAt'] <= row['predictionTime'], f"{row['id']}: {key} arrives after the prediction cutoff.")
            require(key != 'approved_promotion' or value['value'] in (0, 1), 'approved_promotion must be 0 or 1.')
            require(key != 'previous_week' or value['value'] >= 0, 'previous_week cannot be negative.')
            require(key != 'calendar_season' or -1 <= value['value'] <= 1, 'calendar_season must be between -1 and 1.')
            x.append(value['value'])
        p = a['predictor']
        if p['kind'] == 'stump':
            prediction = p['left'] if x[p['feature']] <= p['cut'] else p['right']
        else:
            score = p['weights'][0] + sum(w * (v - mean) / scale for w, v, mean, scale
                                           in zip(p['weights'][1:], x, p['means'], p['scales']))
            if p['kind'] == 'logistic':
                prediction = 1 / (1 + math.exp(-score)) if score >= 0 else math.exp(score) / (1 + math.exp(score))
            else:
                prediction = score * p['targetScale'] + p['targetMean']
        require(math.isfinite(prediction), 'Prediction overflow; investigate input units and the model.')
        rows.append(dict(id=row['id'], predictionTime=row['predictionTime'], prediction=prediction,
                         alert=prediction >= a['threshold'] if a['project'] == 'maintenance' else None,
                         outsideTrainingRange=[f['key'] for f, v in zip(a['features'], x) if not f['min'] <= v <= f['max']]))
    return dict(artifact=a, rows=rows)


def outcome_metrics(actual, predicted, classification, threshold):
    """Small, inspectable metrics; denominators contain only available labels."""
    n = len(actual)
    if not classification:
        errors = [p - y for y, p in zip(actual, predicted)]
        mean = sum(actual) / n
        total = sum((y - mean)**2 for y in actual)
        squared = sum(e * e for e in errors)
        return dict(mae=sum(abs(e) for e in errors) / n, rmse=math.sqrt(squared / n),
                    bias=sum(errors) / n, r2=1 - squared / total if total else None)
    tp = sum(y == 1 and p >= threshold for y, p in zip(actual, predicted))
    fp = sum(y == 0 and p >= threshold for y, p in zip(actual, predicted))
    fn = sum(y == 1 and p < threshold for y, p in zip(actual, predicted))
    tn = n - tp - fp - fn
    clipped = [max(1e-12, min(1 - 1e-12, p)) for p in predicted]
    return dict(tp=tp, fp=fp, fn=fn, tn=tn, cost=10 * fn + fp, reviewCount=tp + fp,
                precision=tp / (tp + fp) if tp + fp else None,
                recall=tp / (tp + fn) if tp + fn else None,
                specificity=tn / (tn + fp) if tn + fp else None,
                accuracy=(tp + tn) / n, brier=sum((p - y)**2 for y, p in zip(actual, predicted)) / n,
                logLoss=-sum(y * math.log(p) + (1-y) * math.log(1-p) for y, p in zip(actual, clipped)) / n)


def monitor_batch(batch, labels, as_of):
    require(isinstance(batch, dict), 'Missing scored batch.')
    a = validate_artifact(batch.get('artifact'))
    require(finite(as_of) and isinstance(labels, list) and len(labels) <= 250,
            'Provide at most 250 labels and a finite review time.')
    rows = batch.get('rows')
    require(isinstance(rows, list) and 1 <= len(rows) <= 250, 'Missing scored batch.')
    classification = a['project'] == 'maintenance'
    indexed = {}
    for row in rows:
        require(isinstance(row, dict) and identifier(row.get('id')) and row['id'] not in indexed
                and finite(row.get('predictionTime'))
                and finite(row.get('prediction'), 0 if classification else -1e100, 1 if classification else 1e100)
                and isinstance(row.get('outsideTrainingRange'), list)
                and all(k in FEATURES[a['project']] for k in row['outsideTrainingRange']), 'Invalid scored rows.')
        indexed[row['id']] = row
    seen, actual, predicted = set(), [], []
    for label in labels:
        require(isinstance(label, dict) and identifier(label.get('id')) and label['id'] not in seen
                and label['id'] in indexed and finite(label.get('actual'), 0)
                and finite(label.get('availableAt')) and (not classification or label['actual'] in (0, 1)),
                'Labels need unique matching IDs, valid outcomes, and availability times.')
        seen.add(label['id'])
        row = indexed[label['id']]
        require(label['availableAt'] >= row['predictionTime'] + a['horizonHours'],
                'A label cannot mature before its forecast window ends.')
        if row['predictionTime'] <= as_of and label['availableAt'] <= as_of:
            actual.append(label['actual'])
            predicted.append(row['prediction'])
    issued = [r for r in rows if r['predictionTime'] <= as_of]
    return dict(issued=len(issued), labeled=len(actual), pending=len(issued) - len(actual),
                outsideTrainingRange=sum(bool(r['outsideTrainingRange']) for r in issued),
                metrics=outcome_metrics(actual, predicted, classification, a['threshold']) if actual else None)


def artifact_from_manual(project, model, training, seed=42):
    """Export the transparent teaching fit after the caller freezes its protocol.

    This format does not serialize arbitrary sklearn estimators or imputation/calibration.
    """
    require(project in FEATURES and not model['leak'] and bool(model['classification']) == (project == 'maintenance'),
            'Incompatible project/model or future leakage.')
    features = [dict(key=key, label=key, min=float(min(r['x'][i] for r in training)),
                     max=float(max(r['x'][i] for r in training))) for i, key in enumerate(FEATURES[project])]
    return validate_artifact(dict(schemaVersion=1, softwareVersion='0.2.0-rc.2', dataVersion='synthetic-v1', project=project, seed=seed,
        units={'energy': 'kWh/day', 'demand': 'packs / store-week', 'maintenance': 'failure probability within 48 hours'}[project],
        clock='elapsed hours', horizonHours=HORIZONS[project], threshold=.3, features=features,
        predictor=dict(kind='logistic' if project == 'maintenance' else 'linear',
                       weights=[float(v) for v in model['weights']], means=[float(v) for v in model['means']],
                       scales=[float(v) for v in model['scales']], targetMean=float(model['target_mean']),
                       targetScale=float(model['target_scale']))))


def read_json(path):
    data = Path(path).read_bytes()
    require(len(data) <= 2_000_000, 'JSON input exceeds the 2 MB teaching limit.')
    def invalid_constant(value):
        raise ValueError(f'Invalid JSON number: {value}')
    return json.loads(data, parse_constant=invalid_constant)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    score = sub.add_parser('score')
    score.add_argument('artifact'); score.add_argument('inputs'); score.add_argument('output')
    monitor = sub.add_parser('monitor')
    monitor.add_argument('predictions'); monitor.add_argument('labels'); monitor.add_argument('as_of', type=float); monitor.add_argument('output')
    args = parser.parse_args()
    try:
        sources = [args.artifact, args.inputs] if args.command == 'score' else [args.predictions, args.labels]
        require(all(Path(args.output).resolve() != Path(p).resolve() for p in sources), 'Output must not overwrite an input file.')
        if args.command == 'score':
            result = score_batch(read_json(args.artifact), read_json(args.inputs))
        else:
            result = monitor_batch(read_json(args.predictions), read_json(args.labels), args.as_of)
        Path(args.output).write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
        print(f'Wrote {args.output}')
    except (ValueError, OSError, TypeError, KeyError, OverflowError) as error:
        print(f'Input rejected: {error}', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
