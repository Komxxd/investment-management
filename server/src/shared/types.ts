// Shared TypeScript types for the server

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  deleted_at: string | null;
  auto_sync_corporate_actions?: boolean;
}

export interface Stock {
  id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  entry_price: number;
  brokerage?: number;
  govt_tax?: number;
  entry_date: string;
  created_at: string;
}

export interface SoldStock {
  id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  exit_price: number;
  brokerage?: number;
  govt_tax?: number;
  exit_date: string;
  created_at: string;
}

export interface LivePrice {
  price: number;
  name: string;
  currency?: string;
  change?: number;
  changePercent?: number;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  volume?: number;
  avgVolume?: number;
  previousClose?: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export interface DividendEvent {
  date: Date;
  amount: number;
}

export interface SplitEvent {
  date: Date;
  numerator: number;
  denominator: number;
  splitRatio?: string;
}

export interface CorporateEvent {
  symbol: string;
  type: 'DIVIDEND' | 'SPLIT';
  date: Date;
  amount?: number;
  numerator?: number;
  denominator?: number;
  splitRatio?: string;
}

// Express request with auth context
export interface AuthenticatedRequest {
  user: { id: string; email?: string };
  supabase: any; // SupabaseClient type from @supabase/supabase-js
}
