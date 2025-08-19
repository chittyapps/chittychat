import { Switch, Route } from "wouter";
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
