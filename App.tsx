import {
    generateEnhancedModelLeaderboard, // Real regression modeling  
    getRealDataChatResponse,          // Real data analysis
    clearDataCache,                   // Clear cache for new datasets
  } from './services/hybridAnalysisService';
  import { generateDemoInsights as fastDemoInsights, generateDemoModels } from './services/demoSimulation';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppStep, EdaResult, UserColumnSelection, ColumnType, AgentMessage, ParsedData, EdaInsights, FeatureParams, ModelRun, ChannelDiagnostic, ColumnSummaryItem, ModelingInteractionResponse, CalibrationInteractionResponse, ModelDetail, OptimizerScenario, OptimizerInteractionResponse, ChatAction } from './types';
import {
  analyzeColumns,
  recommendFeatures,
  getFeatureConfirmationSummary,
  getFeatureEngineeringSummary,
  getModelingInteraction,
  getCalibrationInteraction,
  getConfirmationIntent,
  getOptimizerInteraction,
  rerunModel,
} from './services/geminiService.ts';
import { StepIndicator } from './components/StepIndicator';
import { ChatMessage } from './components/ChatMessage';
import { QuickActionsBar } from './components/QuickActionsBar';
import { Loader } from './components/Loader';
import { UploadIcon } from './components/icons/UploadIcon';
import { UserInput } from './components/UserInput';
import { csvParse, DSVRowString } from 'd3-dsv';
import { DataValidation } from './components/DataValidation';
import { Configure } from './components/Configure';
import { FeatureEngineering } from './components/FeatureEngineering';
import { ModelingView } from './components/ModelingView';
import { RevertedFinalReport } from './components/RevertedFinalReport';
import { EnhancedOptimizer } from './components/EnhancedOptimizer';
import { ColumnSummaryTable } from './components/ColumnSummaryTable';
import { generateInitialScenarios } from './services/optimizerUtils.ts';
import { Logo } from './components/Logo.tsx';
import { setCurrentDataset } from './services/datasetStore';
import { LoginScreen } from './components/LoginScreen.tsx';
import { TrainingProgress } from './components/TrainingProgress.tsx';
import { StagedModelTraining } from './components/StagedModelTraining';
import { loadDemoDataset, getDemoDatasetInfo, isDemoModeAvailable, loadDatasetByFilename, AVAILABLE_DATASETS, DatasetInfo } from './services/demoDataService.ts';


const App: React.FC = () => {
  // Feature flags
  const CHAT_UI_PILLS_ONLY = true; // Default ON - suppress suggestion bubbles, show only pills
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // Check for existing authentication on app load
  useEffect(() => {
    const isAuth = sessionStorage.getItem('mmx_authenticated') === 'true';
    setIsAuthenticated(isAuth);
  }, []);
  
  // Add initial welcome message when authenticated
  useEffect(() => {
    if (isAuthenticated && agentMessages.length === 0) {
      const timer = setTimeout(() => {
        const id = Date.now() + Math.random();
        setAgentMessages([{ 
          id, 
          sender: 'ai' as const, 
          text: "Hi! I'm your MMM assistant. Upload your marketing data to start analyzing channel performance and optimizing budgets.", 
          actions: [] 
        }]);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);
  
  const handleLogin = () => {
    setIsAuthenticated(true);
  };
  
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.Welcome);
  const [completedSteps, setCompletedSteps] = useState<Set<AppStep>>(new Set([AppStep.Welcome]));
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track user interactions to avoid redundant guidance
  const [userInteractionHistory, setUserInteractionHistory] = useState<Set<string>>(new Set());

  const [parsedData, setParsedData] = useState<ParsedData[]>([]);
  const [edaResults, setEdaResults] = useState<EdaResult[]>([]);
  const [edaInsights, setEdaInsights] = useState<EdaInsights | null>(null);
  const [userSelections, setUserSelections] = useState<UserColumnSelection>({});
  const [channelDiagnostics, setChannelDiagnostics] = useState<ChannelDiagnostic[]>([]);
  
  const [featureParams, setFeatureParams] = useState<FeatureParams[]>([]);
  const [featureEngineeringSummary, setFeatureEngineeringSummary] = useState<string>('');
  const [modelLeaderboard, setModelLeaderboard] = useState<ModelRun[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [finalizedModel, setFinalizedModel] = useState<ModelRun | null>(null);
  
  const [optimizationScenarios, setOptimizationScenarios] = useState<OptimizerScenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>('');

  const [userQuery, setUserQuery] = useState<string>('');
  const [hasRunInitialEda, setHasRunInitialEda] = useState<boolean>(false);
  const [isDemoDataAvailable, setIsDemoDataAvailable] = useState<boolean>(false);
  const [selectedDataset, setSelectedDataset] = useState<DatasetInfo | null>(null);
  
  // Training progress state
  const [showTrainingProgress, setShowTrainingProgress] = useState(false);
  
  // States to manage conversational flow
  const [awaitingColumnConfirmation, setAwaitingColumnConfirmation] = useState(false);
  const [awaitingEdaConfirmation, setAwaitingEdaConfirmation] = useState(false);
  const [awaitingFeatureConfirmation, setAwaitingFeatureConfirmation] = useState(false);
  const [awaitingFinalizeConfirmation, setAwaitingFinalizeConfirmation] = useState(false);
  const [isRecalibrating, setIsRecalibrating] = useState<boolean>(false);
  const [recalibrationTimer, setRecalibrationTimer] = useState<NodeJS.Timeout | null>(null);
  const [showStagedTraining, setShowStagedTraining] = useState(false);
  const hasInitializedRef = useRef<boolean>(false);


  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Track user interactions to provide contextual guidance
  const trackInteraction = useCallback((action: string) => {
    setUserInteractionHistory(prev => new Set(prev).add(action));
  }, []);

  // Check if user has demonstrated familiarity with interface
  const userKnowsInterface = useCallback(() => {
    return userInteractionHistory.has('column_assignment') || 
           userInteractionHistory.has('approve_exclude') ||
           userInteractionHistory.has('chat_interaction') ||
           agentMessages.length > 3;
  }, [userInteractionHistory, agentMessages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [agentMessages]);
  
  const addMessage = useCallback((
    text: string | React.ReactNode, 
    sender: 'ai' | 'user' = 'ai', 
    actions?: ChatAction[], 
    meta?: { kind?: 'suggestion' | 'insight' | 'validate_suggestions'; suggestion?: boolean; }
  ) => {
    const id = Date.now() + Math.random();
    setAgentMessages(prev => [...prev, { id, sender, text, actions: actions || [], meta }]);
  }, []);

  // Generate dynamic suggestions based on current state and context
  const getDynamicSuggestions = useCallback((): ChatAction[] => {
    // Don't show suggestions on Welcome step - let users focus on data upload
    if (currentStep === AppStep.Welcome) {
      return [];
    }

    // Only show suggestions when we have data to analyze
    if (parsedData.length === 0) {
      return [];
    }

    switch (currentStep) {
      case AppStep.Configure:
        const spendChannels = Object.keys(userSelections).filter(k => userSelections[k] === ColumnType.MARKETING_SPEND);
        const activityChannels = Object.keys(userSelections).filter(k => userSelections[k] === ColumnType.MARKETING_ACTIVITY);
        const hasTimeColumn = Object.values(userSelections).includes(ColumnType.TIME_DIMENSION);
        const hasGeoColumn = Object.values(userSelections).includes(ColumnType.GEO_DIMENSION);
        const dependentVars = Object.keys(userSelections).filter(k => userSelections[k] === ColumnType.DEPENDENT_VARIABLE);
        const controlVars = Object.keys(userSelections).filter(k => userSelections[k] === ColumnType.CONTROL_VARIABLE);
        const ignoredCols = Object.keys(userSelections).filter(k => userSelections[k] === ColumnType.IGNORE);
        
        const configureRecentMessages = agentMessages.slice(-8).map(m => 
          typeof m.text === 'string' ? m.text.toLowerCase() : ''
        ).filter(text => text.length > 0);
        
        const hasAskedAboutSpend = configureRecentMessages.some(m => m.includes('spend') || m.includes('budget') || m.includes('roi'));
        const hasAskedAboutActivity = configureRecentMessages.some(m => m.includes('activity') || m.includes('impression') || m.includes('reach'));
        const hasAskedAboutKpi = configureRecentMessages.some(m => m.includes('dependent') || m.includes('kpi') || m.includes('target'));
        const hasAskedAboutTime = configureRecentMessages.some(m => m.includes('time') || m.includes('date') || m.includes('weekly'));
        const hasAskedAboutControls = configureRecentMessages.some(m => m.includes('control') || m.includes('external') || m.includes('seasonal'));
        
        const configureSuggestions: ChatAction[] = [];
        
        // Context-aware suggestions based on user's current selections
        if (spendChannels.length > 0 && activityChannels.length > 0 && !hasAskedAboutSpend) {
          configureSuggestions.push({ text: "Why do I have both spend and activity data?", style: 'secondary' });
        } else if (!hasAskedAboutSpend && !hasAskedAboutActivity) {
          configureSuggestions.push({ text: "What's the difference between Spend and Activity?", style: 'secondary' });
        }
        
        if (spendChannels.length >= 3 && !hasAskedAboutSpend) {
          configureSuggestions.push({ text: `How will my ${spendChannels.length} spend channels work in MMM?`, style: 'secondary' });
        }
        
        if (dependentVars.length === 0) {
          configureSuggestions.push({ text: "Help me choose the right KPI for modeling", style: 'secondary' });
        } else if (dependentVars.length > 1) {
          configureSuggestions.push({ text: "Can I model multiple KPIs at once?", style: 'secondary' });
        } else if (!hasAskedAboutKpi) {
          configureSuggestions.push({ text: `Why is ${dependentVars[0]} a good choice for MMM?`, style: 'secondary' });
        }
        
        if (!hasTimeColumn && !hasAskedAboutTime) {
          configureSuggestions.push({ text: "Do I really need a time dimension?", style: 'secondary' });
        } else if (hasTimeColumn && !hasAskedAboutTime) {
          configureSuggestions.push({ text: "How does time granularity affect model quality?", style: 'secondary' });
        }
        
        if (hasGeoColumn) {
          configureSuggestions.push({ text: "What advantages does geographic modeling give me?", style: 'secondary' });
        }
        
        if (controlVars.length === 0 && !hasAskedAboutControls) {
          configureSuggestions.push({ text: "Should I include external factors as controls?", style: 'secondary' });
        } else if (controlVars.length > 0 && !hasAskedAboutControls) {
          configureSuggestions.push({ text: `How will my ${controlVars.length} control variables improve the model?`, style: 'secondary' });
        }
        
        if (ignoredCols.length > 0) {
          configureSuggestions.push({ text: `Review why ${ignoredCols.length} columns are being ignored`, style: 'secondary' });
        }
        
        // Readiness check
        const hasEssentials = dependentVars.length > 0 && hasTimeColumn && (spendChannels.length > 0 || activityChannels.length > 0);
        if (hasEssentials && configureSuggestions.filter(s => s.style === 'secondary').length < 2) {
          configureSuggestions.push({ text: "Are my column assignments ready for validation?", style: 'primary' });
        }
        
        // Fill with rotating general advice if we don't have enough suggestions
        if (configureSuggestions.length < 3) {
          const generalAdvice = [
            "What makes marketing data modeling-ready?",
            "How do I handle seasonality in MMM?",
            "What's the ideal data timeframe for MMM?",
            "Common mistakes in column classification"
          ];
          
          const currentRotation = Math.floor(Date.now() / 45000) % generalAdvice.length;
          const rotatingAdvice = generalAdvice.slice(currentRotation).concat(generalAdvice.slice(0, currentRotation));
          
          for (const advice of rotatingAdvice) {
            if (configureSuggestions.length >= 3) break;
            const isRecent = configureRecentMessages.some(msg => msg.includes(advice.toLowerCase().split(' ').slice(0, 2).join(' ')));
            if (!isRecent) {
              configureSuggestions.push({ text: advice, style: 'secondary' });
            }
          }
        }
        
        return configureSuggestions;

      case AppStep.DataValidation:
        const approvedChannels = channelDiagnostics.filter(c => c.isApproved).length;
        const totalChannels = channelDiagnostics.length;
        const highSparsityChannels = channelDiagnostics.filter(c => parseFloat(c.sparsity) > 50).length;
        const highVolatilityChannels = channelDiagnostics.filter(c => parseFloat(c.volatility) > 80).length;
        const validationRecentMessages = agentMessages.slice(-6).map(m => 
          typeof m.text === 'string' ? m.text.toLowerCase() : ''
        ).filter(text => text.length > 0);
        const hasAskedAboutSparsity = validationRecentMessages.some(m => m.includes('sparsity'));
        const hasAskedAboutCorrelation = validationRecentMessages.some(m => m.includes('correlation'));
        const hasAskedAboutDiagnostics = validationRecentMessages.some(m => m.includes('diagnostic'));
        
        const validationSuggestions: ChatAction[] = [];
        
        // Prioritize contextual suggestions based on data patterns
        if (highSparsityChannels > 0 && !hasAskedAboutSparsity) {
          validationSuggestions.push({ text: `Why do ${highSparsityChannels} channels have high sparsity?`, style: 'secondary' });
        }
        
        if (highVolatilityChannels > 0) {
          validationSuggestions.push({ text: `Analyze high volatility in ${highVolatilityChannels} channels`, style: 'secondary' });
        }
        
        if (approvedChannels < totalChannels) {
          validationSuggestions.push({ text: "Should I exclude problematic channels?", style: 'secondary' });
        } else if (!hasAskedAboutDiagnostics) {
          validationSuggestions.push({ text: "Why are all channels approved?", style: 'secondary' });
        }
        
        if (!hasAskedAboutCorrelation) {
          validationSuggestions.push({ text: "Check correlation patterns", style: 'secondary' });
        }
        
        // Always include next step if ready
        if (edaInsights) {
          validationSuggestions.push({ text: "Proceed to feature engineering", style: 'primary' });
        }
        
        // Advanced dynamic suggestions that change over time
        const currentTime = Date.now();
        const suggestionRotation = Math.floor(currentTime / 30000) % 4; // Change every 30 seconds
        
        if (validationSuggestions.filter(s => s.style === 'secondary').length < 2) {
          const rotatingOptions = [
            // Set 1: Technical Analysis
            ["Explain the trend smoothing method", "What's causing the volatility?", "How reliable is this data?"],
            // Set 2: Business Impact
            ["Which channels need attention?", "How does seasonality affect this?", "What's the business implication?"],
            // Set 3: Data Quality
            ["Should I be concerned about gaps?", "How does this compare to benchmarks?", "What would ideal data look like?"],
            // Set 4: Next Steps
            ["What should I investigate next?", "How do I improve measurement?", "Ready for feature engineering?"]
          ];
          
          const currentSet = rotatingOptions[suggestionRotation] || rotatingOptions[0];
          
          // Add unique suggestions that haven't been used recently
          for (const suggestion of currentSet) {
            if (validationSuggestions.filter(s => s.style === 'secondary').length >= 2) break;
            const keywords = suggestion.toLowerCase().split(' ').slice(0, 3).join(' ');
            const isRecentlyDiscussed = validationRecentMessages.some(msg => msg.includes(keywords));
            if (!isRecentlyDiscussed) {
              validationSuggestions.push({ text: suggestion, style: 'secondary' });
            }
          }
        }
        
        return validationSuggestions;

      case AppStep.FeatureEngineering:
        const highAdstockChannels = featureParams.filter(f => f.adstock >= 0.6);
        const lowAdstockChannels = featureParams.filter(f => f.adstock < 0.2);
        const laggedChannels = featureParams.filter(f => f.lag > 0);
        const immediatChannels = featureParams.filter(f => f.lag === 0);
        const sCurveChannels = featureParams.filter(f => f.transform === 'S-Curve');
        const logChannels = featureParams.filter(f => f.transform === 'Log-transform');
        
        const featureRecentMessages = agentMessages.slice(-8).map(m => 
          typeof m.text === 'string' ? m.text.toLowerCase() : ''
        ).filter(text => text.length > 0);
        
        const hasAskedAboutAdstock = featureRecentMessages.some(m => m.includes('adstock') || m.includes('carryover'));
        const hasAskedAboutLag = featureRecentMessages.some(m => m.includes('lag') || m.includes('delay'));
        const hasAskedAboutTransform = featureRecentMessages.some(m => m.includes('transform') || m.includes('saturation'));
        
        const featureSuggestions: ChatAction[] = [];
        
        // Context-aware suggestions based on feature parameters
        if (highAdstockChannels.length > 0 && !hasAskedAboutAdstock) {
          featureSuggestions.push({ text: `Why do ${highAdstockChannels.length} channels have high adstock?`, style: 'secondary' });
        } else if (lowAdstockChannels.length >= 2 && !hasAskedAboutAdstock) {
          featureSuggestions.push({ text: `Should ${lowAdstockChannels.map(c => c.channel).slice(0, 2).join(' and ')} have higher carryover?`, style: 'secondary' });
        }
        
        if (laggedChannels.length > 0 && !hasAskedAboutLag) {
          featureSuggestions.push({ text: `Explain the ${laggedChannels.length} week delay effects`, style: 'secondary' });
        } else if (immediatChannels.length >= 3 && !hasAskedAboutLag) {
          featureSuggestions.push({ text: "Why do most channels have immediate impact?", style: 'secondary' });
        }
        
        if (sCurveChannels.length > 0 && logChannels.length > 0 && !hasAskedAboutTransform) {
          featureSuggestions.push({ text: "Compare S-Curve vs Log saturation patterns", style: 'secondary' });
        } else if (!hasAskedAboutTransform) {
          featureSuggestions.push({ text: "How do saturation curves affect optimization?", style: 'secondary' });
        }
        
        // Always include validation and next steps
        featureSuggestions.push({ text: "Validate these settings against industry norms", style: 'secondary' });
        
        if (featureParams.length > 0) {
          featureSuggestions.push({ text: "Ready to proceed with modeling", style: 'primary' });
        }
        
        // Fill with rotating technical advice if needed
        if (featureSuggestions.filter(s => s.style === 'secondary').length < 2) {
          const technicalAdvice = [
            "How to adjust parameters for better performance",
            "Industry benchmarks for my channel types",
            "What if my adstock settings are wrong?",
            "How to interpret transformation effects"
          ];
          
          const currentTime = Date.now();
          const rotationIndex = Math.floor(currentTime / 40000) % technicalAdvice.length;
          const currentAdvice = technicalAdvice[rotationIndex];
          
          const isRecent = featureRecentMessages.some(msg => msg.includes(currentAdvice.toLowerCase().split(' ').slice(0, 2).join(' ')));
          if (!isRecent) {
            featureSuggestions.push({ text: currentAdvice, style: 'secondary' });
          }
        }
        
        return featureSuggestions;

      case AppStep.Modeling:
        const topModel = modelLeaderboard.length > 0 ? modelLeaderboard[0] : null;
        const selectedModel = activeModelId ? modelLeaderboard.find(m => m.id === activeModelId) : null;
        
        return [
          { text: "Which model performs best and why?", style: 'secondary' },
          ...(topModel ? [{ text: `Why does ${topModel.algo} work well here?`, style: 'secondary' }] : []),
          ...(selectedModel ? [{ text: `Calibrate ${selectedModel.id}`, style: 'secondary' }] : []),
          { text: "How do I interpret these metrics?", style: 'secondary' },
          ...(activeModelId ? [{ text: "Finalize this model", style: 'primary' }] : []),
        ];

      case AppStep.Report:
        const reportChannels = finalizedModel?.details.filter(d => d.included).length || 0;
        
        return [
          { text: "Summarize the key findings", style: 'secondary' },
          { text: "Which channels drive the most ROI?", style: 'secondary' },
          ...(reportChannels > 0 ? [{ text: `Explain all ${reportChannels} channel contributions`, style: 'secondary' }] : []),
          { text: "How should I present these results?", style: 'secondary' },
          { text: "Go to budget optimization", style: 'primary' },
        ];

      case AppStep.Optimize:
        const currentScenarios = optimizationScenarios.length;
        const activeScenario = optimizationScenarios.find(s => s.id === activeScenarioId);
        const totalCurrentBudget = activeScenario ? Math.round(activeScenario.recommendedSpend) : 100;
        const currentROI = activeScenario ? activeScenario.projectedROI.toFixed(1) : "2.5";
        
        return [
          { text: "Explain the rationale behind this allocation strategy", style: 'secondary' },
          { text: `Create a $${totalCurrentBudget + 50}M efficiency-focused budget`, style: 'secondary' },
          { text: `Maximize volume with $${totalCurrentBudget + 100}M investment`, style: 'secondary' },
          { text: "Protect TV spend but optimize other channels", style: 'secondary' },
          { text: "What's my optimal budget for 15% revenue growth?", style: 'secondary' },
          ...(currentScenarios > 2 ? [{ text: `Compare ROI vs Volume scenarios side-by-side`, style: 'primary' }] : []),
        ];

      default:
        return [];
    }
  }, [currentStep, parsedData, userSelections, channelDiagnostics, edaInsights, featureParams, modelLeaderboard, activeModelId, finalizedModel, optimizationScenarios, agentMessages]);

  // Generate contextual suggestions based on current step and data state (kept for compatibility)
  const getStepSuggestions = useCallback((step: AppStep): ChatAction[] => {
    // Only show suggestions when we have data to analyze
    if (parsedData.length === 0 && step !== AppStep.Welcome) {
      return [];
    }

    switch (step) {
      case AppStep.Configure:
        const hasTimeColumn = Object.values(userSelections).includes(ColumnType.TIME_DIMENSION);
        const hasGeoColumn = Object.values(userSelections).includes(ColumnType.GEO_DIMENSION);
        const spendChannels = Object.keys(userSelections).filter(k => userSelections[k] === ColumnType.MARKETING_SPEND);
        
        return [
          { text: "What's the difference between Marketing Spend and Activity?", style: 'secondary' },
          ...(spendChannels.length > 0 ? [{ text: `Explain my ${spendChannels.length} spend channels`, style: 'secondary' }] : []),
          ...(hasGeoColumn ? [{ text: "How do geographic models work?", style: 'secondary' }] : []),
          ...(hasTimeColumn ? [] : [{ text: "Why do I need a time dimension?", style: 'secondary' }]),
          { text: "What makes a good dependent variable?", style: 'secondary' },
        ];

      case AppStep.DataValidation:
        const approvedChannels = channelDiagnostics.filter(c => c.isApproved).length;
        const totalChannels = channelDiagnostics.length;
        
        return [
          { text: "Explain these diagnostics", style: 'secondary' },
          { text: "What does sparsity mean for my channels?", style: 'secondary' },
          ...(approvedChannels < totalChannels ? [{ text: "Should I exclude high-sparsity channels?", style: 'secondary' }] : []),
          { text: "How do I interpret correlation patterns?", style: 'secondary' },
        ];

      case AppStep.FeatureEngineering:
        const highAdstockChannels = featureParams.filter(f => f.adstock > 0.5).length;
        const hasLagChannels = featureParams.some(f => f.lag > 0);
        
        return [
          { text: "What is adstock and why does it matter?", style: 'secondary' },
          ...(highAdstockChannels > 0 ? [{ text: `Why do ${highAdstockChannels} channels have high adstock?`, style: 'secondary' }] : []),
          ...(hasLagChannels ? [{ text: "Explain the lag effects in my model", style: 'secondary' }] : []),
          { text: "How were these transformations chosen?", style: 'secondary' },
        ];

      case AppStep.Modeling:
        const topModel = modelLeaderboard.length > 0 ? modelLeaderboard[0] : null;
        const selectedModel = activeModelId ? modelLeaderboard.find(m => m.id === activeModelId) : null;
        
        return [
          { text: "Which model performs best and why?", style: 'secondary' },
          ...(topModel ? [{ text: `Why does ${topModel.algo} work well here?`, style: 'secondary' }] : []),
          ...(selectedModel ? [{ text: `Analyze ${selectedModel.id} performance`, style: 'secondary' }] : []),
          { text: "How do I calibrate this model?", style: 'secondary' },
        ];

      case AppStep.Report:
        const reportChannels = finalizedModel?.details.filter(d => d.included).length || 0;
        
        return [
          { text: "Summarize the key findings", style: 'secondary' },
          { text: "Which channels drive the most ROI?", style: 'secondary' },
          ...(reportChannels > 0 ? [{ text: `Explain contribution of all ${reportChannels} channels`, style: 'secondary' }] : []),
          { text: "Take me to budget optimization", style: 'primary' },
        ];

      case AppStep.Optimize:
        const currentScenarios = optimizationScenarios.length;
        const activeScenario = optimizationScenarios.find(s => s.id === activeScenarioId);
        const totalCurrentBudget = activeScenario ? Math.round(activeScenario.recommendedSpend) : 100;
        const currentROI = activeScenario ? activeScenario.projectedROI.toFixed(1) : "2.5";
        
        return [
          { text: "Explain the rationale behind this allocation strategy", style: 'secondary' },
          { text: `Create a $${totalCurrentBudget + 50}M efficiency-focused budget`, style: 'secondary' },
          { text: `Maximize volume with $${totalCurrentBudget + 100}M investment`, style: 'secondary' },
          { text: "Protect TV spend but optimize other channels", style: 'secondary' },
          { text: "What's my optimal budget for 15% revenue growth?", style: 'secondary' },
          ...(currentScenarios > 2 ? [{ text: `Compare ROI vs Volume scenarios side-by-side`, style: 'primary' }] : []),
        ];

      default:
        return [];
    }
  }, [parsedData, userSelections, channelDiagnostics, featureParams, modelLeaderboard, activeModelId, finalizedModel, optimizationScenarios]);


  useEffect(() => {
    const initializeApp = async () => {
      if (hasInitializedRef.current) return; // Prevent duplicate initialization
      hasInitializedRef.current = true; // Set flag immediately to prevent race conditions
      
      // Check if demo data is available
      const demoAvailable = await isDemoModeAvailable();
      setIsDemoDataAvailable(demoAvailable);
      
      addMessage("Hello! I'm MixMind, your Marketing Mix Modeling assistant. Upload a CSV file to begin analysis.", 'ai');
    };
    
    initializeApp();
  }, []); // Empty dependency array - only run on mount
  
  const handleGoToOptimizer = useCallback((modelId?: string) => {
    const modelToUse = modelId ? modelLeaderboard.find(m => m.id === modelId) : finalizedModel;
    if (!modelToUse) {
      // Fallback: use the first available model if none specified or finalized
      const fallbackModel = modelLeaderboard.length > 0 ? modelLeaderboard[0] : null;
      if (!fallbackModel) {
        addMessage("I need a valid model to proceed to optimization. Please finalize a model first.", 'ai');
        return;
      }
      console.log('Using fallback model for optimization:', fallbackModel.id);
      setFinalizedModel(fallbackModel);
      return handleGoToOptimizer(fallbackModel.id);
    }
    setCompletedSteps(prev => new Set(prev).add(AppStep.Report));
    setCurrentStep(AppStep.Optimize);
    
    console.log('Generating scenarios for model:', modelToUse?.id, modelToUse);
    const initialScenarios = generateInitialScenarios(modelToUse);
    console.log('Generated scenarios:', initialScenarios);
    setOptimizationScenarios(initialScenarios);
    setActiveScenarioId(initialScenarios[0]?.id || '');

    addMessage(
        <>
            <p>Excellent. Welcome to the Budget Optimizer. I've created three starter scenarios based on your model performance. You can explore them using the list on the left.</p>
            <p className="mt-2">To create a custom plan, tell me your goals. For example:</p>
            <p className="mt-2">• "Create an efficiency-focused $250M allocation"
            <br/>• "Maximize revenue growth with $400M investment"
            <br/>• "Protect TV budget but optimize digital channels"
            <br/>• "What budget delivers 15% incremental revenue?"</p>
        </>,
        'ai'
    );
  }, [addMessage, finalizedModel, modelLeaderboard]);

  const handleUpdateScenario = useCallback((updatedScenario: OptimizerScenario) => {
    setOptimizationScenarios(prev => 
      prev.map(scenario => 
        scenario.id === updatedScenario.id ? updatedScenario : scenario
      )
    );
  }, []);

  const handleCreateScenario = useCallback((newScenario: OptimizerScenario) => {
    setOptimizationScenarios(prev => [...prev, newScenario]);
    setActiveScenarioId(newScenario.id);
  }, []);

  const handleStartOver = useCallback(() => {
    setCurrentStep(AppStep.Welcome);
    setCompletedSteps(new Set([AppStep.Welcome]));
    setAgentMessages([]);
    clearDataCache(); // Clear cache on reset
    setParsedData([]);
    setEdaResults([]);
    setEdaInsights(null);
    setUserSelections({});
    setChannelDiagnostics([]);
    setFeatureParams([]);
    setFeatureEngineeringSummary('');
    setModelLeaderboard([]);
    setActiveModelId(null);
    setFinalizedModel(null);
    setOptimizationScenarios([]);
    setActiveScenarioId('');
    setError(null);
    setUserQuery('');
    setHasRunInitialEda(false);
    setAwaitingColumnConfirmation(false);
    setAwaitingEdaConfirmation(false);
    setAwaitingFeatureConfirmation(false);
    setAwaitingFinalizeConfirmation(false);
    hasInitializedRef.current = false; // Reset ref for fresh initialization
    setTimeout(() => addMessage("Ready for a new analysis. Please upload your CSV file."), 100);
  }, [addMessage]);

  const handleProceedToValidation = useCallback(async () => {
    setCompletedSteps(prev => new Set(prev).add(AppStep.Configure));
    setCurrentStep(AppStep.DataValidation);
    addMessage("Running data quality diagnostics...");
    
    // Contextual suggestions will be added by useEffect when step transitions
    
    // Will trigger EDA analysis in useEffect when currentStep changes
  }, [addMessage, getStepSuggestions]);

  const handleProceedToFeatureEngineering = useCallback(async () => {
    // Get approved activity channels for feature engineering
    const approvedActivityChannels = channelDiagnostics
      .filter(d => d.isApproved)
      .map(d => d.name);
    
    if (approvedActivityChannels.length === 0) {
      addMessage("Please approve at least one channel from the diagnostics table before proceeding to feature engineering.", 'ai');
      return;
    }
    
    setCompletedSteps(prev => new Set(prev).add(AppStep.DataValidation));
    setCurrentStep(AppStep.FeatureEngineering);
    addMessage("Data looks good. Configuring feature engineering parameters...");
    
    setIsLoading(true);
    setLoadingMessage('Generating feature recommendations...');
    
    try {
      // Generate feature recommendations using the demo simulation service
      const { generateDemoFeatures } = await import('./services/demoSimulation');
      const features = generateDemoFeatures(approvedActivityChannels);
      setFeatureParams(features);
      
      // Generate a detailed, formatted summary for the features
      const highAdstockChannels = features.filter(f => f.adstock >= 0.6);
      const immediateChannels = features.filter(f => f.lag === 0);
      const delayedChannels = features.filter(f => f.lag >= 2);
      const sCurveChannels = features.filter(f => f.transform === 'S-Curve');
      
      const summary = `## Feature Engineering Configuration

### Overview
I've analyzed your **${approvedActivityChannels.length} marketing channels** and configured MMM parameters based on their behavior patterns in your data.

### Key Recommendations

**🔄 Carryover Effects (Adstock)**
${highAdstockChannels.length > 0 ? 
`• **Strong carryover (0.6-0.9):** ${highAdstockChannels.map(c => c.channel).join(', ')} - These channels build lasting brand equity
` : ''}${immediateChannels.length > 0 ?
`• **Minimal carryover (<0.3):** ${immediateChannels.filter(c => c.adstock < 0.3).map(c => c.channel).join(', ')} - Direct response channels with quick decay
` : ''}
**⏱️ Response Timing (Lag)**
${immediateChannels.length > 0 ?
`• **Immediate impact (0 weeks):** ${immediateChannels.map(c => c.channel).join(', ')} - Same-week conversion
` : ''}${delayedChannels.length > 0 ?
`• **Delayed response (2+ weeks):** ${delayedChannels.map(c => c.channel).join(', ')} - Consideration period needed
` : ''}
**📈 Saturation Curves**
${sCurveChannels.length > 0 ?
`• **S-Curve transformation:** ${sCurveChannels.map(c => c.channel).join(', ')} - Clear saturation at high spend levels
` : ''}${features.filter(f => f.transform === 'Log-transform').length > 0 ?
`• **Log transformation:** ${features.filter(f => f.transform === 'Log-transform').map(c => c.channel).join(', ')} - Diminishing returns from the start
` : ''}

### Next Steps
Review each channel's settings in the table below. Adjust based on your business knowledge - for example:
- Increase adstock if you know a channel has strong brand-building effects
- Add lag if there's a known delay between exposure and conversion
- Change transformation if you have evidence of different saturation patterns`;
      
      setFeatureEngineeringSummary(summary);
      addMessage("Feature recommendations ready. Adjust parameters based on your expertise.", 'ai');
    } catch(e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      setError(`Failed to generate feature recommendations: ${errorMessage}`);
      addMessage(`I'm sorry, I couldn't generate feature recommendations. Error: ${errorMessage}.`, 'ai');
      // Go back to validation step on error
      setCurrentStep(AppStep.DataValidation);
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, channelDiagnostics]);

  const handleFinalizeModel = useCallback(() => {
    const modelToFinalize = modelLeaderboard.find(m => m.id === activeModelId);
    if (!modelToFinalize) return;

    setAwaitingFinalizeConfirmation(false);
    setCompletedSteps(prev => new Set(prev).add(AppStep.Modeling));
    setFinalizedModel(modelToFinalize);
    setCurrentStep(AppStep.Report);
    addMessage("Model finalized! I'm now generating the final report with key findings, performance summaries, and response curves. When you're done reviewing, you can ask to 'go to optimizer' or 'start over'.");
  }, [addMessage, activeModelId, modelLeaderboard]);

  const handleRequestFinalizeModel = useCallback(() => {
    if (!activeModelId) {
        addMessage("Please select a model from the leaderboard first before finalizing.", 'ai');
        return;
    }
    addMessage(`You have requested to finalize model **${activeModelId}**. This will lock the model and generate the final report. Are you sure you want to proceed? (Type 'yes' to confirm)`, 'ai');
    setAwaitingFinalizeConfirmation(true);
  }, [addMessage, activeModelId]);

  const handleRunModels = useCallback(async () => {
    const validationErrors: string[] = [];
    const marketingChannelsInData = Object.keys(userSelections).filter(
        (k) => [ColumnType.MARKETING_SPEND, ColumnType.MARKETING_ACTIVITY].includes(userSelections[k])
    );

    for (const param of featureParams) {
        if (!marketingChannelsInData.includes(param.channel)) {
            validationErrors.push(
                `**${param.channel} Type Mismatch:** This channel is configured for modeling, but its type is currently set to '${userSelections[param.channel] || 'Not Set'}', not a marketing channel. Please go back to the 'Validate' step to correct the column type.`
            );
            continue;
        }

        const hasNonNumericData = parsedData.some(row => {
            const value = row[param.channel];
            return value !== null && value !== undefined && value !== '' && isNaN(Number(value));
        });

        if (hasNonNumericData) {
            validationErrors.push(
                `**${param.channel} Data Type Mismatch:** This channel contains non-numeric text values that cannot be used in modeling. Please check your source data or re-classify this column in the 'Validate' step.`
            );
        }
    }

    if (validationErrors.length > 0) {
        let errorMessage = "To proceed to modeling, a few issues require your attention:\n\n" + validationErrors.map((e, i) => `${i + 1}. ${e}`).join('\n\n');
        addMessage(errorMessage);
        setUserQuery('');
        setAwaitingFeatureConfirmation(true); // Let them try again
        return;
    }
      
    setAwaitingFeatureConfirmation(false);
    addMessage("Starting model training...");
    setShowStagedTraining(true);
    setIsRecalibrating(true);
    setError(null);
    setCompletedSteps(prev => new Set(prev).add(AppStep.FeatureEngineering));
    setCurrentStep(AppStep.Modeling);
    addMessage("I'm now building multiple regression models with realistic staged training. This process takes 30-60 seconds for thorough model development...");
    
    // The actual model generation will happen when staged training completes
  }, [addMessage, userSelections, parsedData, userQuery, featureParams, modelLeaderboard]);

  const handleStagedTrainingComplete = useCallback(async () => {
    setShowStagedTraining(false);
    setIsLoading(true);
    try {
      // Use fast demo models for snappy performance, now honoring user's feature selections
      const approvedActivityChannels = featureParams.map(f => f.channel);
      const newResults = generateDemoModels(approvedActivityChannels, userSelections, userQuery, featureParams, edaInsights?.channelDiagnostics);
      
      // Mark new results with isNew flag and generate unique IDs
      const markedResults = newResults.map((model, index) => ({
        ...model,
        id: `${model.id}_${Date.now()}_${index}`, // Ensure unique IDs
        isNew: true
      }));
      
      // Mark all existing models as not new anymore
      const existingModels = modelLeaderboard.map(m => ({ ...m, isNew: false }));
      
      // Append new models to existing ones
      setModelLeaderboard([...existingModels, ...markedResults]);
      
      setIsRecalibrating(false); // Reset recalibrating flag
      if (recalibrationTimer) {
        clearTimeout(recalibrationTimer);
        setRecalibrationTimer(null);
      }
      
      if (markedResults.length > 0 && !activeModelId) {
        setActiveModelId(markedResults[0].id); // Select first model by default
      }

      const isFirstRun = modelLeaderboard.length === 0;
      if (isFirstRun) {
        addMessage("Modeling complete! Here is the new Modeling Workspace with enhanced diagnostics and filtering. The leaderboard shows models ranked by performance. Click a model to see detailed diagnostics including p-values, confidence intervals, and statistical warnings.");
      } else {
        addMessage(`Training complete! Generated ${markedResults.length} new models with enhanced diagnostics. Models are grouped by algorithm and filtered by your current channel selection. Use the filters to explore performance patterns and diagnostics.`);
      }
    } catch (error) {
      console.error('Error generating models:', error);
      addMessage('There was an issue generating the models. Please try again.');
    } finally {
      setIsLoading(false);
      setUserQuery('');
    }
  }, [addMessage, userSelections, parsedData, userQuery, featureParams, modelLeaderboard, edaInsights, activeModelId, recalibrationTimer]);

  const handleTrainingComplete = useCallback(async () => {
    setShowTrainingProgress(false);
    setIsLoading(true);
    try {
      // Use fast demo models for snappy performance, now honoring user's feature selections
      const approvedActivityChannels = featureParams.map(f => f.channel);
      const newResults = generateDemoModels(approvedActivityChannels, userSelections, userQuery, featureParams, edaInsights?.channelDiagnostics);
      
      // Mark new results with isNew flag and generate unique IDs
      const markedResults = newResults.map((model, index) => ({
        ...model,
        id: `${model.id}_${Date.now()}_${index}`, // Ensure unique IDs
        isNew: true
      }));
      
      // Mark all existing models as not new anymore
      const existingModels = modelLeaderboard.map(m => ({ ...m, isNew: false }));
      
      // Append new models to existing ones
      setModelLeaderboard([...existingModels, ...markedResults]);
      
      const isFirstRun = modelLeaderboard.length === 0;
      if (isFirstRun) {
        addMessage("Modeling complete! Here is the new Modeling Workspace. The leaderboard is on the left. Click a model ID to see its detailed results and calibration controls on the right. You can ask me questions about these results (e.g., 'What is the TV impact in br_1?'), request a re-run with new parameters, or tune the active model via chat.");
      } else {
        addMessage(`Training complete! Generated ${markedResults.length} new models marked as 'NEW' in the leaderboard. Models are grouped by algorithm and sorted by performance. The new models respect your current parameter ranges and channel selection.`);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during modeling.';
      setError(`Modeling failed: ${errorMessage}`);
      addMessage(`I'm sorry, the modeling process failed. Error: ${errorMessage}.`);
      setCurrentStep(AppStep.FeatureEngineering);
    } finally {
      setIsLoading(false);
      setUserQuery('');
    }
  }, [addMessage, userSelections, parsedData, userQuery, featureParams, modelLeaderboard, edaInsights]);

  const handleProceedToFeatures = useCallback(async () => {
    // Filter to get only activity channels for features and modeling
    const approvedActivityChannels = channelDiagnostics
      .filter(d => d.isApproved)
      .map(d => d.name)
      .filter(channelName => {
        // Find the actual activity column name for this channel
        const activityCols = Object.keys(userSelections).filter(k => userSelections[k] === ColumnType.MARKETING_ACTIVITY);
        return activityCols.some(activityCol => {
          const activityBase = activityCol.toLowerCase().replace(/_?(impressions?|clicks?|grps?|reach|views?|activity|count|events?|sends?|engagements?)$/i, '');
          const channelBase = channelName.toLowerCase();
          return activityBase.includes(channelBase) || channelBase.includes(activityBase) ||
                 activityBase.replace(/[^a-z]/g, '') === channelBase.replace(/[^a-z]/g, '');
        });
      });
    
    if(approvedActivityChannels.length === 0) {
        addMessage("It looks like no channels are approved. Please approve at least one channel from the diagnostics table on the right to continue, then let me know you want to proceed.", 'ai');
        setAwaitingEdaConfirmation(true); // Let them try again
        return;
    }
    
    setAwaitingEdaConfirmation(false);
    addMessage("Thanks for confirming the data diagnostics. Now, let's think about how to model these channels.");
    setIsLoading(true);
    setLoadingMessage('Recommending features...');
    try {
      addMessage("I'll recommend feature engineering parameters like adstock and lag effects based on industry best practices and your data. These represent the lingering and delayed effects of your advertising.");
      const features = await recommendFeatures(userSelections, approvedActivityChannels, userQuery);
      setFeatureParams(features);
      const summary = await getFeatureEngineeringSummary(features, userSelections, userQuery);
      setFeatureEngineeringSummary(summary);
      setCompletedSteps(prev => new Set(prev).add(AppStep.DataValidation));
      setCurrentStep(AppStep.FeatureEngineering);
      addMessage("Here are my recommendations. You can adjust them based on your domain expertise. When you're ready, let me know so I can summarize the settings and we can proceed to modeling.", 'ai');
      setAwaitingFeatureConfirmation(true);
    } catch(e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        setError(`Failed to get features: ${errorMessage}`);
        addMessage(`I'm sorry, I couldn't generate the features. Error: ${errorMessage}.`);
    } finally {
        setIsLoading(false);
        setUserQuery('');
    }
  }, [addMessage, userQuery, channelDiagnostics, userSelections]);

  const runEdaAndUpdateState = useCallback(async (selections: UserColumnSelection, data: ParsedData[], query: string) => {
    setIsLoading(true);
    setLoadingMessage('Updating diagnostics...');
    try {
        const insightsResult = fastDemoInsights(selections, data);
        setEdaInsights(insightsResult);
        setChannelDiagnostics(insightsResult.channelDiagnostics);
        return insightsResult;
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during EDA.';
        setError(`EDA failed: ${errorMessage}`);
        addMessage(`I'm sorry, I couldn't update the insights. Error: ${errorMessage}.`);
        throw e;
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [addMessage]);

  const handleProceedWithColumnSelection = useCallback(async () => {
    addMessage("Thank you for confirming. We are now proceeding with the data validation checks.", 'ai');
    try {
        const insightsResult = await runEdaAndUpdateState(userSelections, parsedData, "");
        setHasRunInitialEda(true);
        
        const edaSummaryText = <>
            <p>Diagnostics complete:</p>
            <ul className="list-disc list-inside mt-2 text-sm">
                <li><strong>KPI Trend:</strong> {insightsResult.trendsSummary}</li>
                <li><strong>Data Quality:</strong> {insightsResult.diagnosticsSummary}</li>
            </ul>
        </>;

        addMessage(edaSummaryText, 'ai');
        
        // Only provide interface guidance if user seems unfamiliar
        if (!userKnowsInterface()) {
            addMessage("Review channel diagnostics on the right. Approve/exclude channels as needed, then say 'proceed to features' when ready.", 'ai');
        } else {
            addMessage("Say 'proceed to features' when ready to continue.", 'ai');
        }
        setAwaitingEdaConfirmation(true);

    } catch (e) {
        // Error is handled in runEdaAndUpdateState
    } finally {
        setUserQuery('');
    }
  }, [addMessage, userSelections, parsedData, runEdaAndUpdateState]);

  useEffect(() => {
    if (currentStep === AppStep.DataValidation && !hasRunInitialEda && Object.keys(userSelections).length > 0) {
        const handler = setTimeout(() => {
            runEdaAndUpdateState(userSelections, parsedData, '');
            setHasRunInitialEda(true);
        }, 1000); 

        return () => {
            clearTimeout(handler);
        };
    }
  }, [userSelections, currentStep, hasRunInitialEda, parsedData, runEdaAndUpdateState]);

  // Add contextual suggestions when step changes and data is available
  useEffect(() => {
    // Only add suggestions if we have data AND we've completed the previous step properly
    // Skip Configure and FeatureEngineering to avoid redundancy with the chat buttons
    const shouldShowSuggestions = parsedData.length > 0 && 
      (currentStep === AppStep.DataValidation && hasRunInitialEda && edaInsights);
    
    if (shouldShowSuggestions) {
      const timeout = setTimeout(() => {
        const suggestions = getStepSuggestions(currentStep);
        if (suggestions.length > 0) {
          const stepNames = {
            [AppStep.DataValidation]: "📊 **Data validation insights you might want to explore:**"
          };
          const headerText = stepNames[currentStep];
          // Check if we haven't already shown suggestions for this step
          if (headerText && !agentMessages.some(msg => typeof msg.text === 'string' && msg.text.includes(headerText))) {
            // When pills-only mode is enabled, suppress suggestion bubbles but still track them internally
            if (!CHAT_UI_PILLS_ONLY) {
              addMessage(headerText, 'ai', suggestions, { kind: 'validate_suggestions', suggestion: true });
            }
          }
        }
      }, 1500);

      return () => clearTimeout(timeout);
    }
  }, [currentStep, parsedData.length, edaResults.length, hasRunInitialEda, edaInsights, featureParams.length, getStepSuggestions, addMessage, agentMessages]);

  const handleColumnAnalysis = useCallback(async (fileText: string) => {
    setIsLoading(true);
    setLoadingMessage('Analyzing columns...');
    addMessage("Analyzing column structure...");
    try {
      const results = await analyzeColumns(fileText);
      setEdaResults(results);
      const initialSelections = results.reduce((acc, r) => ({ ...acc, [r.columnName]: r.suggestedType }), {});
      setUserSelections(initialSelections);

      const roleOrder = [ ColumnType.DEPENDENT_VARIABLE, ColumnType.TIME_DIMENSION, ColumnType.GEO_DIMENSION, ColumnType.MARKETING_SPEND, ColumnType.MARKETING_ACTIVITY, ColumnType.CONTROL_VARIABLE, ColumnType.IGNORE ];
      const summaryData: ColumnSummaryItem[] = roleOrder.map(role => ({ role, columns: Object.entries(initialSelections).filter(([, r]) => r === role).map(([col]) => col) })).filter(summary => summary.columns.length > 0);
      
      addMessage(
        <>
          <p>Column analysis complete:</p>
          <ColumnSummaryTable summary={summaryData} />
        </>, 'ai');

      addMessage("Review column assignments on the right. Say 'yes' when ready to proceed.", 'ai');
      
      setAwaitingColumnConfirmation(true);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during column analysis.';
      setError(`Analysis failed: ${errorMessage}`);
      addMessage(`I'm sorry, I ran into an issue. Error: ${errorMessage}. Please check your data or API key.`);
      setCurrentStep(AppStep.Welcome);
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, getStepSuggestions]);

  const parseCSV = (text: string) => {
    return csvParse(text, (d: DSVRowString) => {
        const row: ParsedData = {};
        for (const key in d) {
            const value = d[key];
            if (value !== undefined) {
                 const num = Number(value);
                 row[key] = isNaN(num) || value.trim() === '' ? value : num;
            }
        }
        return row;
    });
  }
  
  const handleLoadDataset = useCallback(async (dataset: DatasetInfo) => {
    setError(null);
    addMessage(`Loading ${dataset.name}...`, 'user');
    setIsLoading(true);
    setLoadingMessage(`Loading ${dataset.name}...`);
    
    try {
      const data = await loadDatasetByFilename(dataset.filename);
      clearDataCache(); // Clear cache for new dataset
      setParsedData(data);
      // Set current dataset in store for report reconciliation
      await setCurrentDataset(data);
      setSelectedDataset(dataset);
      setCompletedSteps(prev => new Set(prev).add(AppStep.Welcome));
      setCurrentStep(AppStep.Configure);
      
      addMessage(`Perfect! I've loaded the ${dataset.name}. Let me analyze the column structure...`);
      
      // Convert data back to CSV format for analysis
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const csvLines = [headers.join(',')];
        const sampleRows = data.slice(0, 10).map(row => 
          headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(',')
        );
        csvLines.push(...sampleRows);
        const csvText = csvLines.join('\n');
        
        await handleColumnAnalysis(csvText);
      }
    } catch (error) {
      console.error('Error loading dataset:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(`Failed to load dataset: ${errorMessage}`);
      addMessage(`Sorry, I couldn't load the dataset. Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, handleColumnAnalysis]);

  const handleLoadDemoData = useCallback(async () => {
    const demoDataset = AVAILABLE_DATASETS.find(d => d.id === 'demo');
    if (demoDataset) {
      await handleLoadDataset(demoDataset);
    }
  }, [handleLoadDataset]);

  const handleLoadDemoDataOld = useCallback(async () => {
    setError(null);
    addMessage("Loading demo dataset...", 'user');
    setIsLoading(true);
    setLoadingMessage('Loading embedded dataset...');
    
    try {
      const demoData = await loadDemoDataset();
      clearDataCache(); // Clear cache for demo data
      setParsedData(demoData);
      // Set current dataset in store for report reconciliation
      await setCurrentDataset(demoData);
      setCompletedSteps(prev => new Set(prev).add(AppStep.Welcome));
      setCurrentStep(AppStep.Configure);
      
      addMessage("Perfect! I've loaded your dataset. Let me analyze the column structure and suggest appropriate roles for each column.");
      
      // Convert demo data back to CSV format for analysis
      if (demoData.length > 0) {
        const headers = Object.keys(demoData[0]);
        const csvLines = [headers.join(',')];
        const sampleRows = demoData.slice(0, 10).map(row => 
          headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(',')
        );
        csvLines.push(...sampleRows);
        const csvText = csvLines.join('\n');
        
        await handleColumnAnalysis(csvText);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load demo dataset.';
      setError(errorMessage);
      addMessage(`Sorry, I couldn't load the demo dataset. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [addMessage, handleColumnAnalysis]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setError(null);
      addMessage(`Uploading "${file.name}"...`, 'user');
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        try {
            const data = parseCSV(text);
            clearDataCache(); // Clear cache for uploaded CSV
            setParsedData(data);
            setCompletedSteps(prev => new Set(prev).add(AppStep.Welcome));
            setCurrentStep(AppStep.Configure);
            await handleColumnAnalysis(text);
        } catch(parseError) {
             const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error.';
             setError(`Failed to parse CSV: ${errorMessage}`);
             addMessage(`Sorry, I couldn't parse that CSV file. Details: ${errorMessage}`);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file.');
        addMessage('Sorry, I encountered an error reading that file.');
      }
      reader.readAsText(file);
    }
  }, [addMessage, handleColumnAnalysis]);

  const handleStepClick = useCallback((step: AppStep) => {
    if (completedSteps.has(step)) {
        setCurrentStep(step);
        addMessage(`Navigating to the ${AppStep[step].replace(/([A-Z])/g, ' $1').trim()} step.`, 'ai');
    }
  }, [completedSteps, addMessage]);

  const handleUserQuery = async (query: string) => {
    if (!query.trim()) return;
    addMessage(query, 'user');
    trackInteraction('chat_interaction');

    // --- Global Commands ---
    if (query.toLowerCase().includes('start over')) {
      handleStartOver();
      return;
    }
    if (currentStep === AppStep.Report && query.toLowerCase().includes('optimizer')) {
      handleGoToOptimizer();
      return;
    }

    // --- Configure Step Help ---
    if (currentStep === AppStep.Configure) {
      // First check if this is a column configuration command
      if (query.toLowerCase().includes('ignore') || query.toLowerCase().includes('set') || query.toLowerCase().includes('change')) {
        await handleColumnConfigurationCommand(query);
        setUserQuery('');
        setIsLoading(false);
        return;
      }
      
      const configQueries = [
        { keywords: ['marketing spend', 'what is marketing spend'], response: "Marketing Spend: Dollar amounts invested per channel (TV_Spend, Display_Spend, etc.)\n\nKey for ROI calculations and budget optimization." },
        { keywords: ['marketing activity', 'activity', 'impressions', 'clicks'], response: "Marketing Activity: Volume metrics like impressions, clicks, GRPs, emails sent.\n\nThese measure exposure and reach before conversion." },
        { keywords: ['dependent variable', 'kpi', 'target'], response: "Dependent Variable: Your main business metric to predict and optimize.\n\nExamples: Sales revenue, prescriptions, conversions. Choose your most important outcome." },
        { keywords: ['time dimension', 'date', 'week'], response: "Time Dimension: Enables trend analysis and captures how marketing effects evolve.\n\nWeekly or monthly data works best for MMM." },
        { keywords: ['control variable', 'external', 'seasonality'], response: "Control Variables: External factors affecting your business like seasonality, competitor activity, economic indicators, holidays.\n\nThese isolate true marketing impact." },
        { keywords: ['geo', 'geography', 'dma', 'region'], response: "Geographic Dimension: Identifies your analysis unit (DMA, region, store) for location-based modeling and local optimization." },
        { keywords: ['ignore', 'exclude'], response: "Ignore irrelevant columns: internal IDs, calculated fields, redundant data.\n\nKeep it focused on what drives results." },
        { keywords: ['proceed', 'continue', 'next', 'validation'], response: "Ready to validate? I'll run diagnostics on data quality, correlations, and channel sparsity before modeling." },
        { keywords: ['control variables', 'what are control'], response: "Control Variables account for external business influences (competition, economy, seasonality) to isolate your marketing impact." },
        { keywords: ['correlation', 'correlations', 'interpret correlation'], response: "Correlation measures how variables move together (-1 to +1):\n\nStrong (0.7+): Close relationship\nModerate (0.3-0.7): Some relationship\nWeak (<0.3): Little relationship\n\nHigh correlations between channels may indicate redundancy or shared effects." },
        { keywords: ['spend channels work', 'channels work in mmm', 'spend channels in mmm'], response: "Your spend channels provide the key inputs for MMM analysis:\n\nHigh variability channels (like TV, Display) give the model strong signals to measure impact. Consistent investment channels help establish baseline performance. Each channel's unique spending pattern helps isolate its individual contribution.\n\nMMM will measure how each dollar spent drives your business outcome." }
      ];

      for (const configQuery of configQueries) {
        if (configQuery.keywords.some(keyword => query.toLowerCase().includes(keyword))) {
          addMessage(configQuery.response);
          setUserQuery('');
          setIsLoading(false);
          return;
        }
      }
    }
    
    // --- Demo Data Loading ---
    if (currentStep === AppStep.Welcome && isDemoDataAvailable && 
        (query.toLowerCase().includes('load') || query.toLowerCase().includes('demo') || 
         query.toLowerCase().includes('start') || query.toLowerCase().includes('proceed'))) {
      await handleLoadDemoData();
      return;
    }

    // --- Step-Specific Conversational Logic ---
    setIsChatLoading(true);
    
    try {
      if (currentStep === AppStep.DataValidation) {
        // Check for channel approval/exclusion commands
        if (!awaitingColumnConfirmation && !awaitingEdaConfirmation &&
            (query.toLowerCase().includes('approve') || query.toLowerCase().includes('exclude') || 
             query.toLowerCase().includes('include') || query.toLowerCase().includes('remove'))) {
          await handleChannelApprovalCommand(query);
          setUserQuery('');
          setIsLoading(false);
          return;
        }
        
        if (awaitingColumnConfirmation) {
          const confirmation = await getConfirmationIntent(query);
          if (confirmation === 'affirmative') {
              setAwaitingColumnConfirmation(false);
              await handleProceedWithColumnSelection();
          } else if (confirmation === 'negative') {
              addMessage("No problem. Please adjust the column types on the right. Let me know when you're ready to try again.", 'ai');
          } else { // 'other' case
              const responseText = await getRealDataChatResponse(query, currentStep, {}, parsedData);
              addMessage(responseText, 'ai');
              addMessage("When you're ready to proceed with the column assignments, please say 'yes'.", 'ai');
          }
        } else if (awaitingEdaConfirmation) {
            const confirmation = await getConfirmationIntent(query);
            if(confirmation === 'affirmative') {
              await handleProceedToFeatures();
            } else if (confirmation === 'negative') {
              addMessage("Okay, please continue to review the diagnostics and approve/exclude channels. Let me know when you are ready to proceed.", 'ai');
            } else {
              const responseText = await getRealDataChatResponse(query, currentStep, {}, parsedData);
              addMessage(responseText, 'ai');
            }
        } else {
            const responseText = await getRealDataChatResponse(query, currentStep, {}, parsedData);
            addMessage(responseText, 'ai');
        }

      } else if (currentStep === AppStep.FeatureEngineering) {
          if (awaitingFeatureConfirmation) {
            const isFirstTimeConfirmation = !agentMessages.some(m => typeof m.text === 'string' && m.text.startsWith('Okay, acknowledged.'));
            if (isFirstTimeConfirmation) {
                const summaryText = await getFeatureConfirmationSummary(featureParams, userSelections);
                addMessage(summaryText, 'ai');
                addMessage("Does this look right? If so, say 'proceed to modeling'.", 'ai');
            } else {
                const confirmation = await getConfirmationIntent(query);
                if (confirmation === 'affirmative') {
                    await handleRunModels();
                } else {
                    addMessage("No problem. Please continue to adjust the feature parameters. Let me know when you are ready to proceed again.", 'ai');
                }
            }
          } else {
            const responseText = await getRealDataChatResponse(query, currentStep, { featureParams }, parsedData);
            addMessage(responseText, 'ai');
          }
      } else if (currentStep === AppStep.Modeling) {
        // Unified Modeling/Calibration Logic
        const activeModel = modelLeaderboard.find(m => m.id === activeModelId);
        
        // Prioritize finalize command
        if (activeModelId && query.toLowerCase().includes('finalize')) {
            addMessage(`You'd like to finalize model ${activeModelId}. Are you sure? This will generate the final report.`, 'ai');
            setAwaitingFinalizeConfirmation(true);
        } else if (awaitingFinalizeConfirmation) {
            const confirmation = await getConfirmationIntent(query);
            if (confirmation === 'affirmative') {
                handleFinalizeModel();
            } else {
                setAwaitingFinalizeConfirmation(false);
                addMessage("Okay, finalization cancelled. You can continue to explore and calibrate the models.", 'ai');
            }
        } else {
            // Check if it's a calibration command first, only if a model is active
            let isCalibrationQuery = false;
            if (activeModel) {
                 const calibrationKeywords = ['adstock', 'lag', 'include', 'exclude', 'remove', 'add back', 'set', 'change'];
                 isCalibrationQuery = calibrationKeywords.some(k => query.toLowerCase().includes(k));
            }

            if(isCalibrationQuery && activeModel) {
                addMessage(`Okay, applying this change to model ${activeModelId}...`, 'ai');
                const result: CalibrationInteractionResponse = await getCalibrationInteraction(query, activeModel);
                addMessage(result.text, 'ai');
                setModelLeaderboard(prev => prev.map(m => m.id === activeModelId ? result.updatedModel : m));
            } else {
                // Otherwise, treat as a general modeling query (question, rerun, select)
                const result: ModelingInteractionResponse = await getModelingInteraction(query, modelLeaderboard);
                addMessage(result.text, 'ai');
                if (result.newModel) {
                    setModelLeaderboard(prev => [...prev, result.newModel!]);
                }
                if (result.selectModelId) {
                    const modelToSelect = modelLeaderboard.find(m => m.id === result.selectModelId);
                    if (modelToSelect) {
                        setActiveModelId(result.selectModelId);
                        addMessage(`Model ${result.selectModelId} is now active. Its details and controls are shown on the right.`, 'ai');
                    } else {
                        addMessage(`I couldn't find model "${result.selectModelId}". Please check the ID and try again.`, 'ai');
                    }
                }
            }
        }
      } else if (currentStep === AppStep.Optimize) {
          if (!finalizedModel) {
              addMessage("Something went wrong. A model needs to be finalized before optimization.", 'ai');
              return;
          }

          // Enhanced query processing for optimization
          const lowerQuery = query.toLowerCase();
          
          // Handle specific optimization patterns
          if (lowerQuery.includes('explain') && (lowerQuery.includes('rationale') || lowerQuery.includes('allocation'))) {
            const activeScenario = optimizationScenarios.find(s => s.id === activeScenarioId);
            if (activeScenario) {
              const totalSpend = Math.round(activeScenario.recommendedSpend);
              const roi = activeScenario.projectedROI.toFixed(1);
              addMessage(`This allocation strategy focuses on optimizing your $${totalSpend}M budget for maximum efficiency. The projected ${roi}x ROI is achieved by reallocating spend toward your highest-performing channels while maintaining portfolio diversification. Key shifts include scaling up channels with strong marginal returns and reducing investment in saturated areas. This data-driven approach balances short-term efficiency with long-term growth sustainability.`, 'ai');
              return;
            }
          }

          if (lowerQuery.includes('compare') && (lowerQuery.includes('scenario') || lowerQuery.includes('side-by-side'))) {
            if (optimizationScenarios.length >= 2) {
              const scenario1 = optimizationScenarios[0];
              const scenario2 = optimizationScenarios[1];
              addMessage(`Scenario Comparison Analysis:

${scenario1.title}: $${Math.round(scenario1.recommendedSpend)}M budget, ${scenario1.projectedROI.toFixed(1)}x ROI, $${Math.round(scenario1.netRevenue)}M net revenue
${scenario2.title}: $${Math.round(scenario2.recommendedSpend)}M budget, ${scenario2.projectedROI.toFixed(1)}x ROI, $${Math.round(scenario2.netRevenue)}M net revenue

Key Trade-offs: ${scenario1.projectedROI > scenario2.projectedROI ? scenario1.title + ' prioritizes efficiency' : scenario2.title + ' prioritizes efficiency'} while ${scenario1.recommendedSpend > scenario2.recommendedSpend ? scenario1.title + ' focuses on scale' : scenario2.title + ' focuses on scale'}. Choose based on your strategic priorities: efficiency vs. volume growth.`, 'ai');
              return;
            } else {
              addMessage("You need at least 2 scenarios to compare. Let me help you create another optimization scenario first.", 'ai');
              return;
            }
          }

          addMessage("Perfect! Let me create a strategic optimization scenario based on your request. Analyzing market dynamics and efficiency curves...", 'ai');
          setIsChatLoading(true);

          const result: OptimizerInteractionResponse = await getOptimizerInteraction(query, finalizedModel, optimizationScenarios);
          addMessage(result.text, 'ai');

          const newScenarioCount = optimizationScenarios.length + 1;
          const newScenarioToAdd: OptimizerScenario = {
              ...result.newScenario,
              // Force a unique ID to prevent UI bugs from ID collisions
              id: `scenario_${newScenarioCount}_${Date.now()}`,
              // Create a consistent, numbered title
              title: `Scenario ${newScenarioCount}: ${result.newScenario.title}`,
          };

          setOptimizationScenarios(prev => [...prev, newScenarioToAdd]);
          setActiveScenarioId(newScenarioToAdd.id);

      } else {
        // Check for step-specific quick responses
        const validationQueries = [
          { keywords: ['sparsity', 'gaps', 'zero'], response: "Sparsity: Percentage of zero/null values.\n\nHigh sparsity (>50%) can hurt model accuracy. Consider excluding sparse channels or investigating data collection issues." },
          { keywords: ['volatility', 'variation', 'cv'], response: "Volatility (CV): Coefficient of variation measuring fluctuation.\n\nHigh volatility (>100%) may indicate unstable spend patterns or seasonal effects." },
          { keywords: ['approve', 'include', 'good'], response: "Approved channels will be included in modeling. You can exclude problematic ones anytime." },
          { keywords: ['exclude', 'remove', 'bad'], response: "Excluded channels won't be modeled. Use for channels with poor data quality or business reasons." },
          { keywords: ['diagnostic', 'health', 'quality'], response: "Channel diagnostics show data quality metrics: sparsity, volatility, and trends to help you decide inclusion." }
        ];
        
        if (currentStep === AppStep.DataValidation) {
          for (const validationQuery of validationQueries) {
            if (validationQuery.keywords.some(keyword => query.toLowerCase().includes(keyword))) {
              addMessage(validationQuery.response);
              return;
            }
          }
        }
        
        // Fallback for other steps - but handle Welcome step specially if we have data
        if (currentStep === AppStep.Welcome && parsedData.length === 0) {
          addMessage("Upload data first to start analysis.", 'ai');
        } else {
          const context = { currentStep: AppStep[currentStep], dataSummary: parsedData.length > 0 ? { columns: Object.keys(parsedData[0] || {}), rows: parsedData.length } : 'No data loaded.' };
          const responseText = await getRealDataChatResponse(query, currentStep, context, parsedData);
          addMessage(responseText, 'ai');
        }
      }
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        addMessage(`Error: ${errorMessage}`, 'ai');
    } finally {
        setIsChatLoading(false);
        setUserQuery('');
    }
  };

  // Handle column configuration commands via natural language
  const handleColumnConfigurationCommand = useCallback(async (command: string) => {
    const lowerCommand = command.toLowerCase();
    const currentSelections = {...userSelections};
    let changesApplied = 0;
    
    // Parse "ignore X, Y, and Z" commands
    if (lowerCommand.includes('ignore')) {
      const columnNames = Object.keys(currentSelections);
      
      // Extract column names mentioned in the command
      for (const columnName of columnNames) {
        if (lowerCommand.includes(columnName.toLowerCase())) {
          currentSelections[columnName] = ColumnType.IGNORE;
          changesApplied++;
        }
      }
      
      // Also check for partial matches and common terms
      const ignorePatterns = [
        { pattern: 'population', type: ColumnType.IGNORE },
        { pattern: 'competitor', type: ColumnType.IGNORE },
        { pattern: 'seasonality', type: ColumnType.IGNORE },
      ];
      
      for (const {pattern, type} of ignorePatterns) {
        if (lowerCommand.includes(pattern)) {
          for (const columnName of columnNames) {
            if (columnName.toLowerCase().includes(pattern)) {
              currentSelections[columnName] = type;
              changesApplied++;
            }
          }
        }
      }
    }
    
    // Parse "set X to Y" commands
    const setMatch = lowerCommand.match(/set (.+?) to (.+)/);
    if (setMatch) {
      const [, columnPart, typePart] = setMatch;
      const columnNames = Object.keys(currentSelections);
      const targetColumn = columnNames.find(col => 
        columnPart.toLowerCase().includes(col.toLowerCase()) || 
        col.toLowerCase().includes(columnPart.toLowerCase())
      );
      
      const targetType = Object.values(ColumnType).find(type => 
        type.toLowerCase().includes(typePart.toLowerCase()) ||
        typePart.toLowerCase().includes(type.toLowerCase())
      );
      
      if (targetColumn && targetType) {
        currentSelections[targetColumn] = targetType;
        changesApplied++;
      }
    }
    
    if (changesApplied > 0) {
      setUserSelections(currentSelections);
      addMessage(`✅ Applied ${changesApplied} column configuration change(s). You can review the updated assignments on the right.`, 'ai');
    } else {
      addMessage("I couldn't identify specific columns to modify from your request. Could you be more specific about which columns you'd like to change? For example: 'set TV_Spend to Marketing Spend' or 'ignore DMA_Population'", 'ai');
    }
  }, [userSelections, addMessage]);

  // Handle channel approval/exclusion commands via natural language
  const handleChannelApprovalCommand = useCallback(async (command: string) => {
    const lowerCommand = command.toLowerCase();
    const currentDiagnostics = [...channelDiagnostics];
    let changesApplied = 0;
    
    // Parse approval/exclusion commands
    if (lowerCommand.includes('exclude') || lowerCommand.includes('remove')) {
      for (const diagnostic of currentDiagnostics) {
        if (lowerCommand.includes(diagnostic.name.toLowerCase())) {
          diagnostic.isApproved = false;
          changesApplied++;
        }
      }
    }
    
    if (lowerCommand.includes('approve') || lowerCommand.includes('include')) {
      for (const diagnostic of currentDiagnostics) {
        if (lowerCommand.includes(diagnostic.name.toLowerCase())) {
          diagnostic.isApproved = true;
          changesApplied++;
        }
      }
    }
    
    // Handle "approve all" or "exclude all" commands
    if (lowerCommand.includes('all')) {
      if (lowerCommand.includes('approve') || lowerCommand.includes('include')) {
        currentDiagnostics.forEach(d => d.isApproved = true);
        changesApplied = currentDiagnostics.length;
      } else if (lowerCommand.includes('exclude') || lowerCommand.includes('remove')) {
        currentDiagnostics.forEach(d => d.isApproved = false);
        changesApplied = currentDiagnostics.length;
      }
    }
    
    if (changesApplied > 0) {
      trackInteraction('approve_exclude');
      setChannelDiagnostics(currentDiagnostics);
      addMessage(`✅ Updated approval status for ${changesApplied} channel(s). Check the diagnostics panel on the right to see the changes.`, 'ai');
    } else {
      addMessage("I couldn't identify specific channels to modify from your request. Try being more specific, like 'exclude TV channel' or 'approve Display and Search'", 'ai');
    }
  }, [channelDiagnostics, addMessage]);

  const handleChatActionClick = (actionText: string) => {
    // Handle special action commands
    if (actionText === "Load demo dataset") {
      handleLoadDemoData();
      return;
    }
    if (actionText === "Proceed to feature engineering") {
      handleProceedToFeatures();
      return;
    }
    if (actionText === "Run models with these parameters") {
      handleRunModels();
      return;
    }
    if (actionText === "Finalize this model") {
      if (activeModelId) {
        addMessage(`Please confirm: finalize model ${activeModelId}?`, 'ai');
        setAwaitingFinalizeConfirmation(true);
      }
      return;
    }
    if (actionText === "Go to budget optimization") {
      handleGoToOptimizer();
      return;
    }
    
    // Default: handle as a chat query
    handleUserQuery(actionText);
  };

  const handleRequestRecalibration = (updatedModel: ModelRun) => {
    if (recalibrationTimer) {
        clearTimeout(recalibrationTimer);
    }
    // Set loading state for the model view immediately
    setIsRecalibrating(true);
    // Directly update the state to give immediate visual feedback on the controls
    setModelLeaderboard(prev => prev.map(m => m.id === updatedModel.id ? updatedModel : m));

    const timer = setTimeout(async () => {
        try {
            const newModel = await rerunModel(updatedModel);
            
            setModelLeaderboard(prev => {
                // Replace the draft model with the new one and sort by newness
                const otherModels = prev.filter(m => m.id !== updatedModel.id);
                return [newModel, ...otherModels];
            });
            setActiveModelId(newModel.id);
            addMessage(`Recalibration complete. The new model, **${newModel.id}**, is now active and has been added to the leaderboard.`, 'ai');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            addMessage(`Sorry, the recalibration failed. Error: ${errorMessage}`, 'ai');
            // Revert the temporary change on failure
            setModelLeaderboard(prev => prev.map(m => m.id === updatedModel.id ? modelLeaderboard.find(original => original.id === updatedModel.id) || m : m));
        } finally {
            setIsRecalibrating(false);
        }
    }, 2000); // 2-second debounce

    setRecalibrationTimer(timer);
  };

  const renderContent = () => {
    switch (currentStep) {
      case AppStep.Welcome:
        return (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <div className="max-w-4xl w-full">
              <div className="text-center space-y-8">
                {/* Header Section */}
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold text-gray-900">
                    MixMind - Agentic Marketing Mix Modeling
                  </h1>
                  <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                    AI-Powered Marketing Attribution & Budget Optimization
                  </p>
                  <div className="w-20 h-1 bg-gradient-to-r from-[#EC7200] to-[#FF8C24] mx-auto rounded-full"></div>
                </div>

                
                {/* Upload Options */}
                <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  {/* File Upload */}
                  <label className="cursor-pointer group h-full">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      disabled={isLoading}
                      className="hidden"
                    />
                    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#EC7200] hover:shadow-xl transition-all duration-300 p-8 group-hover:scale-[1.02] h-full flex flex-col">
                      <div className="flex flex-col items-center space-y-4 flex-grow justify-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#EC7200] to-[#FF8C24] rounded-2xl flex items-center justify-center transform group-hover:rotate-3 transition-transform duration-300">
                          <UploadIcon className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-center flex-grow flex flex-col justify-center">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Your Data</h3>
                          <p className="text-gray-600 text-sm leading-relaxed mb-6">
                            Upload a CSV file with your weekly marketing data, 
                            channels, and KPI metrics
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-500 mt-auto">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>CSV files only</span>
                        </div>
                      </div>
                    </div>
                  </label>

                  {/* Demo Datasets */}
                  <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-8 h-full flex flex-col">
                    <div className="flex flex-col items-center space-y-4 flex-grow">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Try Sample Data</h3>
                        <p className="text-gray-600 text-sm leading-relaxed mb-6">
                          Explore the platform with pharmaceutical 
                          MMM sample datasets
                        </p>
                      </div>
                      
                      {AVAILABLE_DATASETS.length > 0 && (
                        <div className="w-full space-y-2 flex-grow flex flex-col justify-center">
                          {AVAILABLE_DATASETS.map((dataset) => (
                            <button
                              key={dataset.id}
                              onClick={() => handleLoadDataset(dataset)}
                              disabled={isLoading}
                              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-[#EC7200] hover:text-white rounded-lg disabled:opacity-50 transition-all duration-200 group text-sm"
                            >
                              <span className="font-medium">{dataset.filename}</span>
                              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Features Preview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto pt-4">
                  <div className="text-center p-6 bg-white rounded-xl shadow-md border border-gray-100">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-2">Data Analysis</h4>
                    <p className="text-sm text-gray-600">Automated EDA & diagnostics</p>
                  </div>
                  <div className="text-center p-6 bg-white rounded-xl shadow-md border border-gray-100">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-2">Model Building</h4>
                    <p className="text-sm text-gray-600">Advanced MMM algorithms</p>
                  </div>
                  <div className="text-center p-6 bg-white rounded-xl shadow-md border border-gray-100">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-2">Optimization</h4>
                    <p className="text-sm text-gray-600">Budget allocation strategies</p>
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl max-w-2xl mx-auto">
                  <p className="text-red-700 text-center">{error}</p>
                </div>
              )}
            </div>
          </div>
        );
      
      case AppStep.Configure:
        return <Configure 
            edaResults={edaResults} 
            selections={userSelections}
            onSelectionsChange={(selections) => {
              setUserSelections(selections);
              trackInteraction('column_assignment');
            }}
            onProceed={handleProceedToValidation}
            isLoading={isLoading}
            onQuestionClick={handleChatActionClick}
        />;
      
      case AppStep.DataValidation:
        return <DataValidation 
            selections={userSelections}
            insights={edaInsights}
            diagnostics={channelDiagnostics}
            onDiagnosticsChange={setChannelDiagnostics}
            isLoadingInsights={isLoading && loadingMessage.includes('diagnostics')}
            parsedData={parsedData}
            onProceed={handleProceedToFeatureEngineering}
            />
      
      case AppStep.FeatureEngineering:
        return <FeatureEngineering 
          initialParams={featureParams} 
          onParamsChange={setFeatureParams}
          agentSummary={featureEngineeringSummary}
          onProceed={handleRunModels}
          isLoading={isLoading}
        />

      case AppStep.Modeling: {
        // Generate current hashes to compare with model provenance
        const approvedChannels = channelDiagnostics.filter(c => c.isApproved).map(c => c.name);
        const currentFeaturesHash = JSON.stringify(approvedChannels.sort()).slice(0, 8);
        const currentRangesHash = featureParams ? JSON.stringify(featureParams.map(f => ({ 
          channel: f.channel, 
          adstock: f.adstock, 
          lag: f.lag, 
          transform: f.transform 
        })).sort((a, b) => a.channel.localeCompare(b.channel))).slice(0, 8) : 'default';
        
        return <ModelingView
            models={modelLeaderboard}
            selectedChannels={approvedChannels}
            activeModelId={activeModelId}
            onSetActiveModel={setActiveModelId}
            onModelChange={handleRequestRecalibration}
            onRequestFinalize={handleRequestFinalizeModel}
            isRecalibrating={isRecalibrating}
            onRecalibrate={(selectedChannels, updatedParams) => {
              if (selectedChannels && updatedParams) {
                // Update feature params to only include selected channels
                setFeatureParams(updatedParams);
                // Update channel diagnostics to reflect new selection
                setChannelDiagnostics(prev => 
                  prev.map(diag => ({
                    ...diag,
                    isApproved: selectedChannels.includes(diag.name)
                  }))
                );
              }
              handleRunModels();
            }}
            onModelsUpdated={(newModels) => {
              // Mark new models with isNew flag and generate unique IDs
              const markedResults = newModels.map((model, index) => ({
                ...model,
                id: `${model.id}_${Date.now()}_${index}`, // Ensure unique IDs
                isNew: true
              }));
              
              // Mark all existing models as not new anymore
              const existingModels = modelLeaderboard.map(m => ({ ...m, isNew: false }));
              
              // Append new models to existing ones
              setModelLeaderboard([...existingModels, ...markedResults]);
              
              // Select first new model if no model is currently active
              if (markedResults.length > 0 && !activeModelId) {
                setActiveModelId(markedResults[0].id);
              }
              
              console.log(`[App] Added ${markedResults.length} new models from recalibration`);
            }}
            currentFeaturesHash={currentFeaturesHash}
            currentRangesHash={currentRangesHash}
            featureParams={featureParams}
        />
      }
      
      case AppStep.Report: {
        const approvedChannels = channelDiagnostics.filter(c => c.isApproved).map(c => c.name);
        return <RevertedFinalReport 
          activeModelId={finalizedModel?.id || null}
          models={modelLeaderboard}
          selectedChannels={approvedChannels}
          onGoToOptimizer={handleGoToOptimizer}
          onRecalibrate={handleRunModels}
        />;
      }

      case AppStep.Optimize: {
        const approvedChannels = channelDiagnostics.filter(c => c.isApproved).map(c => c.name);
        return <EnhancedOptimizer
          activeModelId={finalizedModel?.id || null}
          models={modelLeaderboard}
          selectedChannels={approvedChannels}
          scenarios={optimizationScenarios}
          activeScenarioId={activeScenarioId}
          onSelectScenario={setActiveScenarioId}
          onUpdateScenario={handleUpdateScenario}
          onCreateScenario={handleCreateScenario}
          onRecalibrate={handleRunModels}
        />;
      }

      default:
        return null;
    }
  };

  const showUserInput = ![AppStep.Welcome].includes(currentStep);

  // Filter messages based on feature flags
  const filteredMessages = CHAT_UI_PILLS_ONLY 
    ? agentMessages.filter(message => {
        // Filter out suggestion/insight messages when pills-only mode is enabled
        if (message.sender === 'ai' && message.meta) {
          return !(['suggestion', 'insight', 'validate_suggestions'].includes(message.meta.kind || '') || message.meta.suggestion === true);
        }
        return true;
      })
    : agentMessages;

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen font-sans bg-[#F4F3F3] text-[#1A1628]">
      <div className="w-full max-w-md bg-white flex flex-col p-4 border-r border-gray-200">
        <div className="mb-4 pb-3 border-b border-gray-200">
          <Logo />
        </div>
        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
          {filteredMessages.map(msg => <ChatMessage key={msg.id} message={msg} onActionClick={handleChatActionClick} />)}
          {(isLoading || isChatLoading) && <ChatMessage message={{id:0, sender:'ai', text:<Loader />}} onActionClick={handleChatActionClick} />}
          <div ref={messagesEndRef} />
        </div>
        
        {/* QuickActions Bar - Pills only under composer */}
        {CHAT_UI_PILLS_ONLY ? (
          <div className="border-t border-gray-200 pt-3 mb-3">
            {getDynamicSuggestions().length > 0 ? (
              <QuickActionsBar 
                suggestions={getDynamicSuggestions()}
                onActionClick={handleChatActionClick}
                isDisabled={isLoading || isChatLoading || isRecalibrating}
                maxPills={6}
                maxChars={60}
              />
            ) : parsedData.length === 0 && currentStep !== AppStep.Welcome ? (
              <div className="text-xs text-gray-400 italic text-center py-2 px-4">
                Upload data to see contextual suggestions
              </div>
            ) : null}
          </div>
        ) : (
          /* Legacy mode - original suggestion panel */
          <div className="border-t border-gray-200 pt-3 mb-3">
            {getDynamicSuggestions().length > 0 ? (
              <>
                <div className="text-xs text-gray-500 mb-2">💡 What would you like to explore?</div>
                <div className="flex flex-wrap gap-1">
                  {getDynamicSuggestions().slice(0, 3).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleChatActionClick(suggestion.text)}
                      disabled={isLoading || isChatLoading || isRecalibrating}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        suggestion.style === 'primary' 
                          ? 'bg-[#EC7200] text-white border-[#EC7200] hover:bg-[#d86800] disabled:hover:bg-[#EC7200]' 
                          : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 disabled:hover:bg-gray-50'
                      }`}
                    >
                      {suggestion.text}
                    </button>
                  ))}
                </div>
              </>
            ) : parsedData.length === 0 && currentStep !== AppStep.Welcome ? (
              <div className="text-xs text-gray-400 italic text-center py-2">
                Upload data to see contextual suggestions
              </div>
            ) : null}
          </div>
        )}
        {showUserInput && (
           <UserInput 
            value={userQuery}
            onValueChange={setUserQuery}
            onSubmit={handleUserQuery}
            placeholder={"Ask a question or give a command..."} 
            disabled={isLoading || isChatLoading || isRecalibrating}
           />
        )}
      </div>
      <main className="flex-1 flex flex-col bg-[#F4F3F3]">
        <div className="p-6 border-b border-gray-200 bg-white">
          <StepIndicator currentStep={currentStep} completedSteps={completedSteps} onStepClick={handleStepClick} />
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {isLoading && !isChatLoading && !edaInsights && currentStep !== AppStep.DataValidation && currentStep !== AppStep.Optimize ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Loader />
              <p className="text-xl mt-4 text-gray-700">{loadingMessage}</p>
              <p className="text-gray-500">This may take a moment.</p>
            </div>
          ) : renderContent()}
        </div>
      </main>
      
      <TrainingProgress 
        isVisible={showTrainingProgress}
        onComplete={handleTrainingComplete}
        minDuration={900}
      />
      
      {/* Staged Model Training */}
      <StagedModelTraining 
        isActive={showStagedTraining}
        onComplete={handleStagedTrainingComplete}
        selectedChannels={channelDiagnostics.filter(c => c.isApproved).map(c => c.name)}
        algorithmCount={4}
      />
    </div>
  );
};

export default App;