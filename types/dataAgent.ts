// Data Agent Types

export interface DataSource {
  id: string;
  type: 'CDL' | 'Snowflake' | 'External';
  name: string;
  status: 'Active' | 'Inactive' | 'Error' | 'Syncing';
  lastRefresh: Date;
  nextRefresh?: Date;
  recordCount: number;
  fileSize?: string;
  tables?: string[];
  connection?: {
    host?: string;
    database?: string;
    schema?: string;
    warehouse?: string;
  };
}

export interface DataQualityMetrics {
  overallScore: number; // 0-100
  completeness: number; // % of non-null values
  consistency: number; // Cross-source alignment %
  timeliness: number; // Freshness score
  accuracy: number; // Statistical validity %
  uniqueness: number; // Duplicate detection %
}

export interface DataAnomaly {
  id: string;
  severity: 'Critical' | 'Warning' | 'Info';
  type: 'Missing Data' | 'Outlier' | 'Schema Change' | 'Duplicate' | 'Format Issue' | 'Relationship Break';
  description: string;
  affectedColumns?: string[];
  affectedRows?: number;
  detectedAt: Date;
  suggestedAction?: string;
}

export interface DataProfile {
  column: string;
  dataType: string;
  nullCount: number;
  nullPercentage: number;
  uniqueValues: number;
  cardinality: 'Low' | 'Medium' | 'High';
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  stdDev?: number;
  distribution?: 'Normal' | 'Skewed' | 'Bimodal' | 'Uniform';
  outliers?: number;
}

export interface DataLineage {
  sourceId: string;
  transformations: {
    step: number;
    operation: string;
    timestamp: Date;
    impactedRows?: number;
  }[];
  dependencies: string[];
  consumers: string[];
}

export interface ValidationRule {
  id: string;
  name: string;
  type: 'Business' | 'Technical' | 'Statistical';
  condition: string;
  status: 'Passed' | 'Failed' | 'Warning';
  lastRun: Date;
  failureCount?: number;
  message?: string;
}

export interface DataAlert {
  id: string;
  sourceId: string;
  type: 'Quality Drop' | 'Refresh Failed' | 'Schema Change' | 'Volume Anomaly';
  severity: 'High' | 'Medium' | 'Low';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface QualityTrend {
  date: Date;
  overallScore: number;
  completeness: number;
  consistency: number;
  timeliness: number;
  accuracy: number;
}

export interface DataAgentInsight {
  id: string;
  type: 'Recommendation' | 'Warning' | 'Opportunity' | 'Risk';
  title: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  suggestedActions: string[];
  relatedSources?: string[];
  confidence: number; // AI confidence score
}

export interface CrossSourceValidation {
  sourceA: string;
  sourceB: string;
  overlapColumns: string[];
  matchRate: number;
  discrepancies: {
    column: string;
    mismatchCount: number;
    examples?: any[];
  }[];
}

export interface DataAgentState {
  sources: DataSource[];
  qualityMetrics: Record<string, DataQualityMetrics>;
  anomalies: DataAnomaly[];
  profiles: Record<string, DataProfile[]>;
  lineage: Record<string, DataLineage>;
  validationRules: ValidationRule[];
  alerts: DataAlert[];
  qualityTrends: Record<string, QualityTrend[]>;
  insights: DataAgentInsight[];
  crossValidations: CrossSourceValidation[];
  lastAnalysis: Date;
  isAnalyzing: boolean;
}

export interface RefreshSchedule {
  sourceId: string;
  frequency: 'Hourly' | 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  customCron?: string;
  enabled: boolean;
}

export interface DataAgentConfig {
  autoRefresh: boolean;
  alertThresholds: {
    qualityScore: number;
    completeness: number;
    anomalyCount: number;
  };
  schedules: RefreshSchedule[];
  notificationChannels: ('Email' | 'Slack' | 'InApp')[];
}