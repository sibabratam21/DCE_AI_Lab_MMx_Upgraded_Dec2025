# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Install dependencies:** `npm install`
- **Run development server:** `npm run dev`
- **Build for production:** `npm run build`
- **Preview production build:** `npm run preview`

## Environment Setup

- Set `GEMINI_API_KEY` in `.env.local` file for AI functionality
- The Vite config automatically loads and exposes the API key to the app

## Project Architecture

This is a React-based Marketing Mix Modeling (MMM) application that provides a step-by-step workflow for analyzing marketing data and optimizing budgets.

### Core Application Flow
The app follows a sequential workflow defined by `AppStep` enum in `types.ts`:
1. **Welcome** - CSV data upload
2. **DataValidation** - Column classification and EDA insights  
3. **FeatureEngineering** - Configure adstock, lag, and transformation parameters
4. **Modeling** - Generate model leaderboard and calibrate models
5. **Report** - Final model summary and insights
6. **Optimize** - Budget optimization scenarios

### Key Components Structure
- `App.tsx` - Main application orchestrator managing workflow state and conversational AI interactions
- `components/` - UI components for each step of the workflow
- `services/geminiService.ts` - All AI interactions using Google's Gemini API
- `types.ts` - Comprehensive type definitions for the entire application

### State Management Pattern
The app uses React hooks with complex state management in `App.tsx`:
- Workflow progression tracked via `currentStep` and `completedSteps`
- Conversational flow managed through `awaitingXConfirmation` booleans
- Data flows from CSV parsing → column analysis → EDA → feature engineering → modeling → optimization

### AI Integration
All AI functionality is centralized in `services/geminiService.ts`:
- Uses structured JSON responses with TypeScript schemas
- Handles column analysis, EDA insights, feature recommendations, model generation, and optimization
- Each function has specific prompt engineering for MMM domain expertise

### Key Data Types
- `ParsedData` - Raw CSV data after parsing
- `UserColumnSelection` - Column type assignments by user
- `ModelRun` - Complete model with performance metrics and channel details
- `FeatureParams` - Adstock, lag, and transformation settings per channel
- `OptimizerScenario` - Budget allocation recommendations

### File Organization
- Root components handle main workflow steps
- `components/icons/` contains custom SVG icons
- `services/optimizerUtils.ts` generates initial budget scenarios
- Vite config includes path aliases using `@/` for root directory

This application simulates a complete MMM workflow but generates realistic synthetic results rather than performing actual statistical modeling.

## Deployment on Vercel

### Prerequisites
- Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Create a Vercel account at [vercel.com](https://vercel.com)

### Deployment Steps
1. **Connect to Vercel**: Connect your GitHub repository to Vercel
2. **Configure Environment Variable**: In Vercel dashboard, add environment variable:
   - Key: `GEMINI_API_KEY`
   - Value: Your Gemini API key
3. **Deploy**: Vercel will automatically build and deploy using the included `vercel.json` configuration

### Local Development with Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Link project to Vercel
vercel link

# Pull environment variables from Vercel
vercel env pull .env.local

# Run development server
npm run dev
```

## Enhanced Conversational AI Features

### Agent Personality System
The application now features "Maya," an expert MMM agent with:
- **Dynamic conversation styles**: Friendly, expert, enthusiastic, or analytical
- **Contextual memory**: Remembers user preferences and previous decisions
- **Proactive suggestions**: Offers insights and recommendations based on data patterns
- **Emotional intelligence**: Adapts tone based on situation (excited, concerned, confident)

### Key Enhancements Made
- **Enhanced Prompts**: All AI interactions now use conversational, personality-driven prompts
- **Proactive Agent Panel**: Shows contextual suggestions and warnings
- **Agent Memory System**: Tracks user expertise level and communication preferences
- **Smart Insights**: Generates business-focused recommendations throughout the workflow

### New Components Added
- `ProactiveAgentPanel.tsx` - Displays contextual agent suggestions
- `services/agentPersonality.ts` - Agent personality and memory management
- `services/enhancedPrompts.ts` - Conversational prompt templates

### Agent Behavior Patterns
- **Welcome**: Enthusiastic introduction and data upload guidance
- **Data Validation**: Detailed column analysis with business context
- **Feature Engineering**: Educational explanations of MMM concepts
- **Modeling**: Collaborative exploration of model results  
- **Optimization**: Strategic budget planning partnership