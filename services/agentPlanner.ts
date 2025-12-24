import { AnalysisState, AppStep, UserColumnSelection, ColumnType, FeatureParams, ModelRun } from '../types';

export interface ProposedAction {
  id: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'CONFIGURATION' | 'DATA_QUALITY' | 'MODELING' | 'OPTIMIZATION' | 'WARNING';
  title: string;
  description: string;
  actionable: boolean;
  actionLabel?: string;
  icon: string;
}

export interface PlannerContext {
  analysisState: AnalysisState;
  currentStep: AppStep;
  userSelections?: UserColumnSelection;
  featureParams?: FeatureParams[];
  modelLeaderboard?: ModelRun[];
  activeModelId?: string | null;
}

/**
 * Rule-based agent planner that proposes next actions based on AnalysisState and workflow step.
 * NO LLM CALLS - Pure rule-based logic only.
 */
export function planNext(context: PlannerContext): ProposedAction[] {
  const actions: ProposedAction[] = [];
  const { analysisState, currentStep, userSelections, featureParams, modelLeaderboard, activeModelId } = context;

  // ========================================
  // GLOBAL RULES (apply across all steps)
  // ========================================

  // Rule: Check for high-severity risk flags
  const highRisks = analysisState.riskFlags.filter(r => r.severity === 'HIGH');
  if (highRisks.length > 0) {
    actions.push({
      id: 'global_high_risk',
      priority: 'HIGH',
      category: 'WARNING',
      title: `${highRisks.length} High-Severity Risk${highRisks.length > 1 ? 's' : ''} Detected`,
      description: highRisks.map(r => r.message).join('; '),
      actionable: false,
      icon: '🚨'
    });
  }

  // Rule: Check if ownership is defined when channels exist
  if (userSelections) {
    const channels = Object.keys(userSelections).filter(
      k => userSelections[k] === ColumnType.MARKETING_SPEND || userSelections[k] === ColumnType.MARKETING_ACTIVITY
    );
    const definedOwnership = Object.keys(analysisState.channelOwnership).length;

    if (channels.length > 0 && definedOwnership === 0) {
      actions.push({
        id: 'global_no_ownership',
        priority: 'MEDIUM',
        category: 'CONFIGURATION',
        title: 'Channel Ownership Not Defined',
        description: `${channels.length} marketing channels detected but ownership (CUSTOMER/GEO/SHARED) not assigned. This affects model structure.`,
        actionable: true,
        actionLabel: 'Assign Ownership',
        icon: '👥'
      });
    }
  }

  // Rule: Check if spend availability is unknown
  if (analysisState.spendAvailability === 'NONE') {
    actions.push({
      id: 'global_no_spend',
      priority: 'HIGH',
      category: 'WARNING',
      title: 'ROI Calculations Unavailable',
      description: 'No spend data detected. ROI and ROAS metrics cannot be calculated. Consider adding spend columns or using activity-only modeling.',
      actionable: false,
      icon: '💰'
    });
  }

  // Rule: Dual model setup opportunity
  const hasCustomer = analysisState.runTypes.includes('CUSTOMER');
  const hasGeo = analysisState.runTypes.includes('GEO');
  if (userSelections) {
    const hasGeoColumn = Object.values(userSelections).includes(ColumnType.GEO_DIMENSION);
    if (hasGeoColumn && !hasCustomer && !hasGeo) {
      actions.push({
        id: 'global_dual_model',
        priority: 'MEDIUM',
        category: 'MODELING',
        title: 'Dual Model Setup Recommended',
        description: 'Geographic dimension detected. Consider running both CUSTOMER-level and GEO-level models for comprehensive insights.',
        actionable: true,
        actionLabel: 'Configure Dual Models',
        icon: '🌍'
      });
    }
  }

  // ========================================
  // STEP-SPECIFIC RULES
  // ========================================

  switch (currentStep) {
    case AppStep.Welcome:
      actions.push(...getWelcomeRules(context));
      break;

    case AppStep.Configure:
      actions.push(...getConfigureRules(context));
      break;

    case AppStep.DataValidation:
      actions.push(...getDataValidationRules(context));
      break;

    case AppStep.FeatureEngineering:
      actions.push(...getFeatureEngineeringRules(context));
      break;

    case AppStep.Modeling:
      actions.push(...getModelingRules(context));
      break;

    case AppStep.Report:
      actions.push(...getReportRules(context));
      break;

    case AppStep.Optimize:
      actions.push(...getOptimizeRules(context));
      break;
  }

  // Sort by priority: HIGH > MEDIUM > LOW
  return actions.sort((a, b) => {
    const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// ========================================
// STEP-SPECIFIC RULE FUNCTIONS
// ========================================

function getWelcomeRules(context: PlannerContext): ProposedAction[] {
  const actions: ProposedAction[] = [];

  actions.push({
    id: 'welcome_upload',
    priority: 'HIGH',
    category: 'CONFIGURATION',
    title: 'Upload Your Marketing Data',
    description: 'Start by uploading a CSV file with your marketing KPIs, channel activity/spend, and time dimension.',
    actionable: true,
    actionLabel: 'Choose File',
    icon: '📊'
  });

  return actions;
}

function getConfigureRules(context: PlannerContext): ProposedAction[] {
  const actions: ProposedAction[] = [];
  const { userSelections } = context;

  if (!userSelections || Object.keys(userSelections).length === 0) {
    actions.push({
      id: 'configure_assign_columns',
      priority: 'HIGH',
      category: 'CONFIGURATION',
      title: 'Assign Column Types',
      description: 'Classify each column as KPI, Marketing Channel, Time Dimension, or Control Variable.',
      actionable: false,
      icon: '🏷️'
    });
    return actions;
  }

  // Rule: Check for required columns
  const dependentVars = Object.values(userSelections).filter(v => v === ColumnType.DEPENDENT_VARIABLE);
  const timeColumns = Object.values(userSelections).filter(v => v === ColumnType.TIME_DIMENSION);
  const marketingChannels = Object.values(userSelections).filter(
    v => v === ColumnType.MARKETING_SPEND || v === ColumnType.MARKETING_ACTIVITY
  );

  if (dependentVars.length === 0) {
    actions.push({
      id: 'configure_missing_kpi',
      priority: 'HIGH',
      category: 'CONFIGURATION',
      title: 'Dependent Variable Required',
      description: 'You must select at least one KPI (dependent variable) to model. This is typically revenue, conversions, or another business outcome.',
      actionable: false,
      icon: '🎯'
    });
  }

  if (timeColumns.length === 0) {
    actions.push({
      id: 'configure_missing_time',
      priority: 'HIGH',
      category: 'CONFIGURATION',
      title: 'Time Dimension Required',
      description: 'MMM requires a time dimension (date, week, month) to capture temporal effects of marketing.',
      actionable: false,
      icon: '📅'
    });
  }

  if (marketingChannels.length === 0) {
    actions.push({
      id: 'configure_missing_channels',
      priority: 'HIGH',
      category: 'CONFIGURATION',
      title: 'No Marketing Channels Selected',
      description: 'Add at least one marketing channel (spend or activity) to analyze.',
      actionable: false,
      icon: '📢'
    });
  }

  // Rule: Suggest data grain
  if (!context.analysisState.grain) {
    actions.push({
      id: 'configure_set_grain',
      priority: 'MEDIUM',
      category: 'CONFIGURATION',
      title: 'Set Data Granularity',
      description: 'Specify whether your data is weekly or monthly aggregated. This affects model interpretation.',
      actionable: true,
      actionLabel: 'Set Grain',
      icon: '📏'
    });
  }

  // Rule: Warn about multiple KPIs
  if (dependentVars.length > 1) {
    actions.push({
      id: 'configure_multiple_kpis',
      priority: 'LOW',
      category: 'WARNING',
      title: 'Multiple KPIs Selected',
      description: `${dependentVars.length} dependent variables selected. MMM typically models one KPI at a time. Consider running separate models.`,
      actionable: false,
      icon: '⚠️'
    });
  }

  return actions;
}

function getDataValidationRules(context: PlannerContext): ProposedAction[] {
  const actions: ProposedAction[] = [];

  // Rule: Suggest baseline assumptions
  if (context.analysisState.assumptions.length === 0) {
    actions.push({
      id: 'validation_add_assumptions',
      priority: 'MEDIUM',
      category: 'DATA_QUALITY',
      title: 'Document Key Assumptions',
      description: 'Add assumptions about data quality, seasonality handling, or known limitations for better model interpretation.',
      actionable: true,
      actionLabel: 'Add Assumption',
      icon: '📝'
    });
  }

  // Rule: Check for medium-severity risks
  const mediumRisks = context.analysisState.riskFlags.filter(r => r.severity === 'MEDIUM');
  if (mediumRisks.length > 0) {
    actions.push({
      id: 'validation_medium_risks',
      priority: 'MEDIUM',
      category: 'DATA_QUALITY',
      title: `${mediumRisks.length} Data Quality Warning${mediumRisks.length > 1 ? 's' : ''}`,
      description: mediumRisks.map(r => r.message).join('; '),
      actionable: false,
      icon: '⚠️'
    });
  }

  return actions;
}

function getFeatureEngineeringRules(context: PlannerContext): ProposedAction[] {
  const actions: ProposedAction[] = [];
  const { featureParams } = context;

  if (!featureParams || featureParams.length === 0) {
    actions.push({
      id: 'features_generate_params',
      priority: 'HIGH',
      category: 'MODELING',
      title: 'Generate Feature Parameters',
      description: 'Let the agent recommend adstock, lag, and transformation parameters for each channel.',
      actionable: true,
      actionLabel: 'Generate Recommendations',
      icon: '🔧'
    });
    return actions;
  }

  // Rule: Check for wide adstock ranges (may cause long training)
  const wideAdstockChannels = featureParams.filter(fp => (fp.adstock.max - fp.adstock.min) > 14);
  if (wideAdstockChannels.length > 0) {
    actions.push({
      id: 'features_wide_adstock',
      priority: 'LOW',
      category: 'MODELING',
      title: 'Wide Adstock Ranges Detected',
      description: `${wideAdstockChannels.length} channel(s) have adstock ranges >14 days. This may increase training time. Consider narrowing based on channel type.`,
      actionable: false,
      icon: '⏱️'
    });
  }

  // Rule: Check for all log-transforms (potential issue)
  const allLogTransform = featureParams.every(fp => fp.transform === 'Log-transform');
  if (allLogTransform && featureParams.length > 3) {
    actions.push({
      id: 'features_all_log',
      priority: 'LOW',
      category: 'MODELING',
      title: 'All Channels Using Log Transform',
      description: 'Consider varying transformation types (S-Curve, Power) for different channel behaviors.',
      actionable: false,
      icon: '📈'
    });
  }

  return actions;
}

function getModelingRules(context: PlannerContext): ProposedAction[] {
  const actions: ProposedAction[] = [];
  const { modelLeaderboard, activeModelId } = context;

  if (!modelLeaderboard || modelLeaderboard.length === 0) {
    actions.push({
      id: 'modeling_train_models',
      priority: 'HIGH',
      category: 'MODELING',
      title: 'Train Models',
      description: 'Start model training to generate a leaderboard of algorithms (Bayesian, LightGBM, Neural Network, GLM).',
      actionable: true,
      actionLabel: 'Train Models',
      icon: '🚀'
    });
    return actions;
  }

  // Rule: No model selected
  if (!activeModelId) {
    actions.push({
      id: 'modeling_select_model',
      priority: 'HIGH',
      category: 'MODELING',
      title: 'Select a Model',
      description: 'Choose a model from the leaderboard to view details and calibrate parameters.',
      actionable: false,
      icon: '🎯'
    });
  }

  // Rule: Active model has warnings
  if (activeModelId) {
    const activeModel = modelLeaderboard.find(m => m.id === activeModelId);
    if (activeModel && activeModel.diagnostics.warning_count > 0) {
      actions.push({
        id: 'modeling_address_warnings',
        priority: 'MEDIUM',
        category: 'MODELING',
        title: `Active Model Has ${activeModel.diagnostics.warning_count} Warning${activeModel.diagnostics.warning_count > 1 ? 's' : ''}`,
        description: `Weak channels: ${activeModel.diagnostics.weak_channels.join(', ') || 'none'}. Consider calibrating or selecting a different model.`,
        actionable: true,
        actionLabel: 'View Diagnostics',
        icon: '⚠️'
      });
    }
  }

  // Rule: Low R² across all models
  const allModelsLowR2 = modelLeaderboard.every(m => m.rsq < 0.5);
  if (allModelsLowR2) {
    actions.push({
      id: 'modeling_low_r2',
      priority: 'HIGH',
      category: 'DATA_QUALITY',
      title: 'All Models Show Low R²',
      description: 'All models have R² < 0.5. Consider: (1) Adding more control variables, (2) Checking data quality, (3) Reviewing feature parameters.',
      actionable: false,
      icon: '📉'
    });
  }

  // Rule: Multiple high-performing models (suggest ensemble)
  const highPerformingModels = modelLeaderboard.filter(m => m.rsq > 0.7 && m.mape < 15);
  if (highPerformingModels.length > 1) {
    actions.push({
      id: 'modeling_multiple_good',
      priority: 'LOW',
      category: 'MODELING',
      title: `${highPerformingModels.length} High-Performing Models`,
      description: 'Multiple models show strong performance. Consider finalizing the one with best business interpretability.',
      actionable: false,
      icon: '✨'
    });
  }

  return actions;
}

function getReportRules(context: PlannerContext): ProposedAction[] {
  const actions: ProposedAction[] = [];

  // Rule: Suggest moving to optimization
  actions.push({
    id: 'report_next_optimize',
    priority: 'MEDIUM',
    category: 'OPTIMIZATION',
    title: 'Ready for Budget Optimization',
    description: 'Your model is finalized. Proceed to optimization to get budget reallocation recommendations.',
    actionable: true,
    actionLabel: 'Go to Optimization',
    icon: '💡'
  });

  // Rule: Check if spend data is missing for optimization
  if (context.analysisState.spendAvailability !== 'FULL') {
    actions.push({
      id: 'report_partial_spend',
      priority: 'MEDIUM',
      category: 'WARNING',
      title: 'Limited Optimization Capabilities',
      description: 'Spend data is incomplete. Budget optimization will be limited or unavailable.',
      actionable: false,
      icon: '⚠️'
    });
  }

  return actions;
}

function getOptimizeRules(context: PlannerContext): ProposedAction[] {
  const actions: ProposedAction[] = [];

  // Rule: Export results
  actions.push({
    id: 'optimize_export',
    priority: 'LOW',
    category: 'OPTIMIZATION',
    title: 'Export Recommendations',
    description: 'Download optimization scenarios and model results for stakeholder presentation.',
    actionable: true,
    actionLabel: 'Export to CSV',
    icon: '📥'
  });

  // Rule: Check for extreme reallocation suggestions
  // (This would require scenario data, placeholder for now)
  actions.push({
    id: 'optimize_validate',
    priority: 'MEDIUM',
    category: 'OPTIMIZATION',
    title: 'Validate Recommendations',
    description: 'Review optimization scenarios for business feasibility. Extreme reallocations may need adjustment.',
    actionable: false,
    icon: '🔍'
  });

  return actions;
}
