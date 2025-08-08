import {
    getEnhancedEdaInsights,           // Real EDA calculations
    generateEnhancedModelLeaderboard, // Real regression modeling  
    getRealDataChatResponse,          // Real data analysis
  } from './services/hybridAnalysisService';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppStep, EdaResult, UserColumnSelection, ColumnType, AgentMessage, ParsedData, EdaInsights, FeatureParams, ModelRun, ChannelDiagnostic, ColumnSummaryItem, ModelingInteractionResponse, CalibrationInteractionResponse, ModelDetail, OptimizerScenario, OptimizerInteractionResponse } from './types';
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
import { Loader } from './components/Loader';
import { UploadIcon } from './components/icons/UploadIcon';
import { UserInput } from './components/UserInput';
import { csvParse, DSVRowString } from 'd3-dsv';
import { DataValidation } from './components/DataValidation';
import { FeatureEngineering } from './components/FeatureEngineering';
import { ModelingView } from './components/ModelingView';
import { FinalReport } from './components/FinalReport';
import { Optimizer } from './components/Optimizer';
import { ColumnSummaryTable } from './components/ColumnSummaryTable';
import { generateInitialScenarios } from './services/optimizerUtils.ts';
import { Logo } from './components/Logo.tsx';
import { loadDemoDataset, getDemoDatasetInfo, isDemoModeAvailable } from './services/demoDataService.ts';


const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.Welcome);
  const [completedSteps, setCompletedSteps] = useState<Set<AppStep>>(new Set([AppStep.Welcome]));
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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
  
  // States to manage conversational flow
  const [awaitingColumnConfirmation, setAwaitingColumnConfirmation] = useState(false);
  const [awaitingEdaConfirmation, setAwaitingEdaConfirmation] = useState(false);
  const [awaitingFeatureConfirmation, setAwaitingFeatureConfirmation] = useState(false);
  const [awaitingFinalizeConfirmation, setAwaitingFinalizeConfirmation] = useState(false);
  const [isRecalibrating, setIsRecalibrating] = useState<boolean>(false);
  const [recalibrationTimer, setRecalibrationTimer] = useState<NodeJS.Timeout | null>(null);


  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [agentMessages]);
  
  const addMessage = useCallback((text: string | React.ReactNode, sender: 'ai' | 'user' = 'ai') => {
    const id = Date.now() + Math.random();
    setAgentMessages(prev => [...prev, { id, sender, text, actions: [] }]);
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      // Check if demo data is available
      const demoAvailable = await isDemoModeAvailable();
      setIsDemoDataAvailable(demoAvailable);
      
      if (demoAvailable) {
        addMessage(getDemoDatasetInfo());
        addMessage("Ready to start! I can either load your pre-configured dataset automatically or you can upload your own CSV file. What would you like to do?");
      } else {
        addMessage("Hello! I'm your Marketing Mix Modeling AI assistant. I'll guide you through analyzing your marketing data to uncover key insights. Let's start by uploading your data in CSV format.");
      }
    };
    
    initializeApp();
  }, [addMessage]);
  
  const handleGoToOptimizer = useCallback(() => {
    if (!finalizedModel) return;
    setCompletedSteps(prev => new Set(prev).add(AppStep.Report));
    setCurrentStep(AppStep.Optimize);
    const initialScenarios = generateInitialScenarios(finalizedModel);
    setOptimizationScenarios(initialScenarios);
    setActiveScenarioId(initialScenarios[0].id);

    addMessage(
        <>
            <p>Excellent. Welcome to the Budget Optimizer. I've created three starter scenarios based on your model. You can explore them using the list on the left.</p>
            <p className="mt-2">To create a custom plan, just tell me your goals. For example:
            <br/>- 'What's the best allocation for a $250M budget?'
            <br/>- 'Maximize prescriptions, I can spend up to $400M.'</p>
        </>,
        'ai'
    );
  }, [addMessage, finalizedModel]);

  const handleStartOver = useCallback(() => {
    setCurrentStep(AppStep.Welcome);
    setCompletedSteps(new Set([AppStep.Welcome]));
    setAgentMessages([]);
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
    setTimeout(() => addMessage("Hello again! Let's start a new analysis. Please upload your CSV file when you're ready."), 100);
  }, [addMessage]);

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
    addMessage("Great choices. Starting the modeling process...");
    setIsLoading(true);
    setLoadingMessage('Running 50+ model iterations...');
    setError(null);
    setCompletedSteps(prev => new Set(prev).add(AppStep.FeatureEngineering));
    setCurrentStep(AppStep.Modeling);
    addMessage("I'm now running a suite of simulated modeling techniques to find the most reliable result. This may take a moment...");
    try {
      const results = await generateEnhancedModelLeaderboard(userSelections, featureParams, userQuery, parsedData);
      setModelLeaderboard(results);
      addMessage("Modeling complete! Here is the new Modeling Workspace. The leaderboard is on the left. Click a model ID to see its detailed results and calibration controls on the right. You can ask me questions about these results (e.g., 'What is the TV impact in br_1?'), request a re-run with new parameters, or tune the active model via chat.");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during modeling.';
      setError(`Modeling failed: ${errorMessage}`);
      addMessage(`I'm sorry, the modeling simulation failed. Error: ${errorMessage}.`);
      setCurrentStep(AppStep.FeatureEngineering);
    } finally {
      setIsLoading(false);
      setUserQuery('');
    }
  }, [addMessage, userSelections, parsedData, userQuery, featureParams]);

  const handleProceedToFeatures = useCallback(async () => {
    const approvedChannels = channelDiagnostics.filter(d => d.isApproved).map(d => d.name);
    if(approvedChannels.length === 0) {
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
      const features = await recommendFeatures(userSelections, approvedChannels, userQuery);
      setFeatureParams(features);
      const summary = await getFeatureEngineeringSummary(features);
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
        const insightsResult = await getEnhancedEdaInsights(selections, data, query);
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
            <p>I've completed the diagnostics. Here's a quick summary:</p>
            <ul className="list-disc list-inside mt-2 text-sm">
                <li><strong>KPI Trend:</strong> {insightsResult.trendsSummary}</li>
                <li><strong>Data Quality:</strong> {insightsResult.diagnosticsSummary}</li>
            </ul>
            <p className="mt-2">You can see the detailed charts and channel-specific diagnostics on the right. Please review and approve the channels you want to include in the model.</p>
        </>;

        addMessage(edaSummaryText, 'ai');
        addMessage("Once you've reviewed the diagnostics and approved the channels, just say 'proceed to features' to continue.", 'ai');
        setAwaitingEdaConfirmation(true);

    } catch (e) {
        // Error is handled in runEdaAndUpdateState
    } finally {
        setUserQuery('');
    }
  }, [addMessage, userSelections, parsedData, runEdaAndUpdateState]);

  useEffect(() => {
    if (currentStep === AppStep.DataValidation && hasRunInitialEda) {
        const handler = setTimeout(() => {
            runEdaAndUpdateState(userSelections, parsedData, '');
        }, 1000); 

        return () => {
            clearTimeout(handler);
        };
    }
  }, [userSelections, currentStep, hasRunInitialEda, parsedData, runEdaAndUpdateState]);

  const handleColumnAnalysis = useCallback(async (fileText: string) => {
    setIsLoading(true);
    setLoadingMessage('Analyzing columns...');
    addMessage("Great! I'm now analyzing the columns to understand the data structure.");
    try {
      const results = await analyzeColumns(fileText);
      setEdaResults(results);
      const initialSelections = results.reduce((acc, r) => ({ ...acc, [r.columnName]: r.suggestedType }), {});
      setUserSelections(initialSelections);

      const roleOrder = [ ColumnType.DEPENDENT_VARIABLE, ColumnType.TIME_DIMENSION, ColumnType.GEO_DIMENSION, ColumnType.MARKETING_SPEND, ColumnType.MARKETING_ACTIVITY, ColumnType.CONTROL_VARIABLE, ColumnType.IGNORE ];
      const summaryData: ColumnSummaryItem[] = roleOrder.map(role => ({ role, columns: Object.entries(initialSelections).filter(([, r]) => r === role).map(([col]) => col) })).filter(summary => summary.columns.length > 0);
      
      addMessage(
        <>
          <p>Analysis complete! I've suggested a role for each column. Here's a summary:</p>
          <ColumnSummaryTable summary={summaryData} />
        </>, 'ai');

      addMessage("Please review the roles on the right. You can change them if needed. When you are happy with the assignments, say 'yes' to proceed.", 'ai');
      
      setAwaitingColumnConfirmation(true);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during column analysis.';
      setError(`Analysis failed: ${errorMessage}`);
      addMessage(`I'm sorry, I ran into an issue. Error: ${errorMessage}. Please check your data or API key.`);
      setCurrentStep(AppStep.Welcome);
    } finally {
      setIsLoading(false);
    }
  }, [addMessage]);

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
  
  const handleLoadDemoData = useCallback(async () => {
    setError(null);
    addMessage("Loading demo dataset...", 'user');
    setIsLoading(true);
    setLoadingMessage('Loading embedded dataset...');
    
    try {
      const demoData = await loadDemoDataset();
      setParsedData(demoData);
      setCompletedSteps(prev => new Set(prev).add(AppStep.Welcome));
      setCurrentStep(AppStep.DataValidation);
      
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
            setParsedData(data);
            setCompletedSteps(prev => new Set(prev).add(AppStep.Welcome));
            setCurrentStep(AppStep.DataValidation);
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

    // --- Global Commands ---
    if (query.toLowerCase().includes('start over')) {
      handleStartOver();
      return;
    }
    if (currentStep === AppStep.Report && query.toLowerCase().includes('optimizer')) {
      handleGoToOptimizer();
      return;
    }
    
    // --- Demo Data Loading ---
    if (currentStep === AppStep.Welcome && isDemoDataAvailable && 
        (query.toLowerCase().includes('load') || query.toLowerCase().includes('demo') || 
         query.toLowerCase().includes('start') || query.toLowerCase().includes('proceed'))) {
      await handleLoadDemoData();
      return;
    }

    // --- Step-Specific Conversational Logic ---
    setIsLoading(true);
    setLoadingMessage('Thinking...');
    
    try {
      if (currentStep === AppStep.DataValidation) {
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
          addMessage("Okay, let's create a custom scenario. Analyzing your request...", 'ai');
          setLoadingMessage('Generating new optimization scenario...');

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
        // Fallback for other steps
        const context = { currentStep: AppStep[currentStep], dataSummary: parsedData.length > 0 ? { columns: Object.keys(parsedData[0] || {}), rows: parsedData.length } : 'No data loaded.' };
        const responseText = await getRealDataChatResponse(query, currentStep, context, parsedData);
        addMessage(responseText, 'ai');
      }
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        addMessage(`Sorry, I couldn't process that. Error: ${errorMessage}`, 'ai');
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
        setUserQuery('');
    }
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
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="space-y-4">
              {isDemoDataAvailable && (
                <button 
                  onClick={handleLoadDemoData}
                  disabled={isLoading}
                  className="primary-button inline-flex items-center justify-center mb-2"
                >
                  🚀 Load Demo Dataset
                </button>
              )}
              
              <div className={isDemoDataAvailable ? "relative" : ""}>
                {isDemoDataAvailable && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
                    or
                  </div>
                )}
                <label htmlFor="file-upload" className="primary-button cursor-pointer inline-flex items-center justify-center mt-2">
                  <UploadIcon className="w-6 h-6 mr-3" />
                  Upload Your Own CSV
                </label>
              </div>
            </div>
            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
            {error && <p className="mt-4 text-red-600" role="alert">{error}</p>}
          </div>
        );
      
      case AppStep.DataValidation:
        return <DataValidation 
            edaResults={edaResults} 
            selections={userSelections}
            onSelectionsChange={setUserSelections}
            insights={edaInsights}
            diagnostics={channelDiagnostics}
            onDiagnosticsChange={setChannelDiagnostics}
            isLoadingInsights={isLoading && loadingMessage.includes('diagnostics')}
            parsedData={parsedData}
            />
      
      case AppStep.FeatureEngineering:
        return <FeatureEngineering 
          initialParams={featureParams} 
          onParamsChange={setFeatureParams}
          agentSummary={featureEngineeringSummary}
        />

      case AppStep.Modeling:
        return <ModelingView
            models={modelLeaderboard}
            activeModelId={activeModelId}
            onSetActiveModel={setActiveModelId}
            onModelChange={handleRequestRecalibration}
            onRequestFinalize={handleRequestFinalizeModel}
            isRecalibrating={isRecalibrating}
        />
      
      case AppStep.Report:
        return <FinalReport 
          model={finalizedModel}
          onGoToOptimizer={handleGoToOptimizer}
        />;

      case AppStep.Optimize:
        return <Optimizer
          model={finalizedModel}
          scenarios={optimizationScenarios}
          activeScenarioId={activeScenarioId}
          onSelectScenario={setActiveScenarioId}
        />;

      default:
        return null;
    }
  };

  const showUserInput = ![AppStep.Welcome].includes(currentStep);

  return (
    <div className="flex h-screen font-sans bg-[#F4F3F3] text-[#1A1628]">
      <div className="w-full max-w-md bg-white flex flex-col p-4 border-r border-gray-200">
        <div className="mb-4 pb-3 border-b border-gray-200">
          <Logo />
        </div>
        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
          {agentMessages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
          {isLoading && <ChatMessage message={{id:0, sender:'ai', text:<Loader />}} />}
          <div ref={messagesEndRef} />
        </div>
        {showUserInput && (
           <UserInput 
            value={userQuery}
            onValueChange={setUserQuery}
            onSubmit={handleUserQuery}
            placeholder={"Ask a question or give a command..."} 
            disabled={isLoading || isRecalibrating}
           />
        )}
      </div>
      <main className="flex-1 flex flex-col bg-[#F4F3F3]">
        <div className="p-6 border-b border-gray-200 bg-white">
          <StepIndicator currentStep={currentStep} completedSteps={completedSteps} onStepClick={handleStepClick} />
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar">
          {isLoading && !edaInsights && currentStep !== AppStep.DataValidation && currentStep !== AppStep.Optimize ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Loader />
              <p className="text-xl mt-4 text-gray-700">{loadingMessage}</p>
              <p className="text-gray-500">This may take a moment.</p>
            </div>
          ) : renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;