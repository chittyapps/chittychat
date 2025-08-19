import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function FloatingAssistant() {
  const { toast } = useToast();

  const handleClick = () => {
    const encouragements = [
      "I'm here to help! What would you like to talk about?",
      "You're doing great today. How can I support you?",
      "Ready to chat! I believe in you and your amazing brain.",
      "Hi there! Remember, progress over perfection always.",
      "What's on your mind? I'm here to listen and help however I can."
    ];
    
    const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
    
    toast({
      title: "Your Assistant is Here! 💙",
      description: randomEncouragement,
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={handleClick}
        className="w-14 h-14 bg-gradient-to-br from-sage to-mint rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 group"
      >
        <MessageCircle className="text-white w-6 h-6 group-hover:scale-110 transition-transform" />
      </Button>
    </div>
  );
}
