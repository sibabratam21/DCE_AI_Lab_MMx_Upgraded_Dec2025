
export enum AppStep {
  Welcome,
  Configure,
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

import { DatasetProvenance } from './utils/datasetHash';

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
  [channelKey: string]: number | string; // Allow channel activity data
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
  provenance?: DatasetProvenance;
}

export interface ParameterRange {
  min: number;
  max: number;
}

export interface FeatureParams {
  channel: string;
  adstock: ParameterRange;
  lag: ParameterRange;
  transform: 'Log-transform' | 'Negative Exponential' | 'S-Curve' | 'Power';
  rationale: string;
}

export interface FeatureEngineering {
  selectedChannels: string[];
  paramRanges: FeatureParams[];
  provenance?: DatasetProvenance;
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

export interface ModelProvenance {
  features_hash: string;
  ranges_hash: string;
  algo: string;
  data_version: string;
  timestamp: number;
  seed?: number;
  // Baseline-aware training fields
  baseline_model_id?: string;
  baseline_diff?: Record<string, string[]>; // channel -> [changed_params]
  exploration_method?: string;
}

export interface ChannelDiagnostic {
  name: string;
  coefficient?: number;
  stderr?: number;
  pValue?: number | null;
  confidence_interval?: [number, number];
  expected_sign: 'positive' | 'negative' | 'neutral';
  actual_sign: 'positive' | 'negative' | 'neutral';
  sign_mismatch: boolean;
  importance?: number; // For tree/NN models (0-1)
  top_driver_rank?: number;
}

export interface ModelDiagnostics {
  weak_channels: string[]; // channels with p>0.10, CI crosses 0, or low importance
  sign_mismatch: string[]; // channels with unexpected signs
  overfit_risk: boolean; // high train R² with poor holdout MAPE
  warning_count: number;
  channel_diagnostics: ChannelDiagnostic[];
}

export interface ModelRun {
  id: string;
  algo: 'Bayesian Regression' | 'NN' | 'LightGBM' | 'GLM Regression';
  rsq: number;
  mape: number;
  roi: number; // Blended ROI
  commentary: string;
  details: ModelDetail[];
  channels: string[];
  provenance: ModelProvenance & DatasetProvenance;
  diagnostics: ModelDiagnostics;
  isNew?: boolean;
  isPinned?: boolean;
  isStale?: boolean;
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

export interface ReportAttribution {
    channels: ReportChannelResult[];
    totalSpend: number;
    totalKPI: number;
    curves?: any;
    provenance?: DatasetProvenance;
}

export interface ChatAction {
  text: string;
  onClick?: () => void;
  style?: 'primary' | 'secondary';
  disabled?: boolean;
}

import { ReactNode } from 'react';

export interface AgentMessage {
  id: number;
  sender: 'ai' | 'user';
  text: string | ReactNode;
  actions?: ChatAction[];
  meta?: {
    kind?: 'suggestion' | 'insight' | 'validate_suggestions';
    suggestion?: boolean;
  };
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
    provenance?: DatasetProvenance;
}

export interface OptimizerInteractionResponse {
    text: string;
    newScenario: OptimizerScenario;
}

export interface RiskFlag {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
}

export interface AnalysisState {
  grain?: 'WEEK' | 'MONTH';
  runTypes: ('CUSTOMER' | 'GEO')[];
  channelOwnership: Record<string, 'CUSTOMER' | 'GEO' | 'SHARED'>;
  spendAvailability: 'NONE' | 'PARTIAL' | 'FULL';
  assumptions: string[];
  riskFlags: RiskFlag[];
  lockedDecisions: string[];
}

export interface DecisionRecord {
  id: string;
  step: AppStep;
  type: 'RECOMMENDATION' | 'WARNING' | 'LOCK' | 'OVERRIDE';
  summary: string;
  details: string;
  status: 'ACTIVE' | 'OVERRIDDEN' | 'LOCKED';
  timestamp: number;
}

export interface CriticWarning {
  id: string;
  rule: string;
  severity: 'WARNING' | 'ERROR';
  title: string;
  explanation: string;
  recommendation: string;
  canOverride: boolean;
  step: AppStep;
  context: Record<string, any>;
}

export interface ModelConsistency {
  overallAgreementScore: number; // 0-100
  conflictingChannels: {
    channel: string;
    customerROI: number;
    geoROI: number;
    difference: number;
    direction: 'CUSTOMER_HIGHER' | 'GEO_HIGHER';
  }[];
  recommendedOwnerModel: 'CUSTOMER' | 'GEO' | 'DUAL';
  reasoning: string;
  channelAgreement: {
    channel: string;
    agreementScore: number; // 0-100
    consistent: boolean;
  }[];
}

export type ModelLens = 'CUSTOMER' | 'GEO';
