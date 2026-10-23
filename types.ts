
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
  genericName?: string;
  manufacturer: string;
  atcCode: string;
  packSize: string;
  form: string;
  dosage: string;
  market?: string;
}

export interface AnalysisResult {
  summary?: MedicineSummary;
  details: string;
  groundingMetadata?: GroundingMetadata;
  fromCache?: boolean;
}

export interface SearchState {
  isLoading: boolean;
  hasSearched: boolean;
  query: string;
  market?: string;
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
