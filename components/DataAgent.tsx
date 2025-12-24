import React, { useState, useEffect } from 'react';
import {
  Database,
  Cloud,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Activity,
  TrendingUp,
  AlertCircle,
  Info,
  Clock,
  BarChart3,
  Shield,
  Zap
} from 'lucide-react';
import {
  DataSource,
  DataQualityMetrics,
  DataAnomaly,
  DataAgentInsight,
  DataAlert,
  ValidationRule
} from '../types/dataAgent';
import {
  analyzeDataQuality,
  generateAgentCommentary,
  generateMockDataSources,
  generateMockQualityMetrics,
  generateMockAnomalies
} from '../services/dataAgentService';

const DataAgent: React.FC = () => {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<Record<string, DataQualityMetrics>>({});
  const [anomalies, setAnomalies] = useState<DataAnomaly[]>([]);
  const [insights, setInsights] = useState<DataAgentInsight[]>([]);
  const [alerts, setAlerts] = useState<DataAlert[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [agentCommentary, setAgentCommentary] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'quality' | 'anomalies' | 'insights'>('overview');

  useEffect(() => {
    // Initialize with mock data
    const mockSources = generateMockDataSources();
    const mockMetrics = generateMockQualityMetrics();
    const mockAnomalies = generateMockAnomalies();

    setSources(mockSources);
    setQualityMetrics(mockMetrics);
    setAnomalies(mockAnomalies);

    // Generate initial insights
    const initialInsights: DataAgentInsight[] = [
      {
        id: 'insight-001',
        type: 'Recommendation',
        title: 'Optimize Refresh Schedule',
        description: 'Agency Reports source has a 24-hour lag. Consider implementing real-time API integration.',
        impact: 'High',
        suggestedActions: [
          'Set up automated API connections',
          'Implement incremental data loading',
          'Configure alert thresholds for delays'
        ],
        confidence: 0.85,
        relatedSources: ['ext-001']
      },
      {
        id: 'insight-002',
        type: 'Opportunity',
        title: 'Cross-Source Validation Available',
        description: 'Marketing Data Lake and Analytics Warehouse have 15 overlapping columns that can be cross-validated.',
        impact: 'Medium',
        suggestedActions: [
          'Enable automated cross-validation',
          'Set up reconciliation reports',
          'Define acceptable variance thresholds'
        ],
        confidence: 0.92,
        relatedSources: ['cdl-001', 'snow-001']
      }
    ];
    setInsights(initialInsights);

    // Generate commentary
    generateAgentCommentary(mockSources, mockMetrics, mockAnomalies).then(setAgentCommentary);
  }, []);

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'CDL':
        return <Database className="w-5 h-5" />;
      case 'Snowflake':
        return <Cloud className="w-5 h-5" />;
      case 'External':
        return <FileText className="w-5 h-5" />;
      default:
        return <Database className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'text-green-600 bg-green-50';
      case 'Warning':
        return 'text-yellow-600 bg-yellow-50';
      case 'Error':
        return 'text-red-600 bg-red-50';
      case 'Syncing':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'Warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleRefresh = async (sourceId: string) => {
    setIsAnalyzing(true);
    // Simulate refresh
    setTimeout(() => {
      setSources(prev => prev.map(s =>
        s.id === sourceId
          ? { ...s, lastRefresh: new Date(), status: 'Active' as const }
          : s
      ));
      setIsAnalyzing(false);
    }, 2000);
  };

  const QualityGauge: React.FC<{ score: number; label: string }> = ({ score, label }) => {
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="flex flex-col items-center">
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="#e5e7eb"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke={score >= 90 ? '#10b981' : score >= 75 ? '#f59e0b' : '#ef4444'}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute mt-7 text-2xl font-bold">{score}</div>
        <div className="mt-2 text-sm text-gray-600">{label}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="w-8 h-8 text-purple-600" />
              Data Quality Agent
            </h1>
            <p className="text-gray-600 mt-2">Intelligent monitoring and quality assessment for your data sources</p>
          </div>
          <button
            onClick={() => handleRefresh(sources[0]?.id)}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            Analyze All Sources
          </button>
        </div>

        {/* Agent Commentary */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-1">Maya's Assessment</div>
              <p className="text-gray-700">{agentCommentary || 'Analyzing data quality across all sources...'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'quality', label: 'Quality Metrics', icon: Activity },
          { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
          { id: 'insights', label: 'AI Insights', icon: Zap }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-purple-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Data Sources */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Sources</h2>
            {sources.map(source => (
              <div
                key={source.id}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedSource(source.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      {getSourceIcon(source.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{source.name}</h3>
                      <p className="text-sm text-gray-600">{source.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(source.status)}`}>
                      {source.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefresh(source.id);
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <RefreshCw className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Records</p>
                    <p className="font-semibold">{source.recordCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Last Refresh</p>
                    <p className="font-semibold text-sm">
                      {new Date(source.lastRefresh).toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Quality Score</p>
                    <p className={`font-semibold ${getQualityColor(qualityMetrics[source.id]?.overallScore || 0)}`}>
                      {qualityMetrics[source.id]?.overallScore || 0}%
                    </p>
                  </div>
                </div>

                {source.tables && (
                  <div className="flex gap-2 flex-wrap">
                    {source.tables.map(table => (
                      <span key={table} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                        {table}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Stats</h2>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold">Overall Health</h3>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {Math.round(Object.values(qualityMetrics).reduce((a, b) => a + b.overallScore, 0) / Object.keys(qualityMetrics).length)}%
              </div>
              <p className="text-sm text-gray-600 mt-1">Average quality score</p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <h3 className="font-semibold">Active Issues</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Critical</span>
                  <span className="font-semibold text-red-600">
                    {anomalies.filter(a => a.severity === 'Critical').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Warnings</span>
                  <span className="font-semibold text-yellow-600">
                    {anomalies.filter(a => a.severity === 'Warning').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Info</span>
                  <span className="font-semibold text-blue-600">
                    {anomalies.filter(a => a.severity === 'Info').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold">Last Analysis</h3>
              </div>
              <p className="text-sm text-gray-600">
                {new Date().toLocaleString()}
              </p>
              <button className="mt-3 text-sm text-purple-600 hover:text-purple-700 font-medium">
                View History →
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'quality' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Object.entries(qualityMetrics).map(([sourceId, metrics]) => {
            const source = sources.find(s => s.id === sourceId);
            return (
              <div key={sourceId} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  {getSourceIcon(source?.type || '')}
                  {source?.name}
                </h3>
                <div className="flex justify-center mb-6">
                  <QualityGauge score={metrics.overallScore} label="Overall" />
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Completeness', value: metrics.completeness },
                    { label: 'Consistency', value: metrics.consistency },
                    { label: 'Timeliness', value: metrics.timeliness },
                    { label: 'Accuracy', value: metrics.accuracy },
                    { label: 'Uniqueness', value: metrics.uniqueness }
                  ].map(metric => (
                    <div key={metric.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">{metric.label}</span>
                        <span className={`font-semibold ${getQualityColor(metric.value)}`}>
                          {metric.value}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            metric.value >= 90 ? 'bg-green-500' :
                            metric.value >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${metric.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          {anomalies.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No Anomalies Detected</h3>
              <p className="text-gray-600">All data sources are operating normally</p>
            </div>
          ) : (
            anomalies.map(anomaly => (
              <div
                key={anomaly.id}
                className={`bg-white rounded-xl p-5 shadow-sm border ${getSeverityColor(anomaly.severity)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    {anomaly.severity === 'Critical' && <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                    {anomaly.severity === 'Warning' && <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />}
                    {anomaly.severity === 'Info' && <Info className="w-5 h-5 text-blue-600 mt-0.5" />}
                    <div>
                      <h3 className="font-semibold text-gray-900">{anomaly.type}</h3>
                      <p className="text-gray-700 mt-1">{anomaly.description}</p>
                      {anomaly.affectedColumns && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {anomaly.affectedColumns.map(col => (
                            <span key={col} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                              {col}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(anomaly.detectedAt).toLocaleTimeString()}
                  </span>
                </div>
                {anomaly.suggestedAction && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>Suggested Action:</strong> {anomaly.suggestedAction}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {insights.map(insight => (
            <div key={insight.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    insight.type === 'Recommendation' ? 'bg-purple-100' :
                    insight.type === 'Warning' ? 'bg-yellow-100' :
                    insight.type === 'Opportunity' ? 'bg-green-100' :
                    'bg-red-100'
                  }`}>
                    <Zap className={`w-5 h-5 ${
                      insight.type === 'Recommendation' ? 'text-purple-600' :
                      insight.type === 'Warning' ? 'text-yellow-600' :
                      insight.type === 'Opportunity' ? 'text-green-600' :
                      'text-red-600'
                    }`} />
                  </div>
                  <div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      insight.impact === 'High' ? 'bg-red-100 text-red-700' :
                      insight.impact === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {insight.impact} Impact
                    </span>
                  </div>
                </div>
                <span className="text-sm text-gray-500">
                  {Math.round(insight.confidence * 100)}% confidence
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 mb-2">{insight.title}</h3>
              <p className="text-gray-700 mb-4">{insight.description}</p>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Suggested Actions:</p>
                {insight.suggestedActions.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">•</span>
                    <span className="text-sm text-gray-700">{action}</span>
                  </div>
                ))}
              </div>

              {insight.relatedSources && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500">
                    Affects: {insight.relatedSources.map(id =>
                      sources.find(s => s.id === id)?.name
                    ).join(', ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DataAgent;