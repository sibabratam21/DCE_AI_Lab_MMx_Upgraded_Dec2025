

import { GoogleGenAI, Type } from "@google/genai";
import { AppStep, ColumnType, EdaResult, UserColumnSelection, FeatureParams, ModelRun, EdaInsights, ParsedData, ChannelDiagnostic, TrendDataPoint, ColumnSummaryItem, ModelingInteractionResponse, CalibrationInteractionResponse, ModelDetail, OptimizerInteractionResponse, OptimizerScenario } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getCsvSampleFromData = (data: ParsedData[], rowCount = 5): string => {
    if (data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const sample = [headers.join(',')];
    data.slice(0, rowCount).forEach(row => {
        sample.push(headers.map(h => row[h]).join(','));
    });
    return sample.join('\n');
};

const getCsvSample = (csvText: string, rowCount = 6): string => {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  return lines.slice(0, rowCount).join('\n');
};

const edaSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            columnName: { type: Type.STRING },
            suggestedType: { type: Type.STRING, enum: Object.values(ColumnType) },
        },
        required: ['columnName', 'suggestedType'],
    },
};

export const analyzeColumns = async (csvText: string): Promise<EdaResult[]> => {
  const sample = getCsvSample(csvText);
  const prompt = `You are a data analyst specializing in Marketing Mix Modeling. I will provide a CSV sample. Your task is to analyze the columns and classify each one into one of the following roles: '${Object.values(ColumnType).join(', ')}'.

- Dependent Variable: The target metric to be predicted (e.g., sales, prescriptions). Should be numeric.
- Time Dimension: The date or week column, which defines the time grain of the model.
- Geo Dimension: The geographical area column, if present. Often an ID.
- Marketing Spend: Columns representing money spent on marketing. These are used for ROI calculations and must be numeric.
- Marketing Activity: Columns representing marketing effort (e.g., impressions, clicks, GRPs). Must be numeric.
- Control Variable: External or contextual factors that can influence the dependent variable (e.g., seasonality, competitor actions, economic data, promotions, holidays). Can be numeric or categorical.
- Ignore: Columns not relevant for modeling (e.g., duplicate IDs, notes).

CSV Sample:
\`\`\`csv
${sample}
\`\`\`
Base your analysis on column names and the data. For example, a column named 'TRx' with numeric values is likely the Dependent Variable. 'Week' is the Time Dimension. 'TV_Spend' is Marketing Spend. 'TV_Impressions' is Marketing Activity. 'Seasonality' is a Control Variable.
Return the result as a JSON array matching the provided schema. Be logical and accurate.
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: edaSchema,
        },
    });

    try {
        const jsonResponse = JSON.parse(response.text);
        return jsonResponse.map((item: any) => ({
            ...item,
            suggestedType: Object.values(ColumnType).includes(item.suggestedType) ? item.suggestedType : ColumnType.IGNORE
        }));
    } catch (e) {
        console.error("Failed to parse EDA response:", response.text, e);
        throw new Error("Received an invalid JSON format from the AI for EDA.");
    }
};

export const getEdaInsights = async (selections: UserColumnSelection, data: ParsedData[], userInput: string): Promise<EdaInsights> => {
    const dateCol = Object.keys(selections).find(k => selections[k] === ColumnType.TIME_DIMENSION);
    const kpiCol = Object.keys(selections).find(k => selections[k] === ColumnType.DEPENDENT_VARIABLE);
    const marketingCols = Object.keys(selections).filter(k => 
        [ColumnType.MARKETING_SPEND, ColumnType.MARKETING_ACTIVITY].includes(selections[k])
    );

    if (!dateCol || !kpiCol) {
        throw new Error("A 'Time Dimension' and 'Dependent Variable' column must be selected.");
    }
    
    const dates = data
        .map(row => new Date(String(row[dateCol])))
        .filter(d => d instanceof Date && !isNaN(d.getTime()))
        .sort((a,b) => a.getTime() - b.getTime());
    
    let dateRangeString = "The date range could not be determined from the data.";
    if (dates.length > 0) {
        const startDate = dates[0];
        const endDate = dates[dates.length - 1];
        dateRangeString = `The full dataset spans from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}.`;
    }

    const dataSample = getCsvSampleFromData(data, 20);

    const prompt = `You are a senior data analyst creating EDA for a Marketing Mix Model based on the user's actual data.
    
    Data Sample (first 20 rows):
    \`\`\`csv
    ${dataSample}
    \`\`\`

    Full Data Context:
    - ${dateRangeString}
    - Total Rows: ${data.length}

    Marketing Channels to analyze: ${marketingCols.join(', ')}
    Dependent Variable (KPI): ${kpiCol}
    Time series is based on: ${dateCol}
    ${userInput ? `User Feedback/Context: "${userInput}"` : ''}

    Tasks:
    1.  For each marketing channel, calculate its diagnostic summary based on the provided data.
        -   **Sparsity**: Calculate the percentage of zero-value entries. Return as a string (e.g., "5% zeros").
        -   **Volatility (CV)**: Calculate the Coefficient of Variation (StdDev / Mean). Return as a string (e.g., "25.8% CV").
        -   **YoY Trend**: Based on the full date range provided (${dateRangeString}), estimate the Year-over-Year trend. If the data covers two years or more (e.g., >= 104 weekly rows), calculate the trend by comparing the sum of the most recent 52 weeks to the 52 weeks prior to that. If it's less than two years, state: "Not enough data for YoY trend (less than 2 years)". Return as a percentage string (e.g., "+15%", "-8%").
        -   **Commentary**: Write a brief, insightful AI commentary that EXPLAINS the calculated metrics in a business context. For example, if volatility is high, suggest it might be due to flighted campaigns.
    2.  Write a 'trendsSummary' of the overall KPI trend based on the data.
    3.  Write a 'diagnosticsSummary' of the overall data quality, referencing the calculated diagnostics.

    Return a single JSON object with keys: "channelDiagnostics", "trendsSummary", "diagnosticsSummary".
    The "channelDiagnostics" should be an array of objects, each with "name", "sparsity", "volatility", "yoyTrend", and "commentary".
    `;

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
                    },
                    required: ['name', 'sparsity', 'volatility', 'yoyTrend', 'commentary']
                }
            }
        },
        required: ['trendsSummary', 'diagnosticsSummary', 'channelDiagnostics']
    }
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: insightsSchema }
    });

    try {
        const aiData = JSON.parse(response.text);
        const trendData: TrendDataPoint[] = data.map(row => ({
            date: String(row[dateCol]) || '',
            kpi: Number(row[kpiCol]) || 0,
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
            ...aiData,
            channelDiagnostics: aiData.channelDiagnostics.map((d: any) => ({...d, isApproved: true})),
            trendData,
        };
    } catch (e) {
        console.error("Failed to parse EDA insights:", response.text, e);
        throw new Error("Received an invalid JSON format from the AI for EDA insights.");
    }
}

const featuresSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            channel: { type: Type.STRING },
            adstock: { type: Type.NUMBER },
            lag: { type: Type.NUMBER },
            transform: { type: Type.STRING, enum: ['Log-transform', 'Negative Exponential', 'S-Curve', 'Power'] },
            rationale: { type: Type.STRING }
        },
        required: ['channel', 'adstock', 'lag', 'transform', 'rationale']
    }
};

export const recommendFeatures = async (selections: UserColumnSelection, approvedChannels: string[], userInput: string): Promise<FeatureParams[]> => {
    const prompt = `
You are a Marketing Mix Modeling expert. For the following marketing channels, recommend appropriate feature engineering parameters: adstock, lag, and transformation type.

Channels: ${approvedChannels.join(', ')}
${userInput ? `User Feedback/Context: "${userInput}"` : ''}

Guidelines:
- Adstock (0.0-0.9): Lingering ad effect. High adstock for brand-building (TV), low for direct response (Search).
- Lag (in weeks, 0-4): Delayed impact.
- Transformation: Choose from 'Log-transform', 'Negative Exponential', 'S-Curve', or 'Power'. 'S-Curve' is good for channels with initial ramp-up and saturation effects (like TV). 'Power' is a flexible alternative to log-transform. 'Log-transform' and 'Negative Exponential' model diminishing returns well for most digital channels.
- Rationale: Provide a brief, human-readable rationale (max 2 sentences) for each choice.

Generate a plausible recommendation for each channel and return a JSON array matching the schema.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: featuresSchema }
    });
    try {
        const jsonResponse = JSON.parse(response.text);
        return jsonResponse as FeatureParams[];
    } catch (e) {
        console.error("Failed to parse feature recommendations:", response.text, e);
        throw new Error("Received an invalid JSON format for feature recommendations.");
    }
}

export const getFeatureEngineeringSummary = async (features: FeatureParams[]): Promise<string> => {
    const prompt = `
You are an expert marketing strategist. A user has set up feature engineering parameters for a Marketing Mix Model.
Analyze these parameters and provide a high-level "Agent's Analysis" in clear, readable Markdown.

**Parameters:**
${JSON.stringify(features, null, 2)}

**Instructions for your response:**
Your response MUST be a single string containing only raw Markdown.
- **Do not** wrap your response in markdown code fences (e.g., \`\`\`markdown).
- Structure your response with the following three sections, using the specified headings:

## Overall Strategy
(A brief 1-2 sentence overview of what these settings are designed to achieve.)

## Key Highlights
(2-3 bullet points noting the most significant parameter choices and their implications. For example, contrast a high-adstock channel with a low-adstock one.)

## Expert Considerations
(1-2 bullet points with actionable advice or confirmations. E.g., "The setup for Search follows best practices..." or "The high lag on Samples suggests...")

Keep the tone concise, expert, and helpful. Ensure you use Markdown headings and bullet points as requested.
`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    return response.text;
};

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
                        transform: { type: Type.STRING, enum: ['Log-transform', 'Negative Exponential', 'S-Curve', 'Power'] },
                    },
                    required: ['name', 'included', 'contribution', 'roi', 'pValue', 'adstock', 'lag', 'transform']
                }
            }
        },
        required: ['id', 'algo', 'rsq', 'mape', 'roi', 'commentary', 'details']
    }
};

export const generateModelLeaderboard = async (selections: UserColumnSelection, features: FeatureParams[], userInput: string, data: ParsedData[]): Promise<ModelRun[]> => {
    const prompt = `
You are a data science platform simulating an automated model building process for MMM.
Given the user's setup, generate a plausible but *simulated* leaderboard of model runs.

**Context:**
- Feature Parameters: ${JSON.stringify(features)}
- User Input: "${userInput}"

**Task:**
1.  **Simulate 12 distinct model runs** (3 for each algorithm: 'Bayesian Regression', 'NN', 'LightGBM', 'GLM Regression'). Use IDs like "br_1", "nn_1", "lgbm_1", "glm_1".
2.  For each run, generate realistic top-level metrics: **rsq** (0.7-0.95), **mape** (5-15%), and blended **roi** (-1.0 to 6.0).
3.  For each run, generate a **detailed breakdown for every channel** in the provided features. This breakdown goes in the 'details' array.
    -   **name**: The channel name.
    -   **included**: Set to \`true\`.
    -   **contribution**: Assign a plausible contribution percentage. The sum of contributions for all channels should be between 60-85%.
    -   **roi**: Assign a plausible ROI for the channel (can be negative).
    -   **pValue**: For 'Bayesian Regression' and 'GLM Regression' models, generate a p-value between 0.00 and 0.25. For 'NN' and 'LightGBM', set pValue to \`null\`.
    -   **adstock, lag, transform**: Use the values from the 'Feature Parameters' provided.
4.  **Write a brief, insightful commentary for each run** specific to its algorithm (Bayesian for interpretability, NN for non-linearity, LightGBM for performance, GLM Regression for robust statistical baselining).
5.  Ensure results are varied to present realistic trade-offs.

Generate a JSON array of 12 model run objects according to the schema. Ensure every field is populated correctly.
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: leaderboardSchema
        },
    });

    try {
        const models = JSON.parse(response.text) as ModelRun[];
        // Post-process to ensure p-values are null for non-statistical models
        return models.map(model => {
            if (model.algo !== 'Bayesian Regression' && model.algo !== 'GLM Regression') {
                model.details.forEach(d => d.pValue = null);
            }
            return model;
        });
    } catch (e) {
        console.error("Failed to parse model leaderboard:", response.text, e);
        throw new Error("Received an invalid JSON format from the AI for the model leaderboard.");
    }
};

const getDataSampleAsCsv = (data: ParsedData[], rowCount = 50): string => {
    if (data.length === 0) return "No data available.";
    const headers = Object.keys(data[0]).join(',');
    const sample: string[] = [headers];
    const actualRowCount = Math.min(rowCount, data.length);
    for(let i=0; i<actualRowCount; i++) {
        sample.push(Object.values(data[i]).map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
    }
    if (data.length > rowCount) sample.push('...');
    return sample.join('\n');
}

export const getGeneralChatResponse = async (query: string, currentStep: AppStep, context: any, data: ParsedData[]): Promise<string> => {
    const dataSample = getDataSampleAsCsv(data, 20); 

    const prompt = `You are a data analyst AI assistant. Your primary function is to analyze the provided data sample and answer the user's question based *only* on that data.

**Core Task:**
Analyze the data provided in the "Data Sample" section and use it to answer the "User's Question". All calculations (totals, averages, trends, etc.) MUST be derived directly from this data. Do not use external knowledge or refuse to answer because the data is a sample. If the provided sample is insufficient for a precise answer, provide an estimate based on the available data and explicitly state that it is an estimate based on a sample of the full dataset.

**Data Sample (up to the first 20 rows of user's data):**
\`\`\`csv
${dataSample}
\`\`\`

**Context (for your reference):**
- **Current App Step:** ${AppStep[currentStep]}

**User's Question:** "${query}"

**Response Guidelines:**
- Your response must be in Markdown.
- Use tables for structured data.
- Be concise and directly address the user's question with information from the data.
- Do not suggest UI actions or talk about the app's functionality. Focus on the data.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    return response.text;
}

export const getFeatureConfirmationSummary = async (features: FeatureParams[], selections: UserColumnSelection): Promise<string> => {
    const kpiCol = Object.keys(selections).find(k => selections[k] === ColumnType.DEPENDENT_VARIABLE) || 'the target variable';

    const intro = `Okay, acknowledged. Based on your settings, I will apply the following transformations to model '${kpiCol}':`;
    const tableHeader = `| Channel | Adstock | Lag (Weeks) | Transformation |`;
    const tableSeparator = `|---|---|---|---|`;
    const tableRows = features
        .map(f => `| ${f.channel} | ${f.adstock} | ${f.lag} | ${f.transform} |`)
        .join('\n');

    const markdown = [
        intro,
        '', 
        tableHeader,
        tableSeparator,
        tableRows
    ].join('\n');

    return Promise.resolve(markdown);
}

const modelingInteractionSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "A conversational response to the user's query." },
    newModel: {
      type: Type.OBJECT,
      description: "A new model object to be added to the leaderboard, only if the user requested a re-run.",
      properties: leaderboardSchema.items.properties,
      required: leaderboardSchema.items.required,
    },
    selectModelId: { type: Type.STRING, description: "The ID of the model to be selected for calibration, if the user indicated they want to proceed or examine a model." },
  },
  required: ['text'],
};

export const getModelingInteraction = async (query: string, models: ModelRun[]): Promise<ModelingInteractionResponse> => {
  const prompt = `
You are an AI assistant for a Marketing Mix Modeling platform. The user is viewing a leaderboard of models and has sent a query.
Your task is to interpret the user's query and respond appropriately in JSON format by querying the provided model data.

**Current Model Leaderboard (with details):**
\`\`\`json
${JSON.stringify(models, null, 2)}
\`\`\`

**User Query:** "${query}"

**Your Tasks:**

1.  **Analyze the Query:** Understand the user's intent.
2.  **Formulate a Text Response:** Write a helpful, conversational response.
3.  **Determine Actions and populate the JSON response:**

    *   **If the user asks a question about a specific model or channel (e.g., "what is the TV impact in br_2?", "compare roi for samples in nn_1 and lgbm_1"):**
        *   **CRITICAL: Find the answer in the JSON data provided.** Look up the model by its 'id', find the channel in its 'details' array, and extract the requested metric ('contribution', 'roi', 'pValue', etc.).
        *   Formulate the answer in the 'text' field.
        *   **Do not** populate 'newModel' or 'selectModelId'.

    *   **If the user asks to "rerun" a model or create a new one (e.g., "rerun with stricter outliering"):**
        *   Generate a **single new model object** for the 'newModel' field that is consistent with the schema.
        *   Create a new, unique ID (e.g., if 'br_3' exists, create 'br_4').
        *   Slightly adjust metrics and details to plausibly reflect their request.
        *   Your text response should announce the new model.

    *   **If the user asks to proceed with, select, activate, or examine a specific model (e.g., "let's go with br_2", "activate nn_1"):**
        *   Identify the correct model ID from the leaderboard.
        *   Put this ID in the 'selectModelId' field.
        *   Your text response should confirm their selection.

    *   **For any other general question:**
        *   Provide a helpful answer in the 'text' field.

**Output Format:**
Return a single JSON object matching the provided schema. Only include 'newModel' or 'selectModelId' if the user's query explicitly triggers those actions.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: modelingInteractionSchema,
    },
  });

  try {
    return JSON.parse(response.text) as ModelingInteractionResponse;
  } catch (e) {
    console.error("Failed to parse modeling interaction response:", response.text, e);
    throw new Error("Received an invalid JSON format from the AI for the modeling interaction.");
  }
};

const calibrationInteractionSchema = {
    type: Type.OBJECT,
    properties: {
        text: { type: Type.STRING, description: "A conversational response to the user's tuning request." },
        updatedModel: {
            type: Type.OBJECT,
            description: "The complete, updated model object after applying the user's change.",
            properties: leaderboardSchema.items.properties,
            required: leaderboardSchema.items.required,
        }
    },
    required: ['text', 'updatedModel']
}

export const getCalibrationInteraction = async (query: string, currentModel: ModelRun): Promise<CalibrationInteractionResponse> => {
    const prompt = `
You are an AI assistant for an MMM platform. The user wants to tune the provided model via a natural language command.
Your task is to interpret the command, apply it to the model JSON, and return the complete updated model object.

**Current Model State:**
\`\`\`json
${JSON.stringify(currentModel, null, 2)}
\`\`\`

**User's Command:** "${query}"

**Instructions:**
1.  **Interpret Command:** Understand if the user is changing adstock, lag, or including/excluding a channel.
2.  **Update 'details' Array:** Modify the 'details' array to reflect the command.
    *   If changing a value (e.g., "set TV adstock to 0.7"), update the 'adstock' field for the 'TV' channel.
    *   If excluding a channel, set its 'included' property to \`false\`.
3.  **Recalculate Metrics (Crucial):** After updating, you MUST adjust other values plausibly.
    *   **Contributions:** When a channel is excluded/included, you MUST recalculate the 'contribution' for ALL channels. The total contribution of all *included* channels should be roughly the same as the original total.
    *   **Top-Level Metrics (\`rsq\`, \`mape\`, \`roi\`):** The model's overall performance will change.
        *   If a channel is **excluded**, the model gets "weaker". Slightly **decrease \`rsq\`** (e.g., by 0.01-0.03) and slightly **increase \`mape\`** (e.g., by 0.2-0.5). Adjust blended 'roi' down a bit.
        *   If a channel is **included**, do the reverse.
        *   If tuning a parameter like adstock, metric changes should be very small.
4.  **Formulate Text Response:** Write a short response confirming the action (e.g., "Okay, I've excluded 'Samples' and updated the model.").
5.  **Return Full Object:** Return a single JSON object containing your 'text' response and the **complete, updated 'updatedModel' object**.

This is a simulation. Make logical, plausible changes.
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: calibrationInteractionSchema,
        },
    });

    try {
        const parsedResponse = JSON.parse(response.text);
        if (!parsedResponse.updatedModel) {
            throw new Error("AI response missing required 'updatedModel' field.");
        }
        return parsedResponse as CalibrationInteractionResponse;
    } catch (e) {
        console.error("Failed to parse calibration interaction response:", response.text, e);
        throw new Error("Received an invalid JSON format from the AI for the calibration interaction.");
    }
};

const confirmationIntentSchema = {
    type: Type.OBJECT,
    properties: {
        intent: {
            type: Type.STRING,
            enum: ['affirmative', 'negative', 'other'],
            description: "The user's intent. 'affirmative' for yes/proceed, 'negative' for no/stop, 'other' for questions or unrelated comments."
        }
    },
    required: ['intent']
};

export const getConfirmationIntent = async (query: string): Promise<'affirmative' | 'negative' | 'other'> => {
    const prompt = `
    A user was asked to confirm a choice. Analyze their response to determine their intent.
    - If the user says "yes", "yep", "ok", "proceed", "confirm", "looks good", "correct", or similar, the intent is "affirmative".
    - If the user says "no", "stop", "wait", "cancel", or similar, the intent is "negative".
    - If the user asks a question or says something unrelated, the intent is "other".

    User response: "${query}"

    Return the intent as a JSON object with a single key "intent".
    `;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: confirmationIntentSchema,
            }
        });
        const result = JSON.parse(response.text);
        return result.intent;
    } catch(e) {
        console.error("Error getting confirmation intent", e);
        const lowerQuery = query.toLowerCase();
        if (['yes', 'yep', 'ok', 'proceed', 'confirm'].some(term => lowerQuery.includes(term))) {
            return 'affirmative';
        }
        return 'other';
    }
}


const optimizerInteractionSchema = {
    type: Type.OBJECT,
    properties: {
        text: { type: Type.STRING, description: "A conversational response to the user's request." },
        newScenario: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                recommendedSpend: { type: Type.NUMBER },
                projectedROI: { type: Type.NUMBER },
                netRevenue: { type: Type.NUMBER },
                channels: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            currentSpend: { type: Type.NUMBER },
                            recommendedSpend: { type: Type.NUMBER },
                            change: { type: Type.NUMBER },
                            projectedROI: { type: Type.NUMBER },
                            agentCommentary: { type: Type.STRING },
                        },
                        required: ['name', 'currentSpend', 'recommendedSpend', 'change', 'projectedROI', 'agentCommentary']
                    }
                }
            },
            required: ['id', 'title', 'recommendedSpend', 'projectedROI', 'netRevenue', 'channels']
        }
    },
    required: ['text', 'newScenario']
};


export const getOptimizerInteraction = async (query: string, model: ModelRun, existingScenarios: OptimizerScenario[]): Promise<OptimizerInteractionResponse> => {
    const prompt = `
You are an AI budget optimization specialist for a Marketing Mix Modeling (MMM) platform.
Your task is to create a new, custom budget scenario based on the user's request, the finalized MMM model, and existing scenarios for context.

**Finalized MMM Model (Source of Truth for ROI, etc.):**
\`\`\`json
${JSON.stringify(model, null, 2)}
\`\`\`

**Existing Scenarios (For context on what user has already seen):**
\`\`\`json
${JSON.stringify(existingScenarios.slice(0, 3), null, 2)}
\`\`\`

**User's Request:** "${query}"

**Instructions:**
1.  **Interpret the Request:** Analyze the user's query to understand their constraints and goals (e.g., new total budget, maximizing ROI, protecting spend on a channel).
2.  **Generate a New Scenario:** Create one single, new scenario object.
    *   **ID and Title:** Give it a new, unique ID (e.g., "custom_budget_1"). Give it a descriptive title like "Custom $250M Budget" or "TV Spend Locked at 35M". **Do not** start the title with "Scenario X:". The app will handle numbering.
    *   **Adhere to Constraints:** The 'recommendedSpend' for all channels MUST sum up to the user's requested budget. If no budget is given, make a reasonable adjustment based on their goal.
    *   **Re-allocate Budget:** Plausibly re-allocate spend across channels based on their original ROI from the model. Increase spend on high-ROI channels and decrease on low-ROI channels to meet the user's goal.
    *   **Calculate New Metrics:**
        *   \`recommendedSpend\`: The new total spend (sum of channel spends).
        *   \`projectedROI\`: A plausible new blended ROI. If the budget is lower or focused on efficiency, this might increase. If focused on volume, it might decrease.
        *   \`netRevenue\`: Calculated as \`recommendedSpend * (projectedROI - 1)\`.
    *   **Channel-level Details:**
        *   \`currentSpend\`: This is a simulated value. Use a plausible number based on the channel's adstock/lag from the model (e.g., \`adstock * 500 + lag * 100\`). Keep this consistent for the same channel across scenarios.
        *   \`recommendedSpend\`: Your new proposed spend for this channel.
        *   \`change\`: The percentage change from current to recommended spend.
        *   \`projectedROI\`: The new estimated ROI for the channel under this plan.
        *   \`agentCommentary\`: A short, insightful justification for the change.
3.  **Formulate a Text Response:** Write a conversational response that introduces the new scenario and briefly explains how it meets their request.
4.  **Return JSON:** Respond with a single JSON object containing the 'text' and the 'newScenario' object, matching the provided schema.
`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: optimizerInteractionSchema,
        },
    });

    try {
        const result = JSON.parse(response.text);
        return result as OptimizerInteractionResponse;
    } catch(e) {
        console.error("Failed to parse optimizer interaction response:", response.text, e);
        throw new Error("Received an invalid JSON format from the AI for the optimizer interaction.");
    }
};

const modelRunSchema = {
    type: Type.OBJECT,
    properties: leaderboardSchema.items.properties,
    required: leaderboardSchema.items.required,
};

export const rerunModel = async (originalModel: ModelRun): Promise<ModelRun> => {
    const prompt = `
You are a data science platform simulating a model recalibration. A user has updated parameters for an existing model.
Based on these new parameters, generate a SINGLE new model run object.

**Original Model State (for context):**
\`\`\`json
${JSON.stringify({ id: originalModel.id, algo: originalModel.algo, rsq: originalModel.rsq, mape: originalModel.mape, roi: originalModel.roi }, null, 2)}
\`\`\`

**User's Updated Model Parameters (this is the new target state):**
\`\`\`json
${JSON.stringify(originalModel, null, 2)}
\`\`\`

**Task:**
1.  **Generate a new unique ID.** Append a suffix to the original ID. For example, if the original ID is "glm_1", the new ID should be "glm_1_cal_1". If it's already a calibrated model like "glm_1_cal_1", make it "glm_1_cal_2".
2.  **Plausibly adjust metrics.** Based on the changes in the 'details' array (e.g., a channel was excluded, adstock changed), make small, logical adjustments to the top-level metrics (\`rsq\`, \`mape\`, \`roi\`). For example, excluding a channel with a p-value > 0.1 might slightly IMPROVE the model, while excluding one with p < 0.05 will likely WORSEN it (lower rsq, higher mape). Changing adstock should cause minor fluctuations. When a channel is excluded, its contribution must be redistributed among other channels. The total contribution should remain similar. The blended ROI should also be recalculated.
3.  **Write a new commentary.** The commentary should briefly mention what was changed from the original model (e.g., "Recalibrated from ${originalModel.id} by excluding 'Samples' channel.").
4.  **Return the complete new model object.** The 'details' array in your response should be identical to the one in the "User's Updated Model Parameters" input. The overall object must match the schema.

Return a single JSON object matching the provided schema. Ensure every field is populated correctly.
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: modelRunSchema,
        },
    });

    try {
        const newModel = JSON.parse(response.text);
        // Post-process to ensure p-values are null for non-statistical models, preserving the logic
        if (newModel.algo !== 'Bayesian Regression' && newModel.algo !== 'GLM Regression') {
            newModel.details.forEach((d: ModelDetail) => d.pValue = null);
        }
        return newModel as ModelRun;
    } catch (e) {
        console.error("Failed to parse rerun model response:", response.text, e);
        throw new Error("Received an invalid JSON format from the AI for the recalibrated model.");
    }
};