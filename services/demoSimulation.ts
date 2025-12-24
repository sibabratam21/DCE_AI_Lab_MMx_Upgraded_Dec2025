import { UserColumnSelection, ColumnType, EdaInsights, TrendDataPoint, ChannelDiagnostic, ParsedData, FeatureParams, ModelRun, OptimizerScenario } from '../types';
import { convertModelRunToDTO, validateModelData } from './activeModelAPI';
import type { ActiveModelResponse } from '../types/api';

// Helper function to clean up markdown formatting
const cleanupResponse = (text: string): string => {
  return text
    // Remove all markdown formatting for better readability
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold formatting
    .replace(/\*(.+?)\*/g, '$1') // Remove italic formatting
    .replace(/###\s*(.+)/g, '$1') // Remove header formatting
    .replace(/##\s*(.+)/g, '$1') // Remove header formatting
    .replace(/#\s*(.+)/g, '$1') // Remove header formatting
    .replace(/•\s*/g, '') // Remove bullet points
    .replace(/\*\s*/g, '') // Remove asterisk bullet points
    .replace(/^\s*-\s*/gm, '') // Remove dash bullet points
    .replace(/^\s*\d+\.\s*/gm, '') // Remove numbered lists
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n') // Reduce multiple line breaks
    .trim();
};

/**
 * SPEND vs ACTIVITY SEPARATION LOGIC:
 * 
 * - ACTIVITY columns (impressions, clicks, GRPs): Used for ALL modeling, features, diagnostics, correlation
 * - SPEND columns (spend, cost, investment): Used ONLY for ROI calculations and budget optimization
 * 
 * This ensures we model media activity effects properly while tracking spend for business ROI.
 */

// Global channel spend cache for consistency across tabs
const channelSpendCache: { [channelName: string]: number } = {};

// Extract spend amount from validation diagnostic string (e.g., "$25M" -> 25000000)
export const parseSpendFromDiagnostic = (spendString: string): number => {
    if (!spendString || spendString === "Activity Only" || spendString === "N/A") {
        return 0;
    }
    
    const match = spendString.match(/\$(\d+(?:\.\d+)?)([kKmM])?/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2]?.toLowerCase();
    
    if (unit === 'k') return value * 1000;
    if (unit === 'm') return value * 1000000;
    return value;
};

// Store validation spend data for use across all tabs
export const cacheChannelSpends = (channelDiagnostics: ChannelDiagnostic[]) => {
    channelDiagnostics.forEach(diagnostic => {
        const extendedDiagnostic = diagnostic as ChannelDiagnostic & { latest52wSpend?: string };
        if (extendedDiagnostic.latest52wSpend) {
            const spendAmount = parseSpendFromDiagnostic(extendedDiagnostic.latest52wSpend);
            if (spendAmount > 0) {
                channelSpendCache[diagnostic.name] = spendAmount;
            }
        }
    });
};

// Get cached spend for a channel, fallback to calculation if not cached
export const getConsistentChannelSpend = (channelName: string, avgActivity?: number): number => {
    // First try to get from cache (validation data)
    if (channelSpendCache[channelName]) {
        return channelSpendCache[channelName];
    }
    
    // Fallback to calculation if not cached
    if (avgActivity !== undefined) {
        return calculateRealisticSpend(channelName, avgActivity, 52);
    }
    
    // Last resort - use default calculation with simulated activity
    const simulatedActivity = 10000; // Default activity level
    return calculateRealisticSpend(channelName, simulatedActivity, 52);
};

// Centralized spend calculation for consistency across all tabs
export const calculateRealisticSpend = (channelName: string, avgActivity: number, periodWeeks: number = 52): number => {
    let baseSpendM = 5; // Default base spend in millions
    
    // Channel-specific realistic annual spend levels for pharma (in millions)
    if (channelName.toLowerCase().includes('tv')) {
        baseSpendM = 25; // TV: $25M+ annually for major pharma
    } else if (channelName.toLowerCase().includes('hcp') && channelName.toLowerCase().includes('call')) {
        baseSpendM = 20; // HCP Calls: $20M+ for sales force
    } else if (channelName.toLowerCase().includes('speaker')) {
        baseSpendM = 5; // Speaker programs: $5M for KOL events
    } else if (channelName.toLowerCase().includes('hcp')) {
        baseSpendM = 4; // Other HCP programs: $3-5M range
    } else if (channelName.toLowerCase().includes('display')) {
        baseSpendM = 6; // Digital display: $6M+ (consumer/DTC)
    } else if (channelName.toLowerCase().includes('search')) {
        baseSpendM = 4; // Search: $4M+ (consumer/DTC)
    }
    
    // Add activity-based variation (±30% based on activity levels)
    const activityVariation = (avgActivity / 10000) * 0.3; // Normalize and scale
    const finalSpendM = baseSpendM * (0.7 + activityVariation);
    
    // Scale by period (default assumes 52 weeks = full year)
    return finalSpendM * (periodWeeks / 52) * 1000000; // Convert millions to dollars
};

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
            // Extract base channel name from both columns
            const activityBase = activityCol.toLowerCase().replace(/_?(impressions?|clicks?|grps?|reach|views?|activity|count|events?|sends?|engagements?)$/i, '');
            const spendBase = spendCol.toLowerCase().replace(/_?(spend|cost|investment)$/i, '');
            
            // More flexible matching for common patterns
            return (
                activityBase === spendBase ||
                activityBase.includes(spendBase) || 
                spendBase.includes(activityBase) ||
                // Handle specific naming patterns like TV_Impressions -> TV_Spend
                activityCol.toLowerCase().replace(/_(impressions?|clicks?|count|events?|sends?|engagements?)$/i, '_spend') === spendCol.toLowerCase() ||
                // Handle patterns like Display_Impressions -> Display_Spend  
                activityBase.replace(/[^a-z]/g, '') === spendBase.replace(/[^a-z]/g, '') ||
                // Handle HCP patterns
                (activityBase.startsWith('hcp') && spendBase.startsWith('hcp') && 
                 activityBase.replace('hcp', '') === spendBase.replace('hcp', ''))
            );
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
        // Use the actual activity column name for features and modeling
        const channelName = pair.activityCol;
        
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
        
        if (pair.spendCol) {
            const spendValues = data.map(row => Number(row[pair.spendCol!]) || 0);
            
            if (data.length >= 52) {
                const recent52w = spendValues.slice(-52).reduce((sum, val) => sum + val, 0);
                
                // Ensure we have a realistic spend value
                if (recent52w > 0) {
                    latest52wSpend = `$${(recent52w / 1000).toFixed(0)}k`;
                } else {
                    // Generate realistic pharmaceutical-level spend based on channel type and activity levels
                    const avgActivity = activityValues.reduce((sum, val) => sum + val, 0) / activityValues.length;
                    const estimatedSpend = calculateRealisticSpend(channelName, avgActivity, 52);
                    latest52wSpend = `$${Math.round(estimatedSpend / 1000)}k`;
                }
                
                if (data.length >= 104) {
                    const prior52w = spendValues.slice(-104, -52).reduce((sum, val) => sum + val, 0);
                    if (recent52w > 0 && prior52w > 0) {
                        const trend = ((recent52w - prior52w) / prior52w) * 100;
                        yoyTrend = `${trend > 0 ? '+' : ''}${trend.toFixed(1)}%`;
                    } else if (recent52w > 0) {
                        // Generate realistic YoY trend based on activity patterns
                        const trendRange = [-15, 25]; // -15% to +25%
                        const randomTrend = trendRange[0] + Math.random() * (trendRange[1] - trendRange[0]);
                        yoyTrend = `${randomTrend > 0 ? '+' : ''}${randomTrend.toFixed(1)}%`;
                    }
                }
            } else {
                // For shorter data periods, still show realistic spend
                const avgActivity = activityValues.reduce((sum, val) => sum + val, 0) / activityValues.length;
                const estimatedSpend = calculateRealisticSpend(channelName, avgActivity, Math.min(data.length, 52));
                latest52wSpend = `$${Math.round(estimatedSpend / 1000)}k`;
            }
        }

        // Generate dynamic, data-driven commentary with modeling insights
        let commentary = "";
        const displayName = pair.name; // Use the friendly display name for commentary
        const channelLower = displayName.toLowerCase();
        
        // Calculate actual metrics for dynamic commentary
        const hasHighSparsity = sparsityPct > 50;
        const hasMediumSparsity = sparsityPct > 20 && sparsityPct <= 50;
        const hasLowSparsity = sparsityPct <= 20;
        const hasHighVolatility = cv > 70;
        const hasMediumVolatility = cv > 40 && cv <= 70;
        const hasLowVolatility = cv <= 40;
        
        // Build base commentary based on actual data patterns
        let baseInsight = "";
        let modelingImplication = "";
        
        if (channelLower.includes('tv')) {
            if (hasHighSparsity && hasHighVolatility) {
                baseInsight = `TV shows ${sparsityPct}% zero periods with ${cv.toFixed(0)}% volatility - highly flighted campaigns targeting specific launch windows.`;
                modelingImplication = " → Model consideration: High adstock (0.7+) needed to capture brand halo effects between flights. Consider 2-3 week lag for full impact measurement.";
            } else if (hasHighVolatility) {
                baseInsight = `TV investment varies by ${cv.toFixed(0)}% weekly, indicating burst strategies during key moments.`;
                modelingImplication = " → Model consideration: Use S-curve transformation to capture saturation at peak spend levels. Monitor for overspending in high-burst periods.";
            } else if (hasLowSparsity && hasLowVolatility) {
                baseInsight = `TV maintains consistent presence with only ${sparsityPct}% gaps and ${cv.toFixed(0)}% variation.`;
                modelingImplication = " → Model consideration: Stable base makes it ideal for baseline estimation. Lower adstock (0.4-0.6) may suffice due to continuous presence.";
            } else {
                baseInsight = `TV shows ${sparsityPct}% zero periods with ${cv.toFixed(0)}% spending variation.`;
                modelingImplication = " → Model consideration: Mixed pattern suggests testing multiple decay rates. Validate carryover against campaign calendar.";
            }
        } else if (channelLower.includes('display')) {
            if (hasHighSparsity) {
                baseInsight = `Display runs in ${100-sparsityPct}% of periods with ${cv.toFixed(0)}% spend volatility - selective targeting strategy.`;
                modelingImplication = " → Model consideration: Sparse data may cause unstable coefficients. Consider aggregating with similar digital channels or using regularization.";
            } else if (hasHighVolatility) {
                baseInsight = `Display shows ${cv.toFixed(0)}% volatility with ${sparsityPct}% downtime - performance-driven optimization in action.`;
                modelingImplication = " → Model consideration: High variation ideal for response curve estimation. Use power or log transformation to capture diminishing returns.";
            } else {
                baseInsight = `Display maintains ${100-sparsityPct}% coverage with ${cv.toFixed(0)}% spend stability.`;
                modelingImplication = " → Model consideration: Consistent signal enables reliable attribution. Test immediate (lag 0) vs short-term (lag 1) response patterns.";
            }
        } else if (channelLower.includes('search') || channelLower.includes('paidsearch')) {
            if (hasLowVolatility) {
                baseInsight = `Search shows remarkably stable investment (${cv.toFixed(0)}% CV) capturing consistent demand.`;
                modelingImplication = " → Model consideration: Low volatility perfect for baseline ROI. Minimal adstock (0.1-0.2) as search is direct response.";
            } else {
                baseInsight = `Search varies by ${cv.toFixed(0)}% with ${sparsityPct}% inactive periods - adaptive bidding strategy.`;
                modelingImplication = " → Model consideration: Volatility helps identify elasticity. Use log transformation and test same-week impact (lag 0).";
            }
        } else if (channelLower.includes('hcp')) {
            if (channelLower.includes('call')) {
                if (hasHighSparsity) {
                    baseInsight = `HCP calls active in ${100-sparsityPct}% of periods with ${cv.toFixed(0)}% effort variation - targeted territory focus.`;
                    modelingImplication = " → Model consideration: Sparse calls may indicate pilot programs. Consider geographic clustering or pooling for stability.";
                } else {
                    baseInsight = `HCP calls show ${sparsityPct}% gaps with ${cv.toFixed(0)}% effort changes - consistent field force deployment.`;
                    modelingImplication = " → Model consideration: Professional detailing has 2-4 week prescription lag. High adstock (0.6+) captures relationship building.";
                }
            } else if (channelLower.includes('email')) {
                baseInsight = `HCP email shows ${sparsityPct}% inactive periods with ${cv.toFixed(0)}% send variation.`;
                modelingImplication = " → Model consideration: Digital HCP has 1-week lag typically. Lower adstock (0.2-0.3) due to inbox saturation effects.";
            } else if (channelLower.includes('social')) {
                baseInsight = `HCP social engagement varies by ${cv.toFixed(0)}% with ${100-sparsityPct}% active weeks.`;
                modelingImplication = " → Model consideration: Social amplification suggests moderate adstock (0.3-0.4). Test interaction effects with other HCP channels.";
            } else {
                baseInsight = `HCP channel shows ${sparsityPct}% downtime with ${cv.toFixed(0)}% activity variation.`;
                modelingImplication = " → Model consideration: Professional channels need longer attribution windows. Consider 2-3 week lags for prescription impact.";
            }
        } else if (channelLower.includes('speaker')) {
            if (hasHighSparsity) {
                baseInsight = `Speaker programs run in ${100-sparsityPct}% of periods - selective high-value KOL events.`;
                modelingImplication = " → Model consideration: Sporadic but high-impact. Use high adstock (0.7-0.9) for long-term influence. May need 3-4 week lag.";
            } else {
                baseInsight = `Speaker programs show ${cv.toFixed(0)}% variation across ${100-sparsityPct}% active periods.`;
                modelingImplication = " → Model consideration: Regular programs build cumulative credibility. S-curve captures event capacity constraints.";
            }
        } else {
            // Generic channel with data-driven insights
            if (hasHighSparsity && hasHighVolatility) {
                baseInsight = `Channel active only ${100-sparsityPct}% of time with ${cv.toFixed(0)}% spend swings - highly tactical execution.`;
                modelingImplication = " → Model consideration: Sparse, volatile data challenges modeling. Consider grouping with similar channels or using Bayesian priors for stability.";
            } else if (hasHighSparsity) {
                baseInsight = `Channel shows ${sparsityPct}% zero periods - flighted campaign strategy with focused bursts.`;
                modelingImplication = " → Model consideration: Gaps between flights require careful adstock tuning. Test 0.5-0.7 range to bridge campaign periods.";
            } else if (hasHighVolatility) {
                baseInsight = `Channel volatility at ${cv.toFixed(0)}% indicates dynamic optimization based on performance.`;
                modelingImplication = " → Model consideration: High variance excellent for response curve fitting. Use flexible transformations (power/s-curve).";
            } else if (hasLowSparsity && hasLowVolatility) {
                baseInsight = `Channel maintains steady presence - ${sparsityPct}% gaps, ${cv.toFixed(0)}% variation showing disciplined execution.`;
                modelingImplication = " → Model consideration: Stable signal ideal for MMM. Can reliably estimate both base and incremental effects.";
            } else {
                baseInsight = `Channel shows ${sparsityPct}% inactive periods with ${cv.toFixed(0)}% spending variation.`;
                modelingImplication = " → Model consideration: Moderate pattern allows standard MMM approaches. Test multiple transformation types for best fit.";
            }
        }
        
        commentary = baseInsight + modelingImplication;

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

    // Generate dynamic summaries based on actual data patterns
    const avgKpi = trendData.reduce((sum, point) => sum + point.kpi, 0) / trendData.length;
    const recentKpi = trendData.slice(-13).reduce((sum, point) => sum + point.kpi, 0) / 13;
    const trendPercentage = ((recentKpi - avgKpi) / avgKpi * 100);
    
    // Calculate additional trend metrics for richer insights
    const maxKpi = Math.max(...trendData.map(d => d.kpi));
    const minKpi = Math.min(...trendData.map(d => d.kpi));
    const range = maxKpi - minKpi;
    const volatility = (range / avgKpi) * 100;
    
    // Detect trend direction over last quarter
    const q1Avg = trendData.slice(-13, -9).reduce((sum, p) => sum + p.kpi, 0) / 4;
    const q2Avg = trendData.slice(-9, -5).reduce((sum, p) => sum + p.kpi, 0) / 4;
    const q3Avg = trendData.slice(-5).reduce((sum, p) => sum + p.kpi, 0) / Math.min(5, trendData.slice(-5).length);
    const isAccelerating = q3Avg > q2Avg && q2Avg > q1Avg;
    const isDecelerating = q3Avg < q2Avg && q2Avg < q1Avg;
    
    let trendsSummary = "";
    if (Math.abs(trendPercentage) < 5 && volatility < 20) {
        trendsSummary = `${kpiCol} shows remarkable stability with ${avgKpi.toFixed(0)} weekly average and only ${volatility.toFixed(1)}% range variation. This consistency (${trendPercentage > 0 ? '+' : ''}${trendPercentage.toFixed(1)}% recent trend) indicates mature market dynamics with predictable baseline, ideal for MMM coefficient estimation.`;
    } else if (trendPercentage > 15) {
        if (isAccelerating) {
            trendsSummary = `${kpiCol} demonstrates accelerating growth momentum - ${trendPercentage.toFixed(1)}% above baseline with sequential quarterly improvements. Latest performance (${recentKpi.toFixed(0)} weekly avg) suggests successful market capture. Peak at ${maxKpi.toFixed(0)} shows upside potential still available.`;
        } else {
            trendsSummary = `${kpiCol} shows strong ${trendPercentage.toFixed(1)}% growth vs baseline (${avgKpi.toFixed(0)} historical avg). Recent performance averaging ${recentKpi.toFixed(0)} weekly with ${volatility.toFixed(1)}% volatility range. Growth pattern indicates effective media mix driving incremental volume.`;
        }
    } else if (trendPercentage > 0) {
        trendsSummary = `${kpiCol} trending positively at ${trendPercentage.toFixed(1)}% above ${avgKpi.toFixed(0)} baseline. Current ${recentKpi.toFixed(0)} weekly average with ${volatility.toFixed(1)}% volatility suggests stable growth trajectory. Range from ${minKpi.toFixed(0)} to ${maxKpi.toFixed(0)} provides good variance for response curve fitting.`;
    } else if (trendPercentage < -10) {
        if (isDecelerating) {
            trendsSummary = `${kpiCol} facing sustained pressure with ${Math.abs(trendPercentage).toFixed(1)}% decline and accelerating downward trend. Current ${recentKpi.toFixed(0)} vs ${avgKpi.toFixed(0)} historical average signals urgent optimization need. High ${volatility.toFixed(1)}% volatility suggests unstable market conditions.`;
        } else {
            trendsSummary = `${kpiCol} declined ${Math.abs(trendPercentage).toFixed(1)}% from ${avgKpi.toFixed(0)} baseline to current ${recentKpi.toFixed(0)} weekly average. Performance range ${minKpi.toFixed(0)}-${maxKpi.toFixed(0)} with ${volatility.toFixed(1)}% volatility indicates optimization opportunities through media mix refinement.`;
        }
    } else {
        trendsSummary = `${kpiCol} relatively flat with ${Math.abs(trendPercentage).toFixed(1)}% variance from ${avgKpi.toFixed(0)} baseline. Current performance at ${recentKpi.toFixed(0)} weekly with ${volatility.toFixed(1)}% range volatility. Stable but uninspiring trend suggests need for strategic media mix evolution.`;
    }
    
    // Dynamic channel health assessment
    const activeChannels = channelDiagnostics.filter(d => {
        const sparsityNum = parseInt(d.sparsity.replace('% zeros', ''));
        return sparsityNum < 100;
    });
    
    const sparseChannels = activeChannels.filter(d => {
        const sparsityNum = parseInt(d.sparsity.replace('% zeros', ''));
        return sparsityNum > 50;
    });
    
    const volatileChannels = activeChannels.filter(d => {
        const cvMatch = d.volatility.match(/(\d+\.?\d*)/);
        const cv = cvMatch ? parseFloat(cvMatch[1]) : 0;
        return cv > 70;
    });
    
    const stableChannels = activeChannels.filter(d => {
        const sparsityNum = parseInt(d.sparsity.replace('% zeros', ''));
        const cvMatch = d.volatility.match(/(\d+\.?\d*)/);
        const cv = cvMatch ? parseFloat(cvMatch[1]) : 0;
        return sparsityNum < 20 && cv < 40;
    });
    
    let diagnosticsSummary = "";
    
    if (activeChannels.length === 0) {
        diagnosticsSummary = `Critical data issue: No active marketing channels detected. Please verify data upload and column mappings.`;
    } else if (sparseChannels.length > activeChannels.length * 0.5) {
        diagnosticsSummary = `Data shows ${activeChannels.length} channels but ${sparseChannels.length} have >50% zero periods, indicating highly flighted campaigns. This sparsity pattern requires careful modeling with regularization and potentially channel pooling for stable coefficients. Consider testing Bayesian methods for sparse data handling.`;
    } else if (volatileChannels.length > activeChannels.length * 0.5) {
        diagnosticsSummary = `Marketing mix includes ${activeChannels.length} channels with ${volatileChannels.length} showing >70% volatility. High variation excellent for response curve estimation but may indicate unstable spending patterns. Recommend testing multiple saturation curves and validating against known campaign calendars.`;
    } else if (stableChannels.length > activeChannels.length * 0.7) {
        diagnosticsSummary = `Exceptional data quality with ${activeChannels.length} channels, ${stableChannels.length} showing stable patterns (<20% sparsity, <40% CV). This consistency enables robust MMM with reliable attribution. Low noise ideal for detecting incremental effects and interaction terms.`;
    } else {
        diagnosticsSummary = `Balanced marketing dataset with ${activeChannels.length} active channels: ${stableChannels.length} stable, ${sparseChannels.length} flighted, ${volatileChannels.length} dynamic. Mixed patterns provide good signal diversity for MMM while requiring channel-specific transformation strategies.`;
    }

    const insights = {
        trendData,
        trendsSummary,
        diagnosticsSummary,
        channelDiagnostics: channelDiagnostics as ChannelDiagnostic[]
    };
    
    // Cache the spend data for consistency across tabs
    cacheChannelSpends(insights.channelDiagnostics);
    
    return insights;
};

// Generate realistic feature engineering recommendations (activity channels only)
export const generateDemoFeatures = (approvedActivityChannels: string[]): FeatureParams[] => {
    const channelDefaults: { [key: string]: { adstock: { min: number; max: number }; lag: { min: number; max: number }; transform: string; rationale: string } } = {
        'TV': { 
            adstock: { min: 0.5, max: 0.8 }, 
            lag: { min: 0, max: 2 }, 
            transform: 'S-Curve', 
            rationale: cleanupResponse(`Why 0.5-0.8 adstock range: TV builds brand awareness with 3-6 week persistence. Range allows testing immediate vs sustained carryover effects.
Why 0-2 week lag range: Captures immediate awareness through delayed purchase behavior patterns.
Watchout: If TV is heavily flighted, narrow adstock range to 0.4-0.6 to avoid overestimating carryover during off-periods.`)
        },
        'Display': { 
            adstock: { min: 0.2, max: 0.5 }, 
            lag: { min: 0, max: 2 }, 
            transform: 'Negative Exponential', 
            rationale: cleanupResponse(`Why 0.2-0.5 adstock range: Display ads show moderate brand recall, testing 1-3 week persistence patterns.
Why 0-2 week lag range: Click-to-conversion journey varies from immediate to consideration periods.
Watchout: High frequency campaigns may show fatigue - if range includes negative coefficients, consider upper bound reduction.`)
        },
        'PaidSearch': { 
            adstock: { min: 0.0, max: 0.2 }, 
            lag: { min: 0, max: 1 }, 
            transform: 'Log-transform', 
            rationale: cleanupResponse(`Why 0.0-0.2 adstock range: Search is intent-driven with minimal carryover, testing immediate vs short-term brand effects.
Why 0-1 week lag range: Same-session conversions vs brief consideration periods for high-value items.
Watchout: Brand vs non-brand keywords behave differently. Consider separate parameter ranges if you have the data.`)
        },
        'HCPCalls': { 
            adstock: { min: 0.4, max: 0.7 }, 
            lag: { min: 1, max: 3 }, 
            transform: 'S-Curve', 
            rationale: cleanupResponse(`Why 0.4-0.7 adstock range: Face-to-face HCP interactions build relationships with 3-6 week persistence variability.
Why 1-3 week lag range: Prescription decisions happen at next patient visits with varying appointment schedules.
Watchout: If call frequency is low, consider 0.6-0.8 range to bridge longer gaps between interactions.`)
        },
        'Speaker': { 
            adstock: { min: 0.6, max: 0.9 }, 
            lag: { min: 2, max: 5 }, 
            transform: 'S-Curve', 
            rationale: cleanupResponse(`Why 0.6-0.9 adstock range: KOL events create lasting credibility with 4-8+ week influence variability.
Why 2-5 week lag range: HCPs need varying time to absorb clinical data and change prescribing behavior.
Watchout: Sporadic events may cause instability - if range shows inconsistent coefficients, consider aggregating with other HCP channels.`)
        },
        'HCPEmail': { 
            adstock: { min: 0.1, max: 0.3 }, 
            lag: { min: 0, max: 2 }, 
            transform: 'Log-transform', 
            rationale: cleanupResponse(`Why 0.1-0.3 adstock range: Email impact decays quickly, testing 1-2 week persistence patterns.
Why 0-2 week lag range: HCP email checking patterns vary from immediate to periodic review.
Watchout: Open rates affect exposure - if you have engagement data, consider using opens instead of sends for better parameter stability.`)
        },
        'HCPSocial': { 
            adstock: { min: 0.2, max: 0.4 }, 
            lag: { min: 0, max: 2 }, 
            transform: 'Log-transform', 
            rationale: cleanupResponse(`Why 0.2-0.4 adstock range: Social content persistence varies with shares and professional discussions.
Why 0-2 week lag range: Content circulation time varies in professional networks.
Watchout: Engagement quality varies widely. Range helps capture high vs low impact content patterns.`)
        }
    };

    return approvedActivityChannels.map(channel => {
        const baseChannel = Object.keys(channelDefaults).find(key => 
            channel.toLowerCase().includes(key.toLowerCase())
        );
        
        const defaults = baseChannel ? channelDefaults[baseChannel] : {
            adstock: { min: 0.1, max: 0.4 },
            lag: { min: 0, max: 1 },
            transform: 'Log-transform',
            rationale: cleanupResponse(`Why 0.1-0.4 adstock range: Assuming moderate carryover typical of digital channels with 1-3 week persistence testing.
Why 0-1 week lag range: Default immediate to brief consideration period. Adjust based on business knowledge.
Watchout: Generic ranges may not capture channel-specific behavior. Monitor model fit and narrow ranges based on coefficient stability.`)
        };

        return {
            channel,
            ...defaults
        } as FeatureParams;
    });
};

// Generate validated active model responses with DTO normalization
export const generateValidatedActiveModels = async (activityChannels: string[], userSelections?: UserColumnSelection, userContext?: string, featureParams?: FeatureParams[], channelDiagnostics?: ChannelDiagnostic[]): Promise<{ complete: ActiveModelResponse[], incomplete: string[] }> => {
    const rawModels = generateDemoModels(activityChannels, userSelections, userContext, featureParams, channelDiagnostics);
    const completeModels: ActiveModelResponse[] = [];
    const incompleteModelIds: string[] = [];
    
    // Convert and validate each model
    for (const model of rawModels) {
        try {
            const { metadata, contributions, diagnostics } = convertModelRunToDTO(model);
            const validation = validateModelData(model.id, contributions, diagnostics);
            
            const activeModel: ActiveModelResponse = {
                metadata,
                contributions,
                diagnostics,
                is_complete: validation.is_complete,
                validation_errors: validation.errors.length > 0 ? validation.errors : undefined
            };
            
            if (validation.is_complete) {
                completeModels.push(activeModel);
            } else {
                incompleteModelIds.push(model.id);
                console.warn(`[DemoSimulation] Model ${model.id} failed validation:`, validation.errors);
            }
        } catch (error) {
            console.error(`[DemoSimulation] Failed to convert model ${model.id}:`, error);
            incompleteModelIds.push(model.id);
        }
    }
    
    return { complete: completeModels, incomplete: incompleteModelIds };
};

// Generate realistic model leaderboard with believable performance metrics (activity channels only)
export const generateDemoModels = (activityChannels: string[], userSelections?: UserColumnSelection, userContext?: string, featureParams?: FeatureParams[], channelDiagnostics?: ChannelDiagnostic[]): ModelRun[] => {
    console.log('[generateDemoModels] Called with:', {
        activityChannels,
        userContext,
        featureParamsCount: featureParams?.length || 0,
        channelDiagnosticsCount: channelDiagnostics?.length || 0
    });
    
    const models: ModelRun[] = [];
    let modelCounter = 1;
    
    // Extract context from user selections
    const kpiCol = userSelections ? Object.keys(userSelections).find(k => userSelections[k] === ColumnType.DEPENDENT_VARIABLE) : null;
    const geoCol = userSelections ? Object.keys(userSelections).find(k => userSelections[k] === ColumnType.GEO_DIMENSION) : null;
    
    // Create a function to get actual spend for a channel from validation diagnostics
    const getActualSpendForChannel = (channelName: string): number => {
        if (!channelDiagnostics) return 0;
        
        const diagnostic = channelDiagnostics.find(d => d.name === channelName);
        if (!diagnostic) return 0;
        
        const extendedDiagnostic = diagnostic as ChannelDiagnostic & { latest52wSpend?: string };
        if (!extendedDiagnostic.latest52wSpend) return 0;
        
        return parseSpendFromDiagnostic(extendedDiagnostic.latest52wSpend);
    };
    
    // Algorithm-specific configurations
    const algoConfigs = [
        {
            name: 'GLM Regression',
            variants: 4,
            rsqRange: [0.78, 0.92],
            mapeRange: [7, 15],
            hasPValues: true,
            commentary: (r2: number, mape: number, kpiCol?: string, featureParams?: FeatureParams[], userContext?: string) => {
                let base = `Linear regression with statistical significance testing${kpiCol ? ` for ${kpiCol} prediction` : ''}. Strong interpretability with R² = ${(r2*100).toFixed(1)}% and ${mape.toFixed(1)}% MAPE.`;
                
                // Add user instruction feedback
                if (featureParams && featureParams.length > 0) {
                    const highAdstockChannels = featureParams.filter(f => f.adstock.max > 0.6);
                    const lowLagChannels = featureParams.filter(f => f.lag.min === 0);
                    
                    if (highAdstockChannels.length > 0) {
                        base += ` ✓ Following your high adstock ranges (${highAdstockChannels.map(f => f.channel).join(', ')}) for carryover modeling.`;
                    }
                    if (lowLagChannels.length > 0) {
                        base += ` ✓ Respecting your immediate-impact channel ranges (${lowLagChannels.slice(0,2).map(f => f.channel).join(', ')}).`;
                    }
                }
                
                if (userContext && userContext.toLowerCase().includes('conservative')) {
                    base += ' ✓ Aligned with your conservative modeling approach.';
                }
                
                return base;
            }
        },
        {
            name: 'Bayesian Regression',
            variants: 3,
            rsqRange: [0.76, 0.89],
            mapeRange: [8, 16],
            hasPValues: true,
            commentary: (r2: number, mape: number, kpiCol?: string, featureParams?: FeatureParams[], userContext?: string) => {
                let base = `Bayesian approach with uncertainty quantification${kpiCol ? ` for ${kpiCol} modeling` : ''}. R² = ${(r2*100).toFixed(1)}% with ${mape.toFixed(1)}% MAPE.`;
                
                if (featureParams) {
                    const sCurveChannels = featureParams.filter(f => f.transform === 'S-Curve');
                    if (sCurveChannels.length > 0) {
                        base += ` ✓ Modeling your S-Curve transforms (${sCurveChannels.slice(0,2).map(f => f.channel).join(', ')}) with Bayesian priors.`;
                    }
                }
                
                return base + ' Excellent for handling parameter uncertainty.';
            }
        },
        {
            name: 'LightGBM',
            variants: 4,
            rsqRange: [0.82, 0.94],
            mapeRange: [5, 12],
            hasPValues: false,
            commentary: (r2: number, mape: number, kpiCol?: string, featureParams?: FeatureParams[], userContext?: string) => {
                let base = `Gradient boosting with feature importance${kpiCol ? ` for ${kpiCol} optimization` : ''}. Superior performance: R² = ${(r2*100).toFixed(1)}% and ${mape.toFixed(1)}% MAPE.`;
                
                if (featureParams) {
                    const powerChannels = featureParams.filter(f => f.transform === 'Power');
                    if (powerChannels.length > 0) {
                        base += ` ✓ Your Power transforms (${powerChannels.slice(0,2).map(f => f.channel).join(', ')}) work excellently with tree-based learning.`;
                    }
                }
                
                if (userContext && userContext.toLowerCase().includes('performance')) {
                    base += ' ✓ Maximizing predictive accuracy as requested.';
                }
                
                return base + ' Captures complex saturation patterns automatically.';
            }
        },
        {
            name: 'NN',
            variants: 3,
            rsqRange: [0.79, 0.91],
            mapeRange: [6, 14],
            hasPValues: false,
            commentary: (r2: number, mape: number, kpiCol?: string, featureParams?: FeatureParams[], userContext?: string) => {
                let base = `Neural network with regularization${kpiCol ? ` for ${kpiCol} prediction` : ''}. R² = ${(r2*100).toFixed(1)}% and ${mape.toFixed(1)}% MAPE.`;
                
                if (featureParams) {
                    const highLagChannels = featureParams.filter(f => f.lag >= 2);
                    if (highLagChannels.length > 0) {
                        base += ` ✓ Neural layers effectively capture your lag settings (${highLagChannels.slice(0,2).map(f => f.channel).join(', ')}).`;
                    }
                }
                
                return base + ' Excellent at modeling complex channel interactions.';
            }
        }
    ];

    console.log('[generateDemoModels] Processing algorithm configs:', {
        configCount: algoConfigs.length,
        configs: algoConfigs.map(c => ({ name: c.name, variants: c.variants }))
    });
    
    algoConfigs.forEach(config => {
        console.log(`[generateDemoModels] Processing ${config.name} with ${config.variants} variants`);
        for (let variant = 1; variant <= config.variants; variant++) {
            // Create realistic performance variation within algorithm family
            const rsqVariation = Math.random() * (config.rsqRange[1] - config.rsqRange[0]) + config.rsqRange[0];
            const mapeVariation = Math.random() * (config.mapeRange[1] - config.mapeRange[0]) + config.mapeRange[0];
            
            // Generate channel details with algorithm-specific characteristics
            const channelDetails = activityChannels.map((channel, i) => {
                const baseContrib = 0.12 + (Math.random() * 0.28); // 12% to 40%
                let efficiency = 1.1 + (Math.random() * 2.0); // $1.10 to $3.10 ROI
                
                // Algorithm-specific efficiency adjustments
                if (config.name === 'LightGBM') {
                    efficiency *= 1.05; // Slightly better at capturing efficiency
                } else if (config.name === 'GLM Regression') {
                    efficiency *= 0.97; // More conservative estimates
                }
                
                return {
                    channel,
                    contribution: baseContrib,
                    efficiency: efficiency,
                    confidenceInterval: [efficiency * 0.8, efficiency * 1.2]
                };
            });

            // Normalize contributions to sum to realistic total (75-85%)
            const totalContrib = channelDetails.reduce((sum, ch) => sum + ch.contribution, 0);
            const targetTotal = 0.75 + Math.random() * 0.10; // 75-85%
            channelDetails.forEach(ch => ch.contribution = (ch.contribution / totalContrib) * targetTotal);

            // Calculate blended ROI from channel efficiencies  
            const blendedRoi = channelDetails.reduce((sum, ch) => {
                return sum + (ch.efficiency * ch.contribution);
            }, 0) / channelDetails.reduce((sum, ch) => sum + ch.contribution, 0);

            // Generate algorithm-appropriate model details using user's feature parameters when available
            const modelDetails = channelDetails.map(ch => {
                // Find user's feature settings for this channel
                const userFeature = featureParams?.find(fp => fp.channel === ch.channel);
                
                // Generate specific parameter values from ranges
                let chosenAdstock: number;
                let chosenLag: number;
                
                if (userFeature) {
                    // Sample from within the user-specified ranges
                    const adstockRange = userFeature.adstock.max - userFeature.adstock.min;
                    chosenAdstock = userFeature.adstock.min + Math.random() * adstockRange;
                    
                    const lagRange = userFeature.lag.max - userFeature.lag.min;
                    chosenLag = Math.round(userFeature.lag.min + Math.random() * lagRange);
                } else {
                    // Default fallback values
                    chosenAdstock = 0.2 + Math.random() * 0.6;
                    chosenLag = Math.floor(Math.random() * 4);
                }
                
                return {
                    name: ch.channel,
                    included: Math.random() > 0.15, // 85% inclusion rate (some models exclude weak channels)
                    contribution: ch.contribution * 100, // Convert to percentage
                    roi: ch.efficiency,
                    pValue: config.hasPValues ? Math.random() * 0.12 : null, // Only stats models have p-values
                    // Use chosen parameter values within user's specified ranges
                    adstock: Math.round(chosenAdstock * 100) / 100, // Round to 2 decimals
                    lag: chosenLag,
                    transform: userFeature ? userFeature.transform : ['Log-transform', 'S-Curve', 'Power', 'Negative Exponential'][Math.floor(Math.random() * 4)] as any
                };
            });

            // Generate realistic diagnostics
            const generateDiagnostics = (details: any[], algoName: string, rsq: number, mape: number) => {
                const channelDiagnostics = details.map(detail => {
                    const isStatModel = algoName.includes('Regression') || algoName.includes('Bayesian');
                    const baseCoeff = (Math.random() - 0.5) * 2; // -1 to 1
                    const stderr = isStatModel ? Math.abs(baseCoeff) * (0.1 + Math.random() * 0.3) : undefined;
                    const pValue = isStatModel ? Math.random() * 0.2 : null; // 0 to 0.2
                    
                    // Expected vs actual sign logic
                    const expectedSigns = ['TV', 'Display', 'Search', 'Social'].includes(detail.name) ? 'positive' : 'positive';
                    const actualSign = baseCoeff > 0.1 ? 'positive' : baseCoeff < -0.1 ? 'negative' : 'neutral';
                    
                    return {
                        name: detail.name,
                        coefficient: isStatModel ? baseCoeff : undefined,
                        stderr: stderr,
                        pValue: pValue,
                        confidence_interval: isStatModel && stderr ? [baseCoeff - 1.96 * stderr, baseCoeff + 1.96 * stderr] as [number, number] : undefined,
                        expected_sign: expectedSigns,
                        actual_sign: actualSign,
                        sign_mismatch: expectedSigns !== actualSign,
                        importance: !isStatModel ? Math.random() : undefined,
                        top_driver_rank: !isStatModel ? Math.floor(Math.random() * details.length) + 1 : undefined
                    };
                });
                
                // Identify issues
                const weakChannels = channelDiagnostics.filter(d => 
                    (d.pValue !== null && d.pValue > 0.1) || 
                    (d.confidence_interval && d.confidence_interval[0] <= 0 && d.confidence_interval[1] >= 0) ||
                    (d.importance !== undefined && d.importance < 0.1)
                ).map(d => d.name);
                
                const signMismatchChannels = channelDiagnostics.filter(d => d.sign_mismatch).map(d => d.name);
                const overfitRisk = rsq > 0.9 && mape > 15; // High R² but poor MAPE
                
                return {
                    weak_channels: weakChannels,
                    sign_mismatch: signMismatchChannels,
                    overfit_risk: overfitRisk,
                    warning_count: weakChannels.length + signMismatchChannels.length + (overfitRisk ? 1 : 0),
                    channel_diagnostics: channelDiagnostics
                };
            };

            // Generate provenance hashes
            const featuresHash = JSON.stringify(activityChannels.sort()).slice(0, 8);
            const rangesHash = featureParams ? JSON.stringify(featureParams.map(f => ({ channel: f.channel, adstock: f.adstock, lag: f.lag, transform: f.transform })).sort((a, b) => a.channel.localeCompare(b.channel))).slice(0, 8) : 'default';
            
            const modelDiagnostics = generateDiagnostics(modelDetails, config.name, rsqVariation, mapeVariation);
            
            const newModel = {
                id: `${config.name.toLowerCase().replace(/\s+/g, '_')}_${variant}`,
                algo: config.name as 'Bayesian Regression' | 'NN' | 'LightGBM' | 'GLM Regression',
                rsq: rsqVariation,
                mape: mapeVariation,
                roi: blendedRoi,
                commentary: config.commentary(rsqVariation, mapeVariation, kpiCol || undefined, featureParams, userContext),
                details: modelDetails,
                channels: [...activityChannels], // Copy of selected channels
                provenance: {
                    features_hash: featuresHash,
                    ranges_hash: rangesHash,
                    algo: config.name,
                    data_version: 'demo_v1',
                    timestamp: Date.now(),
                    seed: Math.floor(Math.random() * 10000)
                },
                diagnostics: modelDiagnostics,
                isNew: false, // Will be set to true for newly generated models
                isPinned: false,
                isStale: false
            } as ModelRun;
            
            console.log(`[generateDemoModels] Pushing model ${newModel.id} with channels:`, newModel.channels);
            models.push(newModel);
            
            modelCounter++;
        }
    });
    
    console.log('[generateDemoModels] Generated models before sorting:', {
        count: models.length,
        sampleIds: models.slice(0, 3).map(m => m.id)
    });

    // Sort by performance (R² desc, then MAPE asc)
    const sortedModels = models.sort((a, b) => {
        if (Math.abs(a.rsq - b.rsq) > 0.02) return b.rsq - a.rsq;
        return a.mape - b.mape;
    });
    
    console.log('[generateDemoModels] Returning sorted models:', {
        count: sortedModels.length,
        sampleIds: sortedModels.slice(0, 3).map(m => m.id)
    });
    
    return sortedModels;
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

        const channels = activityChannels.map(channelName => ({
            name: channelName,
            currentSpend: allocations[channelName] || 0,
            recommendedSpend: allocations[channelName] || 0,
            change: 0,
            projectedROI: projectedROI,
            agentCommentary: `Optimized allocation for ${channelName}`
        }));

        return {
            id: `scenario_${index}`,
            title: scenario.name,
            recommendedSpend: totalBudget,
            projectedROI,
            netRevenue: projectedRevenue,
            channels
        };
    });
};