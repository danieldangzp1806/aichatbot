
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  groundingSupports?: any[];
  webSearchQueries?: string[];
}

export interface MedicineSummary {
  name: string;
  manufacturer: string;
  atcCode: string;
  packSize: string;
  form: string;
  dosage: string;
}

export interface AnalysisResult {
  summary?: MedicineSummary;
  details: string;
  groundingMetadata?: GroundingMetadata;
}

export interface SearchState {
  isLoading: boolean;
  hasSearched: boolean;
  query: string;
  result?: AnalysisResult;
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  groundingMetadata?: GroundingMetadata;
  timestamp: number;
}

export interface User {
  uid: string;
  email: string | null;
}
