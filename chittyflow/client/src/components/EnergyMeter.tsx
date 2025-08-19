import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Battery, Zap, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function EnergyMeter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: energyData } = useQuery({
    queryKey: ["/api/energy"],
  });

  const logEnergyMutation = useMutation({
    mutationFn: async (energyLevel: string) => {
      const response = await apiRequest("POST", "/api/energy", { energyLevel });
      return response.json();
    },
    onSuccess: (_, energyLevel) => {
      queryClient.invalidateQueries({ queryKey: ["/api/energy"] });
      const messages = {
        high: "Perfect time for deep work! I'll handle all interruptions.",
        medium: "Great energy for steady progress. You've got this!",
        low: "Rest mode activated. Gentle tasks only, and that's perfectly fine."
      };
      toast({
        title: "Energy level updated! 🔋",
        description: messages[energyLevel as keyof typeof messages],
      });
    },
  });

  const currentLevel = energyData?.currentLevel || 'medium';
  
  const getEnergyPercentage = (level: string) => {
    switch (level) {
      case 'high': return 85;
      case 'medium': return 60;
      case 'low': return 30;
      default: return 60;
    }
  };

  const getEnergyGradient = (level: string) => {
    switch (level) {
      case 'high': return 'from-mint to-sage';
      case 'medium': return 'from-coral to-warmBlue';
      case 'low': return 'from-warmBlue to-sage';
      default: return 'from-coral to-warmBlue';
    }
  };

  const getEnergyMessage = (level: string) => {
    switch (level) {
      case 'high': return 'Perfect time for deep work! I\'ll handle all interruptions.';
      case 'medium': return 'Good energy for steady progress. Take breaks as needed.';
      case 'low': return 'Rest mode is perfectly valid. Gentle tasks only today.';
      default: return 'How are you feeling right now?';
    }
  };

  const getEnergyLabel = (level: string) => {
    switch (level) {
      case 'high': return 'High Focus';
      case 'medium': return 'Balanced';
      case 'low': return 'Rest Mode';
      default: return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
      <h3 className="text-lg font-semibold text-charcoal mb-4 flex items-center">
        <Battery className="text-mint mr-3 w-5 h-5" />
        Energy Check-in
      </h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-charcoal">Current Energy</span>
          <span className="text-sm font-medium text-mint">
            {getEnergyLabel(currentLevel)}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`bg-gradient-to-r ${getEnergyGradient(currentLevel)} h-3 rounded-full transition-all duration-500`}
            style={{ width: `${getEnergyPercentage(currentLevel)}%` }}
          />
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            onClick={() => logEnergyMutation.mutate('high')}
            disabled={logEnergyMutation.isPending}
            className={`flex flex-col items-center p-3 h-auto ${
              currentLevel === 'high' 
                ? 'border-sage bg-sage/10 text-sage' 
                : 'border-gray-200 hover:border-sage'
            }`}
          >
            <Zap className="w-4 h-4 mb-1" />
            <span>High</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => logEnergyMutation.mutate('medium')}
            disabled={logEnergyMutation.isPending}
            className={`flex flex-col items-center p-3 h-auto ${
              currentLevel === 'medium' 
                ? 'border-coral bg-coral/10 text-coral' 
                : 'border-gray-200 hover:border-coral'
            }`}
          >
            <Battery className="w-4 h-4 mb-1" />
            <span>Medium</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => logEnergyMutation.mutate('low')}
            disabled={logEnergyMutation.isPending}
            className={`flex flex-col items-center p-3 h-auto ${
              currentLevel === 'low' 
                ? 'border-warmBlue bg-warmBlue/10 text-warmBlue' 
                : 'border-gray-200 hover:border-warmBlue'
            }`}
          >
            <Moon className="w-4 h-4 mb-1" />
            <span>Low</span>
          </Button>
        </div>
        
        <div className="bg-mint/10 p-3 rounded-lg">
          <p className="text-sm text-charcoal">
            {getEnergyMessage(currentLevel)}
          </p>
        </div>
      </div>
    </div>
  );
}
