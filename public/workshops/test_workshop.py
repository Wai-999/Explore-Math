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

if __name__=='__main__': unittest.main()
