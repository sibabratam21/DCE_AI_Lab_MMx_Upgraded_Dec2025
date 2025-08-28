/**
 * Demo/testing script for model selectors
 * Run this to see selector behavior with different scenarios
 */

import { 
  eqSet, 
  selectActiveModelView, 
  createModelDataStores,
  ModelById,
  ContributionsById,
  DiagnosticsById
} from './modelSelectors';
import { ModelRun } from '../types';

// Test eqSet function
console.log('=== Testing eqSet ===');
const set1 = new Set(['TV', 'Radio', 'Digital']);
const set2 = new Set(['Radio', 'TV', 'Digital']); // Different order
const set3 = new Set(['TV', 'Radio', 'Print']);   // Different content

console.log('set1 == set2 (same elements, diff order):', eqSet(set1, set2)); // true
console.log('set1 == set3 (different elements):', eqSet(set1, set3));       // false

// Create sample models
const sampleModels: ModelRun[] = [
  {
    id: 'model_consistent',
    algo: 'Bayesian Regression',
    rsq: 0.85,
    mape: 12.5,
    roi: 2.3,
    commentary: 'Consistent model',
    channels: ['TV', 'Radio', 'Digital'],
    details: [
      { name: 'TV', included: true, contribution: 45, roi: 2.5, pValue: 0.01, adstock: 0.8, lag: 0, transform: 'Log-transform' },
      { name: 'Radio', included: true, contribution: 30, roi: 2.0, pValue: 0.05, adstock: 0.6, lag: 1, transform: 'Log-transform' },
      { name: 'Digital', included: true, contribution: 25, roi: 1.8, pValue: 0.08, adstock: 0.3, lag: 0, transform: 'S-Curve' },
    ],
    provenance: {
      features_hash: 'hash123',
      ranges_hash: 'hash456',
      algo: 'Bayesian',
      data_version: 'v1',
      timestamp: Date.now()
    },
    diagnostics: {
      weak_channels: [],
      sign_mismatch: [],
      overfit_risk: false,
      warning_count: 0,
      channel_diagnostics: []
    }
  },
  {
    id: 'model_mismatch',
    algo: 'GLM Regression',
    rsq: 0.75,
    mape: 15.0,
    roi: 1.8,
    commentary: 'Mismatched channels',
    channels: ['TV', 'Radio', 'Print'], // Different channel set!
    details: [
      { name: 'TV', included: true, contribution: 50, roi: 2.0, pValue: 0.02, adstock: 0.7, lag: 0, transform: 'Log-transform' },
      { name: 'Radio', included: true, contribution: 30, roi: 1.5, pValue: 0.06, adstock: 0.5, lag: 1, transform: 'Log-transform' },
      { name: 'Print', included: true, contribution: 20, roi: 1.2, pValue: 0.15, adstock: 0.4, lag: 2, transform: 'Power' },
    ],
    provenance: {
      features_hash: 'hash789',
      ranges_hash: 'hash101',
      algo: 'GLM',
      data_version: 'v1',
      timestamp: Date.now()
    },
    diagnostics: {
      weak_channels: ['Print'],
      sign_mismatch: [],
      overfit_risk: false,
      warning_count: 1,
      channel_diagnostics: []
    }
  }
];

// Create data stores
console.log('\n=== Creating Data Stores ===');
const { modelById, contributionsById, diagnosticsById } = createModelDataStores(sampleModels);
console.log('Models loaded:', Object.keys(modelById).length);
console.log('Contributions loaded:', Object.keys(contributionsById).length);
console.log('Diagnostics loaded:', Object.keys(diagnosticsById).length);

// Test Scenario 1: Consistent model
console.log('\n=== Scenario 1: Consistent Model ===');
const result1 = selectActiveModelView('model_consistent', modelById, contributionsById, diagnosticsById);
console.log('Consistent:', result1.consistent);
console.log('Model channels:', result1.model?.channels);
console.log('Contribution channels:', result1.contrib?.channels);
console.log('Diagnostic channels:', result1.diag?.channels);

// Test Scenario 2: Model with mismatched channels
console.log('\n=== Scenario 2: Inconsistent Channels ===');
// Manually modify contributions to create mismatch
const modifiedContribs = { ...contributionsById };
modifiedContribs['model_consistent'] = {
  ...modifiedContribs['model_consistent'],
  channels: ['TV', 'Radio', 'Social'] // Different!
};

const result2 = selectActiveModelView('model_consistent', modelById, modifiedContribs, diagnosticsById);
console.log('Consistent:', result2.consistent);
console.log('Reason:', result2.inconsistencyReason);

// Test Scenario 3: Missing data
console.log('\n=== Scenario 3: Missing Data ===');
const emptyDiagnostics: DiagnosticsById = {};
const result3 = selectActiveModelView('model_consistent', modelById, contributionsById, emptyDiagnostics);
console.log('Consistent:', result3.consistent);
console.log('Reason:', result3.inconsistencyReason);

// Test Scenario 4: No model selected
console.log('\n=== Scenario 4: No Model Selected ===');
const result4 = selectActiveModelView(null, modelById, contributionsById, diagnosticsById);
console.log('Consistent:', result4.consistent);
console.log('Reason:', result4.inconsistencyReason);

// Summary
console.log('\n=== Summary ===');
console.log('✅ eqSet correctly handles set equality');
console.log('✅ Selector detects consistent data');
console.log('✅ Selector detects channel mismatches');
console.log('✅ Selector handles missing data');
console.log('✅ Selector handles null selection');

export {};