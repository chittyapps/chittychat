import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Leaf, Heart, Sparkles, Brain, Zap, CheckCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-white to-sage/5">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-sage/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-sage to-mint rounded-lg flex items-center justify-center">
                <Leaf className="text-white w-4 h-4" />
              </div>
              <span className="text-xl font-semibold text-charcoal">Flow</span>
            </div>
            
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="bg-sage hover:bg-sage/90 text-white"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-sage to-mint rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Brain className="text-white w-10 h-10" />
            </div>
            <h1 className="text-5xl font-bold text-charcoal mb-6">
              Your ADHD-Friendly
              <span className="block text-sage">Executive Assistant</span>
            </h1>
            <p className="text-xl text-charcoal/70 max-w-3xl mx-auto mb-8">
              Flow works with your brain's natural patterns, celebrates every win, and handles the routine stuff 
              so you can focus on what matters most to you.
            </p>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              size="lg"
              className="bg-sage hover:bg-sage/90 text-white px-8 py-4 text-lg"
            >
              Start Your Journey
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          <Card className="border-sage/20 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-sage/10 rounded-xl flex items-center justify-center mb-4">
                <Heart className="text-sage w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal mb-3">Celebrates Progress</h3>
              <p className="text-charcoal/70">
                Every small step forward is a win worth celebrating. We focus on progress, not perfection.
              </p>
            </CardContent>
          </Card>

          <Card className="border-mint/20 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-mint/10 rounded-xl flex items-center justify-center mb-4">
                <Zap className="text-mint w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal mb-3">Energy-Aware</h3>
              <p className="text-charcoal/70">
                Adapts to your natural energy patterns and suggests tasks that match your current state.
              </p>
            </CardContent>
          </Card>

          <Card className="border-coral/20 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-coral/10 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="text-coral w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal mb-3">Auto-Handles Routine</h3>
              <p className="text-charcoal/70">
                Takes care of emails, scheduling, and organization so you can focus on creative work.
              </p>
            </CardContent>
          </Card>

          <Card className="border-warmBlue/20 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-warmBlue/10 rounded-xl flex items-center justify-center mb-4">
                <CheckCircle className="text-warmBlue w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal mb-3">Gentle Nudges</h3>
              <p className="text-charcoal/70">
                Supportive reminders that feel encouraging, not nagging. We believe in your timing.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sage/20 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-sage/10 rounded-xl flex items-center justify-center mb-4">
                <Brain className="text-sage w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal mb-3">Pattern Learning</h3>
              <p className="text-charcoal/70">
                Learns your productive patterns and helps optimize your workflow naturally.
              </p>
            </CardContent>
          </Card>

          <Card className="border-mint/20 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-mint/10 rounded-xl flex items-center justify-center mb-4">
                <Heart className="text-mint w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal mb-3">Shame-Free Zone</h3>
              <p className="text-charcoal/70">
                Creates psychological safety around productivity. Your brain works differently, not wrong.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-sage/10 to-mint/10 rounded-2xl p-8 text-center border border-sage/20">
          <h2 className="text-3xl font-semibold text-charcoal mb-4">
            Ready to work with your brain, not against it?
          </h2>
          <p className="text-charcoal/70 mb-6 max-w-2xl mx-auto">
            Join thousands who've discovered that productivity doesn't have to be painful. 
            Let Flow handle the routine while you focus on what you love.
          </p>
          <Button 
            onClick={() => window.location.href = '/api/login'}
            size="lg"
            className="bg-sage hover:bg-sage/90 text-white px-8 py-4 text-lg"
          >
            Start Your Free Journey
          </Button>
        </div>
      </div>
    </div>
  );
}
