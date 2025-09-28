import { Switch, Route, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Welcome from "@/pages/welcome";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { SecretDiscount } from "@/components/ui/secret-discount";
import { useKonami } from "@/hooks/use-konami";
import { useQuery } from "@tanstack/react-query";

// Auth check component to protect routes
function AuthenticatedRoute({ component: Component, ...rest }: any) {
  // We'll check if user is logged in
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
  });
  
  // While checking authentication status, show nothing
  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }
  
  // If user is authenticated, render the component
  // Otherwise, redirect to welcome page
  return user ? <Component {...rest} /> : <Redirect to="/" />;
}

function Router() {
  // Check authentication status for conditional rendering
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false,
  });
  
  return (
    <Switch>
      {/* Show welcome page to non-authenticated users, home to authenticated users */}
      <Route path="/" component={user ? Home : Welcome} />
      
      {/* Protected dashboard route */}
      <Route path="/dashboard">
        <AuthenticatedRoute component={Home} />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const showSecretDiscount = useKonami();
  
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-dark">
      <NavBar />
      <Toaster />
      <Router />
      <Footer />
      {showSecretDiscount && <SecretDiscount />}
    </div>
  );
}

export default App;
