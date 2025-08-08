import { UserColumnSelection, ColumnType, EdaInsights, TrendDataPoint, ChannelDiagnostic, ParsedData, FeatureParams, ModelRun, OptimizerScenario } from '../types';

/**
 * SPEND vs ACTIVITY SEPARATION LOGIC:
 * 
 * - ACTIVITY columns (impressions, clicks, GRPs): Used for ALL modeling, features, diagnostics, correlation
 * - SPEND columns (spend, cost, investment): Used ONLY for ROI calculations and budget optimization
 * 
 * This ensures we model media activity effects properly while tracking spend for business ROI.
 */

// Realistic demo simulation for MMM diagnostics
export const generateDemoInsights = (selections: UserColumnSelection, data: ParsedData[]): EdaInsights => {
    const dateCol = Object.keys(selections).find(k => selections[k] === ColumnType.TIME_DIMENSION);
    const kpiCol = Object.keys(selections).find(k => selections[k] === ColumnType.DEPENDENT_VARIABLE);
    const spendCols = Object.keys(selections).filter(k => selections[k] === ColumnType.MARKETING_SPEND);
    const activityCols = Object.keys(selections).filter(k => selections[k] === ColumnType.MARKETING_ACTIVITY);

    if (!dateCol || !kpiCol) {
        throw new Error("A 'Time Dimension' and 'Dependent Variable' column must be selected.");
    }

    // Create channel pairs mapping spend to activity
    const channelPairs: Array<{name: string, spendCol?: string, activityCol: string}> = [];
    
    activityCols.forEach(activityCol => {
        // Find matching spend column by similar name pattern
        const matchingSpendCol = spendCols.find(spendCol => {
            const activityBase = activityCol.toLowerCase().replace(/_?(impressions?|clicks?|grps?|reach|views?|activity|count|events?|sends?|engagements?)$/i, '');
            const spendBase = spendCol.toLowerCase().replace(/_?(spend|cost|investment)$/i, '');
            return activityBase.includes(spendBase) || spendBase.includes(activityBase) || 
                   activityBase.replace(/[^a-z]/g, '') === spendBase.replace(/[^a-z]/g, '');
        });
        
        channelPairs.push({
            name: matchingSpendCol ? 
                activityCol.replace(/_?(impressions?|clicks?|grps?|reach|views?|activity|count|events?|sends?|engagements?)$/i, '') : 
                activityCol,
            spendCol: matchingSpendCol,
            activityCol: activityCol
        });
    });
    
    // Add unmatched spend columns as standalone channels
    const usedSpendCols = channelPairs.map(p => p.spendCol).filter(Boolean);
    spendCols.filter(col => !usedSpendCols.includes(col)).forEach(spendCol => {
        channelPairs.push({
            name: spendCol.replace(/_?(spend|cost|investment)$/i, ''),
            spendCol: spendCol,
            activityCol: spendCol // Will use spend values for analysis when no activity available
        });
    });

    // Generate realistic channel diagnostics based on activity columns (spend only for ROI)
    const channelDiagnostics: ChannelDiagnostic[] = channelPairs.map((pair, index) => {
        const channelName = pair.name;
        
        // Calculate realistic sparsity based on activity data
        const activityValues = data.map(row => Number(row[pair.activityCol]) || 0);
        const zeroCount = activityValues.filter(v => v === 0).length;
        const sparsityPct = Math.round((zeroCount / data.length) * 100);
        
        // Calculate coefficient of variation for activity
        const mean = activityValues.reduce((sum, val) => sum + val, 0) / activityValues.length;
        const variance = activityValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / activityValues.length;
        const cv = mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 100) : 0;
        
        // Calculate spend totals if spend column exists
        let latest52wSpend = "Activity Only";
        let yoyTrend = "N/A";
        
        if (pair.spendCol && data.length >= 52) {
            const spendValues = data.map(row => Number(row[pair.spendCol!]) || 0);
            const recent52w = spendValues.slice(-52).reduce((sum, val) => sum + val, 0);
            latest52wSpend = `$${(recent52w / 1000).toFixed(0)}k`;
            
            if (data.length >= 104) {
                const prior52w = spendValues.slice(-104, -52).reduce((sum, val) => sum + val, 0);
                if (prior52w > 0) {
                    const trend = ((recent52w - prior52w) / prior52w) * 100;
                    yoyTrend = `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`;
                }
            }
        }

        // Generate realistic commentary based on metrics
        let commentary = "";
        if (sparsityPct > 50) {
            commentary = "High sparsity suggests flighted campaign pattern.";
        } else if (cv > 80) {
            commentary = "High volatility indicates burst-style media deployment.";
        } else if (sparsityPct < 20 && cv < 40) {
            commentary = "Consistent always-on channel with stable spend pattern.";
        } else {
            commentary = "Moderate activity with seasonal variation patterns.";
        }

        return {
            name: channelName,
            sparsity: `${sparsityPct}% zeros`,
            volatility: `${cv.toFixed(1)}% CV`,
            yoyTrend: yoyTrend,
            commentary: commentary,
            isApproved: true,
            // Add new fields for spend tracking
            latest52wSpend: latest52wSpend,
            yoySpendTrend: yoyTrend
        } as ChannelDiagnostic & { latest52wSpend: string; yoySpendTrend: string };
    });

    // Generate KPI trend data
    const trendData: TrendDataPoint[] = data.map(row => ({
        date: String(row[dateCol!]) || '',
        kpi: Number(row[kpiCol!]) || 0,
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Generate realistic summaries
    const avgKpi = trendData.reduce((sum, point) => sum + point.kpi, 0) / trendData.length;
    const recentKpi = trendData.slice(-13).reduce((sum, point) => sum + point.kpi, 0) / 13;
    const trendDirection = recentKpi > avgKpi ? "upward" : "downward";
    
    const trendsSummary = `${kpiCol} shows ${trendDirection} trend with average weekly value of ${avgKpi.toFixed(0)} units.`;
    
    const activeChannels = channelDiagnostics.filter(d => !d.sparsity.includes('100%')).length;
    const diagnosticsSummary = `Data quality is good with ${activeChannels} of ${channelDiagnostics.length} channels showing active spend patterns.`;

    return {
        trendData,
        trendsSummary,
        diagnosticsSummary,
        channelDiagnostics: channelDiagnostics as ChannelDiagnostic[]
    };
};

// Generate realistic feature engineering recommendations (activity channels only)
export const generateDemoFeatures = (approvedActivityChannels: string[]): FeatureParams[] => {
    const channelDefaults: { [key: string]: { adstock: number; lag: number; transform: string; rationale: string } } = {
        'TV': { adstock: 0.7, lag: 1, transform: 'S-Curve', rationale: 'TV has strong carryover effects and exhibits diminishing returns at high spend levels.' },
        'Display': { adstock: 0.4, lag: 1, transform: 'Negative Exponential', rationale: 'Display advertising has brand awareness carryover with exponential decay patterns.' },
        'PaidSearch': { adstock: 0.1, lag: 0, transform: 'Log-transform', rationale: 'Paid search is direct response with minimal carryover and clear diminishing returns.' },
        'HCPCalls': { adstock: 0.6, lag: 2, transform: 'S-Curve', rationale: 'HCP outreach has strong professional influence with 2-week lag for prescription decisions.' },
        'Speaker': { adstock: 0.8, lag: 3, transform: 'S-Curve', rationale: 'Speaker events build long-term credibility with extended carryover effects.' },
        'HCPEmail': { adstock: 0.2, lag: 1, transform: 'Log-transform', rationale: 'Digital HCP communication has quick response with moderate diminishing returns.' },
        'HCPSocial': { adstock: 0.3, lag: 1, transform: 'Power', rationale: 'HCP social engagement has flexible response curves with short carryover.' }
    };

    return approvedActivityChannels.map(channel => {
        const baseChannel = Object.keys(channelDefaults).find(key => 
            channel.toLowerCase().includes(key.toLowerCase())
        );
        
        const defaults = baseChannel ? channelDefaults[baseChannel] : {
            adstock: 0.3,
            lag: 0,
            transform: 'Log-transform',
            rationale: 'Standard MMM parameters with moderate carryover and diminishing returns.'
        };

        return {
            channel,
            ...defaults
        } as FeatureParams;
    });
};

// Generate realistic model leaderboard with believable performance metrics (activity channels only)
export const generateDemoModels = (activityChannels: string[]): ModelRun[] => {
    const modelTypes = ['Ridge Regression', 'Random Forest', 'XGBoost', 'Bayesian MMM'];
    
    return modelTypes.map((modelType, index) => {
        const baseRsquared = 0.75 + (Math.random() * 0.2) - 0.1; // 0.65 to 0.95
        const mape = 8 + (Math.random() * 12); // 8% to 20%
        
        // Generate realistic channel contributions (activity-based analysis)
        const channelDetails = activityChannels.map((channel, i) => {
            const baseContrib = 0.15 + (Math.random() * 0.25); // 15% to 40%
            const efficiency = 1.2 + (Math.random() * 1.8); // $1.20 to $3.00 ROI
            
            return {
                channel,
                contribution: baseContrib,
                efficiency: efficiency,
                confidenceInterval: [efficiency * 0.8, efficiency * 1.2]
            };
        });

        // Normalize contributions to sum to ~80% (leaving 20% for base/control)
        const totalContrib = channelDetails.reduce((sum, ch) => sum + ch.contribution, 0);
        channelDetails.forEach(ch => ch.contribution = (ch.contribution / totalContrib) * 0.8);

        return {
            id: `model_${index}`,
            modelType,
            rsquared: baseRsquared,
            mape: mape,
            channelDetails: channelDetails,
            selectedModel: index === 0, // First model is selected by default
            summary: `${modelType} achieves ${(baseRsquared * 100).toFixed(1)}% R² with ${mape.toFixed(1)}% MAPE across ${activityChannels.length} activity channels.`,
            insights: `Top performing channels: ${channelDetails.sort((a, b) => b.efficiency - a.efficiency).slice(0, 2).map(ch => ch.channel).join(', ')}.`
        } as ModelRun;
    });
};

// Generate realistic optimization scenarios (spend-based allocations from activity analysis)
export const generateDemoOptimization = (currentSpend: number, activityChannels: string[]): OptimizerScenario[] => {
    const scenarios = [
        { name: 'Current Allocation', multiplier: 1.0, description: 'Maintain current spend distribution' },
        { name: 'Efficiency Focused', multiplier: 1.0, description: 'Reallocate to highest ROI channels' },
        { name: 'Growth (+25%)', multiplier: 1.25, description: 'Increase total budget by 25%' },
        { name: 'Diversified', multiplier: 1.1, description: 'Balance reach and efficiency' }
    ];

    return scenarios.map((scenario, index) => {
        const totalBudget = currentSpend * scenario.multiplier;
        
        // Generate realistic channel allocations
        const allocations: { [key: string]: number } = {};
        let remaining = totalBudget;
        
        activityChannels.forEach((channel, i) => {
            const isLast = i === activityChannels.length - 1;
            if (isLast) {
                allocations[channel] = remaining;
            } else {
                const minAlloc = totalBudget * 0.05; // At least 5%
                const maxAlloc = remaining * 0.6; // At most 60% of remaining
                const allocation = minAlloc + (Math.random() * (maxAlloc - minAlloc));
                allocations[channel] = allocation;
                remaining -= allocation;
            }
        });

        // Calculate projected ROI (higher for efficiency-focused scenarios)
        const baseROI = 2.1;
        const roiMultiplier = scenario.name.includes('Efficiency') ? 1.3 : 
                             scenario.name.includes('Growth') ? 0.95 :
                             scenario.name.includes('Diversified') ? 1.1 : 1.0;
        
        const projectedROI = baseROI * roiMultiplier;
        const projectedRevenue = totalBudget * projectedROI;

        return {
            id: `scenario_${index}`,
            ...scenario,
            totalBudget,
            projectedROI,
            projectedRevenue,
            channelAllocations: allocations,
            isRecommended: scenario.name.includes('Efficiency') // Mark efficiency scenario as recommended
        } as OptimizerScenario;
    });
};