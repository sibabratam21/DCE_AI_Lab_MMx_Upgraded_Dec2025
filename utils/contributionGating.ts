/**
 * Contribution gating utilities for displaying only credible positive effects
 */

export interface ChannelDiagnostic {
  channel: string;
  pValue?: number | null;
  coefficient?: number;
  stderr?: number;
  confidence_interval?: [number, number];
  sign?: 'positive' | 'negative' | 'neutral';
  importance?: number;
}

export interface ChannelContribution {
  channel: string;
  value: number;
  percentage: number;
}

export interface ReportabilityResult {
  channel: string;
  contribution: number;
  isReportable: boolean;
  reason: string;
}

export interface GatedContributions {
  reportable: ChannelContribution[];
  hidden: ChannelContribution[];
  hiddenSum: number;
  totalSum: number;
  reconciliationCheck: {
    visibleSum: number;
    hiddenSum: number;
    totalSum: number;
    difference: number;
    isValid: boolean;
  };
}

/**
 * Determine if a channel should be reported based on model type and diagnostics
 */
export const isChannelReportable = (
  contribution: ChannelContribution,
  diagnostic: ChannelDiagnostic | undefined,
  modelAlgo: string
): ReportabilityResult => {
  const { channel, value: contrib } = contribution;
  
  // Base case: negative contributions are not reportable
  if (contrib <= 0) {
    return {
      channel,
      contribution: contrib,
      isReportable: false,
      reason: 'Negative or zero contribution'
    };
  }

  if (!diagnostic) {
    return {
      channel,
      contribution: contrib,
      isReportable: false,
      reason: 'No diagnostic data available'
    };
  }

  const isStatistical = modelAlgo.includes('Regression') || modelAlgo.includes('Bayesian') || modelAlgo.includes('GLM');
  
  if (isStatistical) {
    // Regression/Bayesian reportability: (beta_j > 0) && (p_j < 0.05 OR ci95_j_lower > 0)
    const hasPositiveCoeff = (diagnostic.coefficient || 0) > 0;
    const isSignificant = (diagnostic.pValue !== null && diagnostic.pValue !== undefined) 
      ? diagnostic.pValue < 0.05 
      : false;
    const hasPositiveCI = diagnostic.confidence_interval 
      ? diagnostic.confidence_interval[0] > 0 
      : false;

    if (!hasPositiveCoeff) {
      return {
        channel,
        contribution: contrib,
        isReportable: false,
        reason: 'Non-positive coefficient'
      };
    }

    if (!isSignificant && !hasPositiveCI) {
      return {
        channel,
        contribution: contrib,
        isReportable: false,
        reason: 'Not statistically significant (p>=0.05) and CI crosses zero'
      };
    }

    return {
      channel,
      contribution: contrib,
      isReportable: true,
      reason: isSignificant ? 'Statistically significant' : 'Confidence interval above zero'
    };
  } else {
    // Tree/NN reportability: mean_shap_j > 0 (using SHAP importance as proxy)
    const hasPositiveShap = (diagnostic.importance || 0) > 0;
    
    if (!hasPositiveShap) {
      return {
        channel,
        contribution: contrib,
        isReportable: false,
        reason: 'Non-positive SHAP importance'
      };
    }

    return {
      channel,
      contribution: contrib,
      isReportable: true,
      reason: 'Positive SHAP importance'
    };
  }
};

/**
 * Gate contributions and calculate reconciliation
 */
export const gateContributions = (
  contributions: ChannelContribution[],
  diagnostics: ChannelDiagnostic[],
  modelAlgo: string,
  includeAll: boolean = false
): GatedContributions => {
  const reportabilityResults = contributions.map(contrib => {
    const diagnostic = diagnostics.find(d => d.channel === contrib.channel);
    return isChannelReportable(contrib, diagnostic, modelAlgo);
  });

  const reportable: ChannelContribution[] = [];
  const hidden: ChannelContribution[] = [];

  reportabilityResults.forEach((result, index) => {
    const contrib = contributions[index];
    if (includeAll || result.isReportable) {
      reportable.push(contrib);
    } else {
      hidden.push(contrib);
    }
  });

  // Calculate reconciliation
  const visibleSum = reportable.reduce((sum, c) => sum + c.value, 0);
  const hiddenSum = hidden.reduce((sum, c) => sum + c.value, 0);
  const totalSum = contributions.reduce((sum, c) => sum + c.value, 0);
  const difference = Math.abs((visibleSum + hiddenSum) - totalSum);

  return {
    reportable,
    hidden,
    hiddenSum,
    totalSum,
    reconciliationCheck: {
      visibleSum,
      hiddenSum,
      totalSum,
      difference,
      isValid: difference < 1e-6 // Tolerance check
    }
  };
};

/**
 * Create chart data with unattributed bar if needed
 */
export const createChartData = (
  gatedData: GatedContributions,
  showUnattributed: boolean = true
): Array<{ name: string; contribution: number; isHidden?: boolean; color?: string }> => {
  const chartData = gatedData.reportable.map(contrib => ({
    name: contrib.channel,
    contribution: contrib.percentage,
    color: '#32A29B' // Green for reportable
  }));

  // Add unattributed/hidden bar if there are hidden contributions
  if (showUnattributed && gatedData.hiddenSum !== 0) {
    chartData.push({
      name: 'Unattributed / Hidden',
      contribution: (gatedData.hiddenSum / gatedData.totalSum) * 100, // Convert to percentage
      isHidden: true,
      color: '#9CA3AF' // Gray for hidden
    });
  }

  return chartData;
};