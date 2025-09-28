import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Shield, TrendingUp, TrendingDown, Minus, Star, Award, Users, Activity, Clock, CheckCircle } from "lucide-react";

interface ReputationDashboardProps {
  agentAddress: string;
  showDetailedView?: boolean;
}

interface ReputationData {
  score: number;
  interactions: number;
  successRate: number;
  rank: string;
  trustLevel: string;
  onChainVerified: boolean;
}

interface ReputationHistory {
  timestamp: number;
  score: number;
  action: string;
  txHash?: string;
}

interface AgentMetrics {
  tasksCompleted: number;
  averageRating: number;
  responseTime: number;
  availability: number;
  specializations: string[];
  endorsements: number;
}

interface AgentRanking {
  rank: number;
  percentile: number;
  totalAgents: number;
  category: string;
}

interface ReputationTrends {
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  prediction: number;
  confidence: number;
}

export default function ReputationDashboard({ agentAddress, showDetailedView = false }: ReputationDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch reputation data
  const { data: reputation, isLoading: reputationLoading } = useQuery<ReputationData>({
    queryKey: [`/api/reputation/${agentAddress}`],
    refetchInterval: 30000,
  });

  const { data: history = [] } = useQuery<ReputationHistory[]>({
    queryKey: [`/api/reputation/${agentAddress}/history`],
    enabled: showDetailedView,
  });

  const { data: metrics } = useQuery<AgentMetrics>({
    queryKey: [`/api/reputation/${agentAddress}/metrics`],
    enabled: showDetailedView,
  });

  const { data: ranking } = useQuery<AgentRanking>({
    queryKey: [`/api/reputation/${agentAddress}/ranking`],
    enabled: showDetailedView,
  });

  const { data: trends } = useQuery<ReputationTrends>({
    queryKey: [`/api/reputation/${agentAddress}/trends`],
    enabled: showDetailedView,
  });

  const { data: verification } = useQuery<{
    isVerified: boolean;
    lastVerification: string;
    verificationMethod: string;
    confidence: number;
  }>({
    queryKey: [`/api/reputation/${agentAddress}/verification`],
    enabled: showDetailedView,
  });

  const getScoreColor = (score: number) => {
    if (score >= 900) return 'text-green-600';
    if (score >= 800) return 'text-blue-600';
    if (score >= 700) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 900) return 'bg-green-100';
    if (score >= 800) return 'bg-blue-100';
    if (score >= 700) return 'bg-yellow-100';
    return 'bg-gray-100';
  };

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decreasing': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  if (reputationLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-gray-200 rounded-lg"></div>
        {showDetailedView && (
          <>
            <div className="h-32 bg-gray-200 rounded-lg"></div>
            <div className="h-40 bg-gray-200 rounded-lg"></div>
          </>
        )}
      </div>
    );
  }

  if (!reputation) {
    return (
      <div className="text-center py-8">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">No reputation data available</p>
        <p className="text-sm text-gray-400">Agent may not be registered on-chain</p>
      </div>
    );
  }

  if (!showDetailedView) {
    // Compact view for search results
    return (
      <div className="flex items-center space-x-3 p-3 bg-white border border-gray-200 rounded-lg">
        <div className={`flex items-center justify-center w-12 h-12 rounded-full ${getScoreBackground(reputation.score)}`}>
          <span className={`text-lg font-bold ${getScoreColor(reputation.score)}`}>
            {Math.round(reputation.score / 10)}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-gray-900">{reputation.rank}</span>
            {reputation.onChainVerified && (
              <Shield className="w-4 h-4 text-green-500" />
            )}
            <span className="text-sm text-gray-500">{reputation.trustLevel}</span>
          </div>
          <div className="text-xs text-gray-500">
            {reputation.interactions} interactions • {reputation.successRate}% success
          </div>
        </div>
      </div>
    );
  }

  // Detailed view
  return (
    <div className="space-y-6">
      {/* Reputation Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Reputation Score</h3>
          <div className="flex items-center space-x-2">
            {reputation.onChainVerified && (
              <div className="flex items-center space-x-1 text-green-600">
                <Shield className="w-4 h-4" />
                <span className="text-sm">Verified</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Main Score */}
          <div className="text-center">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${getScoreBackground(reputation.score)} mb-2`}>
              <span className={`text-2xl font-bold ${getScoreColor(reputation.score)}`}>
                {reputation.score}
              </span>
            </div>
            <p className="text-sm text-gray-600">Overall Score</p>
            <p className="text-xs text-gray-500">{reputation.rank}</p>
          </div>

          {/* Interactions */}
          <div className="text-center">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 mb-2">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-lg font-semibold text-gray-900">{reputation.interactions}</p>
            <p className="text-sm text-gray-600">Interactions</p>
          </div>

          {/* Success Rate */}
          <div className="text-center">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-2">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-gray-900">{reputation.successRate}%</p>
            <p className="text-sm text-gray-600">Success Rate</p>
          </div>

          {/* Trust Level */}
          <div className="text-center">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-purple-100 mb-2">
              <Award className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-lg font-semibold text-gray-900">{reputation.trustLevel}</p>
            <p className="text-sm text-gray-600">Trust Level</p>
          </div>
        </div>
      </div>

      {/* Detailed Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {["overview", "metrics", "history", "ranking"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-sm font-medium border-b-2 ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                data-testid={`tab-${tab}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-4">
              {trends && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getTrendIcon(trends.trend)}
                    <div>
                      <p className="font-medium text-gray-900">Reputation Trend</p>
                      <p className="text-sm text-gray-600">
                        {trends.trend === 'increasing' ? 'Improving' : 
                         trends.trend === 'decreasing' ? 'Declining' : 'Stable'}
                        {trends.changeRate !== 0 && ` (${trends.changeRate > 0 ? '+' : ''}${trends.changeRate.toFixed(1)} per period)`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Confidence</p>
                    <p className="font-medium">{trends.confidence}%</p>
                  </div>
                </div>
              )}

              {verification && (
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Verification Status</h4>
                    <span className={`px-2 py-1 text-xs rounded ${
                      verification.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {verification.isVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">Method: {verification.verificationMethod}</p>
                  <p className="text-sm text-gray-600">Confidence: {verification.confidence}%</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "metrics" && metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Tasks Completed</span>
                  <span className="font-medium">{metrics.tasksCompleted}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Average Rating</span>
                  <span className="font-medium">{metrics.averageRating.toFixed(1)}/10</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Response Time</span>
                  <span className="font-medium">{metrics.responseTime}h</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Availability</span>
                  <span className="font-medium">{metrics.availability}%</span>
                </div>
              </div>
              
              <div>
                <h5 className="font-medium text-gray-900 mb-3">Specializations</h5>
                <div className="flex flex-wrap gap-2">
                  {metrics.specializations.map((spec, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                      {spec}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  {metrics.endorsements} community endorsements
                </p>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Recent Activity</h4>
              {history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{entry.action}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{entry.score}</p>
                        {entry.txHash && (
                          <p className="text-xs text-blue-600">{entry.txHash.slice(0, 10)}...</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No recent activity</p>
              )}
            </div>
          )}

          {activeTab === "ranking" && ranking && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-3">
                  <span className="text-2xl">#{ranking.rank}</span>
                </div>
                <h4 className="font-medium text-gray-900">Global Ranking</h4>
                <p className="text-sm text-gray-600">
                  Top {ranking.percentile}% of {ranking.totalAgents} agents
                </p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-2">Category: {ranking.category}</h5>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${ranking.percentile}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{ranking.percentile}th percentile</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}