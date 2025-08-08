// Hybrid Analysis Service: Real Statistics + AI Interpretation
import { GoogleGenAI, Type } from "@google/genai";
import { 
  calculateRealEdaInsights, 
  runRealMMModeling, 
  StatisticalUtils, 
  FeatureTransformations 
} from './statisticalModeling';
import { 
  AppStep, 
  ColumnType, 
  EdaResult, 
  UserColumnSelection, 
  FeatureParams, 
  ModelRun, 
  EdaInsights, 
  ParsedData, 
  ModelingInteractionResponse,
  CalibrationInteractionResponse,
  OptimizerInteractionResponse,
  OptimizerScenario
} from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Enhanced EDA with real calculations + AI interpretation
export async function getEnhancedEdaInsights(
  selections: UserColumnSelection, 
  data: ParsedData[], 
  userInput: string
): Promise<EdaInsights> {
  // First, perform real statistical calculations
  const realInsights = await calculateRealEdaInsights(selections, data, userInput);
  
  // Then enhance with AI interpretation
  const marketingCols = Object.keys(selections).filter(k => 
    [ColumnType.MARKETING_SPEND, ColumnType.MARKETING_ACTIVITY].includes(selections[k])
  );
  
  const prompt = `You are Maya, an expert Marketing Mix Modeling analyst. I've performed statistical calculations on marketing data, and I need you to provide enhanced business insights and commentary.

**Real Statistical Results:**
${JSON.stringify(realInsights, null, 2)}

**Marketing Channels:** ${marketingCols.join(', ')}
**User Context:** ${userInput || 'None provided'}

**Your Task:**
Enhance the diagnostics commentary for each channel with deeper business insights. Keep the calculated metrics exactly as provided, but improve the commentary to be more:
1. Business-focused (what this means for marketing strategy)
2. Actionable (specific recommendations)
3. Context-aware (considering the user's situation)

Return the same JSON structure but with enhanced commentary fields that provide strategic insights based on the real statistical patterns.

**Example Enhancement:**
Instead of: "High volatility suggests heavily flighted campaigns"
Provide: "High volatility (85.2% CV) indicates aggressive campaign flighting strategy. This pattern is common in seasonal businesses or when testing campaign intensities. Consider smoothing spend for more stable measurement, or ensure your MMM captures these flight patterns with appropriate lag settings."

Return a JSON object matching the original EdaInsights structure with enhanced commentary.`;

  const insightsSchema = {
    type: Type.OBJECT,
    properties: {
      trendsSummary: { type: Type.STRING },
      diagnosticsSummary: { type: Type.STRING },
      channelDiagnostics: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            sparsity: { type: Type.STRING },
            volatility: { type: Type.STRING },
            yoyTrend: { type: Type.STRING },
            commentary: { type: Type.STRING },
            isApproved: { type: Type.BOOLEAN }
          },
          required: ['name', 'sparsity', 'volatility', 'yoyTrend', 'commentary', 'isApproved']
        }
      },
      trendData: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            kpi: { type: Type.NUMBER }
          },
          required: ['date', 'kpi']
        }
      }
    },
    required: ['trendsSummary', 'diagnosticsSummary', 'channelDiagnostics', 'trendData']
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { 
        responseMimeType: 'application/json', 
        responseSchema: insightsSchema 
      }
    });

    const enhancedInsights = JSON.parse(response.text);
    
    // Ensure we preserve the real trend data
    return {
      ...enhancedInsights,
      trendData: realInsights.trendData
    };
  } catch (e) {
    console.error("Failed to enhance EDA insights:", e);
    // Return real insights as fallback
    return realInsights;
  }
}

// Real modeling with AI-enhanced interpretation
export async function generateEnhancedModelLeaderboard(
  selections: UserColumnSelection,
  features: FeatureParams[],
  userInput: string,
  data: ParsedData[]
): Promise<ModelRun[]> {
  // First, run real statistical modeling
  const realModels = await runRealMMModeling(data, selections, features);
  
  // Then enhance with AI interpretation
  const prompt = `You are Maya, an expert Marketing Mix Modeling consultant. I've run real statistical models on marketing data and need you to enhance the model commentary with business insights.

**Real Model Results:**
${JSON.stringify(realModels.map(m => ({ 
  id: m.id, 
  algo: m.algo, 
  rsq: m.rsq, 
  mape: m.mape, 
  roi: m.roi,
  details: m.details.map(d => ({ 
    name: d.name, 
    contribution: d.contribution, 
    roi: d.roi, 
    pValue: d.pValue 
  }))
})), null, 2)}

**User Context:** ${userInput || 'None provided'}
**Feature Settings:** ${JSON.stringify(features)}

**Your Task:**
Enhance the commentary for each model with:
1. **Performance Assessment**: What the R-squared, MAPE, and ROI numbers mean for this business
2. **Algorithm Insights**: Why this algorithm performed well/poorly given the data patterns
3. **Channel Analysis**: Key insights about which channels are driving performance
4. **Business Recommendations**: Specific actions based on these results

Keep all numerical results EXACTLY the same. Only enhance the commentary field.

**Example Enhancement:**
Instead of: "Linear model with statistical significance testing. Good interpretability."
Provide: "Linear model achieved strong performance (R² = 0.87) indicating clear linear relationships between marketing spend and outcomes. The statistical significance testing reveals TV and Digital Display as primary drivers with p-values < 0.05. This interpretable model is ideal for stakeholder communication and budget justification."

Return the complete model objects with enhanced commentary only.`;

  const leaderboardSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        algo: { type: Type.STRING, enum: ['Bayesian Regression', 'NN', 'LightGBM', 'GLM Regression'] },
        rsq: { type: Type.NUMBER },
        mape: { type: Type.NUMBER },
        roi: { type: Type.NUMBER },
        commentary: { type: Type.STRING },
        details: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              included: { type: Type.BOOLEAN },
              contribution: { type: Type.NUMBER },
              roi: { type: Type.NUMBER },
              pValue: { type: Type.NUMBER },
              adstock: { type: Type.NUMBER },
              lag: { type: Type.NUMBER },
              transform: { type: Type.STRING }
            },
            required: ['name', 'included', 'contribution', 'roi', 'pValue', 'adstock', 'lag', 'transform']
          }
        }
      },
      required: ['id', 'algo', 'rsq', 'mape', 'roi', 'commentary', 'details']
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { 
        responseMimeType: 'application/json', 
        responseSchema: leaderboardSchema 
      }
    });

    const enhancedModels = JSON.parse(response.text);
    
    // Merge enhanced commentary with real model data
    return realModels.map((realModel, idx) => ({
      ...realModel,
      commentary: enhancedModels[idx]?.commentary || realModel.commentary
    }));
  } catch (e) {
    console.error("Failed to enhance model commentary:", e);
    // Return real models as fallback
    return realModels;
  }
}

// Cache for expensive statistical calculations
let dataCache: { 
  dataHash: string, 
  statistics: { [key: string]: any }, 
  correlations: { [key: string]: number },
  numericColumns: string[] 
} | null = null;

// Real data analysis for chat responses (optimized)
export async function getRealDataChatResponse(
  query: string, 
  currentStep: AppStep, 
  context: any, 
  data: ParsedData[]
): Promise<string> {
  if (data.length === 0) {
    return "I don't have any data to analyze yet. Please upload your CSV file first!";
  }

  // Create simple hash of data to check if we can use cached results
  const dataHash = `${data.length}_${Object.keys(data[0]).join('_')}`;
  
  let statistics: { [key: string]: any };
  let correlations: { [key: string]: number };
  let numericColumns: string[];

  // Use cached results if data hasn't changed
  if (dataCache && dataCache.dataHash === dataHash) {
    statistics = dataCache.statistics;
    correlations = dataCache.correlations;
    numericColumns = dataCache.numericColumns;
  } else {
    // Perform statistical analysis only when data changes
    numericColumns = Object.keys(data[0]).filter(col => {
      const sampleValues = data.slice(0, 10).map(row => row[col]);
      return sampleValues.some(val => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)));
    });

    statistics = {};
    for (const col of numericColumns) {
      const values = data.map(row => Number(row[col]) || 0);
      statistics[col] = {
        mean: StatisticalUtils.mean(values),
        std: StatisticalUtils.standardDeviation(values),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length
      };
    }

    // Calculate only most relevant correlations (limit to prevent O(n²) explosion)
    correlations = {};
    if (numericColumns.length > 1 && numericColumns.length <= 10) {
      for (let i = 0; i < Math.min(numericColumns.length, 5); i++) {
        for (let j = i + 1; j < Math.min(numericColumns.length, 5); j++) {
          const col1 = numericColumns[i];
          const col2 = numericColumns[j];
          const values1 = data.map(row => Number(row[col1]) || 0);
          const values2 = data.map(row => Number(row[col2]) || 0);
          const corr = StatisticalUtils.correlation(values1, values2);
          correlations[`${col1} vs ${col2}`] = corr;
        }
      }
    }

    // Cache the results
    dataCache = { dataHash, statistics, correlations, numericColumns };
  }

  // Create concise summary for AI (reduce payload size)
  const topColumns = Object.entries(statistics)
    .sort(([,a], [,b]) => b.std - a.std)
    .slice(0, 8);  // Limit to top 8 most variable columns
  
  const significantCorrs = Object.entries(correlations)
    .filter(([,corr]) => Math.abs(corr) > 0.3)  // Only strong correlations
    .slice(0, 5);  // Limit to top 5

  const prompt = `You are Maya, an expert data analyst. Answer the user's question using real statistical analysis.

**User's Question:** "${query}"

**Dataset:** ${data.length} rows, ${Object.keys(data[0]).length} columns

**Key Statistics:**
${topColumns.map(([col, stats]) => 
  `${col}: μ=${stats.mean.toFixed(1)}, σ=${stats.std.toFixed(1)}`
).join(' | ')}

**Notable Correlations:**
${significantCorrs.map(([pair, corr]) => `${pair}: ${corr.toFixed(2)}`).join(' | ')}

**Context:** ${AppStep[currentStep]} step

Provide specific insights based on these real calculations. Be concise and actionable.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return response.text;
  } catch (e) {
    console.error("Failed to generate chat response:", e);
    // Efficient fallback using cached statistics
    const topCols = numericColumns.slice(0, 3);
    return `Based on your data: ${data.length} rows, ${numericColumns.length} numeric columns. Key metrics: ${topCols.map(col => `${col} (μ=${statistics[col].mean.toFixed(1)})`).join(', ')}. Ask me specific questions!`;
  }
}

// Enhanced modeling interaction with real calculations
export async function getEnhancedModelingInteraction(
  query: string, 
  models: ModelRun[]
): Promise<ModelingInteractionResponse> {
  // If query asks about specific metrics, calculate them from real model data
  const modelDataContext = models.map(m => ({
    id: m.id,
    rsq: m.rsq,
    mape: m.mape,
    roi: m.roi,
    topChannels: m.details
      .filter(d => d.included)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 3)
      .map(d => ({ name: d.name, contribution: d.contribution, roi: d.roi }))
  }));

  const prompt = `You are Maya, an MMM expert analyzing real model results. I need you to respond to the user's query about these actual model performances.

**Real Model Performance Data:**
${JSON.stringify(modelDataContext, null, 2)}

**Full Model Details Available:**
${JSON.stringify(models, null, 2)}

**User Query:** "${query}"

**Instructions:**
1. If the user asks about specific metrics (R-squared, MAPE, ROI, channel performance), extract the exact numbers from the real model data above
2. If they want to select/activate a model, identify the correct model ID
3. If they want to rerun models, generate a new model variation with slightly different parameters
4. Provide insights based on the actual calculated performance metrics

Always use the real numbers from the model data. Be specific and accurate with your analysis.

Return a JSON response with appropriate actions based on the query type.`;

  const modelingSchema = {
    type: Type.OBJECT,
    properties: {
      text: { type: Type.STRING },
      newModel: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          algo: { type: Type.STRING },
          rsq: { type: Type.NUMBER },
          mape: { type: Type.NUMBER },
          roi: { type: Type.NUMBER },
          commentary: { type: Type.STRING },
          details: { type: Type.ARRAY, items: { type: Type.OBJECT } }
        }
      },
      selectModelId: { type: Type.STRING }
    },
    required: ['text']
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { 
        responseMimeType: 'application/json', 
        responseSchema: modelingSchema 
      }
    });

    return JSON.parse(response.text) as ModelingInteractionResponse;
  } catch (e) {
    console.error("Failed to process modeling interaction:", e);
    // Fallback response with real data
    return {
      text: `Based on the model performance, the top model is ${models[0].id} with R² = ${models[0].rsq.toFixed(3)} and MAPE = ${models[0].mape.toFixed(1)}%. The strongest performing channels are: ${models[0].details.filter(d => d.included).sort((a, b) => b.contribution - a.contribution).slice(0, 2).map(d => `${d.name} (${d.contribution.toFixed(1)}%)`).join(', ')}.`
    };
  }
}