import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Star, ExternalLink, Zap, Users, Search, RefreshCw } from "lucide-react";

interface Recommendation {
  itemId: string;
  itemType: string;
  title: string;
  description: string;
  score: number;
  reason: string;
  metadata: Record<string, any>;
}

interface SmartRecommendation {
  id: string;
  type: string;
  targetId: string;
  recommendations: Recommendation[];
  generatedAt: string;
  expiresAt: string;
}

interface SmartRecommendationsProps {
  type: 'agent' | 'project' | 'user';
  targetId: string;
  title?: string;
}

export default function SmartRecommendations({ type, targetId, title }: SmartRecommendationsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, any>>({});

  // Fetch recommendations for the target
  const { data: recommendations, isLoading, refetch } = useQuery<SmartRecommendation>({
    queryKey: [`/api/recommendations/${type}/${targetId}`],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Search ETH registry
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['/api/registry/search', searchQuery, selectedFilters],
    enabled: searchQuery.length > 2,
    refetchInterval: false,
  });

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getScoreBadge = (score: number) => {
    const percentage = Math.round(score * 100);
    const colorClass = getScoreColor(score);
    return (
      <span className={`text-sm font-medium ${colorClass}`}>
        {percentage}%
      </span>
    );
  };

  const renderRecommendation = (rec: Recommendation, index: number) => (
    <div key={`${rec.itemId}-${index}`} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <h4 className="font-medium text-gray-900">{rec.title}</h4>
          {rec.metadata?.verified && (
            <div className="flex items-center text-blue-600">
              <Star className="w-4 h-4 fill-current" />
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {getScoreBadge(rec.score)}
          {rec.metadata?.address && (
            <ExternalLink className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>
      
      <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{rec.reason}</span>
        <div className="flex items-center space-x-3">
          {rec.metadata?.reputation && (
            <span className="flex items-center">
              <Star className="w-3 h-3 mr-1" />
              {rec.metadata.reputation}
            </span>
          )}
          {rec.metadata?.capabilities && (
            <span className="flex items-center">
              <Zap className="w-3 h-3 mr-1" />
              {rec.metadata.capabilities.length}
            </span>
          )}
        </div>
      </div>
      
      {rec.metadata?.capabilities && rec.metadata.capabilities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {rec.metadata.capabilities.slice(0, 3).map((cap: string, i: number) => (
            <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
              {cap}
            </span>
          ))}
          {rec.metadata.capabilities.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
              +{rec.metadata.capabilities.length - 3} more
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {title || `Smart Recommendations for ${type}`}
          </h3>
          <button
            onClick={() => refetch()}
            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            data-testid="button-refresh-recommendations"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search Registry */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search ETH registry for agents and tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid="input-search-registry"
            />
          </div>
        </div>

        {/* Search Results */}
        {searchQuery.length > 2 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Registry Search Results {isSearching && "(Loading...)"}
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map((result: any, index: number) => (
                  <div key={result.id || index} className="border border-gray-200 rounded p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{result.ensName || result.address}</span>
                      <span className="text-xs text-gray-500">{result.agentType}</span>
                    </div>
                    <p className="text-gray-600 text-xs mb-2">{result.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Reputation: {result.reputation}</span>
                      <span>{result.capabilities?.length || 0} capabilities</span>
                    </div>
                  </div>
                ))
              ) : searchQuery.length > 2 && !isSearching ? (
                <p className="text-sm text-gray-500">No results found</p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h4 className="font-medium text-gray-900 mb-4">
          Personalized Recommendations
          {recommendations && (
            <span className="ml-2 text-sm text-gray-500">
              ({recommendations.recommendations.length} items)
            </span>
          )}
        </h4>

        {recommendations && recommendations.recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.recommendations.map((rec, index) => 
              renderRecommendation(rec, index)
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No recommendations available yet</p>
            <p className="text-sm text-gray-400">
              Recommendations will appear based on your activity and ChittyID profile
            </p>
          </div>
        )}

        {recommendations && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Generated: {new Date(recommendations.generatedAt).toLocaleString()}</span>
              <span>Expires: {new Date(recommendations.expiresAt).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}