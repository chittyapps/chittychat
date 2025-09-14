import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Zap, 
  Users, 
  AlertTriangle, 
  Shield, 
  Server,
  Minus,
  RefreshCw
} from "lucide-react";

// TypeScript interfaces for the dashboard data
interface KPIData {
  requestsPerMinute: number;
  successRate: number;
  p95Latency: number;
  errorBudget: number;
  lastUpdated: number;
}

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  activeAgents: number;
  recentActivities: any[];
  kpis: KPIData;
  systemStatus: 'operational' | 'degraded' | 'error';
  integrationHealth: Array<{
    id: string;
    name: string;
    status: 'active' | 'inactive' | 'error';
    healthScore: number;
  }>;
  incidents: {
    total: number;
    active: number;
    critical: number;
  };
}

type TimeRange = '5min' | '15min' | '1hour' | '6hour' | '24hour' | '7day';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'good' | 'warning' | 'critical';
  icon: React.ReactNode;
  isLoading?: boolean;
}

function KPICard({ title, value, subtitle, trend, status = 'good', icon, isLoading }: KPICardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'good': return 'text-green-400 border-green-400/20 bg-green-500/10';
      case 'warning': return 'text-yellow-400 border-yellow-400/20 bg-yellow-500/10';
      case 'critical': return 'text-red-400 border-red-400/20 bg-red-500/10';
      default: return 'text-blue-400 border-blue-400/20 bg-blue-500/10';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="w-24 h-4 bg-white/10 rounded"></div>
          <div className="w-6 h-6 bg-white/10 rounded"></div>
        </div>
        <div className="w-16 h-8 bg-white/20 rounded mb-2"></div>
        <div className="w-20 h-3 bg-white/10 rounded"></div>
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 border transition-all duration-300 hover:scale-105 hover:shadow-xl group ${getStatusColor()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white/80 tracking-wide uppercase">
          {title}
        </h3>
        <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
          {icon}
        </div>
      </div>

      {/* Value */}
      <div className="mb-2">
        <div className="text-3xl font-bold text-white mb-1 font-mono">
          {value}
        </div>
        
        {/* Trend and subtitle */}
        {(trend || subtitle) && (
          <div className="flex items-center gap-2">
            {trend && getTrendIcon()}
            {subtitle && (
              <span className="text-sm text-white/60">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${status === 'good' ? 'bg-green-400' : status === 'warning' ? 'bg-yellow-400' : 'bg-red-400'} animate-pulse-slow`}></div>
        <span className="text-xs text-white/50 capitalize">{status}</span>
      </div>
    </div>
  );
}

interface TimeRangeButtonProps {
  range: TimeRange;
  active: boolean;
  onClick: (range: TimeRange) => void;
}

function TimeRangeButton({ range, active, onClick }: TimeRangeButtonProps) {
  return (
    <button
      onClick={() => onClick(range)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30 shadow-lg'
          : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
      data-testid={`button-timerange-${range}`}
    >
      {range}
    </button>
  );
}

export default function HeroOverview() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1hour');

  // Fetch dashboard stats with real-time updates
  const { data: stats, isLoading, error, isRefetching } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 5000, // 5 seconds
    refetchIntervalInBackground: true,
    staleTime: 0, // Always fetch fresh data
  });

  const timeRanges: TimeRange[] = ['5min', '15min', '1hour', '6hour', '24hour', '7day'];

  // Calculate performance indicators
  const getSystemHealth = () => {
    if (!stats) return 'unknown';
    const { successRate, errorBudget } = stats.kpis;
    
    if (successRate >= 99 && errorBudget >= 80) return 'good';
    if (successRate >= 95 && errorBudget >= 50) return 'warning';
    return 'critical';
  };

  const getUptimePercentage = () => {
    if (!stats) return 0;
    // Calculate uptime based on incidents and system status
    const { total, active } = stats.incidents;
    if (total === 0) return 99.9;
    return Math.max(95, 100 - (active / total) * 5);
  };

  // Format latency with proper units
  const formatLatency = (latency: number) => {
    if (latency < 1000) return `${latency}ms`;
    return `${(latency / 1000).toFixed(1)}s`;
  };

  // Calculate agent capacity
  const getAgentCapacity = () => {
    if (!stats) return 0;
    const maxCapacity = 50; // Assumed max capacity
    return Math.round((stats.activeAgents / maxCapacity) * 100);
  };

  if (error) {
    return (
      <div className="glass-card p-8 text-center" data-testid="hero-overview-error">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Unable to Load KPIs</h3>
        <p className="text-white/60">Failed to fetch dashboard statistics. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="hero-overview">
      {/* Header with Time Range Controls */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30">
              <Activity className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white font-sans">
                System Overview
              </h1>
              <p className="text-white/60 flex items-center gap-2">
                Real-time performance metrics
                {isRefetching && (
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                )}
              </p>
            </div>
          </div>

          {/* Time Range Controls */}
          <div className="flex flex-wrap gap-2 p-1 bg-black/20 rounded-lg border border-white/10">
            {timeRanges.map((range) => (
              <TimeRangeButton
                key={range}
                range={range}
                active={timeRange === range}
                onClick={setTimeRange}
              />
            ))}
          </div>
        </div>

        {/* Last Updated */}
        {stats?.kpis.lastUpdated && (
          <div className="mt-4 text-xs text-white/40 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last updated: {new Date(stats.kpis.lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Requests per Minute */}
        <KPICard
          title="Requests/Min"
          value={stats?.kpis.requestsPerMinute ? stats.kpis.requestsPerMinute.toLocaleString() : '0'}
          subtitle="Current throughput"
          trend="up"
          status="good"
          icon={<Zap className="w-5 h-5 text-yellow-400" />}
          isLoading={isLoading}
        />

        {/* Success Rate */}
        <KPICard
          title="Success Rate"
          value={stats?.kpis.successRate ? `${stats.kpis.successRate}%` : '0%'}
          subtitle="Request success"
          trend={stats?.kpis.successRate && stats.kpis.successRate > 95 ? 'up' : 'down'}
          status={stats?.kpis.successRate && stats.kpis.successRate > 95 ? 'good' : 'warning'}
          icon={<CheckCircle className="w-5 h-5 text-green-400" />}
          isLoading={isLoading}
        />

        {/* P95 Latency */}
        <KPICard
          title="P95 Latency"
          value={stats?.kpis.p95Latency ? formatLatency(stats.kpis.p95Latency) : '0ms'}
          subtitle="95th percentile"
          trend={stats?.kpis.p95Latency && stats.kpis.p95Latency < 500 ? 'up' : 'down'}
          status={stats?.kpis.p95Latency && stats.kpis.p95Latency < 200 ? 'good' : stats?.kpis.p95Latency && stats.kpis.p95Latency < 500 ? 'warning' : 'critical'}
          icon={<Clock className="w-5 h-5 text-blue-400" />}
          isLoading={isLoading}
        />

        {/* Active Agents */}
        <KPICard
          title="Active Agents"
          value={stats?.activeAgents || 0}
          subtitle={`${getAgentCapacity()}% capacity`}
          trend="neutral"
          status={getAgentCapacity() < 80 ? 'good' : 'warning'}
          icon={<Users className="w-5 h-5 text-purple-400" />}
          isLoading={isLoading}
        />

        {/* Error Budget */}
        <KPICard
          title="Error Budget"
          value={stats?.kpis.errorBudget ? `${stats.kpis.errorBudget}%` : '0%'}
          subtitle="SLA compliance"
          trend={stats?.kpis.errorBudget && stats.kpis.errorBudget > 50 ? 'up' : 'down'}
          status={stats?.kpis.errorBudget && stats.kpis.errorBudget > 80 ? 'good' : stats?.kpis.errorBudget && stats.kpis.errorBudget > 50 ? 'warning' : 'critical'}
          icon={<Shield className="w-5 h-5 text-cyan-400" />}
          isLoading={isLoading}
        />

        {/* System Uptime */}
        <KPICard
          title="System Uptime"
          value={`${getUptimePercentage().toFixed(2)}%`}
          subtitle="Availability"
          trend="up"
          status={getSystemHealth() as 'good' | 'warning' | 'critical'}
          icon={<Server className="w-5 h-5 text-emerald-400" />}
          isLoading={isLoading}
        />
      </div>

      {/* System Status Banner */}
      {stats && (
        <div className={`glass-card p-4 border-l-4 ${
          stats.systemStatus === 'operational' ? 'border-green-400 bg-green-500/10' :
          stats.systemStatus === 'degraded' ? 'border-yellow-400 bg-yellow-500/10' :
          'border-red-400 bg-red-500/10'
        }`} data-testid="system-status-banner">
          <div className="flex items-center gap-3">
            {stats.systemStatus === 'operational' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : stats.systemStatus === 'degraded' ? (
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            )}
            <div>
              <span className="text-white font-medium capitalize">
                System Status: {stats.systemStatus}
              </span>
              {stats.incidents.active > 0 && (
                <span className="ml-2 text-sm text-white/60">
                  ({stats.incidents.active} active incident{stats.incidents.active !== 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}