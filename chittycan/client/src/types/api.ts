// API response types for better TypeScript support

export interface UserData {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StatsData {
  activeTunnels: number;
  bandwidth?: {
    total: number;
    incoming: number;
    outgoing: number;
  };
  uptime: number;
  averageResponseTime?: number;
  totalConnections?: number;
  errorRate?: number;
}

export interface DashboardData {
  tunnels: any[]; // Use existing Tunnel type from shared schema
  stats: StatsData;
  isLoading: boolean;
}

// Auth response types
export interface AuthResponse {
  user: UserData | null;
  isAuthenticated: boolean;
}

// API error types
export interface ApiError {
  message: string;
  statusCode: number;
  details?: any;
}