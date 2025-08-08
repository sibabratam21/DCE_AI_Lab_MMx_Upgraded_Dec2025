import { AppStep, AgentMessage } from '../types';

// Enhanced Agent Types for more conversational and agentic behavior
export interface AgentPersonality {
    name: string;
    expertise: string[];
    conversationStyle: 'friendly' | 'expert' | 'enthusiastic' | 'analytical';
    proactiveLevel: 'low' | 'medium' | 'high';
}

export interface AgentMemory {
    userPreferences: Record<string, any>;
    previousDecisions: Array<{
        step: AppStep;
        decision: string;
        rationale: string;
        timestamp: Date;
    }>;
    insights: Array<{
        type: 'observation' | 'recommendation' | 'warning';
        content: string;
        relevance: AppStep[];
        timestamp: Date;
    }>;
    conversationContext: {
        topics: string[];
        userExpertiseLevel: 'beginner' | 'intermediate' | 'expert';
        communicationPreference: 'detailed' | 'concise' | 'visual';
    };
}

export interface ProactiveAction {
    id: string;
    type: 'suggestion' | 'warning' | 'optimization' | 'insight';
    priority: 'low' | 'medium' | 'high';
    message: string;
    actionButton?: {
        text: string;
        action: () => void;
    };
    dismissible: boolean;
}

export interface AgentInsight {
    id: string;
    type: 'data_quality' | 'model_performance' | 'business_recommendation' | 'process_optimization';
    title: string;
    description: string;
    confidence: number; // 0-1
    impact: 'low' | 'medium' | 'high';
    suggestedActions: string[];
    relatedSteps: AppStep[];
}

export interface EnhancedAgentMessage extends AgentMessage {
    personality?: AgentPersonality;
    proactiveActions?: ProactiveAction[];
    insights?: AgentInsight[];
    emotionalTone?: 'neutral' | 'excited' | 'concerned' | 'confident' | 'encouraging';
}

// Default Agent Personality
export const defaultAgentPersonality: AgentPersonality = {
    name: "Maya",
    expertise: ["Marketing Mix Modeling", "Statistical Analysis", "Marketing Strategy", "Budget Optimization"],
    conversationStyle: "friendly",
    proactiveLevel: "high"
};

// Agent personality prompts for different conversation styles
export const personalityPrompts = {
    friendly: "You are Maya, a friendly and approachable Marketing Mix Modeling expert. You communicate with warmth and enthusiasm, using conversational language while maintaining professional expertise. You're genuinely excited to help users discover insights in their data and often use encouraging language.",
    
    expert: "You are Maya, a seasoned MMM expert with deep statistical and marketing knowledge. You communicate with technical precision and confidence, providing detailed explanations and industry best practices. You cite specific methodologies and share advanced insights.",
    
    enthusiastic: "You are Maya, an energetic and passionate MMM specialist who gets genuinely excited about data insights and optimization opportunities. You use exclamation points, express amazement at interesting findings, and are eager to explore every aspect of the analysis.",
    
    analytical: "You are Maya, a methodical and detail-oriented MMM analyst. You approach problems systematically, explain your reasoning step-by-step, and focus on statistical rigor and data quality. You're thorough in your explanations and highlight potential limitations."
};

// Generate contextual system prompts based on agent memory and current step
export const generateContextualPrompt = (
    basePrompt: string,
    personality: AgentPersonality,
    memory: AgentMemory,
    currentStep: AppStep
): string => {
    const personalityPrompt = personalityPrompts[personality.conversationStyle];
    const expertiseContext = `Your expertise includes: ${personality.expertise.join(', ')}.`;
    
    const memoryContext = memory.previousDecisions.length > 0 
        ? `Based on previous interactions, the user has shown ${memory.conversationContext.userExpertiseLevel} level expertise and prefers ${memory.conversationContext.communicationPreference} communication.`
        : '';
    
    const relevantInsights = memory.insights
        .filter(insight => insight.relevance.includes(currentStep))
        .map(insight => `- ${insight.content}`)
        .join('\n');
    
    const insightsContext = relevantInsights 
        ? `Key insights relevant to this step:\n${relevantInsights}\n` 
        : '';
    
    return [
        personalityPrompt,
        expertiseContext,
        memoryContext,
        insightsContext,
        basePrompt
    ].filter(Boolean).join('\n\n');
};

// Generate proactive suggestions based on current context
export const generateProactiveActions = (
    currentStep: AppStep,
    data: any,
    memory: AgentMemory
): ProactiveAction[] => {
    const actions: ProactiveAction[] = [];
    
    switch (currentStep) {
        case AppStep.DataValidation:
            if (data.edaResults && data.edaResults.length > 10) {
                actions.push({
                    id: 'large_dataset_tip',
                    type: 'insight',
                    priority: 'medium',
                    message: "I notice you have many columns! I can help you focus on the most important ones for MMM. Would you like me to suggest which columns might be most valuable?",
                    dismissible: true
                });
            }
            break;
            
        case AppStep.FeatureEngineering:
            actions.push({
                id: 'feature_explanation',
                type: 'suggestion',
                priority: 'low',
                message: "💡 Tip: Adstock represents how advertising effects decay over time, while lag captures delayed impacts. I've set these based on industry best practices, but feel free to adjust based on your business knowledge!",
                dismissible: true
            });
            break;
            
        case AppStep.Modeling:
            if (data.modelLeaderboard && data.modelLeaderboard.length > 0) {
                const topModel = data.modelLeaderboard[0];
                if (topModel.rsq < 0.75) {
                    actions.push({
                        id: 'low_rsq_warning',
                        type: 'warning',
                        priority: 'high',
                        message: `The best model has an R-squared of ${(topModel.rsq * 100).toFixed(1)}%. This might indicate missing variables or data quality issues. Shall we investigate?`,
                        dismissible: true
                    });
                }
            }
            break;
    }
    
    return actions;
};