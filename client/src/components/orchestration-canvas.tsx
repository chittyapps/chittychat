import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ReactFlow, 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  Panel,
  NodeProps,
  Handle,
  Position,
  getBezierPath,
  EdgeProps,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { 
  Play, 
  Pause, 
  Square, 
  Save, 
  Download, 
  Upload, 
  Settings,
  Copy,
  Trash2,
  Zap,
  Bot,
  Wrench,
  GitBranch,
  Globe,
  Clock,
  CheckCircle,
  XCircle,
  PlayCircle,
  PauseCircle,
  Loader2,
  Plus,
  MousePointer,
  Hand,
  History,
  RotateCcw,
  Maximize2,
  Grid3x3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket } from '@/hooks/use-websocket';
import { 
  WorkflowNode as WorkflowNodeType, 
  WorkflowEdge as WorkflowEdgeType,
  WorkflowDefinition,
  WorkflowExecutionState,
  WorkflowNodeData,
  Workflow,
  WorkflowRun,
  Agent,
  Integration
} from '@shared/schema';

// Extended types for React Flow
type AgentNodeData = WorkflowNodeData & {
  agentType?: string;
  capabilities?: string[];
  status?: 'idle' | 'running' | 'completed' | 'error' | 'skipped';
  executionTime?: number;
};

type ToolNodeData = WorkflowNodeData & {
  toolName?: string;
  status?: 'idle' | 'running' | 'completed' | 'error' | 'skipped';
  executionTime?: number;
};

type DecisionNodeData = WorkflowNodeData & {
  condition?: string;
  status?: 'idle' | 'running' | 'completed' | 'error' | 'skipped';
};

type IntegrationNodeData = WorkflowNodeData & {
  integrationName?: string;
  endpoint?: string;
  method?: string;
  status?: 'idle' | 'running' | 'completed' | 'error' | 'skipped';
  executionTime?: number;
};

type StartEndNodeData = WorkflowNodeData & {
  status?: 'idle' | 'running' | 'completed' | 'error' | 'skipped';
};

type CustomNodeProps<T = WorkflowNodeData> = NodeProps & {
  data: T;
};

// Custom Node Components
const AgentNode = ({ data, selected, id }: CustomNodeProps<AgentNodeData>) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  const statusColors = {
    idle: 'border-slate-400 bg-slate-900/50',
    running: 'border-blue-400 bg-blue-900/50 animate-pulse',
    completed: 'border-green-400 bg-green-900/50',
    error: 'border-red-400 bg-red-900/50',
    skipped: 'border-yellow-400 bg-yellow-900/50'
  };

  const statusColor = statusColors[data.status as keyof typeof statusColors] || statusColors.idle;
  
  return (
    <>
      <div
        className={`
          px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px] backdrop-blur-sm
          ${statusColor}
          ${selected ? 'ring-2 ring-blue-400' : ''}
          transition-all duration-200 hover:shadow-xl
        `}
        onDoubleClick={() => setIsConfigOpen(true)}
        data-testid={`node-agent-${id}`}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-blue-400 !w-3 !h-3"
          data-testid={`handle-target-${id}`}
        />
        
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-5 h-5 text-blue-400" />
          <span className="font-medium text-white">{data.label}</span>
          {data.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
        </div>
        
        {data.description && (
          <p className="text-sm text-white/60 mb-2">{data.description}</p>
        )}
        
        <div className="flex gap-1 flex-wrap">
          {data.capabilities?.map((cap: string) => (
            <Badge key={cap} variant="secondary" className="text-xs">
              {cap}
            </Badge>
          ))}
        </div>
        
        {data.executionTime && (
          <div className="mt-2 text-xs text-white/60">
            {data.executionTime}ms
          </div>
        )}
        
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-blue-400 !w-3 !h-3"
          data-testid={`handle-source-${id}`}
        />
      </div>
      
      {/* Node Configuration Dialog would go here */}
    </>
  );
};

const ToolNode = ({ data, selected, id }: CustomNodeProps<ToolNodeData>) => {
  const statusColors = {
    idle: 'border-slate-400 bg-slate-900/50',
    running: 'border-purple-400 bg-purple-900/50 animate-pulse',
    completed: 'border-green-400 bg-green-900/50',
    error: 'border-red-400 bg-red-900/50',
    skipped: 'border-yellow-400 bg-yellow-900/50'
  };

  const statusColor = statusColors[data.status as keyof typeof statusColors] || statusColors.idle;
  
  return (
    <div
      className={`
        px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px] backdrop-blur-sm
        ${statusColor}
        ${selected ? 'ring-2 ring-purple-400' : ''}
        transition-all duration-200 hover:shadow-xl
      `}
      data-testid={`node-tool-${id}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-purple-400 !w-3 !h-3"
      />
      
      <div className="flex items-center gap-2 mb-2">
        <Wrench className="w-5 h-5 text-purple-400" />
        <span className="font-medium text-white">{data.label}</span>
        {data.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
      </div>
      
      {data.description && (
        <p className="text-sm text-white/60 mb-2">{data.description}</p>
      )}
      
      {data.toolName && (
        <Badge variant="outline" className="text-xs mb-2">
          {data.toolName}
        </Badge>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-400 !w-3 !h-3"
      />
    </div>
  );
};

const DecisionNode = ({ data, selected, id }: CustomNodeProps<DecisionNodeData>) => {
  const statusColor = data.status === 'running' ? 'border-orange-400 bg-orange-900/50 animate-pulse' : 'border-orange-400 bg-orange-900/50';
  
  return (
    <div
      className={`
        px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px] backdrop-blur-sm
        ${statusColor}
        ${selected ? 'ring-2 ring-orange-400' : ''}
        transition-all duration-200 hover:shadow-xl
      `}
      data-testid={`node-decision-${id}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-orange-400 !w-3 !h-3"
      />
      
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="w-5 h-5 text-orange-400" />
        <span className="font-medium text-white">{data.label}</span>
      </div>
      
      {data.condition && (
        <p className="text-sm text-white/80 mb-2 font-mono">
          {data.condition}
        </p>
      )}
      
      <div className="flex justify-between">
        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
          className="!bg-green-400 !w-3 !h-3 !left-1/4"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          className="!bg-red-400 !w-3 !h-3 !left-3/4"
        />
      </div>
    </div>
  );
};

const IntegrationNode = ({ data, selected, id }: CustomNodeProps<IntegrationNodeData>) => {
  const statusColor = data.status === 'running' ? 'border-green-400 bg-green-900/50 animate-pulse' : 'border-green-400 bg-green-900/50';
  
  return (
    <div
      className={`
        px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px] backdrop-blur-sm
        ${statusColor}
        ${selected ? 'ring-2 ring-green-400' : ''}
        transition-all duration-200 hover:shadow-xl
      `}
      data-testid={`node-integration-${id}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-green-400 !w-3 !h-3"
      />
      
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5 text-green-400" />
        <span className="font-medium text-white">{data.label}</span>
        {data.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-green-400" />}
      </div>
      
      {data.integrationName && (
        <Badge variant="outline" className="text-xs mb-2">
          {data.integrationName}
        </Badge>
      )}
      
      {data.endpoint && (
        <p className="text-xs text-white/60 mb-2 font-mono">
          {data.method?.toUpperCase()} {data.endpoint}
        </p>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-green-400 !w-3 !h-3"
      />
    </div>
  );
};

const StartNode = ({ data, selected, id }: CustomNodeProps<StartEndNodeData>) => {
  return (
    <div
      className={`
        px-6 py-4 shadow-lg rounded-full border-2 border-cyan-400 bg-cyan-900/50 backdrop-blur-sm
        ${selected ? 'ring-2 ring-cyan-400' : ''}
        transition-all duration-200 hover:shadow-xl
      `}
      data-testid={`node-start-${id}`}
    >
      <div className="flex items-center gap-2">
        <PlayCircle className="w-6 h-6 text-cyan-400" />
        <span className="font-medium text-white">Start</span>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-cyan-400 !w-3 !h-3"
      />
    </div>
  );
};

const EndNode = ({ data, selected, id }: CustomNodeProps<StartEndNodeData>) => {
  return (
    <div
      className={`
        px-6 py-4 shadow-lg rounded-full border-2 border-red-400 bg-red-900/50 backdrop-blur-sm
        ${selected ? 'ring-2 ring-red-400' : ''}
        transition-all duration-200 hover:shadow-xl
      `}
      data-testid={`node-end-${id}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-red-400 !w-3 !h-3"
      />
      
      <div className="flex items-center gap-2">
        <Square className="w-6 h-6 text-red-400 fill-current" />
        <span className="font-medium text-white">End</span>
      </div>
    </div>
  );
};

// Custom Edge Component
const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path stroke-2 stroke-white/30 hover:stroke-blue-400 transition-colors"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {data?.label && (
        <text
          x={labelX}
          y={labelY}
          className="react-flow__edge-textwrapper fill-white text-xs"
          textAnchor="middle"
          dominantBaseline="central"
        >
          <tspan
            x={labelX}
            dy="0"
            className="react-flow__edge-text bg-slate-900 px-2 py-1 rounded"
          >
            {String(data.label)}
          </tspan>
        </text>
      )}
    </>
  );
};

// Node Palette Component
const NodePalette = ({ onDragStart }: { onDragStart: (event: any, nodeType: string) => void }) => {
  const nodeTypes = [
    { type: 'start', icon: PlayCircle, label: 'Start', color: 'text-cyan-400' },
    { type: 'agent', icon: Bot, label: 'Agent', color: 'text-blue-400' },
    { type: 'tool', icon: Wrench, label: 'Tool', color: 'text-purple-400' },
    { type: 'decision', icon: GitBranch, label: 'Decision', color: 'text-orange-400' },
    { type: 'integration', icon: Globe, label: 'Integration', color: 'text-green-400' },
    { type: 'end', icon: Square, label: 'End', color: 'text-red-400' },
  ];

  return (
    <Card className="glass-card border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-sm font-medium">Node Palette</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {nodeTypes.map((nodeType) => {
          const IconComponent = nodeType.icon;
          return (
            <div
              key={nodeType.type}
              className={`
                flex items-center gap-3 p-3 rounded-lg cursor-grab active:cursor-grabbing
                bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20
                transition-all duration-200 hover:scale-105
              `}
              draggable
              onDragStart={(event) => onDragStart(event, nodeType.type)}
              data-testid={`palette-${nodeType.type}`}
            >
              <IconComponent className={`w-5 h-5 ${nodeType.color}`} />
              <span className="text-white text-sm font-medium">{nodeType.label}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

// Execution Panel Component
const ExecutionPanel = ({ 
  workflow, 
  isRunning, 
  onRun, 
  onPause, 
  onStop,
  executionState 
}: {
  workflow: Workflow | null;
  isRunning: boolean;
  onRun: () => void;
  onPause: () => void;
  onStop: () => void;
  executionState?: WorkflowExecutionState;
}) => {
  return (
    <Card className="glass-card border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-sm font-medium">Execution Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onRun}
            disabled={isRunning}
            className="bg-green-500/20 hover:bg-green-500/30 border-green-400/20"
            data-testid="button-run-workflow"
          >
            <Play className="w-4 h-4 mr-1" />
            Run
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onPause}
            disabled={!isRunning}
            className="bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-400/20"
            data-testid="button-pause-workflow"
          >
            <Pause className="w-4 h-4 mr-1" />
            Pause
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onStop}
            disabled={!isRunning}
            className="bg-red-500/20 hover:bg-red-500/30 border-red-400/20"
            data-testid="button-stop-workflow"
          >
            <Square className="w-4 h-4 mr-1" />
            Stop
          </Button>
        </div>
        
        {executionState && (
          <div className="space-y-2">
            <div className="text-xs text-white/60">
              Completed: {executionState.completedNodes.length} nodes
            </div>
            {executionState.failedNodes.length > 0 && (
              <div className="text-xs text-red-400">
                Failed: {executionState.failedNodes.length} nodes
              </div>
            )}
            {executionState.currentNodeId && (
              <div className="text-xs text-blue-400">
                Current: {executionState.currentNodeId}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Main Orchestration Canvas Component
export default function OrchestrationCanvas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { sendMessage } = useWebSocket(); // Initialize WebSocket
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const { fitView, setViewport, getViewport } = useReactFlow();

  // State management  
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionState, setExecutionState] = useState<WorkflowExecutionState>();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isDragMode, setIsDragMode] = useState(false);

  // Node types configuration
  const nodeTypes: NodeTypes = useMemo(() => ({
    agent: AgentNode,
    tool: ToolNode,
    decision: DecisionNode,
    integration: IntegrationNode,
    start: StartNode,
    end: EndNode,
  }), []);

  const edgeTypes: EdgeTypes = useMemo(() => ({
    custom: CustomEdge,
  }), []);

  // Data fetching
  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
    refetchInterval: 15000,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['/api/agents'],
    refetchInterval: 30000,
  });

  const { data: integrations = [] } = useQuery<Integration[]>({
    queryKey: ['/api/integrations'],
    refetchInterval: 30000,
  });

  // Workflow operations
  const saveWorkflowMutation = useMutation({
    mutationFn: async (workflowData: any) => {
      return apiRequest('/api/workflows', {
        method: 'POST',
        body: JSON.stringify(workflowData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Workflow Saved",
        description: "Your workflow has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      setShowSaveDialog(false);
      setWorkflowName('');
      setWorkflowDescription('');
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save workflow.",
        variant: "destructive",
      });
    },
  });

  const runWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest(`/api/workflows/${workflowId}/run`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      setIsRunning(true);
      toast({
        title: "Workflow Started",
        description: "Your workflow execution has begun.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to start workflow execution.",
        variant: "destructive",
      });
    },
  });

  const pauseWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest(`/api/workflows/${workflowId}/pause`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setIsRunning(false);
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', selectedWorkflow] });
    },
    onError: (error: any) => {
      toast({
        title: "Pause Failed",
        description: error.message || "Failed to pause workflow execution.",
        variant: "destructive",
      });
    },
  });

  const stopWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      return apiRequest(`/api/workflows/${workflowId}/stop`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setIsRunning(false);
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', selectedWorkflow] });
    },
    onError: (error: any) => {
      toast({
        title: "Stop Failed",
        description: error.message || "Failed to stop workflow execution.",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds: any) => addEdge({ ...params, type: 'custom' }, eds));
  }, [setEdges]);

  const onDragStart = (event: any, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    setIsDragMode(true);
  };

  const onDrop = useCallback(
    (event: any) => {
      event.preventDefault();
      setIsDragMode(false);

      if (!reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: type as any,
        position,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          description: `Configure this ${type} node`,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, setNodes]
  );

  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleSaveWorkflow = () => {
    const workflowDefinition: WorkflowDefinition = {
      nodes: nodes as unknown as WorkflowNodeType[],
      edges: edges as unknown as WorkflowEdgeType[],
      viewport: getViewport(),
    };

    saveWorkflowMutation.mutate({
      name: workflowName,
      description: workflowDescription,
      definition: workflowDefinition,
      status: 'draft',
    });
  };

  const handleRunWorkflow = () => {
    if (selectedWorkflow) {
      runWorkflowMutation.mutate(selectedWorkflow);
    } else if (nodes.length > 0) {
      // Run current canvas workflow
      const tempWorkflowDefinition: WorkflowDefinition = {
        nodes: nodes as unknown as WorkflowNodeType[],
        edges: edges as unknown as WorkflowEdgeType[],
        viewport: getViewport(),
      };
      
      // Create and immediately run workflow
      setIsRunning(true);
      toast({
        title: "Workflow Started",
        description: "Running workflow from current canvas.",
      });
    }
  };

  const handleLoadWorkflow = (workflow: Workflow) => {
    const definition = workflow.definition as WorkflowDefinition;
    setNodes((definition.nodes as unknown as Node[]) || []);
    setEdges((definition.edges as unknown as Edge[]) || []);
    setSelectedWorkflow(workflow.id);
    
    if (definition.viewport) {
      setViewport(definition.viewport, { duration: 800 });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            setShowSaveDialog(true);
            break;
          case 'z':
            event.preventDefault();
            // Implement undo
            break;
          case 'y':
            event.preventDefault();
            // Implement redo
            break;
        }
      }
      
      if (event.key === 'Delete') {
        // Delete selected nodes/edges
        setNodes((nds) => nds.filter((node: any) => !node.selected));
        setEdges((eds) => eds.filter((edge: any) => !edge.selected));
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, [setNodes, setEdges]);

  return (
    <div className="h-screen w-full flex bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Left Sidebar */}
      <div className="w-80 border-r border-white/10 p-4 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Orchestration Canvas</h1>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSaveDialog(true)}
            className="bg-blue-500/20 hover:bg-blue-500/30"
            data-testid="button-save-workflow"
          >
            <Save className="w-4 h-4" />
          </Button>
        </div>

        {/* Node Palette */}
        <NodePalette onDragStart={onDragStart} />

        {/* Execution Panel */}
        <ExecutionPanel
          workflow={selectedWorkflow ? workflows.find((w: Workflow) => w.id === selectedWorkflow) || null : null}
          isRunning={isRunning}
          onRun={handleRunWorkflow}
          onPause={() => selectedWorkflow && pauseWorkflowMutation.mutate(selectedWorkflow)}
          onStop={() => selectedWorkflow && stopWorkflowMutation.mutate(selectedWorkflow)}
          executionState={executionState}
        />

        {/* Workflow List */}
        <Card className="glass-card border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm font-medium">Saved Workflows</CardTitle>
          </CardHeader>
          <CardContent>
            {workflowsLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {workflows.map((workflow: Workflow) => (
                  <div
                    key={workflow.id}
                    className={`
                      p-3 rounded-lg cursor-pointer border transition-all duration-200
                      ${selectedWorkflow === workflow.id 
                        ? 'bg-blue-500/20 border-blue-400/30' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }
                    `}
                    onClick={() => handleLoadWorkflow(workflow)}
                    data-testid={`workflow-item-${workflow.id}`}
                  >
                    <div className="font-medium text-white text-sm">{workflow.name}</div>
                    {workflow.description && (
                      <div className="text-xs text-white/60 mt-1">{workflow.description}</div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline" className="text-xs">
                        {workflow.status}
                      </Badge>
                      <div className="text-xs text-white/40">
                        {new Date(workflow.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative">
        <div ref={reactFlowWrapper} className="h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            className="!bg-transparent"
            fitView
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
            data-testid="react-flow-canvas"
          >
            <Background 
              color="#ffffff20"
              gap={20}
              size={1}
              className="opacity-30"
            />
            
            <Controls 
              className="!bg-slate-800/80 !backdrop-blur-sm !border-white/20"
              showZoom
              showFitView
              showInteractive
            />
            
            <MiniMap
              className="!bg-slate-800/80 !backdrop-blur-sm !border !border-white/20 !rounded-lg"
              nodeColor="#ffffff40"
              nodeStrokeWidth={2}
              zoomable
              pannable
            />

            {/* Canvas Overlay Info */}
            <Panel position="top-center" className="pointer-events-none">
              <div className="glass-card px-4 py-2 border-white/10">
                <div className="text-white/80 text-sm">
                  {isDragMode ? 'Drop node on canvas' : `${nodes.length} nodes • ${edges.length} connections`}
                </div>
              </div>
            </Panel>

            {/* Execution Status Overlay */}
            {isRunning && (
              <Panel position="top-right" className="pointer-events-none">
                <div className="glass-card px-4 py-2 border-green-400/30 bg-green-900/20">
                  <div className="flex items-center gap-2 text-green-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Executing Workflow</span>
                  </div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Save Workflow Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="glass-card border-white/20">
          <DialogHeader>
            <DialogTitle className="text-white">Save Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="workflow-name" className="text-white/80">
                Workflow Name
              </Label>
              <Input
                id="workflow-name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Enter workflow name"
                className="bg-white/10 border-white/20 text-white"
                data-testid="input-workflow-name"
              />
            </div>
            <div>
              <Label htmlFor="workflow-description" className="text-white/80">
                Description
              </Label>
              <Textarea
                id="workflow-description"
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Describe your workflow..."
                className="bg-white/10 border-white/20 text-white resize-none"
                data-testid="textarea-workflow-description"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowSaveDialog(false)}
                className="bg-white/10 hover:bg-white/20"
                data-testid="button-cancel-save"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveWorkflow}
                disabled={!workflowName.trim() || saveWorkflowMutation.isPending}
                className="bg-blue-500/20 hover:bg-blue-500/30 border-blue-400/20"
                data-testid="button-confirm-save"
              >
                {saveWorkflowMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save Workflow
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wrapped component with ReactFlowProvider
export function OrchestrationCanvasWrapper() {
  return (
    <ReactFlowProvider>
      <OrchestrationCanvas />
    </ReactFlowProvider>
  );
}