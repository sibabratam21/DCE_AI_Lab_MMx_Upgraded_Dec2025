/**
 * Decision Log Panel Test Script
 *
 * Instructions:
 * 1. Open the MMX app at http://localhost:5173/
 * 2. Log in with password: dce_ai_mmx_2025
 * 3. Open browser console (F12 or Cmd+Option+I)
 * 4. Copy and paste this entire script
 * 5. The Decision Log button should appear in top-right with sample data
 */

// Test helper functions for DecisionLogPanel
window.testDecisionLog = {
  // Seed sample decisions
  seedSampleDecisions: () => {
    const sampleDecisions = [
      {
        id: 'decision_1',
        step: 2, // DataValidation
        type: 'LOCK',
        summary: 'Locked column assignments',
        details: 'User confirmed column types after EDA review. All marketing channels properly classified.',
        status: 'LOCKED',
        timestamp: Date.now() - 7200000 // 2 hours ago
      },
      {
        id: 'decision_2',
        step: 3, // FeatureEngineering
        type: 'RECOMMENDATION',
        summary: 'Recommended adstock ranges for digital channels',
        details: 'Agent suggested 0-7 day adstock for Google Ads and Facebook based on typical immediate response patterns in digital marketing.',
        status: 'ACTIVE',
        timestamp: Date.now() - 5400000 // 90 min ago
      },
      {
        id: 'decision_3',
        step: 3, // FeatureEngineering
        type: 'WARNING',
        summary: 'High correlation detected between channels',
        details: 'Google Ads and Bing Ads show 0.85 correlation coefficient. Consider combining these channels or reviewing attribution methodology.',
        status: 'ACTIVE',
        timestamp: Date.now() - 3600000 // 1 hour ago
      },
      {
        id: 'decision_4',
        step: 4, // Modeling
        type: 'RECOMMENDATION',
        summary: 'Selected Bayesian Regression as primary model',
        details: 'Model shows best balance of R² (0.87) and MAPE (8.2%). All channels show statistically significant contributions.',
        status: 'ACTIVE',
        timestamp: Date.now() - 1800000 // 30 min ago
      },
      {
        id: 'decision_5',
        step: 4, // Modeling
        type: 'OVERRIDE',
        summary: 'User overrode TV channel exclusion',
        details: 'Despite low p-value (0.14), user requested to keep TV channel in model based on domain knowledge of brand building effects.',
        status: 'ACTIVE',
        timestamp: Date.now() - 900000 // 15 min ago
      },
      {
        id: 'decision_6',
        step: 5, // Report
        type: 'LOCK',
        summary: 'Finalized model for production',
        details: 'Model validated and locked for budget optimization. All stakeholder approvals received.',
        status: 'LOCKED',
        timestamp: Date.now() - 300000 // 5 min ago
      },
      {
        id: 'decision_7',
        step: 6, // Optimize
        type: 'RECOMMENDATION',
        summary: 'Recommend 20% budget shift to digital',
        details: 'Optimization suggests reallocating budget from TV to Google Ads and Facebook for +15% projected revenue lift.',
        status: 'ACTIVE',
        timestamp: Date.now() - 60000 // 1 min ago
      }
    ];

    const sampleAnalysisState = {
      grain: 'WEEK',
      runTypes: ['CUSTOMER', 'GEO'],
      channelOwnership: {
        'Google Ads': 'CUSTOMER',
        'Facebook': 'CUSTOMER',
        'Bing Ads': 'CUSTOMER',
        'TV': 'GEO',
        'Radio': 'SHARED'
      },
      spendAvailability: 'FULL',
      assumptions: [
        'Data is weekly aggregated from 2022-2024',
        'All channels have complete spend and activity data',
        'Seasonality accounted for via holiday controls',
        'Geographic effects modeled at DMA level'
      ],
      riskFlags: [
        {
          id: 'risk_1',
          severity: 'MEDIUM',
          message: 'Limited historical data for TV channel (only 18 months)'
        },
        {
          id: 'risk_2',
          severity: 'LOW',
          message: 'Potential multicollinearity between digital channels'
        },
        {
          id: 'risk_3',
          severity: 'HIGH',
          message: 'Major platform change in Facebook attribution model mid-2023 may affect reliability'
        }
      ],
      lockedDecisions: ['decision_1', 'decision_6']
    };

    localStorage.setItem('mmx_decisionLog', JSON.stringify(sampleDecisions));
    localStorage.setItem('mmx_analysisState', JSON.stringify(sampleAnalysisState));

    console.log('✅ Sample decisions seeded! Reload the page to see them in the Decision Log panel.');
    console.log(`📊 Added ${sampleDecisions.length} decisions`);
    console.log(`🔒 ${sampleAnalysisState.lockedDecisions.length} decisions locked`);
    console.log(`⚠️ ${sampleAnalysisState.riskFlags.length} risk flags added`);

    return {
      decisions: sampleDecisions,
      analysisState: sampleAnalysisState
    };
  },

  // Clear all decisions
  clearDecisions: () => {
    localStorage.removeItem('mmx_decisionLog');
    localStorage.removeItem('mmx_analysisState');
    console.log('🗑️ All decisions and analysis state cleared! Reload the page.');
  },

  // View current decisions
  viewDecisions: () => {
    const decisions = localStorage.getItem('mmx_decisionLog');
    const analysisState = localStorage.getItem('mmx_analysisState');

    if (decisions) {
      console.log('📋 Current Decisions:', JSON.parse(decisions));
    } else {
      console.log('ℹ️ No decisions found in localStorage');
    }

    if (analysisState) {
      console.log('📊 Analysis State:', JSON.parse(analysisState));
    } else {
      console.log('ℹ️ No analysis state found in localStorage');
    }
  },

  // Add a single test decision
  addTestDecision: (summary = 'Test Decision', type = 'RECOMMENDATION') => {
    const decisions = JSON.parse(localStorage.getItem('mmx_decisionLog') || '[]');

    const newDecision = {
      id: `decision_test_${Date.now()}`,
      step: 2, // DataValidation
      type: type,
      summary: summary,
      details: 'This is a test decision added via console script.',
      status: 'ACTIVE',
      timestamp: Date.now()
    };

    decisions.push(newDecision);
    localStorage.setItem('mmx_decisionLog', JSON.stringify(decisions));

    console.log('✅ Test decision added! Reload to see it.');
    return newDecision;
  },

  // Get stats
  getStats: () => {
    const decisions = JSON.parse(localStorage.getItem('mmx_decisionLog') || '[]');
    const analysisState = JSON.parse(localStorage.getItem('mmx_analysisState') || '{}');

    const stats = {
      totalDecisions: decisions.length,
      byType: {},
      byStatus: {},
      byStep: {},
      lockedCount: analysisState.lockedDecisions?.length || 0,
      riskCount: analysisState.riskFlags?.length || 0,
      assumptionsCount: analysisState.assumptions?.length || 0
    };

    decisions.forEach(d => {
      stats.byType[d.type] = (stats.byType[d.type] || 0) + 1;
      stats.byStatus[d.status] = (stats.byStatus[d.status] || 0) + 1;
      stats.byStep[d.step] = (stats.byStep[d.step] || 0) + 1;
    });

    console.log('📊 Decision Log Statistics:');
    console.table(stats);
    return stats;
  }
};

console.log('🧪 Decision Log Test Utilities Loaded!');
console.log('');
console.log('Available commands:');
console.log('  testDecisionLog.seedSampleDecisions() - Add 7 sample decisions');
console.log('  testDecisionLog.clearDecisions()      - Clear all decisions');
console.log('  testDecisionLog.viewDecisions()       - View current decisions');
console.log('  testDecisionLog.addTestDecision()     - Add a single test decision');
console.log('  testDecisionLog.getStats()            - Get decision statistics');
console.log('');
console.log('Quick start: Run testDecisionLog.seedSampleDecisions() then reload the page!');
