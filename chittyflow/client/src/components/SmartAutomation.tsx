import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { 
  Lightbulb,
  TrendingUp,
  Clock,
  Zap,
  CheckCircle,
  X,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Mail,
  Phone,
  FileText,
  Coffee,
  DropletIcon as Water,
  Battery,
  Target,
  BrainCircuit
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SmartSuggestion {
  id: string;
  userId: string;
  suggestionType: string;
  title: string;
  description: string;
  actionData?: any;
  isAcknowledged: boolean;
  wasHelpful?: boolean;
  priority: 'low' | 'medium' | 'high';
  expiresAt?: string;
  createdAt: string;
}

interface UserPattern {
  id: string;
  userId: string;
  patternType: string;
  timeOfDay?: string;
  dayOfWeek?: string;
  confidence: number;
  dataPoints: number;
  insights?: any;
  createdAt: string;
  updatedAt: string;
}

export function SmartAutomation() {
  const [autoNudgesEnabled, setAutoNudgesEnabled] = useState(true);
  const [patternLearningEnabled, setPatternLearningEnabled] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: suggestions = [] } = useQuery({
    queryKey: ["/api/smart/suggestions"],
  });

  const { data: patterns = [] } = useQuery({
    queryKey: ["/api/smart/patterns"],
  });

  const acknowledgeSuggestion = useMutation({
    mutationFn: async ({ id, wasHelpful }: { id: string; wasHelpful: boolean }) => {
      return await apiRequest(`/api/smart/suggestions/${id}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({ wasHelpful }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart/suggestions"] });
      toast({
        title: "Thank you for the feedback!",
        description: "Your input helps us provide better suggestions.",
      });
    },
  });

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'optimal_timing':
        return <Clock className="w-4 h-4" />;
      case 'energy_break':
        return <Coffee className="w-4 h-4" />;
      case 'hydration':
        return <Water className="w-4 h-4" />;
      case 'context_switch':
        return <Target className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-coral/20 bg-coral/5';
      case 'medium':
        return 'border-warm-blue/20 bg-warm-blue/5';
      case 'low':
        return 'border-sage/20 bg-sage/5';
      default:
        return 'border-sage/20 bg-sage/5';
    }
  };

  const getPatternInsight = (pattern: UserPattern) => {
    const confidence = Math.round(pattern.confidence * 100);
    switch (pattern.patternType) {
      case 'productivity_peak':
        return `You're most productive during ${pattern.timeOfDay} (${confidence}% confidence)`;
      case 'energy_dip':
        return `Energy tends to dip during ${pattern.timeOfDay} (${confidence}% confidence)`;
      case 'focus_duration':
        return `Your optimal focus sessions last ${pattern.insights?.averageMinutes || 25} minutes`;
      default:
        return `Pattern detected with ${confidence}% confidence`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <BrainCircuit className="w-5 h-5 text-warm-blue" />
        <h2 className="text-xl font-semibold text-charcoal">Smart Automation</h2>
      </div>

      <p className="text-charcoal/60 leading-relaxed">
        AI-powered insights that learn your patterns and provide gentle suggestions to optimize your workflow.
      </p>

      {/* Settings */}
      <Card className="border-sage/20 bg-sage/5">
        <CardHeader>
          <CardTitle className="text-lg text-charcoal">Automation Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium text-charcoal">Smart Nudges</p>
              <p className="text-sm text-charcoal/60">Gentle reminders based on your patterns</p>
            </div>
            <Switch
              checked={autoNudgesEnabled}
              onCheckedChange={setAutoNudgesEnabled}
              data-testid="switch-auto-nudges"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium text-charcoal">Pattern Learning</p>
              <p className="text-sm text-charcoal/60">Learn from your behavior to provide better suggestions</p>
            </div>
            <Switch
              checked={patternLearningEnabled}
              onCheckedChange={setPatternLearningEnabled}
              data-testid="switch-pattern-learning"
            />
          </div>
        </CardContent>
      </Card>

      {/* Active Suggestions */}
      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-charcoal">Smart Suggestions</CardTitle>
              <Badge variant="outline" className="bg-warm-blue/10 text-warm-blue border-warm-blue/20">
                {suggestions.length} active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((suggestion: SmartSuggestion) => (
              <div
                key={suggestion.id}
                className={`p-4 rounded-lg border ${getPriorityColor(suggestion.priority)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-white/60 rounded-full flex items-center justify-center">
                      {getSuggestionIcon(suggestion.suggestionType)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-charcoal">{suggestion.title}</h4>
                      <p className="text-sm text-charcoal/60 mt-1">{suggestion.description}</p>
                      
                      {suggestion.priority === 'high' && (
                        <Badge variant="outline" className="mt-2 bg-coral/10 text-coral border-coral/20">
                          High Priority
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeSuggestion.mutate({ id: suggestion.id, wasHelpful: true })}
                      className="text-mint border-mint/20 hover:bg-mint/10"
                      data-testid={`button-helpful-${suggestion.id}`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeSuggestion.mutate({ id: suggestion.id, wasHelpful: false })}
                      className="text-charcoal/60 border-charcoal/20 hover:bg-charcoal/5"
                      data-testid={`button-not-helpful-${suggestion.id}`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeSuggestion.mutate({ id: suggestion.id, wasHelpful: false })}
                      className="text-charcoal/60 border-charcoal/20 hover:bg-charcoal/5"
                      data-testid={`button-dismiss-${suggestion.id}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Learned Patterns */}
      {patterns.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-mint" />
              <CardTitle className="text-lg text-charcoal">Discovered Patterns</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {patterns.slice(0, 5).map((pattern: UserPattern) => (
              <div key={pattern.id} className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
                <div>
                  <p className="font-medium text-charcoal">{getPatternInsight(pattern)}</p>
                  <p className="text-sm text-charcoal/60">
                    Based on {pattern.dataPoints} data points • {new Date(pattern.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-mint h-2 rounded-full"
                      style={{ width: `${Math.round(pattern.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-charcoal/60 w-10">
                    {Math.round(pattern.confidence * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="border-mint/20 bg-mint/5">
        <CardHeader>
          <CardTitle className="text-lg text-charcoal">Suggested Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="border-mint/20 text-mint hover:bg-mint/10 h-auto py-3"
              data-testid="button-schedule-break"
            >
              <div className="flex flex-col items-center space-y-1">
                <Coffee className="w-5 h-5" />
                <span className="text-sm">Schedule Break</span>
              </div>
            </Button>
            <Button
              variant="outline"
              className="border-mint/20 text-mint hover:bg-mint/10 h-auto py-3"
              data-testid="button-hydration-reminder"
            >
              <div className="flex flex-col items-center space-y-1">
                <Water className="w-5 h-5" />
                <span className="text-sm">Hydration Reminder</span>
              </div>
            </Button>
            <Button
              variant="outline"
              className="border-mint/20 text-mint hover:bg-mint/10 h-auto py-3"
              data-testid="button-energy-check"
            >
              <div className="flex flex-col items-center space-y-1">
                <Battery className="w-5 h-5" />
                <span className="text-sm">Energy Check</span>
              </div>
            </Button>
            <Button
              variant="outline"
              className="border-mint/20 text-mint hover:bg-mint/10 h-auto py-3"
              data-testid="button-focus-preparation"
            >
              <div className="flex flex-col items-center space-y-1">
                <Target className="w-5 h-5" />
                <span className="text-sm">Focus Prep</span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* No data state */}
      {suggestions.length === 0 && patterns.length === 0 && (
        <Card className="border-sage/20 bg-sage/5">
          <CardContent className="text-center py-8">
            <BrainCircuit className="w-12 h-12 text-sage mx-auto mb-4" />
            <h3 className="text-lg font-medium text-charcoal mb-2">Learning Your Patterns</h3>
            <p className="text-charcoal/60 mb-4">
              Keep using Flow regularly, and we'll start recognizing your productivity patterns to provide personalized suggestions.
            </p>
            <p className="text-sm text-charcoal/50">
              We respect your privacy - all pattern learning happens locally and only improves your personal experience.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}