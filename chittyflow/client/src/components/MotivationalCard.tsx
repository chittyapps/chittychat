import { Heart } from "lucide-react";

export function MotivationalCard() {
  const motivationalMessages = [
    {
      title: "You're Doing Amazing",
      message: "Your brain works beautifully. Every small step forward is progress worth celebrating.",
      quote: "Progress, not perfection - Today you've shown up, and that's what matters."
    },
    {
      title: "Your Timing is Perfect",
      message: "Trust your natural rhythms. Your brain knows when it's ready to tackle different tasks.",
      quote: "There's no such thing as behind - only your unique timeline of growth."
    },
    {
      title: "Celebrate Small Wins",
      message: "Every completed task, every moment of focus, every time you show up - it all counts.",
      quote: "You're building something incredible, one gentle step at a time."
    },
    {
      title: "Rest is Productive",
      message: "Taking breaks, having low-energy days, and switching tasks aren't failures - they're features.",
      quote: "Your brain is always working, even when it doesn't feel like it."
    }
  ];

  // Rotate through messages based on the current time
  const currentMessage = motivationalMessages[Math.floor(Date.now() / (1000 * 60 * 30)) % motivationalMessages.length];

  return (
    <div className="bg-gradient-to-br from-coral/10 to-sage/10 rounded-2xl p-6 border border-coral/20">
      <div className="text-center">
        <div className="w-16 h-16 bg-white/60 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="text-coral w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-charcoal mb-2">
          {currentMessage.title}
        </h3>
        <p className="text-sm text-charcoal/70 mb-4">
          {currentMessage.message}
        </p>
        <div className="bg-white/60 rounded-lg p-3">
          <p className="text-xs text-charcoal/60 italic">
            "{currentMessage.quote}"
          </p>
        </div>
      </div>
    </div>
  );
}
