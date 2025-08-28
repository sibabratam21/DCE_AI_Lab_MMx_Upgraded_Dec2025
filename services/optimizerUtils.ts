import { ModelRun, OptimizerScenario, OptimizerScenarioChannel } from '../types';
import { getConsistentChannelSpend } from './demoSimulation';

const getAgentCommentary = (channelName: string, scenarioKey: string): string => {
    const commentaries: Record<string, Record<string, string>> = {
        maximizeROI: {
            "TV_Impressions": "Forward-looking signals show high engagement. Increasing spend to capture strong mROI before saturation.",
            "Digital_Clicks": "Performance KPIs show this channel is near saturation. Recommending a 15% budget reallocation to more efficient channels.",
            "Default": "Reallocating budget towards this channel based on its high marginal ROI."
        },
        maximizeContrib: {
            "TV_Impressions": "Increasing budget to saturation point to maximize reach and contribution, accepting a lower ROI.",
            "Search_Spend": "Aggressively increasing spend to capture all available volume for growth, despite diminishing returns.",
            "Default": "Increasing spend to drive maximum volume contribution, a key goal of this scenario."
        },
        balanced: {
            "TV_Impressions": "Optimized budget increase, balancing its strong mROI with the need to fund other channels.",
            "Search_Spend": "High executional costs (CPCs) are compressing ROI. A slight reduction frees up budget for more efficient tactics.",
            "Default": "Spend adjusted to balance its performance KPIs with overall portfolio efficiency."
        }
    };
    const keyMap: { [key: string]: string } = {
        'Efficiency-First Strategy': 'maximizeROI',
        'Growth Acceleration Plan': 'maximizeContrib',
        'Balanced Portfolio Strategy': 'balanced'
    };
    const internalKey = keyMap[scenarioKey] || 'balanced';
    return commentaries[internalKey][channelName] || commentaries[internalKey]['Default'];
};


const generateScenario = (
    model: ModelRun, 
    id: string,
    title: string, 
    spendMultiplierProfile: (roi: number) => number,
    overallSpendMultiplier: number,
    roiAdjustment: number
): OptimizerScenario => {
    
    const channels: OptimizerScenarioChannel[] = model.details
        .filter(p => p.included)
        .map(p => {
            // Use consistent spend calculation that matches validation tab
            const currentSpend = getConsistentChannelSpend(p.name) / 1000000; // Convert to M for display
            const spendMultiplier = spendMultiplierProfile(p.roi);
            const recommendedSpend = currentSpend * spendMultiplier;
            const change = recommendedSpend === 0 && currentSpend === 0 ? 0 : ((recommendedSpend - currentSpend) / currentSpend) * 100;

            return {
                name: p.name,
                currentSpend: currentSpend, // Already in millions from /1000000 above
                recommendedSpend: recommendedSpend, // Already in millions 
                change,
                projectedROI: p.roi * (1 + roiAdjustment + (spendMultiplier - 1) * 0.1),
                agentCommentary: getAgentCommentary(p.name, title)
            };
        });

    const recommendedSpend = channels.reduce((sum, ch) => sum + ch.recommendedSpend, 0);
    const totalCurrentSpend = channels.reduce((sum, ch) => sum + ch.currentSpend, 0);
    const projectedROI = model.roi + roiAdjustment;
    const netRevenue = recommendedSpend * (projectedROI - 1);

    return {
        id,
        title,
        recommendedSpend,
        projectedROI,
        netRevenue,
        channels
    };
};


export const generateInitialScenarios = (model: ModelRun): OptimizerScenario[] => {
    const scenarios: OptimizerScenario[] = [];

    // Scenario 1: Efficiency-First Strategy
    scenarios.push(generateScenario(
        model,
        'efficiency_focus',
        'Efficiency-First Strategy',
        (roi) => (roi > model.roi * 1.1 ? 1.5 : roi < model.roi * 0.9 ? 0.5 : 0.8),
        0.9,
        0.15
    ));

    // Scenario 2: Growth Acceleration Plan
    scenarios.push(generateScenario(
        model,
        'growth_acceleration',
        'Growth Acceleration Plan',
        (roi) => (roi > model.roi * 0.5 ? 1.5 : 1.1),
        1.2,
        -0.1
    ));
    
    // Scenario 3: Balanced Portfolio Strategy
    scenarios.push(generateScenario(
        model,
        'balanced_portfolio',
        'Balanced Portfolio Strategy',
        (roi) => (roi > model.roi * 1.1 ? 1.25 : roi < model.roi * 0.9 ? 0.75 : 1.0),
        1.05,
        0.05
    ));

    return scenarios;
};