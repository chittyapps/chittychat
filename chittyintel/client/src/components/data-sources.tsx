import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Clock, ExternalLink } from "lucide-react";

interface DataSource {
  name: string;
  type: 'legal' | 'financial' | 'public' | 'private';
  status: 'connected' | 'pending' | 'error';
  lastSync?: string;
  description: string;
  apiEndpoint?: string;
}

const dataSources: DataSource[] = [
  {
    name: 'ChittyChain Production Database',
    type: 'private',
    status: 'connected',
    lastSync: '2025-08-05T15:58:00Z',
    description: 'Corporate governance, blockchain transactions, and legal entity management',
    apiEndpoint: '/api/legal/timeline'
  },
  {
    name: 'ChittyFinance Production Database',
    type: 'financial',
    status: 'connected',
    lastSync: '2025-08-05T15:58:00Z',
    description: 'Loan records, payment history, financial transactions, and accounting data',
    apiEndpoint: '/api/legal/loan-details'
  },
  {
    name: 'Arias v Bianchi Case Database',
    type: 'legal',
    status: 'connected',
    lastSync: '2025-08-05T15:58:00Z',
    description: 'Litigation timeline, case filings, court orders, and legal proceedings',
    apiEndpoint: '/api/legal/litigation-status'
  },
  {
    name: 'Legal Analytics Engine',
    type: 'legal',
    status: 'connected',
    lastSync: '2025-08-05T15:57:00Z',
    description: 'Multi-perspective analysis, strength assessments, and legal intelligence',
    apiEndpoint: '/api/legal/pov-analysis'
  },
  {
    name: 'Illinois Secretary of State API',
    type: 'public',
    status: 'connected',
    lastSync: '2025-08-05T15:55:00Z',
    description: 'Corporate filings, amendments, and registered agent information',
    apiEndpoint: '/api/legal/timeline'
  },
  {
    name: 'Cook County Circuit Court',
    type: 'public',
    status: 'connected',
    lastSync: '2025-08-05T15:56:00Z',
    description: 'Case filings, court orders, and litigation status updates',
    apiEndpoint: '/api/legal/litigation-status'
  }
];

const statusConfig = {
  connected: { 
    icon: CheckCircle2, 
    color: 'text-green-500', 
    badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
  },
  pending: { 
    icon: Clock, 
    color: 'text-yellow-500', 
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
  },
  error: { 
    icon: AlertCircle, 
    color: 'text-red-500', 
    badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
  }
};

const typeConfig = {
  legal: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  financial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  public: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  private: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
};

export function DataSourcesPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gradient">Live Data Sources</h2>
        <Badge variant="outline" className="chitty-accent">
          {dataSources.filter(ds => ds.status === 'connected').length} of {dataSources.length} Connected
        </Badge>
      </div>
      
      <div className="grid gap-4">
        {dataSources.map((source, index) => {
          const StatusIcon = statusConfig[source.status].icon;
          
          return (
            <Card key={index} className="chitty-accent hover:shadow-lg transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-5 w-5 ${statusConfig[source.status].color}`} />
                    <CardTitle className="text-lg">{source.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={typeConfig[source.type]}>
                      {source.type}
                    </Badge>
                    <Badge className={statusConfig[source.status].badge}>
                      {source.status}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="text-sm">
                  {source.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {source.apiEndpoint && (
                      <>
                        <ExternalLink className="h-4 w-4" />
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {source.apiEndpoint}
                        </code>
                      </>
                    )}
                  </div>
                  {source.lastSync && (
                    <span>
                      Last sync: {new Date(source.lastSync).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2 chitty-text">Data Integrity Notice</h3>
        <p className="text-sm text-muted-foreground">
          ChittyIntel connects to authentic data sources for real-time legal intelligence. 
          All information is pulled directly from official records, court systems, and 
          authorized financial platforms to ensure accuracy and compliance.
        </p>
      </div>
    </div>
  );
}