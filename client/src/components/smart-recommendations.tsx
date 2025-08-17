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

  // Search ETH registry with enhanced filtering
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['/api/registry/search', searchQuery, selectedFilters],
    enabled: searchQuery.length > 1, // Lower threshold for better UX
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

        {/* Enhanced Search with Filters */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search agents, domains, capabilities, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              data-testid="input-search-registry"
            />
          </div>
          
          {/* Search Filters */}
          <div className="flex flex-wrap gap-2 text-sm">
            <select
              value={selectedFilters.agentType || ''}
              onChange={(e) => setSelectedFilters({...selectedFilters, agentType: e.target.value || undefined})}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
              data-testid="select-agent-type"
            >
              <option value="">All Types</option>
              <option value="task-manager">Task Manager</option>
              <option value="developer">Developer</option>
              <option value="analyst">Analyst</option>
            </select>
            
            <select
              value={selectedFilters.minReputation || ''}
              onChange={(e) => setSelectedFilters({...selectedFilters, minReputation: e.target.value ? parseInt(e.target.value) : undefined})}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
              data-testid="select-min-reputation"
            >
              <option value="">Any Reputation</option>
              <option value="80">80+ Reputation</option>
              <option value="90">90+ Reputation</option>
              <option value="95">95+ Reputation</option>
            </select>
            
            <label className="flex items-center space-x-1">
              <input
                type="checkbox"
                checked={selectedFilters.verified === true}
                onChange={(e) => setSelectedFilters({...selectedFilters, verified: e.target.checked ? true : undefined})}
                className="rounded"
                data-testid="checkbox-verified-only"
              />
              <span>Verified Only</span>
            </label>
          </div>
        </div>

        {/* Enhanced Search Results with Alignment Info */}
        {searchQuery.length > 1 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
              Registry Search Results 
              {isSearching && <span className="ml-2 text-blue-500">(Searching...)</span>}
              {searchResults.length > 0 && (
                <span className="ml-2 text-gray-500">({searchResults.length} found)</span>
              )}
            </h4>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map((result: any, index: number) => (
                  <div key={result.id || index} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-blue-600">
                            {result.ensName || `${result.address.slice(0, 8)}...${result.address.slice(-6)}`}
                          </span>
                          {result.verified && (
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                          )}
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {result.agentType}
                          </span>
                        </div>
                        <p className="text-gray-600 text-xs mb-2">{result.description}</p>
                        
                        {/* Alignment factors */}
                        {result.alignmentFactors && result.alignmentFactors.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {result.alignmentFactors.slice(0, 2).map((factor: string, i: number) => (
                              <span key={i} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                {factor}
                              </span>
                            ))}
                            {result.alignmentFactors.length > 2 && (
                              <span className="text-xs text-gray-500">+{result.alignmentFactors.length - 2} more</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        {result.relevanceScore && (
                          <div className="text-xs text-gray-500 mb-1">
                            Relevance: {Math.round(result.relevanceScore * 100) / 100}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Rep: {result.reputation}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex flex-wrap gap-1">
                        {result.capabilities?.slice(0, 3).map((cap: string, i: number) => (
                          <span key={i} className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                            {cap}
                          </span>
                        ))}
                        {result.capabilities?.length > 3 && (
                          <span>+{result.capabilities.length - 3} more</span>
                        )}
                      </div>
                      <span>{result.capabilities?.length || 0} capabilities</span>
                    </div>
                  </div>
                ))
              ) : searchQuery.length > 1 && !isSearching ? (
                <div className="text-center py-4">
                  <Search className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No agents found matching your search</p>
                  <p className="text-xs text-gray-400">Try different keywords or remove filters</p>
                </div>
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