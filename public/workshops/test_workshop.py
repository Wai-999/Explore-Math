import unittest
import numpy as np
from workshop import *

class WorkshopChecks(unittest.TestCase):
    def test_reproducible(self):
        for project in ('energy', 'maintenance', 'demand'):
            self.assertEqual(make_dataset(project), make_dataset(project))
            self.assertNotEqual(make_dataset(project), make_dataset(project, 59))

    def test_preprocessing_and_groups(self):
        rows = make_dataset('maintenance')
        groups = [{r['entity'] for r in partition(rows, split)} for split in ('train', 'validation', 'test')]
        self.assertFalse(groups[0] & groups[1] or groups[0] & groups[2] or groups[1] & groups[2])
        train = partition(make_dataset('energy'), 'train')
        model = manual_fit(train)
        np.testing.assert_allclose(model['means'], arrays(train)[0].mean(axis=0))

    def test_manual_matches_ridge_pipeline(self):
        train = partition(make_dataset('energy'), 'train')
        val = partition(make_dataset('energy'), 'validation')
        manual = manual_fit(train, penalty=.1, steps=1000)
        pipeline = pipeline_for(False, .1, len(train))
        pipeline.fit(*arrays(train))
        np.testing.assert_allclose(manual_predict(manual, val), pipeline.predict(arrays(val)[0]), atol=1e-5)

    def test_manual_matches_logistic_pipeline(self):
        train = partition(make_dataset('maintenance'), 'train')
        val = partition(make_dataset('maintenance'), 'validation')
        manual = manual_fit(train, True, penalty=.1, steps=2000)
        pipeline = pipeline_for(True, .1, len(train))
        pipeline.fit(*arrays(train))
        np.testing.assert_allclose(manual_predict(manual, val), pipeline.predict_proba(arrays(val)[0])[:, 1], atol=1e-5)

    def test_metric_hand_calculations(self):
        self.assertEqual(metrics(np.array([100,120]),np.array([90,130]))['mae'], 10)
        result=metrics(np.array([1,1,1,0,0,1,0,0,0,0]),np.array([.8,.8,.8,.8,.8,.1,.1,.1,.1,.1]),True,.5)
        self.assertEqual(result['cost'], 12)
        self.assertEqual(result['recall'], .75)
        self.assertEqual(metrics(np.array([1,0]),np.array([.5,.5]),True)['average_precision'], .5)

    def test_imputation_does_not_learn_from_validation(self):
        model=pipeline_for(False)
        model.fit(np.array([[10.],[np.nan],[30.]]),np.array([1.,2.,3.]))
        self.assertEqual(model[0].statistics_[0],20)
        np.testing.assert_array_equal(model[0].transform(np.array([[1000.],[np.nan]])),[[1000.],[20.]])

    def test_freeze_once(self):
        rows=make_dataset('energy');pipeline=pipeline_for();pipeline.fit(*arrays(partition(rows,'train')))
        frozen=freeze(pipeline);frozen.evaluate_once(partition(rows,'test'))
        with self.assertRaises(RuntimeError): frozen.evaluate_once(partition(rows,'test'))

    def test_calibration_without_test(self):
        rows=make_dataset('maintenance');train=partition(rows,'train');pipeline=pipeline_for(True,.1,len(train));pipeline.fit(*arrays(train))
        calibrated,threshold,result=calibrate_and_select_policy(pipeline,partition(rows,'validation'))
        self.assertLessEqual(result['alerts'],6);self.assertGreater(threshold,0)
        self.assertTrue(np.isfinite(calibrated.predict_proba(arrays(partition(rows,'test'))[0])).all())

    def test_regime_change_is_out_of_development(self):
        for project in ('energy','maintenance','demand'):
            a,b=make_dataset(project),make_dataset(project,shift=True)
            self.assertEqual(partition(a,'train'),partition(b,'train'))
            self.assertEqual(partition(a,'validation'),partition(b,'validation'))

    def test_backtest_no_future(self):
        results=rolling_backtests(make_dataset('demand'))
        self.assertEqual([r['cutoff'] for r in results],[42,48,54])
        self.assertTrue(all(r['n_validation']==18 for r in results))

class HandoffChecks(unittest.TestCase):
    def example(self, project='energy'):
        from serve import artifact_from_manual
        training=partition(make_dataset(project),'train')
        artifact=artifact_from_manual(project,manual_fit(training,project=='maintenance'),training)
        inputs=[dict(id=f'batch-{i}',predictionTime=0,features={f['key']:dict(value=(i if f['key']=='approved_promotion' else f['min']+.5*(f['max']-f['min'])),availableAt=0) for f in artifact['features']}) for i in range(2)]
        return artifact,inputs

    def test_exported_predictions_match_transparent_model(self):
        from serve import score_batch, artifact_from_manual
        for project in ('energy','maintenance','demand'):
            training=partition(make_dataset(project),'train');validation=partition(make_dataset(project),'validation')[:2]
            model=manual_fit(training,project=='maintenance')
            artifact=artifact_from_manual(project,model,training)
            inputs=[dict(id=r['id'],predictionTime=0,features={f['key']:dict(value=r['x'][i],availableAt=0) for i,f in enumerate(artifact['features'])}) for r in validation]
            np.testing.assert_allclose([r['prediction'] for r in score_batch(artifact,inputs)['rows']],manual_predict(model,validation),atol=1e-10)

    def test_delayed_labels_have_honest_denominators(self):
        from serve import score_batch, monitor_batch
        a,x=self.example();batch=score_batch(a,x)
        labels=[dict(id=r['id'],actual=r['prediction']+(4 if i==0 else -8),availableAt=48+i*12) for i,r in enumerate(batch['rows'])]
        self.assertIsNone(monitor_batch(batch,labels,0)['metrics'])
        self.assertEqual(monitor_batch(batch,labels,48)['labeled'],1)
        report=monitor_batch(batch,labels,60)
        self.assertEqual((report['labeled'],report['pending']),(2,0))
        self.assertEqual((report['metrics']['mae'],report['metrics']['bias']),(6,2))

    def test_schema_and_availability_rejections(self):
        from serve import score_batch
        from copy import deepcopy
        a,x=self.example()
        bad=deepcopy(x);bad[0]['features']['temperature']['availableAt']=1
        missing=deepcopy(x);del missing[0]['features']['temperature']
        target=deepcopy(x);target[0]['features']['target']=dict(value=100,availableAt=0)
        string=deepcopy(x);string[0]['features']['temperature']['value']='1'
        for data in ([],bad,missing,target,string,[x[0],x[0]]):
            with self.assertRaises(ValueError): score_batch(a,data)

    def test_range_warning_cannot_establish_outcome_error(self):
        from serve import score_batch, monitor_batch
        a,x=self.example();x[0]['features']['temperature']['value']=a['features'][0]['max']+10
        report=monitor_batch(score_batch(a,x),[],0)
        self.assertEqual(report['outsideTrainingRange'],1)
        self.assertIsNone(report['metrics'])

    def test_invalid_labels_and_artifacts(self):
        from serve import score_batch, monitor_batch, validate_artifact
        a,x=self.example('maintenance');batch=score_batch(a,x)
        label=dict(id='batch-0',actual=1,availableAt=72)
        for labels in ([dict(label,availableAt=47)],[label,label],[dict(label,id='missing')],[dict(label,actual=2)],[dict(label,actual=float('nan'))]):
            with self.assertRaises(ValueError): monitor_batch(batch,labels,100)
        for artifact in (None,dict(a,schemaVersion=True),dict(a,schemaVersion=2),dict(a,predictor=dict(kind='logistic',weights=[]))):
            with self.assertRaises(ValueError): validate_artifact(artifact)

    def test_binary_tree_and_extreme_logits(self):
        from serve import score_batch
        a,x=self.example('maintenance')
        a['predictor']=dict(kind='stump',feature=0,cut=0,left=.2,right=.8)
        self.assertIn(score_batch(a,x)['rows'][0]['prediction'],(.2,.8))
        a['predictor']=dict(kind='logistic',weights=[-1000,0,0],means=[0,0],scales=[1,1],targetMean=0,targetScale=1)
        self.assertEqual(score_batch(a,x)['rows'][0]['prediction'],0)

    def test_domain_constraints(self):
        from serve import score_batch
        a,x=self.example('demand')
        from copy import deepcopy
        for key,value in [('previous_week',-1),('calendar_season',2),('approved_promotion',2)]:
            bad=deepcopy(x);bad[0]['features'][key]['value']=value
            with self.assertRaises(ValueError): score_batch(a,bad)

    def test_cli_roundtrip_and_no_partial_invalid_output(self):
        from serve import read_json
        from pathlib import Path
        import json, subprocess, sys, tempfile
        a,x=self.example()
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);model=root/'model.json';inputs=root/'inputs.json';out=root/'predictions.json'
            model.write_text(json.dumps(a));inputs.write_text(json.dumps(x))
            command=[sys.executable,str(Path(__file__).with_name('serve.py')),'score',str(model),str(inputs),str(out)]
            self.assertEqual(subprocess.run(command,capture_output=True).returncode,0)
            self.assertEqual(len(read_json(out)['rows']),2)
            inputs.write_text('[]');out.unlink()
            self.assertEqual(subprocess.run(command,capture_output=True).returncode,2)
            self.assertFalse(out.exists())
            inputs.write_text('[NaN]')
            with self.assertRaises(ValueError): read_json(inputs)

if __name__=='__main__': unittest.main()
