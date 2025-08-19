import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Leaf, Bell, Zap, Bot, Home as HomeIcon, Settings, Sparkles, Brain, BarChart3 } from "lucide-react";
import { CelebrationSection } from "@/components/CelebrationSection";
import { GentleTaskSection } from "@/components/GentleTaskSection";
import { AutoHandledSection } from "@/components/AutoHandledSection";
import { EnergyMeter } from "@/components/EnergyMeter";
import { MotivationalCard } from "@/components/MotivationalCard";
import { QuickActions } from "@/components/QuickActions";
import { InsightCard } from "@/components/InsightCard";
import { FloatingAssistant } from "@/components/FloatingAssistant";
import { ServicesConnection } from "@/components/ServicesConnection";
import { AIActions } from "@/components/AIActions";
import { TransitionRituals } from "@/components/TransitionRituals";
import { ExecutiveFunctionSupport } from "@/components/ExecutiveFunctionSupport";
import { SmartAutomation } from "@/components/SmartAutomation";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const { data: winsData } = useQuery({
    queryKey: ["/api/analytics/wins"],
  });

  const { data: energyData } = useQuery({
    queryKey: ["/api/energy"],
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user?.firstName || "there";
  const autoHandledCount = winsData?.celebrations?.filter((c: any) => c.type === 'auto_handled')?.length || 7;

  return (
    <div className="min-h-screen bg-cream">
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
            
            {/* Navigation Tabs */}
            <div className="hidden md:flex items-center space-x-1">
              <Button
                variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('dashboard')}
                className={activeTab === 'dashboard' ? 'bg-sage hover:bg-sage/90' : ''}
              >
                <HomeIcon className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <Button
                variant={activeTab === 'ai-actions' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('ai-actions')}
                className={activeTab === 'ai-actions' ? 'bg-sage hover:bg-sage/90' : ''}
              >
                <Bot className="w-4 h-4 mr-2" />
                AI Actions
              </Button>
              <Button
                variant={activeTab === 'services' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('services')}
                className={activeTab === 'services' ? 'bg-sage hover:bg-sage/90' : ''}
              >
                <Zap className="w-4 h-4 mr-2" />
                Services
              </Button>
              <Button
                variant={activeTab === 'transitions' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('transitions')}
                className={activeTab === 'transitions' ? 'bg-sage hover:bg-sage/90' : ''}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Transitions
              </Button>
              <Button
                variant={activeTab === 'executive' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('executive')}
                className={activeTab === 'executive' ? 'bg-sage hover:bg-sage/90' : ''}
              >
                <Brain className="w-4 h-4 mr-2" />
                Focus Tools
              </Button>
              <Button
                variant={activeTab === 'analytics' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('analytics')}
                className={activeTab === 'analytics' ? 'bg-sage hover:bg-sage/90' : ''}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Button>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="hidden lg:flex items-center space-x-6 text-sm text-charcoal/70">
                <span className="bg-mint/20 px-3 py-1 rounded-full text-mint font-medium">
                  <span className="inline-block w-2 h-2 bg-mint rounded-full mr-1 animate-pulse"></span>
                  {energyData?.currentLevel === 'high' ? 'High Energy Mode' : 
                   energyData?.currentLevel === 'low' ? 'Rest Mode' : 'Balanced Mode'}
                </span>
              </div>
              
              <div className="flex items-center space-x-3">
                <button className="relative p-2 text-charcoal/60 hover:text-charcoal transition-colors">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-coral rounded-full"></span>
                </button>
                
                <div className="flex items-center space-x-2">
                  {user?.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile" 
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-sage/20 rounded-full flex items-center justify-center">
                      <span className="text-sage text-sm font-medium">
                        {firstName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="hidden sm:block text-sm font-medium text-charcoal">
                    {firstName}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.location.href = '/api/logout'}
                    className="text-charcoal/60 hover:text-charcoal"
                  >
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Hero */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-sage/10 to-mint/10 rounded-2xl p-6 border border-sage/20">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-charcoal mb-2">
                  {getGreeting()}, {firstName}! 🌟
                </h1>
                <p className="text-charcoal/70">
                  You've already accomplished so much today. I'm here to handle the rest while you focus on what matters most.
                </p>
              </div>
              <div className="hidden lg:block">
                <div className="bg-white/60 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-sage">{autoHandledCount}</div>
                  <div className="text-xs text-charcoal/60">Tasks I handled for you today</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-6">
              <CelebrationSection />
              <GentleTaskSection />
              <AutoHandledSection />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <EnergyMeter />
              <MotivationalCard />
              <QuickActions />
              <InsightCard />
            </div>
          </div>
        )}

        {activeTab === 'ai-actions' && (
          <div className="max-w-4xl mx-auto">
            <AIActions />
          </div>
        )}

        {activeTab === 'services' && (
          <div className="max-w-4xl mx-auto">
            <ServicesConnection />
          </div>
        )}

        {activeTab === 'transitions' && (
          <div className="max-w-4xl mx-auto">
            <TransitionRituals />
          </div>
        )}

        {activeTab === 'executive' && (
          <div className="max-w-4xl mx-auto">
            <ExecutiveFunctionSupport />
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="max-w-4xl mx-auto">
            <SmartAutomation />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="max-w-4xl mx-auto">
            <AnalyticsDashboard />
          </div>
        )}
      </div>

      <FloatingAssistant />
    </div>
  );
}
