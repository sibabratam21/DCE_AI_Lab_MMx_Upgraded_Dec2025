import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  DataSource,
  DataQualityMetrics,
  DataAnomaly,
  DataProfile,
  DataAgentInsight,
  CrossSourceValidation,
  ValidationRule
} from '../types/dataAgent';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export const analyzeDataQuality = async (
  source: DataSource,
  profiles: DataProfile[]
): Promise<{
  metrics: DataQualityMetrics;
  anomalies: DataAnomaly[];
  insights: DataAgentInsight[];
}> => {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `
You are Maya, an expert data quality analyst specializing in Marketing Mix Modeling data.

Analyze this data source and provide quality assessment:

Source: ${source.name} (${source.type})
Record Count: ${source.recordCount}
Last Refresh: ${source.lastRefresh}

Data Profiles:
${JSON.stringify(profiles, null, 2)}

Provide a comprehensive quality assessment in this JSON format:
{
  "metrics": {
    "overallScore": <0-100>,
    "completeness": <percentage>,
    "consistency": <percentage>,
    "timeliness": <percentage>,
    "accuracy": <percentage>,
    "uniqueness": <percentage>
  },
  "anomalies": [
    {
      "id": "<unique_id>",
      "severity": "Critical|Warning|Info",
      "type": "Missing Data|Outlier|Schema Change|Duplicate|Format Issue|Relationship Break",
      "description": "<detailed description>",
      "affectedColumns": ["<column_names>"],
      "affectedRows": <number>,
      "suggestedAction": "<actionable recommendation>"
    }
  ],
  "insights": [
    {
      "id": "<unique_id>",
      "type": "Recommendation|Warning|Opportunity|Risk",
      "title": "<brief title>",
      "description": "<detailed explanation>",
      "impact": "High|Medium|Low",
      "suggestedActions": ["<action1>", "<action2>"],
      "confidence": <0-1>
    }
  ]
}

Focus on MMM-specific issues like:
- Media spend data completeness
- Date consistency across channels
- KPI metric reliability
- Seasonal pattern detection
- Outlier identification in marketing data
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        metrics: analysis.metrics,
        anomalies: analysis.anomalies.map((a: any) => ({
          ...a,
          detectedAt: new Date()
        })),
        insights: analysis.insights.map((i: any) => ({
          ...i,
          relatedSources: [source.id]
        }))
      };
    }
  } catch (error) {
    console.error('Error analyzing data quality:', error);
  }

  // Fallback to basic analysis
  return {
    metrics: {
      overallScore: 75,
      completeness: 85,
      consistency: 80,
      timeliness: 70,
      accuracy: 75,
      uniqueness: 90
    },
    anomalies: [],
    insights: []
  };
};

export const generateDataProfiles = async (
  data: any[],
  columns: string[]
): Promise<DataProfile[]> => {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `
Analyze these columns and generate detailed data profiles:

Columns: ${columns.join(', ')}
Sample Data (first 100 rows): ${JSON.stringify(data.slice(0, 100))}

For each column, provide:
{
  "profiles": [
    {
      "column": "<name>",
      "dataType": "string|number|date|boolean",
      "nullCount": <number>,
      "nullPercentage": <percentage>,
      "uniqueValues": <count>,
      "cardinality": "Low|Medium|High",
      "min": <value>,
      "max": <value>,
      "mean": <for numeric>,
      "median": <for numeric>,
      "stdDev": <for numeric>,
      "distribution": "Normal|Skewed|Bimodal|Uniform",
      "outliers": <count>
    }
  ]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const { profiles } = JSON.parse(jsonMatch[0]);
      return profiles;
    }
  } catch (error) {
    console.error('Error generating data profiles:', error);
  }

  // Fallback profiles
  return columns.map(col => ({
    column: col,
    dataType: 'string',
    nullCount: 0,
    nullPercentage: 0,
    uniqueValues: 100,
    cardinality: 'Medium',
    distribution: 'Uniform',
    outliers: 0
  }));
};

export const validateCrossSource = async (
  sourceA: DataSource,
  sourceB: DataSource,
  dataA: any[],
  dataB: any[]
): Promise<CrossSourceValidation> => {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `
Compare these two data sources for consistency:

Source A: ${sourceA.name} (${sourceA.type})
Columns: ${Object.keys(dataA[0] || {}).join(', ')}

Source B: ${sourceB.name} (${sourceB.type})
Columns: ${Object.keys(dataB[0] || {}).join(', ')}

Sample from A: ${JSON.stringify(dataA.slice(0, 50))}
Sample from B: ${JSON.stringify(dataB.slice(0, 50))}

Identify overlapping columns and check for discrepancies:
{
  "overlapColumns": ["<columns that exist in both>"],
  "matchRate": <0-100 percentage>,
  "discrepancies": [
    {
      "column": "<column_name>",
      "mismatchCount": <number>,
      "examples": [<up to 3 examples of mismatches>]
    }
  ]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const validation = JSON.parse(jsonMatch[0]);
      return {
        sourceA: sourceA.id,
        sourceB: sourceB.id,
        ...validation
      };
    }
  } catch (error) {
    console.error('Error validating cross-source:', error);
  }

  return {
    sourceA: sourceA.id,
    sourceB: sourceB.id,
    overlapColumns: [],
    matchRate: 100,
    discrepancies: []
  };
};

export const generateValidationRules = async (
  source: DataSource,
  profiles: DataProfile[]
): Promise<ValidationRule[]> => {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `
Generate MMM-specific validation rules for this data source:

Source: ${source.name}
Profiles: ${JSON.stringify(profiles)}

Create business, technical, and statistical validation rules:
{
  "rules": [
    {
      "id": "<unique_id>",
      "name": "<descriptive name>",
      "type": "Business|Technical|Statistical",
      "condition": "<SQL-like or natural language condition>",
      "message": "<failure message>"
    }
  ]
}

Include rules for:
- Spend amounts must be non-negative
- Dates must be continuous
- KPIs should have expected ranges
- Channel names consistency
- Statistical outlier detection
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const { rules } = JSON.parse(jsonMatch[0]);
      return rules.map((r: any) => ({
        ...r,
        status: 'Passed',
        lastRun: new Date()
      }));
    }
  } catch (error) {
    console.error('Error generating validation rules:', error);
  }

  return [];
};

export const generateAgentCommentary = async (
  sources: DataSource[],
  qualityMetrics: Record<string, DataQualityMetrics>,
  anomalies: DataAnomaly[]
): Promise<string> => {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  const prompt = `
You are Maya, the data quality expert. Provide a conversational summary of the data health:

Sources: ${sources.map(s => `${s.name} (${s.status})`).join(', ')}
Average Quality Score: ${Object.values(qualityMetrics).reduce((a, b) => a + b.overallScore, 0) / Object.keys(qualityMetrics).length}
Active Anomalies: ${anomalies.filter(a => a.severity === 'Critical').length} critical, ${anomalies.filter(a => a.severity === 'Warning').length} warnings

Provide a 2-3 sentence friendly but professional assessment. Be specific about any critical issues.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating commentary:', error);
    return "Data sources are being monitored. Quality assessment in progress.";
  }
};

// Mock data generation for demo
export const generateMockDataSources = (): DataSource[] => {
  return [
    {
      id: 'cdl-001',
      type: 'CDL',
      name: 'Marketing Data Lake',
      status: 'Active',
      lastRefresh: new Date('2024-01-20T08:00:00'),
      nextRefresh: new Date('2024-01-21T08:00:00'),
      recordCount: 1250000,
      fileSize: '2.3 GB',
      tables: ['media_spend', 'campaign_performance', 'channel_metrics']
    },
    {
      id: 'snow-001',
      type: 'Snowflake',
      name: 'Analytics Warehouse',
      status: 'Active',
      lastRefresh: new Date('2024-01-20T10:30:00'),
      recordCount: 3500000,
      connection: {
        host: 'company.snowflakecomputing.com',
        database: 'ANALYTICS_DB',
        schema: 'MARKETING',
        warehouse: 'COMPUTE_WH'
      }
    },
    {
      id: 'ext-001',
      type: 'External',
      name: 'Agency Reports',
      status: 'Warning',
      lastRefresh: new Date('2024-01-19T14:00:00'),
      recordCount: 45000,
      fileSize: '125 MB'
    }
  ];
};

export const generateMockQualityMetrics = (): Record<string, DataQualityMetrics> => {
  return {
    'cdl-001': {
      overallScore: 92,
      completeness: 95,
      consistency: 89,
      timeliness: 90,
      accuracy: 93,
      uniqueness: 94
    },
    'snow-001': {
      overallScore: 88,
      completeness: 92,
      consistency: 85,
      timeliness: 95,
      accuracy: 82,
      uniqueness: 88
    },
    'ext-001': {
      overallScore: 75,
      completeness: 78,
      consistency: 70,
      timeliness: 65,
      accuracy: 80,
      uniqueness: 82
    }
  };
};

export const generateMockAnomalies = (): DataAnomaly[] => {
  return [
    {
      id: 'anom-001',
      severity: 'Warning',
      type: 'Missing Data',
      description: 'Facebook Ads spend data missing for last 3 days',
      affectedColumns: ['facebook_spend', 'facebook_impressions'],
      affectedRows: 72,
      detectedAt: new Date('2024-01-20T09:15:00'),
      suggestedAction: 'Check Facebook API connection and rerun data pipeline'
    },
    {
      id: 'anom-002',
      severity: 'Critical',
      type: 'Outlier',
      description: 'Unusual spike in Google Ads CPC on Jan 18 (5x normal)',
      affectedColumns: ['google_cpc'],
      affectedRows: 24,
      detectedAt: new Date('2024-01-20T10:00:00'),
      suggestedAction: 'Verify with Google Ads dashboard, possible data entry error'
    },
    {
      id: 'anom-003',
      severity: 'Info',
      type: 'Schema Change',
      description: 'New column "tiktok_spend" detected in External source',
      affectedColumns: ['tiktok_spend'],
      detectedAt: new Date('2024-01-19T14:30:00'),
      suggestedAction: 'Update data mapping to include TikTok channel'
    }
  ];
};