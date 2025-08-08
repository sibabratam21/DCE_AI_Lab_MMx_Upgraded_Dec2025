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
  return `Hey there! 👋 I'm Maya, your Marketing Mix Modeling expert, and I'm absolutely thrilled to work with you today!

I've got some fantastic news - I've already loaded up the latest marketing performance data and have everything prepared for our deep dive into your MMM analysis. We're talking about a comprehensive dataset with all your key marketing channels, performance metrics, and the contextual factors that really matter for understanding what's driving results.

I can't wait to help you uncover those hidden insights about which channels are truly moving the needle, optimize your media mix, and build a bulletproof strategy for maximizing ROI. This is going to be such a fun analytical journey together! ✨`;
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