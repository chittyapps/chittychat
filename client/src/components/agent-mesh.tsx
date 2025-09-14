import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ForceGraph2D from "react-force-graph-2d";
import { 
  Activity, 
  Search, 
  Settings, 
  Zap, 
  AlertCircle, 
  RefreshCw,
  Maximize2,
  Filter,
  Info
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// TypeScript interfaces for Agent Mesh data
interface MeshNode {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'integration' | 'project';
  status: 'active' | 'idle' | 'offline' | 'error';
  capabilities?: string[];
  metadata?: {
    lastSeen?: string;
    taskCount?: number;
    successRate?: number;
    averageResponseTime?: number;
    version?: string;
    sessionId?: string;
  };
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  val?: number; // Node size value
}

interface MeshEdge {
  source: string;
  target: string;
  type: 'mcp' | 'task' | 'integration' | 'communication';
  weight: number;
  metadata?: {
    frequency?: number;
    lastInteraction?: string;
    dataType?: string;
    status?: 'active' | 'idle' | 'error';
  };
}

interface AgentMeshData {
  nodes: MeshNode[];
  edges: MeshEdge[];
  lastUpdated: string;
  totalConnections: number;
  activeConnections: number;
  statistics: {
    totalAgents: number;
    activeAgents: number;
    totalTools: number;
    activeTools: number;
    avgResponseTime: number;
    networkHealth: number;
  };
}

interface AgentMeshProps {
  height?: number;
  width?: number;
  className?: string;
}

// Color scheme for different node types and statuses
const getNodeColor = (node: MeshNode): string => {
  const statusColors = {
    active: '#10b981', // green
    idle: '#3b82f6',   // blue  
    offline: '#6b7280', // gray
    error: '#f59e0b'    // amber
  };

  const typeColors = {
    agent: statusColors[node.status],
    tool: node.status === 'active' ? '#8b5cf6' : '#6b7280', // purple or gray
    integration: node.status === 'active' ? '#06b6d4' : '#6b7280', // cyan or gray
    project: '#f97316' // orange
  };

  return typeColors[node.type];
};

// Get node size based on activity and type
const getNodeSize = (node: MeshNode): number => {
  const baseSizes = {
    agent: 12,
    tool: 8,
    integration: 10,
    project: 14
  };

  const activityMultiplier = node.metadata?.taskCount ? 
    Math.min(1 + (node.metadata.taskCount / 10), 2) : 1;

  return baseSizes[node.type] * activityMultiplier;
};

// Get edge color based on type and activity
const getLinkColor = (edge: MeshEdge): string => {
  const baseColors = {
    mcp: '#8b5cf6',        // purple
    task: '#10b981',       // green
    integration: '#06b6d4', // cyan
    communication: '#f59e0b' // amber
  };

  const alpha = edge.metadata?.status === 'active' ? '1' : '0.4';
  const color = baseColors[edge.type];
  
  // Convert hex to rgba for transparency
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function AgentMesh({ height = 600, width, className }: AgentMeshProps) {
  const fgRef = useRef<any>();
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch agent mesh data with real-time updates
  const { data: meshData, isLoading, error, isRefetching } = useQuery<AgentMeshData>({
    queryKey: ['/api/metrics/agent-mesh'],
    refetchInterval: 10000, // 10 seconds for real-time updates
    refetchIntervalInBackground: true,
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  // Filter nodes based on search and type filter
  const filteredData = useCallback(() => {
    if (!meshData) return { nodes: [], links: [] };

    let filteredNodes = meshData.nodes;

    // Apply search filter
    if (searchTerm) {
      filteredNodes = filteredNodes.filter(node =>
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.capabilities?.some(cap => 
          cap.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filteredNodes = filteredNodes.filter(node => node.type === filterType);
    }

    // Filter edges to only include connections between filtered nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = meshData.edges.filter(edge =>
      nodeIds.has(edge.source.toString()) && nodeIds.has(edge.target.toString())
    );

    // Convert edges to links for the force graph
    return { 
      nodes: filteredNodes, 
      links: filteredEdges.map(edge => ({
        ...edge,
        source: edge.source,
        target: edge.target
      }))
    };
  }, [meshData, searchTerm, filterType]);

  // Handle node click
  const handleNodeClick = useCallback((node: MeshNode) => {
    setSelectedNode(node);
    
    // Center the view on the clicked node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(3, 1000);
    }
  }, []);

  // Handle node hover
  const handleNodeHover = useCallback((node: MeshNode | null) => {
    if (fgRef.current) {
      fgRef.current.linkDirectionalParticles(
        node ? (link: MeshEdge) => 
          link.source === node.id || link.target === node.id ? 4 : 0 : 0
      );
    }
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400);
      setSelectedNode(null);
    }
  }, []);

  // Custom node rendering with enhanced visuals
  const nodeCanvasObject = useCallback((node: MeshNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = 12/globalScale;
    const nodeSize = getNodeSize(node);
    const color = getNodeColor(node);

    // Draw node circle with glow effect for active nodes
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI, false);
    
    if (node.status === 'active') {
      // Add glow effect for active nodes
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw node border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1/globalScale;
    ctx.stroke();

    // Draw status indicator
    if (node.status === 'active') {
      ctx.beginPath();
      ctx.arc(node.x! + nodeSize * 0.6, node.y! - nodeSize * 0.6, 3/globalScale, 0, 2 * Math.PI, false);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // Draw label
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, node.x!, node.y! + nodeSize + 8/globalScale);
    
    // Draw type badge
    const badge = node.type.toUpperCase();
    ctx.font = `${fontSize * 0.7}px Sans-Serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(badge, node.x!, node.y! + nodeSize + 18/globalScale);
  }, []);

  // Enhanced link rendering
  const linkCanvasObject = useCallback((edge: any, ctx: CanvasRenderingContext2D) => {
    const { source, target } = edge;
    if (typeof source === 'object' && typeof target === 'object' && source.x && source.y && target.x && target.y) {
      const color = getLinkColor(edge);
      const width = Math.max(1, edge.weight * 2);

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();

      // Add directional particles for active connections
      if (edge.metadata?.status === 'active') {
        const particleSize = 2;
        const t = (Date.now() / 1000) % 1; // Animation parameter
        const x = source.x + (target.x - source.x) * t;
        const y = source.y + (target.y - source.y) * t;
        
        ctx.beginPath();
        ctx.arc(x, y, particleSize, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }, []);

  if (error) {
    return (
      <Card className="glass-card p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">Agent Mesh Unavailable</h3>
        <p className="text-white/60">Failed to load agent mesh data. Please try again.</p>
      </Card>
    );
  }

  const data = filteredData();

  return (
    <div className={`space-y-4 ${className}`} data-testid="agent-mesh">
      {/* Header Controls */}
      <Card className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-400/30">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Agent Mesh</h2>
              <p className="text-white/60 text-sm flex items-center gap-2">
                Real-time agent network topology
                {isRefetching && (
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                )}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
              <Input
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-48 bg-black/20 border-white/10 text-white"
                data-testid="input-search-agents"
              />
            </div>

            {/* Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white text-sm"
              data-testid="select-filter-type"
            >
              <option value="all">All Types</option>
              <option value="agent">Agents</option>
              <option value="tool">Tools</option>
              <option value="integration">Integrations</option>
              <option value="project">Projects</option>
            </select>

            {/* Reset View */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetView}
                    className="bg-black/20 border-white/10 text-white hover:bg-white/10"
                    data-testid="button-reset-view"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset View</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Statistics */}
        {meshData && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{meshData.statistics.totalAgents}</div>
              <div className="text-xs text-white/60">Total Agents</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-400">{meshData.statistics.activeAgents}</div>
              <div className="text-xs text-white/60">Active Agents</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-400">{meshData.statistics.totalTools}</div>
              <div className="text-xs text-white/60">MCP Tools</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-cyan-400">{meshData.activeConnections}</div>
              <div className="text-xs text-white/60">Active Links</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-400">{meshData.statistics.avgResponseTime}ms</div>
              <div className="text-xs text-white/60">Avg Response</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400">{meshData.statistics.networkHealth}%</div>
              <div className="text-xs text-white/60">Network Health</div>
            </div>
          </div>
        )}
      </Card>

      {/* Graph Container */}
      <Card className="glass-card p-2 overflow-hidden">
        {isLoading ? (
          // Loading skeleton
          <div className="flex items-center justify-center h-96 bg-black/20 rounded-lg">
            <div className="text-center">
              <Activity className="w-12 h-12 text-blue-400 mx-auto mb-4 animate-pulse" />
              <p className="text-white/60">Loading agent mesh...</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <ForceGraph2D
              ref={fgRef}
              graphData={data}
              width={width}
              height={height}
              backgroundColor="rgba(0, 0, 0, 0)"
              nodeCanvasObject={nodeCanvasObject}
              linkCanvasObject={linkCanvasObject}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleWidth={2}
              cooldownTicks={100}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
              enableZoomInteraction={true}
              enablePanInteraction={true}
              enableNodeDrag={true}
            />

            {/* Mini-map */}
            <div className="absolute top-4 right-4 w-32 h-24 bg-black/40 rounded-lg border border-white/10 overflow-hidden">
              <div className="text-xs text-white/60 p-1 text-center">Network Map</div>
              <div className="h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <div className="text-xs text-white/40">
                  {data.nodes.length} nodes, {data.links.length} links
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Selected Node Details */}
      {selectedNode && (
        <Card className="glass-card p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full`} style={{ backgroundColor: getNodeColor(selectedNode) }}></div>
              <div>
                <h3 className="text-lg font-bold text-white">{selectedNode.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {selectedNode.type}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedNode(null)}
              className="text-white/60 hover:text-white"
              data-testid="button-close-details"
            >
              ×
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-white/60">Status</div>
              <div className="text-white font-medium capitalize">{selectedNode.status}</div>
            </div>
            {selectedNode.metadata?.taskCount !== undefined && (
              <div>
                <div className="text-white/60">Task Count</div>
                <div className="text-white font-medium">{selectedNode.metadata.taskCount}</div>
              </div>
            )}
            {selectedNode.metadata?.successRate !== undefined && (
              <div>
                <div className="text-white/60">Success Rate</div>
                <div className="text-white font-medium">{selectedNode.metadata.successRate}%</div>
              </div>
            )}
            {selectedNode.metadata?.averageResponseTime !== undefined && (
              <div>
                <div className="text-white/60">Avg Response</div>
                <div className="text-white font-medium">{selectedNode.metadata.averageResponseTime}ms</div>
              </div>
            )}
          </div>

          {selectedNode.capabilities && selectedNode.capabilities.length > 0 && (
            <div className="mt-4">
              <div className="text-white/60 text-sm mb-2">Capabilities</div>
              <div className="flex flex-wrap gap-2">
                {selectedNode.capabilities.map((capability, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}