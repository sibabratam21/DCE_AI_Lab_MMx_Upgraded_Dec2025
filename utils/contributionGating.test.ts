/**
 * Unit tests for contribution gating logic
 */

import { 
  isChannelReportable, 
  gateContributions, 
  createChartData,
  ChannelDiagnostic,
  ChannelContribution 
} from './contributionGating';

describe('isChannelReportable', () => {
  const mockContribution: ChannelContribution = { channel: 'TV', value: 45, percentage: 45 };

  describe('Regression/Bayesian models', () => {
    it('should report positive coeff with p < 0.05', () => {
      const diagnostic: ChannelDiagnostic = {
        channel: 'TV',
        coefficient: 0.5,
        pValue: 0.01,
        confidence_interval: [-0.1, 1.1]
      };

      const result = isChannelReportable(mockContribution, diagnostic, 'Bayesian Regression');
      
      expect(result.isReportable).toBe(true);
      expect(result.reason).toBe('Statistically significant');
    });

    it('should report positive coeff with CI above zero', () => {
      const diagnostic: ChannelDiagnostic = {
        channel: 'TV',
        coefficient: 0.5,
        pValue: 0.08, // Not significant
        confidence_interval: [0.1, 1.1] // But CI above zero
      };

      const result = isChannelReportable(mockContribution, diagnostic, 'Bayesian Regression');
      
      expect(result.isReportable).toBe(true);
      expect(result.reason).toBe('Confidence interval above zero');
    });

    it('should NOT report negative coefficient', () => {
      const diagnostic: ChannelDiagnostic = {
        channel: 'TV',
        coefficient: -0.5,
        pValue: 0.01
      };

      const result = isChannelReportable(mockContribution, diagnostic, 'GLM Regression');
      
      expect(result.isReportable).toBe(false);
      expect(result.reason).toBe('Non-positive coefficient');
    });

    it('should NOT report if p >= 0.05 AND CI crosses zero', () => {
      const diagnostic: ChannelDiagnostic = {
        channel: 'TV',
        coefficient: 0.5,
        pValue: 0.15,
        confidence_interval: [-0.2, 1.2] // Crosses zero
      };

      const result = isChannelReportable(mockContribution, diagnostic, 'Bayesian Regression');
      
      expect(result.isReportable).toBe(false);
      expect(result.reason).toBe('Not statistically significant (p>=0.05) and CI crosses zero');
    });
  });

  describe('Tree/NN models', () => {
    it('should report positive SHAP importance', () => {
      const diagnostic: ChannelDiagnostic = {
        channel: 'TV',
        importance: 0.3
      };

      const result = isChannelReportable(mockContribution, diagnostic, 'LightGBM');
      
      expect(result.isReportable).toBe(true);
      expect(result.reason).toBe('Positive SHAP importance');
    });

    it('should NOT report non-positive SHAP importance', () => {
      const diagnostic: ChannelDiagnostic = {
        channel: 'TV',
        importance: 0
      };

      const result = isChannelReportable(mockContribution, diagnostic, 'NN');
      
      expect(result.isReportable).toBe(false);
      expect(result.reason).toBe('Non-positive SHAP importance');
    });
  });

  describe('Edge cases', () => {
    it('should NOT report negative contributions', () => {
      const negativeContrib = { channel: 'TV', value: -10, percentage: -10 };
      const diagnostic: ChannelDiagnostic = {
        channel: 'TV',
        coefficient: 0.5,
        pValue: 0.01
      };

      const result = isChannelReportable(negativeContrib, diagnostic, 'Bayesian Regression');
      
      expect(result.isReportable).toBe(false);
      expect(result.reason).toBe('Negative or zero contribution');
    });

    it('should handle missing diagnostics', () => {
      const result = isChannelReportable(mockContribution, undefined, 'Bayesian Regression');
      
      expect(result.isReportable).toBe(false);
      expect(result.reason).toBe('No diagnostic data available');
    });
  });
});

describe('gateContributions', () => {
  const mockContributions: ChannelContribution[] = [
    { channel: 'TV', value: 45, percentage: 45 },
    { channel: 'Radio', value: 30, percentage: 30 },
    { channel: 'Digital', value: -5, percentage: -5 }, // Negative
    { channel: 'Search', value: 20, percentage: 20 }
  ];

  const mockDiagnostics: ChannelDiagnostic[] = [
    { channel: 'TV', coefficient: 0.5, pValue: 0.01 }, // Reportable
    { channel: 'Radio', coefficient: 0.3, pValue: 0.15, confidence_interval: [-0.1, 0.7] }, // Not reportable
    { channel: 'Digital', coefficient: -0.2, pValue: 0.05 }, // Negative coeff
    { channel: 'Search', coefficient: 0.4, pValue: 0.03 } // Reportable
  ];

  it('should correctly gate contributions for regression model', () => {
    const result = gateContributions(mockContributions, mockDiagnostics, 'Bayesian Regression', false);

    expect(result.reportable).toHaveLength(2); // TV and Search
    expect(result.hidden).toHaveLength(2); // Radio and Digital
    expect(result.hiddenSum).toBe(25); // Radio(30) + Digital(-5)
    expect(result.totalSum).toBe(90); // All contributions sum
    expect(result.reconciliationCheck.isValid).toBe(true);
  });

  it('should include all contributions when includeAll=true', () => {
    const result = gateContributions(mockContributions, mockDiagnostics, 'Bayesian Regression', true);

    expect(result.reportable).toHaveLength(4); // All channels
    expect(result.hidden).toHaveLength(0);
    expect(result.hiddenSum).toBe(0);
  });

  it('should maintain reconciliation accuracy', () => {
    const result = gateContributions(mockContributions, mockDiagnostics, 'Bayesian Regression', false);
    const { reconciliationCheck } = result;

    expect(reconciliationCheck.visibleSum + reconciliationCheck.hiddenSum)
      .toBeCloseTo(reconciliationCheck.totalSum, 6);
    expect(reconciliationCheck.difference).toBeLessThan(1e-6);
    expect(reconciliationCheck.isValid).toBe(true);
  });
});

describe('createChartData', () => {
  it('should create chart data with unattributed bar', () => {
    const gatedData = {
      reportable: [
        { channel: 'TV', value: 45, percentage: 50 },
        { channel: 'Search', value: 36, percentage: 40 }
      ],
      hidden: [
        { channel: 'Radio', value: 9, percentage: 10 }
      ],
      hiddenSum: 9,
      totalSum: 90,
      reconciliationCheck: {
        visibleSum: 81,
        hiddenSum: 9,
        totalSum: 90,
        difference: 0,
        isValid: true
      }
    };

    const chartData = createChartData(gatedData, true);

    expect(chartData).toHaveLength(3); // 2 reportable + 1 unattributed
    expect(chartData[0]).toEqual({
      name: 'TV',
      contribution: 50,
      color: '#32A29B'
    });
    expect(chartData[2]).toEqual({
      name: 'Unattributed / Hidden',
      contribution: 10, // (9/90) * 100
      isHidden: true,
      color: '#9CA3AF'
    });
  });

  it('should omit unattributed bar when hiddenSum is zero', () => {
    const gatedData = {
      reportable: [
        { channel: 'TV', value: 45, percentage: 50 }
      ],
      hidden: [],
      hiddenSum: 0,
      totalSum: 45,
      reconciliationCheck: {
        visibleSum: 45,
        hiddenSum: 0,
        totalSum: 45,
        difference: 0,
        isValid: true
      }
    };

    const chartData = createChartData(gatedData, true);

    expect(chartData).toHaveLength(1); // Only reportable channels
    expect(chartData[0].name).toBe('TV');
  });
});