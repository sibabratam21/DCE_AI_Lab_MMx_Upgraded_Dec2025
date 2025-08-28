// Demo Data Loading Service
import { ParsedData } from '../types';
import { csvParse } from 'd3-dsv';

export interface DatasetInfo {
  id: string;
  name: string;
  filename: string;
  description: string;
  size: string;
}

// Available datasets in public folder
export const AVAILABLE_DATASETS: DatasetInfo[] = [
  {
    id: 'demo',
    name: 'Demo Dataset',
    filename: 'demo-dataset.csv',
    description: 'Sample pharmaceutical marketing data with TV, Display, Search, and other channels',
    size: '~2KB'
  },
  {
    id: 'pharma',
    name: 'Pharma MMM Sample',
    filename: 'pharma-mmm-sample.csv', 
    description: 'Alternative pharmaceutical marketing dataset for testing',
    size: '~2KB'
  },
  {
    id: 'mixmind_demo',
    name: 'MixMind Demo 100M Weekly',
    filename: 'mixmind_demo_100M_weekly.csv',
    description: 'MixMind demonstration dataset with 100M weekly marketing data across multiple channels',
    size: '~3KB'
  }
];

// Load dataset by filename
export async function loadDatasetByFilename(filename: string): Promise<ParsedData[]> {
  try {
    // Fetch the CSV file from public folder
    const response = await fetch(`/${filename}`);
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
    console.error('Error loading dataset:', error);
    throw new Error(`Could not load dataset: ${filename}. Please check that the file exists in the public folder.`);
  }
}

// Load embedded demo dataset (backward compatibility)
export async function loadDemoDataset(): Promise<ParsedData[]> {
  return loadDatasetByFilename('demo-dataset.csv');
}

// Get demo dataset info for the agent to reference
export function getDemoDatasetInfo(): string {
  return `Hey there! 👋 I'm MixMind, your Marketing Mix Modeling expert, and I'm absolutely thrilled to work with you today!

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