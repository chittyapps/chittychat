import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  RotateCcw,
  Play,
  CheckCircle,
  Clock,
  Sparkles,
  Plus,
  Edit,
  Trash2,
  ArrowRight,
  Coffee,
  Brain,
  Sunrise,
  Sunset,
  Focus,
  Heart,
  Timer
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TransitionRitual {
  id: string;
  ritualType: string;
  title: string;
  description?: string;
  steps: string[];
  estimatedMinutes: number;
  isEnabled: boolean;
  useCount: number;
  lastUsed?: string;
  createdAt: string;
}

interface TransitionSession {
  id: string;
  ritualId?: string;
  transitionType: string;
  fromTask?: string;
  toTask?: string;
  completedSteps: string[];
  wasHelpful?: boolean;
  notes?: string;
  startedAt: string;
  completedAt?: string;
}

export function TransitionRituals() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rituals = [], isLoading: loadingRituals } = useQuery({
    queryKey: ["/api/transitions/rituals"],
  });

  const { data: activeSession } = useQuery({
    queryKey: ["/api/transitions/sessions/active"],
  });

  // Default rituals to create for new users
  const defaultRituals = [
    {
      ritualType: "task_switch",
      title: "Gentle Task Transition",
      description: "A calming ritual to help you switch between tasks without losing momentum",
      steps: [
        "Take three deep breaths to center yourself",
        "Appreciate what you just accomplished",
        "Write down one thing from the previous task (if needed)",
        "Set a gentle intention for the next task",
        "Take a moment to visualize success"
      ],
      estimatedMinutes: 2
    },
    {
      ritualType: "break_return",
      title: "Return from Break",
      description: "Ease back into focus after a break with kindness to yourself",
      steps: [
        "Notice how you're feeling right now - that's okay",
        "Drink some water and stretch gently",
        "Review your next task without judgment",
        "Set a small, achievable first step",
        "Remind yourself: 'I can do this at my own pace'"
      ],
      estimatedMinutes: 3
    },
    {
      ritualType: "focus_prep",
      title: "Focus Preparation",
      description: "Prepare your mind and environment for focused work",
      steps: [
        "Clear your workspace of distractions",
        "Put devices in 'do not disturb' mode",
        "Do a quick body scan - adjust your posture",
        "Set a realistic time boundary for this session",
        "Choose your focus intention: 'I am here, I am present'"
      ],
      estimatedMinutes: 2
    },
    {
      ritualType: "day_start",
      title: "Gentle Morning Start",
      description: "Begin your day with self-compassion and clear intentions",
      steps: [
        "Acknowledge that you showed up today - that's enough",
        "Check in with your energy level honestly",
        "Choose 1-3 priority items (not overwhelming lists)",
        "Set your energy boundaries for the day",
        "Remind yourself: 'Progress over perfection'"
      ],
      estimatedMinutes: 3
    },
    {
      ritualType: "day_end",
      title: "Compassionate Day Closing",
      description: "End your day by celebrating what went well",
      steps: [
        "List 2-3 things you accomplished (however small)",
        "Acknowledge any challenges without self-criticism",
        "Note what your brain/body needs for tomorrow",
        "Set one gentle intention for tomorrow",
        "Remind yourself: 'I did my best with what I had today'"
      ],
      estimatedMinutes: 4
    }
  ];

  const createDefaultRituals = useMutation({
    mutationFn: async () => {
      for (const ritual of defaultRituals) {
        await apiRequest(`/api/transitions/rituals`, {
          method: "POST",
          body: JSON.stringify(ritual),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transitions/rituals"] });
      toast({
        title: "Welcome to Transition Rituals!",
        description: "We've created some gentle rituals to get you started. You can customize or create your own anytime.",
      });
    },
  });

  const startSession = useMutation({
    mutationFn: async ({ ritualId, transitionType }: { ritualId: string; transitionType: string }) => {
      return await apiRequest(`/api/transitions/sessions`, {
        method: "POST",
        body: JSON.stringify({ ritualId, transitionType }),
      });
    },
    onSuccess: (session) => {
      setActiveSessionId(session.id);
      setCurrentStep(0);
      queryClient.invalidateQueries({ queryKey: ["/api/transitions/sessions/active"] });
    },
  });

  const updateSession = useMutation({
    mutationFn: async ({ sessionId, updates }: { sessionId: string; updates: any }) => {
      return await apiRequest(`/api/transitions/sessions/${sessionId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transitions/sessions/active"] });
    },
  });

  const completeSession = useMutation({
    mutationFn: async ({ sessionId, wasHelpful }: { sessionId: string; wasHelpful: boolean }) => {
      return await apiRequest(`/api/transitions/sessions/${sessionId}`, {
        method: "PUT",
        body: JSON.stringify({ 
          completedAt: new Date().toISOString(),
          wasHelpful 
        }),
      });
    },
    onSuccess: () => {
      setActiveSessionId(null);
      setCurrentStep(0);
      queryClient.invalidateQueries({ queryKey: ["/api/transitions/sessions/active"] });
      toast({
        title: "Ritual Complete",
        description: "You've completed your transition ritual. Well done!",
      });
    },
  });

  const getRitualIcon = (type: string) => {
    switch (type) {
      case "task_switch": return <RotateCcw className="w-5 h-5 text-sage" />;
      case "break_return": return <Coffee className="w-5 h-5 text-mint" />;
      case "focus_prep": return <Focus className="w-5 h-5 text-warm-blue" />;
      case "day_start": return <Sunrise className="w-5 h-5 text-warm-yellow" />;
      case "day_end": return <Sunset className="w-5 h-5 text-coral" />;
      default: return <Brain className="w-5 h-5 text-sage" />;
    }
  };

  const getRitualTypeLabel = (type: string) => {
    switch (type) {
      case "task_switch": return "Task Switch";
      case "break_return": return "Break Return";
      case "focus_prep": return "Focus Prep";
      case "day_start": return "Day Start";
      case "day_end": return "Day End";
      default: return type;
    }
  };

  const currentRitual = activeSession && rituals.find((r: TransitionRitual) => r.id === activeSession.ritualId);

  if (loadingRituals) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-sage animate-pulse" />
          <h2 className="text-xl font-semibold text-charcoal">Loading Transition Rituals...</h2>
        </div>
      </div>
    );
  }

  if (rituals.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <Sparkles className="w-12 h-12 text-sage mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-charcoal mb-2">Welcome to Transition Rituals</h2>
          <p className="text-charcoal/60 mb-6 max-w-md mx-auto">
            Gentle rituals help your brain transition between tasks, return from breaks, and maintain focus. 
            Let's create some personalized rituals for you.
          </p>
          <Button 
            onClick={() => createDefaultRituals.mutate()}
            disabled={createDefaultRituals.isPending}
            className="bg-sage hover:bg-sage/90"
          >
            {createDefaultRituals.isPending ? (
              <Timer className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Heart className="w-4 h-4 mr-2" />
            )}
            Create My First Rituals
          </Button>
        </div>
      </div>
    );
  }

  // Active session view
  if (activeSession && currentRitual) {
    const progress = ((currentStep + 1) / currentRitual.steps.length) * 100;
    
    return (
      <div className="space-y-6">
        <Card className="border-sage/20 bg-sage/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getRitualIcon(currentRitual.ritualType)}
                <div>
                  <CardTitle className="text-lg text-charcoal">{currentRitual.title}</CardTitle>
                  <p className="text-sm text-charcoal/60">{currentRitual.description}</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-sage/10 text-sage border-sage/20">
                Step {currentStep + 1} of {currentRitual.steps.length}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <Progress value={progress} className="h-2" />
            
            <div className="bg-white/60 rounded-lg p-6 border border-sage/10">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-sm font-medium text-sage">{currentStep + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="text-charcoal leading-relaxed">
                    {currentRitual.steps[currentStep]}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  if (currentStep > 0) {
                    setCurrentStep(currentStep - 1);
                  }
                }}
                disabled={currentStep === 0}
                className="border-sage/20"
              >
                Previous Step
              </Button>
              
              {currentStep < currentRitual.steps.length - 1 ? (
                <Button
                  onClick={() => {
                    setCurrentStep(currentStep + 1);
                    updateSession.mutate({
                      sessionId: activeSession.id,
                      updates: {
                        completedSteps: currentRitual.steps.slice(0, currentStep + 1)
                      }
                    });
                  }}
                  className="bg-sage hover:bg-sage/90"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => completeSession.mutate({ sessionId: activeSession.id, wasHelpful: false })}
                    className="border-coral/20 text-coral hover:bg-coral/10"
                  >
                    Not Helpful
                  </Button>
                  <Button
                    onClick={() => completeSession.mutate({ sessionId: activeSession.id, wasHelpful: true })}
                    className="bg-sage hover:bg-sage/90"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete Ritual
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rituals overview
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-sage" />
          <h2 className="text-xl font-semibold text-charcoal">Transition Rituals</h2>
        </div>
        <Button variant="outline" className="border-sage/20 text-sage hover:bg-sage/10">
          <Plus className="w-4 h-4 mr-2" />
          Create Ritual
        </Button>
      </div>

      <p className="text-charcoal/60 leading-relaxed">
        Gentle rituals help your brain transition smoothly between tasks, return from breaks with focus, 
        and maintain energy throughout your day. Choose a ritual below to start your transition.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rituals.map((ritual: TransitionRitual) => (
          <Card key={ritual.id} className="border-2 transition-all hover:border-sage/20 hover:shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getRitualIcon(ritual.ritualType)}
                  <div>
                    <CardTitle className="text-base text-charcoal">{ritual.title}</CardTitle>
                    <Badge variant="outline" className="text-xs mt-1">
                      {getRitualTypeLabel(ritual.ritualType)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center space-x-1 text-xs text-charcoal/50">
                  <Clock className="w-3 h-3" />
                  {ritual.estimatedMinutes}m
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <p className="text-sm text-charcoal/60 mb-4 leading-relaxed">
                {ritual.description}
              </p>
              
              <div className="space-y-2 mb-4">
                <p className="text-xs font-medium text-charcoal">Steps preview:</p>
                <ul className="space-y-1">
                  {ritual.steps.slice(0, 2).map((step, index) => (
                    <li key={index} className="text-xs text-charcoal/60 flex items-start">
                      <span className="w-4 h-4 rounded-full bg-sage/20 flex items-center justify-center text-xs text-sage mr-2 mt-0.5 flex-shrink-0">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                  {ritual.steps.length > 2 && (
                    <li className="text-xs text-charcoal/40 ml-6">
                      +{ritual.steps.length - 2} more steps
                    </li>
                  )}
                </ul>
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex items-center justify-between">
                <div className="text-xs text-charcoal/50">
                  {ritual.useCount > 0 ? `Used ${ritual.useCount} times` : 'Not used yet'}
                </div>
                <Button
                  onClick={() => startSession.mutate({ 
                    ritualId: ritual.id, 
                    transitionType: ritual.ritualType 
                  })}
                  disabled={startSession.isPending}
                  size="sm"
                  className="bg-sage hover:bg-sage/90"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Start Ritual
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}