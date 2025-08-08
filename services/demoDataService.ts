// Demo Data Loading Service
import { ParsedData } from '../types';
import { csvParse } from 'd3-dsv';

// Load embedded demo dataset
export async function loadDemoDataset(): Promise<ParsedData[]> {
  try {
    // Fetch the CSV file from public folder
    const response = await fetch('/demo-dataset.csv');
    if (!response.ok) {
      throw new Error(`Failed to load dataset: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    // Parse CSV data
    const parsedData = csvParse(csvText, (d: any) => {
      const row: ParsedData = {};
      for (const key in d) {
        if (d[key] !== undefined) {
          const num = Number(d[key]);
          row[key] = isNaN(num) || d[key].trim() === '' ? d[key] : num;
        }
      }
      return row;
    });

    return parsedData;
  } catch (error) {
    console.error('Error loading demo dataset:', error);
    throw new Error('Could not load the embedded demo dataset. Please check that demo-dataset.csv exists in the public folder.');
  }
}

// Get demo dataset info for the agent to reference
export function getDemoDatasetInfo(): string {
  return `I'm working with your marketing mix modeling dataset that includes:
  
📊 **Dataset Overview:**
- Time period: Multiple weeks of marketing and performance data
- Contains both spend and activity metrics for various marketing channels
- Includes dependent variable (KPI) for modeling

🎯 **Key Columns Expected:**
- **Time Dimension**: Week/Date column for temporal analysis  
- **Dependent Variable**: Your main KPI (sales, prescriptions, revenue, etc.)
- **Marketing Spend**: Budget allocation for different channels
- **Marketing Activity**: Volume metrics (impressions, clicks, etc.)
- **Control Variables**: External factors (seasonality, promotions, etc.)

I've pre-loaded this data so we can dive straight into the MMx analysis. Let me help you validate the column classifications and guide you through the statistical modeling process!`;
}

// Check if demo mode should be enabled (dataset exists)
export async function isDemoModeAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/demo-dataset.csv', { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}