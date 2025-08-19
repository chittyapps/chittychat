import { Pause, Lightbulb, MessageCircle, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function QuickActions() {
  const { toast } = useToast();

  const handleBreak = () => {
    toast({
      title: "Great idea! 🌸",
      description: "Taking breaks helps your brain process and recharge. You've earned this.",
    });
  };

  const handleIdea = () => {
    toast({
      title: "Idea captured! 💡",
      description: "I've got that thought saved for you. No need to worry about forgetting it.",
    });
  };

  const handleChat = () => {
    toast({
      title: "I'm here for you! 💬",
      description: "What would you like to talk about? I'm ready to listen and help.",
    });
  };

  const handleHydrate = () => {
    toast({
      title: "Hydration reminder! 💧",
      description: "Your brain will thank you for this. Great self-care!",
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
      <h3 className="text-lg font-semibold text-charcoal mb-4">Quick Actions</h3>
      
      <div className="space-y-3">
        <Button
          onClick={handleBreak}
          variant="ghost"
          className="w-full flex items-center justify-start p-3 bg-sage/5 hover:bg-sage/10 text-left h-auto"
        >
          <Pause className="text-sage mr-3 w-5 h-5" />
          <div className="text-left">
            <div className="text-sm text-charcoal font-medium">Take a mindful break</div>
            <div className="text-xs text-charcoal/60">You deserve this pause</div>
          </div>
        </Button>
        
        <Button
          onClick={handleIdea}
          variant="ghost"
          className="w-full flex items-center justify-start p-3 bg-coral/5 hover:bg-coral/10 text-left h-auto"
        >
          <Lightbulb className="text-coral mr-3 w-5 h-5" />
          <div className="text-left">
            <div className="text-sm text-charcoal font-medium">Capture an idea</div>
            <div className="text-xs text-charcoal/60">Don't let inspiration slip away</div>
          </div>
        </Button>
        
        <Button
          onClick={handleHydrate}
          variant="ghost"
          className="w-full flex items-center justify-start p-3 bg-mint/5 hover:bg-mint/10 text-left h-auto"
        >
          <Coffee className="text-mint mr-3 w-5 h-5" />
          <div className="text-left">
            <div className="text-sm text-charcoal font-medium">Hydrate & nourish</div>
            <div className="text-xs text-charcoal/60">Self-care is productive</div>
          </div>
        </Button>
        
        <Button
          onClick={handleChat}
          variant="ghost"
          className="w-full flex items-center justify-start p-3 bg-warmBlue/5 hover:bg-warmBlue/10 text-left h-auto"
        >
          <MessageCircle className="text-warmBlue mr-3 w-5 h-5" />
          <div className="text-left">
            <div className="text-sm text-charcoal font-medium">Chat with me</div>
            <div className="text-xs text-charcoal/60">I'm here to support you</div>
          </div>
        </Button>
      </div>
    </div>
  );
}
