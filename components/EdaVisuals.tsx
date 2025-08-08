import React from 'react';
import { EdaInsights } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

interface EdaVisualsProps {
  insights: EdaInsights;
  onConfirm: () => void;
  userFeedback: string;
  onUserFeedbackChange: (value: string) => void;
}

const chartColors = {
  revenue: '#2dd4bf', // teal-400
  spend: '#a78bfa', // purple-400
  scatter: '#60a5fa', // blue-400
  grid: 'rgba(100, 116, 139, 0.2)',
  text: '#94a3b8' // slate-400
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 glass-pane text-sm">
        <p className="label text-slate-300">{`Date: ${label}`}</p>
        <p className="intro" style={{ color: chartColors.revenue }}>{`Revenue: ${payload[0].value.toLocaleString()}`}</p>
        <p className="intro" style={{ color: chartColors.spend }}>{`Spend: ${payload[1]?.value?.toLocaleString()}`}</p>
      </div>
    );
  }
  return null;
};

export const EdaVisuals: React.FC<EdaVisualsProps> = ({ insights, onConfirm }) => {
  return (
    <div className="p-4 md:p-6 space-y-8 max-w-7xl mx-auto">
      <div className="glass-pane p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Data Trends: Spend vs. Revenue</h3>
        <p className="text-slate-400 mb-4 max-w-3xl">{insights.trendsSummary}</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={insights.trendData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis dataKey="date" stroke={chartColors.text} tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" stroke={chartColors.revenue} tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" stroke={chartColors.spend} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{color: chartColors.text}}/>
            <Line yAxisId="left" type="monotone" dataKey="revenue" stroke={chartColors.revenue} strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="spend" stroke={chartColors.spend} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-pane p-6">
        <h3 className="text-xl font-semibold text-white mb-2">Channel Correlations</h3>
         {insights.correlationSummary && <p className="text-slate-400 mb-4 max-w-3xl">{insights.correlationSummary}</p>}
        {insights.interactionsWarning && <p className="text-yellow-400 text-sm mb-4"><strong>Warning:</strong> {insights.interactionsWarning}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {insights.correlationData?.map(corr => (
            <div key={corr.channel}>
              <h4 className="text-center font-medium text-slate-300 mb-2">{corr.channel}</h4>
              <p className="text-center text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 font-mono mb-2">Correlation: {corr.correlation.toFixed(3)}</p>
              <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid}/>
                      <XAxis type="number" dataKey="spend" name="spend" unit="" stroke={chartColors.text} tick={{ fontSize: 10 }} domain={['dataMin', 'dataMax']} />
                      <YAxis type="number" dataKey="revenue" name="revenue" unit="" stroke={chartColors.text} tick={{ fontSize: 10 }} domain={['dataMin', 'dataMax']}/>
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} wrapperClassName="glass-pane"/>
                      <Scatter name={corr.channel} data={corr.data} fill={chartColors.scatter} fillOpacity={0.6}/>
                  </ScatterChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 text-center">
        <button onClick={onConfirm} className="primary-button">
          Proceed to Assumptions
        </button>
      </div>
    </div>
  );
};