import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SimpleDashboard from "@/pages/simple-dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SimpleDashboard} />
      <Route path="/dashboard" component={SimpleDashboard} />
      {/* Add more routes as needed */}
      <Route>
        {/* 404 fallback */}
        <div className="min-h-screen flex items-center justify-center">
          <div className="glass-card p-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
            <p className="text-white/60">The page you're looking for doesn't exist.</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  // Enforce dark theme
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.background = 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)';
    document.body.style.color = 'white';
    document.body.style.minHeight = '100vh';
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
