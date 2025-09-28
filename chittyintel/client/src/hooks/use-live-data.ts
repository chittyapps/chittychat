import { useQuery } from '@tanstack/react-query';

interface LiveLoanDetails {
  principal: number;
  interestRate: number;
  status: string;
  source: string;
  lastUpdated: string;
}

interface LiveTimelineEvent {
  id: number;
  title: string;
  date: string;
  description: string;
  type: string;
  color: string;
  source: string;
}

interface LivePOVAnalysis {
  perspective: string;
  analysis: string;
  strengthScore: number;
  source: string;
  lastUpdated: string;
}

export function useLiveLoanDetails() {
  return useQuery({
    queryKey: ['/api/legal/loan-details'],
    queryFn: async (): Promise<LiveLoanDetails> => {
      const response = await fetch('/api/legal/loan-details');
      if (!response.ok) {
        throw new Error('Failed to fetch loan details');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
}

export function useLiveTimelineData() {
  return useQuery({
    queryKey: ['/api/legal/timeline'],
    queryFn: async (): Promise<{ events: LiveTimelineEvent[] }> => {
      const response = await fetch('/api/legal/timeline');
      if (!response.ok) {
        throw new Error('Failed to fetch timeline data');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}

export function useLivePOVAnalysis(perspective: string) {
  return useQuery({
    queryKey: ['/api/legal/pov-analysis', perspective],
    queryFn: async (): Promise<LivePOVAnalysis> => {
      const response = await fetch(`/api/legal/pov-analysis/${perspective}`);
      if (!response.ok) {
        throw new Error('Failed to fetch POV analysis');
      }
      return response.json();
    },
    refetchInterval: 45000, // Refresh every 45 seconds
    staleTime: 20000,
    enabled: !!perspective, // Only run when perspective is provided
  });
}

export function useLiveFinancialData() {
  return useQuery({
    queryKey: ['/api/legal/financial-data'],
    queryFn: async () => {
      const response = await fetch('/api/legal/financial-data');
      if (!response.ok) {
        throw new Error('Failed to fetch financial data');
      }
      return response.json();
    },
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000,
  });
}