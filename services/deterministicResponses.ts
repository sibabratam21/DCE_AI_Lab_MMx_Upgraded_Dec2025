import { AppStep } from '../types';

/**
 * Deterministic agent responses for Product Mode.
 * NO API CALLS - Pure rule-based responses only.
 *
 * Used when productMode = true to ensure safe, predictable behavior
 * without external dependencies.
 */

export const deterministicResponses = {
  welcome: {
    greeting: "Welcome to the Marketing Mix Modeling platform. I'm your AI assistant, ready to help you analyze your marketing data and optimize your budget allocation.",
    uploadPrompt: "To get started, please upload a CSV file containing your marketing data. The file should include:\n\n• **Time dimension** (date, week, or month)\n• **KPI/outcome variable** (revenue, conversions, etc.)\n• **Marketing channels** (spend or activity data)\n• **Optional**: Control variables (seasonality, external factors)\n\nOnce uploaded, I'll help you configure the columns and run the analysis."
  },

  configure: {
    columnAnalysisComplete: "I've analyzed your dataset and identified potential column types. Please review the assignments on the right and make any necessary adjustments.\n\n**Key columns to verify:**\n• Dependent variable (KPI you want to model)\n• Marketing channels (spend or activity)\n• Time dimension (for temporal analysis)\n• Control variables (optional but recommended)\n\nWhen you're satisfied with the assignments, let me know and we'll proceed to data validation.",

    confirmationRequest: "Please confirm: Are these column assignments correct?\n\n• Type 'yes' to proceed with data validation\n• Type 'no' to make adjustments",

    adjustmentAcknowledged: "No problem. Please adjust the column types on the right. Let me know when you're ready to try again."
  },

  dataValidation: {
    edaComplete: "Data validation complete. I've analyzed your marketing data for quality issues, correlations, and temporal patterns.\n\n**Key findings:**\n• All channels have been evaluated for data quality\n• Correlation analysis identifies potential multicollinearity\n• Temporal patterns show seasonality and trends\n\nReview the channel diagnostics on the right. You can approve or exclude channels based on data quality. When ready, we'll proceed to feature engineering.",

    channelApprovalRequest: "Review the channel diagnostics. You can:\n• Approve high-quality channels for modeling\n• Exclude problematic channels\n• Ask questions about specific channels\n\nWhen ready, say 'proceed to features' to continue.",

    proceedToFeatures: "Great! I'll now recommend feature engineering parameters (adstock, lag, transformation) for each approved channel based on industry best practices."
  },

  featureEngineering: {
    parametersReady: "I've generated feature engineering recommendations for each channel. These parameters control:\n\n• **Adstock**: How long marketing effects persist (carryover)\n• **Lag**: Delayed response time\n• **Transformation**: Functional form (S-curve, log, power, etc.)\n\nYou can adjust these parameters based on your domain expertise. When satisfied, say 'proceed to modeling' to start training.",

    confirmationRequest: "Review the feature parameters on the right. When ready:\n• Say 'proceed to modeling' to start model training\n• Or adjust parameters and let me know when done",

    adjustmentAcknowledged: "Parameters updated. Let me know when you're ready to proceed to modeling."
  },

  modeling: {
    trainingStarted: "Starting model training. I'll generate a leaderboard of different algorithms:\n\n• Bayesian Regression\n• LightGBM\n• Neural Network\n• Generalized Linear Model\n\nThis will take a few moments...",

    trainingComplete: "Model training complete! Review the leaderboard to compare algorithms by R², MAPE, and ROI.\n\n**Next steps:**\n• Select a model to view detailed diagnostics\n• Compare multiple models side-by-side\n• Recalibrate parameters if needed\n• Finalize your chosen model when ready",

    modelSelected: "Model selected. Review the performance metrics, channel contributions, and diagnostics.\n\n**Diagnostics to check:**\n• Weak channels (low statistical significance)\n• Sign mismatches (unexpected negative effects)\n• Model fit quality (R², MAPE)\n\nWhen satisfied, you can finalize this model for reporting and optimization.",

    finalizeRequest: "Are you ready to finalize this model? This will lock it for the final report and optimization. Type 'yes' to confirm or 'no' to continue exploring."
  },

  report: {
    reportReady: "Final report generated! This summarizes:\n\n• Model performance and fit quality\n• Channel attribution and ROI breakdown\n• Response curves showing diminishing returns\n• Key insights and recommendations\n\nReview the report and proceed to optimization when ready to explore budget reallocation scenarios.",

    optimizationPrompt: "Ready to optimize your marketing budget? The optimizer will:\n\n• Generate scenarios at different budget levels\n• Show optimal channel allocation\n• Compare current vs recommended spend\n• Calculate incremental ROI\n\nSay 'go to optimization' to continue."
  },

  optimize: {
    scenariosReady: "Budget optimization scenarios generated! Review the recommended allocations:\n\n• **Baseline**: Current spend distribution\n• **Conservative**: 10% budget increase\n• **Moderate**: 25% budget increase  \n• **Aggressive**: 50% budget increase\n\nEach scenario shows optimal channel mix based on your model's ROI curves. You can also create custom scenarios.",

    customScenarioPrompt: "To create a custom scenario, specify:\n• Total budget amount\n• Any channel constraints (min/max spend)\n• Optimization goal (maximize ROI, maximize revenue, etc.)\n\nI'll calculate the optimal allocation for your parameters."
  },

  general: {
    unknownIntent: "I'm not sure what you're asking. Here are some things I can help with:\n\n• Upload and configure your data\n• Run data validation and EDA\n• Set up feature engineering parameters\n• Train and compare models\n• Generate reports and optimize budgets\n\nWhat would you like to do?",

    error: "I encountered an issue processing your request. Please try rephrasing or use one of the suggested actions.",

    outOfScope: "That request is outside my current capabilities. I'm designed to help with:\n\n• Marketing Mix Modeling workflow\n• Data analysis and validation\n• Model training and evaluation\n• Budget optimization\n\nPlease ask about these topics, or use the interface controls to proceed."
  }
};

/**
 * Get deterministic response based on step and context
 */
export function getDeterministicResponse(
  step: AppStep,
  context: 'greeting' | 'complete' | 'request' | 'acknowledged' | 'error' | 'custom',
  customKey?: string
): string {
  switch (step) {
    case AppStep.Welcome:
      if (context === 'greeting') return deterministicResponses.welcome.greeting;
      if (context === 'request') return deterministicResponses.welcome.uploadPrompt;
      break;

    case AppStep.Configure:
      if (context === 'complete') return deterministicResponses.configure.columnAnalysisComplete;
      if (context === 'request') return deterministicResponses.configure.confirmationRequest;
      if (context === 'acknowledged') return deterministicResponses.configure.adjustmentAcknowledged;
      break;

    case AppStep.DataValidation:
      if (context === 'complete') return deterministicResponses.dataValidation.edaComplete;
      if (context === 'request') return deterministicResponses.dataValidation.channelApprovalRequest;
      if (customKey === 'proceedToFeatures') return deterministicResponses.dataValidation.proceedToFeatures;
      break;

    case AppStep.FeatureEngineering:
      if (context === 'complete') return deterministicResponses.featureEngineering.parametersReady;
      if (context === 'request') return deterministicResponses.featureEngineering.confirmationRequest;
      if (context === 'acknowledged') return deterministicResponses.featureEngineering.adjustmentAcknowledged;
      break;

    case AppStep.Modeling:
      if (customKey === 'trainingStarted') return deterministicResponses.modeling.trainingStarted;
      if (context === 'complete') return deterministicResponses.modeling.trainingComplete;
      if (customKey === 'modelSelected') return deterministicResponses.modeling.modelSelected;
      if (context === 'request') return deterministicResponses.modeling.finalizeRequest;
      break;

    case AppStep.Report:
      if (context === 'complete') return deterministicResponses.report.reportReady;
      if (context === 'request') return deterministicResponses.report.optimizationPrompt;
      break;

    case AppStep.Optimize:
      if (context === 'complete') return deterministicResponses.optimize.scenariosReady;
      if (context === 'request') return deterministicResponses.optimize.customScenarioPrompt;
      break;
  }

  // Fallback
  if (context === 'error') return deterministicResponses.general.error;
  return deterministicResponses.general.unknownIntent;
}

/**
 * Deterministic confirmation intent detection (no LLM)
 */
export function getDeterministicConfirmationIntent(query: string): 'affirmative' | 'negative' | 'unknown' {
  const lowerQuery = query.toLowerCase().trim();

  // Affirmative patterns
  const affirmativePatterns = [
    'yes', 'yep', 'yeah', 'correct', 'right', 'confirm', 'confirmed',
    'proceed', 'continue', 'go ahead', 'looks good', 'perfect',
    'agreed', 'ok', 'okay', 'sure', 'absolutely', 'definitely'
  ];

  // Negative patterns
  const negativePatterns = [
    'no', 'nope', 'incorrect', 'wrong', 'change', 'adjust',
    'modify', 'edit', 'fix', 'update', 'not right', 'not correct'
  ];

  // Check affirmative
  for (const pattern of affirmativePatterns) {
    if (lowerQuery.includes(pattern)) {
      return 'affirmative';
    }
  }

  // Check negative
  for (const pattern of negativePatterns) {
    if (lowerQuery.includes(pattern)) {
      return 'negative';
    }
  }

  return 'unknown';
}

/**
 * Generate deterministic summary for feature confirmation (no LLM)
 */
export function getDeterministicFeatureSummary(channelCount: number): string {
  return `I've configured ${channelCount} channel${channelCount > 1 ? 's' : ''} with recommended adstock, lag, and transformation parameters. Each channel's parameters are based on:\n\n• Channel type and behavior patterns\n• Industry best practices for MMM\n• Data characteristics from your dataset\n\nReview the parameters and adjust if you have specific domain knowledge about delayed effects or carryover.`;
}

/**
 * Generate deterministic column summary (no LLM)
 */
export function getDeterministicColumnSummary(
  dependentVars: number,
  marketingChannels: number,
  timeColumns: number,
  controls: number
): string {
  let summary = `I've analyzed your columns and identified:\n\n`;

  if (dependentVars > 0) {
    summary += `• **${dependentVars} Dependent Variable${dependentVars > 1 ? 's' : ''}** (KPI to model)\n`;
  }

  if (marketingChannels > 0) {
    summary += `• **${marketingChannels} Marketing Channel${marketingChannels > 1 ? 's' : ''}** (spend or activity)\n`;
  }

  if (timeColumns > 0) {
    summary += `• **${timeColumns} Time Dimension${timeColumns > 1 ? 's' : ''}**\n`;
  }

  if (controls > 0) {
    summary += `• **${controls} Control Variable${controls > 1 ? 's' : ''}**\n`;
  }

  summary += `\nPlease verify these assignments match your expectations.`;

  return summary;
}
