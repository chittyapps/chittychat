import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  Zap, 
  CheckCircle, 
  XCircle, 
  Mail, 
  Calendar, 
  FileText,
  Loader2,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Service {
  type: string;
  name: string;
  description: string;
  features: string[];
}

interface ConnectedService {
  id: string;
  serviceType: string;
  serviceName: string;
  accountEmail?: string;
  accountDisplayName?: string;
  isActive: boolean;
  lastSync: string;
  createdAt: string;
}

export function ServicesConnection() {
  const [connectingService, setConnectingService] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: availableServices = [], isLoading: loadingAvailable } = useQuery({
    queryKey: ["/api/services/available"],
  });

  const { data: connectedServices = [], isLoading: loadingConnected } = useQuery({
    queryKey: ["/api/services/connected"],
  });

  const connectMutation = useMutation({
    mutationFn: async (serviceType: string) => {
      const response = await apiRequest("POST", `/api/services/connect/${serviceType}`);
      return response.json();
    },
    onSuccess: (data, serviceType) => {
      setConnectingService(serviceType);
      // Open OAuth flow in popup
      const popup = window.open(
        data.authUrl,
        'oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );
      
      // Listen for OAuth completion
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          setConnectingService(null);
          // Refresh connected services
          queryClient.invalidateQueries({ queryKey: ["/api/services/connected"] });
          toast({
            title: "Checking connection...",
            description: "Please wait while we verify your connection.",
          });
        }
      }, 1000);
    },
    onError: (error) => {
      setConnectingService(null);
      toast({
        title: "Connection failed",
        description: "Couldn't start the connection process. Please try again.",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      const response = await apiRequest("DELETE", `/api/services/${serviceId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services/connected"] });
      toast({
        title: "Service disconnected",
        description: "The service has been safely disconnected.",
      });
    },
    onError: () => {
      toast({
        title: "Disconnect failed",
        description: "Couldn't disconnect the service. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'gmail':
        return <Mail className="w-6 h-6 text-coral" />;
      case 'google_calendar':
        return <Calendar className="w-6 h-6 text-mint" />;
      case 'google_drive':
        return <FileText className="w-6 h-6 text-warmBlue" />;
      default:
        return <Settings className="w-6 h-6 text-sage" />;
    }
  };

  const getConnectedAccounts = (serviceType: string) => {
    return connectedServices.filter((s: ConnectedService) => s.serviceType === serviceType && s.isActive);
  };

  const hasConnectedAccounts = (serviceType: string) => {
    return getConnectedAccounts(serviceType).length > 0;
  };

  if (loadingAvailable || loadingConnected) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-sage/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-charcoal flex items-center">
            <Zap className="text-sage mr-3 w-5 h-5" />
            Connect Your Services
          </h2>
          <p className="text-sm text-charcoal/60 mt-1">
            Let your AI assistant access and manage your accounts
          </p>
        </div>
        
        {connectedServices.length > 0 && (
          <Badge variant="outline" className="bg-sage/10 text-sage border-sage/20">
            {connectedServices.length} connected
          </Badge>
        )}
      </div>

      {connectedServices.length === 0 && (
        <div className="bg-warmBlue/5 border border-warmBlue/20 rounded-xl p-4 mb-6">
          <div className="flex items-start">
            <AlertCircle className="text-warmBlue mr-3 w-5 h-5 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-charcoal">Ready to get started?</p>
              <p className="text-xs text-charcoal/60">
                Connect your first service to let your AI assistant start helping you manage tasks automatically.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableServices.map((service: Service) => {
          const connectedAccounts = getConnectedAccounts(service.type);
          const hasAccounts = hasConnectedAccounts(service.type);
          const isConnecting = connectingService === service.type;
          
          return (
            <Card key={service.type} className={`border-2 transition-all ${
              hasAccounts 
                ? 'border-sage/20 bg-sage/5' 
                : 'border-gray-200 hover:border-sage/20'
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getServiceIcon(service.type)}
                    <div>
                      <CardTitle className="text-base text-charcoal">{service.name}</CardTitle>
                      {hasAccounts && (
                        <Badge variant="outline" className="text-xs bg-sage/10 text-sage border-sage/20 mt-1">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {connectedAccounts.length} connected
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <p className="text-sm text-charcoal/60 mb-4">
                  {service.description}
                </p>
                
                {/* Show connected accounts */}
                {hasAccounts && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-charcoal mb-2">Connected accounts:</p>
                    <div className="space-y-2">
                      {connectedAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between bg-white/60 rounded-lg p-2 border border-sage/10">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-charcoal truncate">
                              {account.accountDisplayName || account.accountEmail || account.serviceName}
                            </p>
                            {account.accountEmail && account.accountEmail !== account.accountDisplayName && (
                              <p className="text-xs text-charcoal/50 truncate">{account.accountEmail}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => disconnectMutation.mutate(account.id)}
                            disabled={disconnectMutation.isPending}
                            className="ml-2 h-6 w-6 p-0 text-coral hover:bg-coral/10"
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-medium text-charcoal">AI capabilities:</p>
                  <ul className="space-y-1">
                    {service.features.slice(0, 3).map((feature, index) => (
                      <li key={index} className="text-xs text-charcoal/60 flex items-center">
                        <CheckCircle className="w-3 h-3 mr-2 text-sage" />
                        {feature}
                      </li>
                    ))}
                    {service.features.length > 3 && (
                      <li className="text-xs text-charcoal/50">
                        +{service.features.length - 3} more features
                      </li>
                    )}
                  </ul>
                </div>
                
                <Separator className="my-4" />
                
                <div className="flex justify-center">
                  <Button
                    onClick={() => connectMutation.mutate(service.type)}
                    disabled={isConnecting || connectMutation.isPending}
                    className="w-full bg-sage hover:bg-sage/90"
                    variant={hasAccounts ? "outline" : "default"}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {hasAccounts ? `Add another ${service.name}` : `Connect ${service.name}`}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {connectedServices.length > 0 && (
        <div className="mt-6 p-4 bg-gradient-to-r from-sage/5 to-mint/5 rounded-xl border border-sage/10">
          <p className="text-sm text-charcoal text-center">
            🎉 Your AI assistant is now monitoring these services and will proactively help manage tasks. 
            Check the "AI Actions" section to see what it's working on!
          </p>
        </div>
      )}
    </div>
  );
}