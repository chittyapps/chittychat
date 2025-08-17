import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, Shield, TrendingUp, Users, Award, RefreshCw } from "lucide-react";
import ReputationDashboard from "./reputation-dashboard";

interface LeaderboardEntry {
  address: string;
  ensName?: string;
  score: number;
  rank: number;
  interactions: number;
  successRate: number;
  trustLevel: string;
}

export default function ReputationLeaderboard() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [limit, setLimit] = useState(10);

  const { data: leaderboard = [], isLoading, refetch } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/reputation/leaderboard', { limit }],
    refetchInterval: 60000, // Refresh every minute
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2: return <Award className="w-5 h-5 text-gray-400" />;
      case 3: return <Award className="w-5 h-5 text-orange-500" />;
      default: return <span className="w-5 h-5 flex items-center justify-center text-sm font-medium text-gray-500">#{rank}</span>;
    }
  };

  const getTrustLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'trusted': return 'bg-blue-100 text-blue-800';
      case 'emerging': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (selectedAgent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Agent Reputation Details</h2>
          <button
            onClick={() => setSelectedAgent(null)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            data-testid="button-back-to-leaderboard"
          >
            ← Back to Leaderboard
          </button>
        </div>
        <ReputationDashboard agentAddress={selectedAgent} showDetailedView={true} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold text-gray-900">Reputation Leaderboard</h2>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              data-testid="select-leaderboard-limit"
            >
              <option value={10}>Top 10</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
            </select>
            <button
              onClick={() => refetch()}
              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              data-testid="button-refresh-leaderboard"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-900">Elite Agents</span>
            </div>
            <p className="text-2xl font-bold text-yellow-900">
              {leaderboard.filter(agent => agent.score >= 900).length}
            </p>
            <p className="text-sm text-yellow-700">Score 900+</p>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">Verified Agents</span>
            </div>
            <p className="text-2xl font-bold text-blue-900">
              {leaderboard.filter(agent => agent.trustLevel === 'Verified').length}
            </p>
            <p className="text-sm text-blue-700">Blockchain Verified</p>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-900">Total Interactions</span>
            </div>
            <p className="text-2xl font-bold text-green-900">
              {leaderboard.reduce((sum, agent) => sum + agent.interactions, 0).toLocaleString()}
            </p>
            <p className="text-sm text-green-700">Across all agents</p>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Rankings</h3>
        </div>

        {isLoading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {leaderboard.map((agent, index) => (
              <div
                key={agent.address}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  index < 3 ? 'bg-gradient-to-r from-yellow-50 to-transparent' : ''
                }`}
                onClick={() => setSelectedAgent(agent.address)}
                data-testid={`leaderboard-entry-${agent.rank}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Rank */}
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(agent.rank)}
                    </div>

                    {/* Agent Info */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900">
                          {agent.ensName || `${agent.address.slice(0, 8)}...${agent.address.slice(-6)}`}
                        </h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${getTrustLevelColor(agent.trustLevel)}`}>
                          {agent.trustLevel}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Users className="w-3 h-3" />
                          <span>{agent.interactions} interactions</span>
                        </span>
                        <span>{agent.successRate}% success rate</span>
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{agent.score}</div>
                    <div className="text-sm text-gray-500">Reputation Score</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && leaderboard.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No reputation data available</p>
            <p className="text-sm text-gray-400">Agents will appear here as they build reputation on-chain</p>
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Blockchain-Powered Reputation</h4>
            <p className="text-sm text-blue-800">
              Reputation scores are calculated from verified on-chain transactions and interactions. 
              This ensures transparency and prevents manipulation of reputation data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}