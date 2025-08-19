import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { NewTunnelForm } from "@/components/forms/NewTunnelForm";
import { Tunnel } from "@shared/schema";

// Define response interface for typed data handling
interface TunnelsResponse {
  tunnels: Tunnel[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  
  // Stats query to fetch dashboard data
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/stats'],
  });
  
  // Tunnels query to fetch tunnel data with proper typing
  const { data: tunnelsData, isLoading: tunnelsLoading } = useQuery<TunnelsResponse>({
    queryKey: ['/api/tunnels'],
  });
  
  return (
    <div className="flex-grow">
      {/* Minimal Hero Section */}
      <div className="bg-dark text-white py-5">
        <div className="container mx-auto px-4">
          <div className="max-w-lg mx-auto text-center">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              <span className="text-secondary">ChittyCan™</span>
            </h1>
            <p className="text-base mb-2">Static IPs for banking APIs - easy peasy</p>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 w-full flex justify-center">
            <TabsTrigger value="dashboard" className="flex-1">My Connections</TabsTrigger>
            <TabsTrigger value="new-tunnel" className="flex-1">Connect</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard">
            <Dashboard 
              tunnels={tunnelsData?.tunnels || []} 
              stats={statsData} 
              isLoading={statsLoading || tunnelsLoading} 
            />
          </TabsContent>
          
          <TabsContent value="new-tunnel">
            <NewTunnelForm onSuccess={() => setActiveTab("dashboard")} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
