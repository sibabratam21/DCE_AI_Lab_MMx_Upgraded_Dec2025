import {
  AnalysisState,
  AppStep,
  UserColumnSelection,
  ColumnType,
  FeatureParams,
  CriticWarning,
  ParsedData
} from '../types';

export interface CriticContext {
  analysisState: AnalysisState;
  currentStep: AppStep;
  userSelections?: UserColumnSelection;
  featureParams?: FeatureParams[];
  parsedData?: ParsedData;
}

/**
 * Rule-based agent critic that raises warnings when user choices conflict with MMM best practices.
 * NO LLM CALLS - Pure rule-based logic only.
 *
 * Warnings must be acknowledged or overridden with reason.
 * All warnings and overrides are logged to DecisionLog.
 */
export function criticizeDecision(context: CriticContext): CriticWarning[] {
  const warnings: CriticWarning[] = [];

  // Rule 1: TV assigned to customer level
  warnings.push(...checkTvAtCustomerLevel(context));

  // Rule 2: Monthly data + weekly lag
  warnings.push(...checkMonthlyDataWeeklyLag(context));

  // Rule 3: Sparse activity + high adstock
  warnings.push(...checkSparseActivityHighAdstock(context));

  // Rule 4: Spend missing + ROI request
  warnings.push(...checkSpendMissingRoiRequest(context));

  return warnings;
}

// ========================================
// RULE 1: TV Assigned to Customer Level
// ========================================
function checkTvAtCustomerLevel(context: CriticContext): CriticWarning[] {
  const { analysisState, userSelections, currentStep } = context;
  const warnings: CriticWarning[] = [];

  if (!userSelections) return warnings;

  // Check if we're at a step where channel ownership is relevant
  if (currentStep !== AppStep.Configure && currentStep !== AppStep.DataValidation) {
    return warnings;
  }

  // Find TV channels (case-insensitive) assigned to CUSTOMER ownership
  const tvChannelsAtCustomer = Object.entries(analysisState.channelOwnership)
    .filter(([channelName, ownership]) => {
      const isTV = channelName.toLowerCase().includes('tv') ||
                   channelName.toLowerCase().includes('television') ||
                   channelName.toLowerCase().includes('ctv') ||
                   channelName.toLowerCase().includes('connected tv');
      const isCustomer = ownership === 'CUSTOMER';
      return isTV && isCustomer;
    });

  if (tvChannelsAtCustomer.length > 0) {
    warnings.push({
      id: `critic_tv_customer_${Date.now()}`,
      rule: 'TV_AT_CUSTOMER_LEVEL',
      severity: 'WARNING',
      title: 'TV Channel Assigned to Customer Level',
      explanation: `TV/CTV channels (${tvChannelsAtCustomer.map(([name]) => name).join(', ')}) are assigned to CUSTOMER-level modeling. TV advertising typically has broad reach and brand-building effects that operate at a geographic or market level, not individual customer level. Customer-level models may fail to capture TV's true impact, leading to underestimation of ROI.`,
      recommendation: 'Consider reassigning TV/CTV channels to GEO-level ownership, or run a dual model setup (both CUSTOMER and GEO) to properly capture TV effects at the market level.',
      canOverride: true,
      step: currentStep,
      context: {
        tvChannels: tvChannelsAtCustomer.map(([name]) => name),
        ownership: 'CUSTOMER'
      }
    });
  }

  return warnings;
}

// ========================================
// RULE 2: Monthly Data + Weekly Lag
// ========================================
function checkMonthlyDataWeeklyLag(context: CriticContext): CriticWarning[] {
  const { analysisState, featureParams, currentStep } = context;
  const warnings: CriticWarning[] = [];

  // Only check at feature engineering step
  if (currentStep !== AppStep.FeatureEngineering) {
    return warnings;
  }

  if (!featureParams || featureParams.length === 0) {
    return warnings;
  }

  // Check if data grain is monthly
  if (analysisState.grain !== 'MONTH') {
    return warnings;
  }

  // Find channels with lag parameters that seem weekly (> 4 weeks = monthly+)
  const channelsWithWeeklyLag = featureParams.filter(fp => {
    const maxLagWeeks = fp.lag.max;
    // If max lag is between 1-4 weeks, it's likely weekly thinking
    return maxLagWeeks > 0 && maxLagWeeks <= 4;
  });

  if (channelsWithWeeklyLag.length > 0) {
    warnings.push({
      id: `critic_monthly_weekly_lag_${Date.now()}`,
      rule: 'MONTHLY_DATA_WEEKLY_LAG',
      severity: 'WARNING',
      title: 'Monthly Data with Weekly Lag Parameters',
      explanation: `Your data is aggregated MONTHLY, but ${channelsWithWeeklyLag.length} channel(s) have lag parameters that appear to be in weeks (${channelsWithWeeklyLag.map(fp => `${fp.channel}: ${fp.lag.max}w`).join(', ')}). With monthly data, lag parameters should be specified in months (e.g., 1-3 months), not weeks. Weekly lags don't make sense for monthly data and will cause model misspecification.`,
      recommendation: 'Adjust lag parameters to monthly units. For example, if you expect a 2-week lag, use lag=1 month. For 6-week lag, use lag=2 months.',
      canOverride: true,
      step: currentStep,
      context: {
        grain: 'MONTH',
        channelsWithWeeklyLag: channelsWithWeeklyLag.map(fp => fp.channel),
        lagValues: channelsWithWeeklyLag.map(fp => ({ channel: fp.channel, lag: fp.lag }))
      }
    });
  }

  return warnings;
}

// ========================================
// RULE 3: Sparse Activity + High Adstock
// ========================================
function checkSparseActivityHighAdstock(context: CriticContext): CriticWarning[] {
  const { featureParams, parsedData, currentStep } = context;
  const warnings: CriticWarning[] = [];

  // Only check at feature engineering step
  if (currentStep !== AppStep.FeatureEngineering) {
    return warnings;
  }

  if (!featureParams || featureParams.length === 0 || !parsedData) {
    return warnings;
  }

  // Analyze each channel for sparsity
  const sparseChannelsWithHighAdstock = featureParams.filter(fp => {
    const channelData = parsedData.columns.find(col => col.name === fp.channel);
    if (!channelData) return false;

    // Calculate sparsity (% of zero values)
    const totalRows = channelData.values.length;
    const zeroCount = channelData.values.filter(val => val === 0 || val === null || val === undefined).length;
    const sparsityPercent = (zeroCount / totalRows) * 100;

    // High adstock means max > 8 weeks (or > 2 months)
    const hasHighAdstock = fp.adstock.max > 8;

    // Sparse = more than 60% zeros
    const isSparse = sparsityPercent > 60;

    return isSparse && hasHighAdstock;
  });

  if (sparseChannelsWithHighAdstock.length > 0) {
    warnings.push({
      id: `critic_sparse_high_adstock_${Date.now()}`,
      rule: 'SPARSE_ACTIVITY_HIGH_ADSTOCK',
      severity: 'WARNING',
      title: 'Sparse Channel Activity with High Adstock',
      explanation: `${sparseChannelsWithHighAdstock.length} channel(s) (${sparseChannelsWithHighAdstock.map(fp => fp.channel).join(', ')}) have sparse activity (>60% zero values) but high adstock decay parameters (>${sparseChannelsWithHighAdstock[0].adstock.max} periods). High adstock creates carryover effects across many time periods, but with sparse data, there's insufficient information to reliably estimate these long decay patterns. This can lead to unstable coefficients and inflated ROI estimates.`,
      recommendation: 'For sparse channels, reduce adstock to 2-4 periods max, or consider excluding the channel if activity is too infrequent for reliable modeling.',
      canOverride: true,
      step: currentStep,
      context: {
        sparseChannels: sparseChannelsWithHighAdstock.map(fp => ({
          channel: fp.channel,
          adstockMax: fp.adstock.max
        }))
      }
    });
  }

  return warnings;
}

// ========================================
// RULE 4: Spend Missing + ROI Request
// ========================================
function checkSpendMissingRoiRequest(context: CriticContext): CriticWarning[] {
  const { analysisState, currentStep } = context;
  const warnings: CriticWarning[] = [];

  // Check at modeling or report step
  if (currentStep !== AppStep.Modeling && currentStep !== AppStep.Report) {
    return warnings;
  }

  // If spend is completely missing or only partial
  if (analysisState.spendAvailability === 'NONE' || analysisState.spendAvailability === 'PARTIAL') {
    warnings.push({
      id: `critic_spend_missing_roi_${Date.now()}`,
      rule: 'SPEND_MISSING_ROI_REQUEST',
      severity: 'ERROR',
      title: 'Cannot Calculate ROI Without Spend Data',
      explanation: `Your dataset has ${analysisState.spendAvailability === 'NONE' ? 'NO' : 'INCOMPLETE'} spend data. ROI and ROAS metrics require both revenue impact (from the model) AND spend data to calculate return on investment. Without complete spend data, you can only measure marketing effectiveness via coefficients and elasticity, not financial ROI.`,
      recommendation: analysisState.spendAvailability === 'NONE'
        ? 'Add spend columns to your dataset, or switch to an activity-based model that focuses on effectiveness rather than ROI.'
        : 'Complete missing spend data for all marketing channels, or exclude channels without spend from ROI calculations.',
      canOverride: analysisState.spendAvailability === 'PARTIAL', // Can override if partial, not if NONE
      step: currentStep,
      context: {
        spendAvailability: analysisState.spendAvailability
      }
    });
  }

  return warnings;
}

/**
 * Helper function to get human-readable rule name
 */
export function getRuleName(rule: string): string {
  const ruleNames: Record<string, string> = {
    TV_AT_CUSTOMER_LEVEL: 'TV at Customer Level',
    MONTHLY_DATA_WEEKLY_LAG: 'Monthly Data with Weekly Lag',
    SPARSE_ACTIVITY_HIGH_ADSTOCK: 'Sparse Activity with High Adstock',
    SPEND_MISSING_ROI_REQUEST: 'Missing Spend Data for ROI'
  };
  return ruleNames[rule] || rule;
}
