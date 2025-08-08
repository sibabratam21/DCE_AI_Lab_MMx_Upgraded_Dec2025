
export enum AppStep {
  Welcome,
  DataValidation,
  FeatureEngineering,
  Modeling,
  Report,
  Optimize,
}

export enum ColumnType {
  TIME_DIMENSION = 'Time Dimension',
  GEO_DIMENSION = 'Geo Dimension',
  DEPENDENT_VARIABLE = 'Dependent Variable',
  MARKETING_SPEND = 'Marketing Spend',
  MARKETING_ACTIVITY = 'Marketing Activity',
  CONTROL_VARIABLE = 'Control Variable',
  IGNORE = 'Ignore',
}

export interface EdaResult {
  columnName: string;
  suggestedType: ColumnType;
}

export interface UserColumnSelection {
  [columnName: string]: ColumnType;
}

export interface ChannelDiagnostic {
    name: string;
    sparsity: string; // e.g., "5% zeros"
    volatility: string; // e.g., "25.8% CV"
    yoyTrend: string; // e.g., "+15%"
    commentary: string;
    isApproved: boolean;
}

export interface TrendDataPoint {
  date: string;
  kpi: number;
}

export interface CorrelationDataPoint {
  spend: number;
  revenue: number;
}

export interface CorrelationResult {
  channel: string;
  correlation: number;
  data: CorrelationDataPoint[];
}

export interface EdaInsights {
  trendsSummary: string;
  diagnosticsSummary: string;
  trendData: TrendDataPoint[];
  channelDiagnostics: ChannelDiagnostic[];
  correlationSummary?: string;
  interactionsWarning?: string;
  correlationData?: CorrelationResult[];
}

export interface FeatureParams {
  channel: string;
  adstock: number;
  lag: number;
  transform: 'Log-transform' | 'Negative Exponential' | 'S-Curve' | 'Power';
  rationale: string;
}

// Unified model detail, combining parameters and results
export interface ModelDetail {
    name: string;
    included: boolean;
    contribution: number;
    roi: number;
    pValue: number | null;
    adstock: number;
    lag: number;
    transform: 'Log-transform' | 'Negative Exponential' | 'S-Curve' | 'Power';
}

export interface ModelRun {
  id: string;
  algo: 'Bayesian Regression' | 'NN' | 'LightGBM' | 'GLM Regression';
  rsq: number;
  mape: number;
  roi: number; // Blended ROI
  commentary: string;
  details: ModelDetail[];
}

export interface ResultSummary {
  headline: string;
  keyInsights: string[];
  recommendations: string[];
}

export interface ReportChannelResult {
    name: string;
    spend: number;
    attributedKPI: number;
    impactPercentage: number;
    avgROI: number;
    mROI: number;
}

export interface ChatAction {
  text: string;
  onClick: () => void;
  style?: 'primary' | 'secondary';
  disabled?: boolean;
}

export interface AgentMessage {
  id: number;
  sender: 'ai' | 'user';
  text: string | React.ReactNode;
  actions?: ChatAction[];
}

export type ParsedData = Record<string, string | number>;

export interface ColumnSummaryItem {
  role: ColumnType;
  columns: string[];
}

export interface ModelingInteractionResponse {
    text: string;
    newModel?: ModelRun;
    selectModelId?: string;
}

export interface CalibrationInteractionResponse {
    text: string;
    updatedModel: ModelRun;
}

export interface OptimizerScenarioChannel {
    name: string;
    currentSpend: number;
    recommendedSpend: number;
    change: number;
    projectedROI: number;
    agentCommentary: string;
}

export interface OptimizerScenario {
    id: string;
    title: string;
    recommendedSpend: number;
    projectedROI: number;
    netRevenue: number;
    channels: OptimizerScenarioChannel[];
}

export interface OptimizerInteractionResponse {
    text: string;
    newScenario: OptimizerScenario;
}
