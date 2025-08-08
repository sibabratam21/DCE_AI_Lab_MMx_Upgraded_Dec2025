# Deployment Guide - Agentic Marketing Mix Modeling

This guide walks you through deploying your enhanced MMM application to Vercel.

## 🚀 Quick Deploy to Vercel

### Prerequisites
1. **Gemini API Key**: Get one from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **GitHub Repository**: Push your code to GitHub

### One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Manual Deployment Steps

#### 1. Connect to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from your project directory
vercel
```

#### 2. Environment Variables
In your Vercel dashboard, add the following environment variable:
- **Key**: `GEMINI_API_KEY`
- **Value**: Your Gemini API key from Google AI Studio

#### 3. Build Configuration
Your project includes a `vercel.json` file with optimal settings:
```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

## 🔧 Local Development with Vercel

### Setup
```bash
# Link your local project to Vercel
vercel link

# Pull environment variables
vercel env pull .env.local

# Start development server
npm run dev
```

### Testing Deployment Locally
```bash
# Build and preview production version
npm run build
npm run preview

# Test with Vercel CLI
vercel dev
```

## 🌟 Enhanced Features Included

### Agent "Maya" Personality System
- **Conversational AI**: Natural, friendly interactions throughout the workflow
- **Contextual Memory**: Remembers user preferences and decisions
- **Proactive Suggestions**: Smart recommendations based on data patterns
- **Business Intelligence**: Explains MMM concepts in accessible terms

### Technical Enhancements
- **Enhanced Prompts**: All AI interactions use personality-driven prompts
- **Agent Memory**: Tracks user expertise and communication style
- **Proactive Panels**: Contextual warnings and suggestions
- **Smart Insights**: Business-focused recommendations

## 🛠️ Customization Options

### Modify Agent Personality
Edit `services/agentPersonality.ts`:
```typescript
export const defaultAgentPersonality: AgentPersonality = {
    name: "Maya", // Change agent name
    expertise: ["Marketing Mix Modeling", "Statistical Analysis"], 
    conversationStyle: "friendly", // Options: friendly, expert, enthusiastic, analytical
    proactiveLevel: "high" // Options: low, medium, high
};
```

### Customize Conversation Style
Edit prompts in `services/enhancedPrompts.ts` to match your brand voice and expertise level.

### Add New Proactive Actions
Extend `generateProactiveActions()` in `services/agentPersonality.ts` to add context-specific suggestions.

## 📊 Performance Optimization

### For Production
- Gemini Flash 2.5 provides fast responses for real-time interactions
- JSON schema validation ensures consistent AI outputs
- Lazy loading of components reduces initial bundle size
- Vite's optimized build process for fast loading

### Monitoring
- Enable Vercel Analytics in your dashboard
- Monitor API usage in Google AI Studio console
- Set up error tracking for AI service failures

## 🚨 Troubleshooting

### Common Issues
1. **API Key Issues**: Ensure `GEMINI_API_KEY` is set in Vercel dashboard
2. **Build Failures**: Check TypeScript errors and dependency versions
3. **AI Response Errors**: Verify API quota and key permissions in Google AI Studio

### Support Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Google AI Studio](https://makersuite.google.com/)
- [Vite Documentation](https://vitejs.dev/)

## 🎯 Next Steps

Once deployed:
1. Test the full workflow with sample marketing data
2. Customize Maya's personality for your organization
3. Add your brand colors and styling
4. Set up custom domain in Vercel dashboard

Your enhanced, conversational MMM application is now ready to help users discover actionable marketing insights! 🚀