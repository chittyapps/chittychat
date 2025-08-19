import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Clock,
  Timer,
  Brain,
  AlertTriangle,
  CheckCircle,
  Coffee,
  Shuffle,
  Zap,
  Heart,
  Target,
  Calendar,
  Lightbulb,
  Shield,
  Gauge
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TimeEstimate {
  id: string;
  taskName: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  confidence: 'low' | 'medium' | 'high';
  userId: string;
  createdAt: string;
}

interface FocusSession {
  id: string;
  userId: string;
  taskName: string;
  plannedMinutes: number;
  actualMinutes?: number;
  breakCount: number;
  isHyperfocus: boolean;
  mood: string;
  energyBefore: string;
  energyAfter?: string;
  startedAt: string;
  endedAt?: string;
}

interface DecisionSupport {
  id: string;
  userId: string;
  question: string;
  options: string[];
  selectedOption?: string;
  decisionMethod: 'pros_cons' | 'coin_flip' | 'gut_feeling' | 'timer';
  timeSpentMinutes?: number;
  confidence?: number;
  createdAt: string;
  decidedAt?: string;
}

export function ExecutiveFunctionSupport() {
  const [activeTimer, setActiveTimer] = useState<number | null>(null);
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [isBreakTime, setIsBreakTime] = useState(false);
  const [hyperfocusWarning, setHyperfocusWarning] = useState(false);
  const [showDecisionHelper, setShowDecisionHelper] = useState(false);
  const [decisionQuestion, setDecisionQuestion] = useState("");
  const [decisionOptions, setDecisionOptions] = useState<string[]>(["", ""]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentSession } = useQuery({
    queryKey: ["/api/focus/current-session"],
  });

  const { data: timeEstimates = [] } = useQuery({
    queryKey: ["/api/time-estimates"],
  });

  const { data: recentDecisions = [] } = useQuery({
    queryKey: ["/api/decisions/recent"],
  });

  // Time blindness helper - visual timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTimer !== null && activeTimer > 0) {
      interval = setInterval(() => {
        setActiveTimer(prev => {
          if (prev === null || prev <= 1) {
            // Timer finished
            if (isBreakTime) {
              toast({
                title: "Break time is over!",
                description: "Ready to get back to your task? Take it one step at a time.",
              });
              setIsBreakTime(false);
            } else {
              toast({
                title: "Time for a gentle break",
                description: "You've been focused for a while. A short break will help you come back refreshed.",
              });
              setIsBreakTime(true);
              setActiveTimer(5 * 60); // 5 minute break
              return 5 * 60;
            }
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer, isBreakTime, toast]);

  // Hyperfocus protection
  useEffect(() => {
    if (currentSession && !currentSession.endedAt) {
      const sessionDuration = Date.now() - new Date(currentSession.startedAt).getTime();
      const hoursInSession = sessionDuration / (1000 * 60 * 60);
      
      if (hoursInSession > 2 && !hyperfocusWarning) {
        setHyperfocusWarning(true);
        toast({
          title: "Hyperfocus detected",
          description: "You've been at this for over 2 hours. Consider taking a longer break to recharge.",
          variant: "destructive",
        });
      }
    }
  }, [currentSession, hyperfocusWarning, toast]);

  const startFocusSession = useMutation({
    mutationFn: async ({ taskName, plannedMinutes }: { taskName: string; plannedMinutes: number }) => {
      return await apiRequest("/api/focus/start-session", {
        method: "POST",
        body: JSON.stringify({ taskName, plannedMinutes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/focus/current-session"] });
      setActiveTimer(timerMinutes * 60);
      setHyperfocusWarning(false);
    },
  });

  const endFocusSession = useMutation({
    mutationFn: async ({ energyAfter, mood }: { energyAfter: string; mood: string }) => {
      return await apiRequest("/api/focus/end-session", {
        method: "POST",
        body: JSON.stringify({ energyAfter, mood }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/focus/current-session"] });
      setActiveTimer(null);
      setIsBreakTime(false);
    },
  });

  const createDecision = useMutation({
    mutationFn: async (decisionData: any) => {
      return await apiRequest("/api/decisions", {
        method: "POST",
        body: JSON.stringify(decisionData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/decisions/recent"] });
      setShowDecisionHelper(false);
      setDecisionQuestion("");
      setDecisionOptions(["", ""]);
    },
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const quickDecision = (method: string) => {
    if (method === 'coin_flip') {
      const winner = Math.random() < 0.5 ? decisionOptions[0] : decisionOptions[1];
      toast({
        title: "Coin flip says:",
        description: winner || "Option " + (Math.random() < 0.5 ? "1" : "2"),
      });
    } else if (method === 'gut_feeling') {
      toast({
        title: "Trust your gut",
        description: "What did you secretly hope the coin would land on? That's your answer.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Brain className="w-5 h-5 text-sage" />
        <h2 className="text-xl font-semibold text-charcoal">Executive Function Support</h2>
      </div>

      <p className="text-charcoal/60 leading-relaxed">
        Tools designed specifically for ADHD brains to help with time awareness, decision making, 
        and maintaining healthy focus patterns.
      </p>

      {/* Time Blindness Helper */}
      <Card className="border-warm-blue/20 bg-warm-blue/5">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-warm-blue" />
            <CardTitle className="text-lg text-charcoal">Time Blindness Helper</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTimer !== null ? (
            <div className="text-center space-y-4">
              <div className="text-4xl font-bold text-warm-blue">
                {formatTime(activeTimer)}
              </div>
              <div className="text-sm text-charcoal/60">
                {isBreakTime ? "Break time - be kind to yourself" : "Focus time - you've got this"}
              </div>
              <Progress 
                value={((timerMinutes * 60 - activeTimer) / (timerMinutes * 60)) * 100} 
                className="h-3"
              />
              <Button
                variant="outline"
                onClick={() => {
                  setActiveTimer(null);
                  setIsBreakTime(false);
                }}
                className="border-warm-blue/20"
              >
                Stop Timer
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-charcoal">Focus session length:</label>
                <select 
                  value={timerMinutes} 
                  onChange={(e) => setTimerMinutes(Number(e.target.value))}
                  className="border border-sage/20 rounded px-2 py-1 text-sm"
                >
                  <option value={15}>15 minutes</option>
                  <option value={25}>25 minutes (Pomodoro)</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
              <Button
                onClick={() => {
                  startFocusSession.mutate({ 
                    taskName: "Focus session", 
                    plannedMinutes: timerMinutes 
                  });
                }}
                className="bg-warm-blue hover:bg-warm-blue/90 w-full"
                data-testid="button-start-focus"
              >
                <Timer className="w-4 h-4 mr-2" />
                Start Focus Timer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Paralysis Assistant */}
      <Card className="border-mint/20 bg-mint/5">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-mint" />
            <CardTitle className="text-lg text-charcoal">Decision Paralysis Assistant</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-charcoal/60">
            Stuck on a decision? These tools help break through analysis paralysis.
          </p>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => quickDecision('coin_flip')}
              className="border-mint/20 text-mint hover:bg-mint/10"
              data-testid="button-coin-flip"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Coin Flip
            </Button>
            <Button
              variant="outline"
              onClick={() => quickDecision('gut_feeling')}
              className="border-mint/20 text-mint hover:bg-mint/10"
              data-testid="button-gut-feeling"
            >
              <Heart className="w-4 h-4 mr-2" />
              Gut Check
            </Button>
          </div>

          <Dialog open={showDecisionHelper} onOpenChange={setShowDecisionHelper}>
            <DialogTrigger asChild>
              <Button className="bg-mint hover:bg-mint/90 w-full" data-testid="button-decision-helper">
                <Lightbulb className="w-4 h-4 mr-2" />
                Structured Decision Helper
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Let's work through this decision</DialogTitle>
                <DialogDescription>
                  Break down your decision into manageable pieces. No pressure - we'll figure it out together.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-charcoal">What decision are you facing?</label>
                  <textarea
                    value={decisionQuestion}
                    onChange={(e) => setDecisionQuestion(e.target.value)}
                    className="w-full mt-1 p-2 border border-sage/20 rounded"
                    placeholder="e.g., Which project should I work on first?"
                    data-testid="input-decision-question"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-charcoal">Your options:</label>
                  {decisionOptions.map((option, index) => (
                    <input
                      key={index}
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...decisionOptions];
                        newOptions[index] = e.target.value;
                        setDecisionOptions(newOptions);
                      }}
                      className="w-full mt-1 p-2 border border-sage/20 rounded"
                      placeholder={`Option ${index + 1}`}
                      data-testid={`input-option-${index}`}
                    />
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => setDecisionOptions([...decisionOptions, ""])}
                    className="mt-2 text-xs"
                    data-testid="button-add-option"
                  >
                    Add another option
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => {
                    createDecision.mutate({
                      question: decisionQuestion,
                      options: decisionOptions.filter(o => o.trim()),
                      decisionMethod: 'structured'
                    });
                  }}
                  disabled={!decisionQuestion.trim() || decisionOptions.filter(o => o.trim()).length < 2}
                  className="bg-mint hover:bg-mint/90"
                  data-testid="button-save-decision"
                >
                  Save Decision Framework
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Hyperfocus Protection */}
      {currentSession && !currentSession.endedAt && (
        <Card className="border-coral/20 bg-coral/5">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-coral" />
              <CardTitle className="text-lg text-charcoal">Hyperfocus Protection</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-charcoal">{currentSession.taskName}</p>
                <p className="text-sm text-charcoal/60">
                  Started {new Date(currentSession.startedAt).toLocaleTimeString()}
                </p>
              </div>
              <Badge variant="outline" className="bg-coral/10 text-coral border-coral/20">
                Active Session
              </Badge>
            </div>
            
            {hyperfocusWarning && (
              <div className="bg-warm-yellow/10 border border-warm-yellow/20 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-warm-yellow mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-charcoal">Gentle reminder</p>
                    <p className="text-charcoal/60">You've been hyperfocused for a while. Your brain might need some fuel and rest.</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveTimer(15 * 60); // 15 minute break
                  setIsBreakTime(true);
                }}
                className="border-coral/20"
                data-testid="button-take-break"
              >
                <Coffee className="w-4 h-4 mr-2" />
                Take a Break
              </Button>
              <Button
                onClick={() => {
                  endFocusSession.mutate({ 
                    energyAfter: "medium", 
                    mood: "accomplished" 
                  });
                }}
                className="bg-coral hover:bg-coral/90"
                data-testid="button-end-session"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                End Session
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Context Switching Buffer */}
      <Card className="border-sage/20 bg-sage/5">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-sage" />
            <CardTitle className="text-lg text-charcoal">Context Switching Buffer</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-charcoal/60">
            Automatic 5-minute buffers between calendar events help your brain transition smoothly.
          </p>
          
          <div className="bg-white/60 rounded-lg p-4 border border-sage/10">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-sage/20 rounded-full flex items-center justify-center">
                <Gauge className="w-4 h-4 text-sage" />
              </div>
              <div>
                <p className="font-medium text-charcoal">Smart Buffer Active</p>
                <p className="text-sm text-charcoal/60">
                  We'll automatically suggest transition rituals before your next scheduled event.
                </p>
              </div>
            </div>
          </div>
          
          <Button
            variant="outline"
            className="border-sage/20 text-sage hover:bg-sage/10 w-full"
            data-testid="button-calendar-settings"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure Calendar Integration
          </Button>
        </CardContent>
      </Card>

      {/* Recent Decisions */}
      {recentDecisions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-charcoal">Recent Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentDecisions.slice(0, 3).map((decision: DecisionSupport) => (
                <div key={decision.id} className="flex items-center justify-between p-2 bg-sage/5 rounded">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{decision.question}</p>
                    {decision.selectedOption && (
                      <p className="text-xs text-charcoal/60">Chose: {decision.selectedOption}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {decision.decisionMethod}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}