import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Bot, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail, 
  Calendar, 
  FileText,
  Loader2,
  Brain,
  Zap,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface AgentAction {
  id: string;
  actionType: string;
  description: string;
  proposedChanges: any;
  isApproved: boolean | null;
  isExecuted: boolean;
  requiresApproval: boolean;
  confidence: number;
  serviceType: string;
  createdAt: string;
  executedAt: string | null;
}

export function AIActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ["/api/agent/actions"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const approveMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const response = await apiRequest("POST", `/api/agent/actions/${actionId}/approve`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/actions"] });
      toast({
        title: "Action approved",
        description: "Your AI assistant will execute this action shortly.",
      });
    },
    onError: () => {
      toast({
        title: "Approval failed",
        description: "Couldn't approve the action. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (actionId: string) => {
      const response = await apiRequest("POST", `/api/agent/actions/${actionId}/reject`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/actions"] });
      toast({
        title: "Action rejected",
        description: "Your AI assistant will learn from this feedback.",
      });
    },
    onError: () => {
      toast({
        title: "Rejection failed",
        description: "Couldn't reject the action. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'gmail':
        return <Mail className="w-4 h-4 text-coral" />;
      case 'google_calendar':
        return <Calendar className="w-4 h-4 text-mint" />;
      case 'google_drive':
        return <FileText className="w-4 h-4 text-warmBlue" />;
      default:
        return <Bot className="w-4 h-4 text-sage" />;
    }
  };

  const getActionStatus = (action: AgentAction) => {
    if (action.isExecuted) {
      return {
        label: "Completed",
        variant: "success" as const,
        icon: <CheckCircle className="w-3 h-3" />,
        className: "bg-sage/10 text-sage border-sage/20"
      };
    } else if (action.isApproved === false) {
      return {
        label: "Rejected",
        variant: "destructive" as const,
        icon: <XCircle className="w-3 h-3" />,
        className: "bg-coral/10 text-coral border-coral/20"
      };
    } else if (action.isApproved === true) {
      return {
        label: "Approved",
        variant: "default" as const,
        icon: <Loader2 className="w-3 h-3 animate-spin" />,
        className: "bg-mint/10 text-mint border-mint/20"
      };
    } else if (action.requiresApproval) {
      return {
        label: "Needs approval",
        variant: "secondary" as const,
        icon: <AlertTriangle className="w-3 h-3" />,
        className: "bg-warmBlue/10 text-warmBlue border-warmBlue/20"
      };
    } else {
      return {
        label: "Processing",
        variant: "outline" as const,
        icon: <Clock className="w-3 h-3" />,
        className: "bg-gray-50 text-gray-600 border-gray-200"
      };
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-sage";
    if (confidence >= 0.6) return "text-mint";
    return "text-warmBlue";
  };

  const pendingActions = (actions as AgentAction[]).filter((action: AgentAction) => 
    action.requiresApproval && action.isApproved === null
  );

  const recentActions = (actions as AgentAction[]).filter((action: AgentAction) => 
    !action.requiresApproval || action.isApproved !== null
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
        <div className="flex items-center mb-6">
          <Brain className="text-sage mr-3 w-5 h-5" />
          <h2 className="text-xl font-semibold text-charcoal">AI Actions</h2>
        </div>
        
        <div className="text-center py-8">
          <Bot className="w-16 h-16 text-sage/30 mx-auto mb-4" />
          <p className="text-charcoal/60 mb-2">Your AI assistant is getting ready</p>
          <p className="text-sm text-charcoal/40">
            Connect your services first, and your assistant will start working in the background
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Brain className="text-sage mr-3 w-5 h-5" />
          <h2 className="text-xl font-semibold text-charcoal">AI Actions</h2>
        </div>
        
        {pendingActions.length > 0 && (
          <Badge variant="outline" className="bg-warmBlue/10 text-warmBlue border-warmBlue/20">
            {pendingActions.length} need approval
          </Badge>
        )}
      </div>

      {/* Pending approval actions */}
      {pendingActions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <AlertTriangle className="w-4 h-4 text-warmBlue mr-2" />
            <h3 className="font-medium text-charcoal">Needs Your Approval</h3>
          </div>
          
          <div className="space-y-3">
            {pendingActions.map((action: AgentAction) => {
              const status = getActionStatus(action);
              
              return (
                <Card key={action.id} className="border-warmBlue/20 bg-warmBlue/5">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          {getServiceIcon(action.serviceType)}
                          <span className="ml-2 font-medium text-charcoal text-sm">
                            {action.actionType.replace(/_/g, ' ')}
                          </span>
                          <Badge className={`ml-2 ${status.className}`}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-charcoal/70 mb-3">
                          {action.description}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-xs text-charcoal/50">
                            <Zap className={`w-3 h-3 mr-1 ${getConfidenceColor(action.confidence)}`} />
                            {Math.round(action.confidence * 100)}% confidence
                            <span className="mx-2">•</span>
                            {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectMutation.mutate(action.id)}
                              disabled={rejectMutation.isPending}
                              className="text-coral border-coral/20 hover:bg-coral/10"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate(action.id)}
                              disabled={approveMutation.isPending}
                              className="bg-sage hover:bg-sage/90"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          <Separator className="my-6" />
        </div>
      )}

      {/* Recent actions */}
      <div>
        <h3 className="font-medium text-charcoal mb-3">Recent Activity</h3>
        
        {recentActions.length === 0 ? (
          <div className="text-center py-6 text-charcoal/50">
            <Clock className="w-12 h-12 mx-auto mb-2 text-sage/30" />
            <p>No recent activity yet</p>
            <p className="text-sm">Your AI assistant is learning your patterns</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActions.slice(0, 10).map((action: AgentAction) => {
              const status = getActionStatus(action);
              
              return (
                <Card key={action.id} className="border-gray-100">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          {getServiceIcon(action.serviceType)}
                          <span className="ml-2 font-medium text-charcoal text-sm">
                            {action.actionType.replace(/_/g, ' ')}
                          </span>
                          <Badge className={`ml-2 ${status.className}`}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-charcoal/60 mb-2">
                          {action.description}
                        </p>
                        
                        <div className="flex items-center text-xs text-charcoal/50">
                          <Zap className={`w-3 h-3 mr-1 ${getConfidenceColor(action.confidence)}`} />
                          {Math.round(action.confidence * 100)}% confidence
                          <span className="mx-2">•</span>
                          {formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}
                          {action.executedAt && (
                            <>
                              <span className="mx-2">•</span>
                              Completed {formatDistanceToNow(new Date(action.executedAt), { addSuffix: true })}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}