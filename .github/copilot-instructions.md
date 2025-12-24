# AI Coding Agent Instructions for DCE AI Lab MMx

## Project Overview
Full-stack Marketing Mix Modeling (MMM) application with React frontend and Python FastAPI backend. Frontend provides conversational AI-guided workflow using Gemini API; backend performs Bayesian statistical modeling with PyMC.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite, workflow steps in `AppStep` enum (Welcome → DataValidation → FeatureEngineering → Modeling → Report → Optimize)
- **Backend**: FastAPI with PyMC for hierarchical Bayesian regression, artifact storage in Parquet/NetCDF
- **AI Integration**: Gemini API for conversational insights, structured JSON responses via schemas in `services/geminiService.ts`
- **State Management**: Complex boolean flags in `App.tsx` for conversation flow (`awaitingXConfirmation`)

## Key Workflows
- **Development**: `npm run dev` (frontend), `python3 app.py` (backend on :8000)
- **Authentication**: Password-protected frontend (`dce_ai_mmx_2025`), session storage
- **Data Flow**: CSV upload → column classification → EDA → feature engineering → model training → optimization
- **Model Training**: Synthetic demo mode via `demoSimulation.ts`, real Bayesian modeling via `hybridAnalysisService.ts`
- **Deployment**: Vercel for frontend, environment variable `GEMINI_API_KEY`

## Conventions
- **Types**: Comprehensive interfaces in `types.ts`, use `ColumnType` enum for data columns
- **AI Responses**: Clean markdown formatting in `geminiService.ts` cleanup functions
- **Components**: Functional React components, import from `components/` directory
- **Services**: AI in `geminiService.ts`, synthetic data in `demoSimulation.ts`, real analysis in `hybridAnalysisService.ts`
- **Backend Data**: Required columns: `entity_id`, `period_start`, `sales`; optional: `act_*`, `ctrl_*`, `spend_*`
- **Model Specs**: StudentT likelihood, hierarchical shrinkage, non-negative channel effects
- **Paths**: `@/` alias for root directory in Vite config

## Examples
- **Add new workflow step**: Extend `AppStep` enum, add case in `App.tsx` render switch
- **AI feature**: Define schema in `geminiService.ts`, use `ai.generateContent()` with structured output
- **Component**: Export functional component from `components/`, import in `App.tsx`
- **Backend endpoint**: Add route in `api/`, implement in `core/`, update status in `status.json`

## Integration Points
- Frontend calls backend via `VITE_BACKEND_URL` (planned, currently synthetic)
- Dataset validation: Check `entity_id` uniqueness, `period_start` parsing, required columns
- Model diagnostics: Monitor R-hat < 1.01, ESS > 400, divergences in PyMC sampling