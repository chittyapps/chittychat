import { useState, useEffect } from "react";
import * as React from "react";
import { Brain, DollarSign, Percent, AlertTriangle, Scale, Eye, BarChart3, Wifi, WifiOff, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { Timeline } from "@/components/timeline";
import { FinancialChart } from "@/components/financial-chart";
import { DataSourcesPanel } from "@/components/data-sources";
import { ChittyBeaconMonitor } from "@/components/chitty-beacon-monitor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveLoanDetails, useLiveTimelineData, useLivePOVAnalysis } from "@/hooks/use-live-data";
import { useChittyBeacon } from "@/hooks/use-chitty-beacon";
import { aribiaData } from "@/data/aribia-data";

export default function Dashboard() {
  const [currentPOV, setCurrentPOV] = useState('aribia');
  const [dataMode, setDataMode] = useState<'live' | 'static'>('live');
  const [beaconVisible, setBeaconVisible] = useState(false);
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Live data hooks
  const { data: liveLoanData, isLoading: loanLoading, error: loanError } = useLiveLoanDetails();
  const { data: liveTimelineData, isLoading: timelineLoading } = useLiveTimelineData();
  const { data: livePOVData, isLoading: povLoading } = useLivePOVAnalysis(currentPOV);

  // ChittyBeacon integration
  const beacon = useChittyBeacon({
    enabled: true,
    endpoint: '/api/beacon/events',
    bufferSize: 100,
    flushInterval: 10000
  });

  // Fallback to static data if live data fails
  const { loanDetails, timelineEvents, financialData } = aribiaData;
  const isLiveDataAvailable = liveLoanData && !loanError;

  const coreMetrics = [
    {
      title: "Loan Principal",
      value: `$${loanDetails.principal.toLocaleString()}`,
      icon: DollarSign,
      color: 'var(--chitty-primary)'
    },
    {
      title: "Interest Rate",
      value: `${loanDetails.interestRate}%`,
      icon: Percent,
      color: 'var(--chitty-blue)'
    },
    {
      title: "TRO Duration",
      value: "118 Days",
      icon: AlertTriangle,
      color: 'var(--chitty-red)'
    },
    {
      title: "Legal Status",
      value: "Active Litigation",
      icon: Scale,
      color: 'var(--chitty-amber)'
    }
  ];

  const povOptions = [
    { id: 'aribia', label: 'ARIBIA LLC', description: 'Business Defense' },
    { id: 'sharon', label: 'Sharon Jones', description: 'Lender & President' },
    { id: 'luisa', label: 'Luisa Arias', description: 'Former Member' },
    { id: 'legal', label: 'Legal Neutral', description: 'Court Analysis' },
    { id: 'colombia', label: 'Colombian Legal', description: 'International' }
  ];

  // Handle POV switching with beacon tracking
  const handlePOVChange = (newPOV: string) => {
    const oldPOV = currentPOV;
    setCurrentPOV(newPOV);
    beacon.trackPOVSwitch(oldPOV, newPOV);
    beacon.trackUserAction('pov_switch', `${oldPOV}_to_${newPOV}`);
  };

  // Track system initialization and data loading
  React.useEffect(() => {
    beacon.trackLegalEvent('dashboard_initialized', { 
      initial_pov: currentPOV,
      data_mode: dataMode,
      live_data_available: isLiveDataAvailable
    });

    if (isLiveDataAvailable) {
      beacon.trackDatabaseStatus('ChittyIntel', 'connected', { 
        databases: ['ChittyChain', 'ChittyFinance', 'Arias v Bianchi']
      });
    }
  }, []);

  // Track data loading states
  React.useEffect(() => {
    if (loanLoading) {
      beacon.trackFinancialEvent('loan_data_loading');
    } else if (liveLoanData) {
      beacon.trackFinancialEvent('loan_data_loaded', liveLoanData.principal, 'USD');
    }
  }, [loanLoading, liveLoanData]);

  React.useEffect(() => {
    if (timelineLoading) {
      beacon.trackLegalEvent('timeline_data_loading');
    } else if (liveTimelineData) {
      beacon.trackLegalEvent('timeline_data_loaded', { 
        event_count: liveTimelineData.events?.length || 0
      });
    }
  }, [timelineLoading, liveTimelineData]);

  return (
    <div className="min-h-screen bg-background">
      {/* Modern Header */}
      <header className="border-b border-border backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <motion.div 
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="w-12 h-12 aribia-gradient rounded-xl flex items-center justify-center shadow-lg">
                <Brain className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">ChittyIntel</h1>
                <p className="text-sm text-muted-foreground">Advanced Legal Intelligence Platform</p>
              </div>
            </motion.div>
            
            <motion.div 
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {/* Live Data Status Indicator */}
              <div className="flex items-center gap-2">
                {isLiveDataAvailable ? (
                  <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                    <Wifi className="w-3 h-3 mr-1" />
                    Live Data
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Static Data
                  </Badge>
                )}
              </div>
              
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">Multi-POV Dashboard</p>
                <p className="text-xs text-muted-foreground">
                  {isLiveDataAvailable ? 'Real-time Legal Intelligence' : 'Using Static Demo Data'}
                </p>
              </div>
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                <Eye className="text-primary" size={20} />
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Main Tabs */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger 
              value="dashboard" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Intelligence Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="data-sources"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Wifi className="w-4 h-4 mr-2" />
              Data Sources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-8">
            {/* POV Selector */}
            <div className="modern-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Intelligence Perspective</h2>
              <p className="text-muted-foreground text-sm">Select stakeholder viewpoint for analysis</p>
            </div>
            <Eye className="text-primary" size={20} />
          </div>
          
          <div className="grid grid-cols-5 gap-4">
            {povOptions.map((option, index) => (
              <motion.button
                key={option.id}
                className={`p-4 rounded-xl border-2 smooth-hover text-center ${
                  currentPOV === option.id 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => handlePOVChange(option.id)}
                data-testid={`button-pov-${option.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="text-sm font-semibold text-foreground mb-1">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Core Metrics */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {coreMetrics.map((metric, index) => (
            <motion.div
              key={metric.title}
              className="metric-card modern-card rounded-2xl p-6 smooth-hover hover:scale-105"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${metric.color}20` }}
                >
                  <metric.icon size={20} style={{ color: metric.color }} />
                </div>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: metric.color }}></div>
              </div>
              
              <div>
                <p className="text-muted-foreground text-sm font-medium mb-1">{metric.title}</p>
                <p className="text-2xl font-bold text-foreground">{metric.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Timeline Section */}
        <Timeline events={timelineEvents} />

        {/* Analysis Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Claims Analysis */}
          <div className="modern-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Legal Position Analysis</h3>
                <p className="text-muted-foreground text-sm">Current perspective: {povOptions.find(p => p.id === currentPOV)?.label}</p>
              </div>
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-primary" size={16} />
              </div>
            </div>

            <div className="space-y-4">
              {currentPOV === 'aribia' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-4 border border-green-500/30 bg-green-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Pre-Marital Asset Defense</span>
                      <span className="text-sm font-semibold text-green-400">95%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">ARIBIA formed 5 months before marriage (Oct 2022)</p>
                  </div>
                  <div className="p-4 border border-green-500/30 bg-green-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Separate Property Funding</span>
                      <span className="text-sm font-semibold text-green-400">90%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Colombian property purchased with pre-marital funds</p>
                  </div>
                  <div className="p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Corporate Compliance</span>
                      <span className="text-sm font-semibold text-blue-400">85%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Proper member removal following operating agreement</p>
                  </div>
                </motion.div>
              )}
              
              {currentPOV === 'sharon' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-4 border border-green-500/30 bg-green-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Secured Loan Position</span>
                      <span className="text-sm font-semibold text-green-400">100%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">$100K loan secured by Medellín + City Studio properties</p>
                  </div>
                  <div className="p-4 border border-green-500/30 bg-green-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Executive Authority</span>
                      <span className="text-sm font-semibold text-green-400">95%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Appointed Interim President April 2025</p>
                  </div>
                  <div className="p-4 border border-purple-500/30 bg-purple-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Non-Marital Interest</span>
                      <span className="text-sm font-semibold text-purple-400">100%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">15% IT CAN BE LLC member, no marital connection</p>
                  </div>
                </motion.div>
              )}
              
              {currentPOV === 'luisa' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Marital Asset Claims</span>
                      <span className="text-sm font-semibold text-amber-400">65%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Claims ARIBIA as marital property despite formation timing</p>
                  </div>
                  <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Improper Removal Challenge</span>
                      <span className="text-sm font-semibold text-red-400">45%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Disputes validity of member removal process</p>
                  </div>
                  <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">TRO Emergency Relief</span>
                      <span className="text-sm font-semibold text-red-400">25%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Temporary restraining order for asset protection</p>
                  </div>
                </motion.div>
              )}
              
              {currentPOV === 'legal' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-4 border border-green-500/30 bg-green-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Corporate Veil Integrity</span>
                      <span className="text-sm font-semibold text-green-400">88%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Strong entity separation with comprehensive documentation</p>
                  </div>
                  <div className="p-4 border border-green-500/30 bg-green-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Timeline Evidence</span>
                      <span className="text-sm font-semibold text-green-400">92%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Clear chronological formation record pre-marriage</p>
                  </div>
                  <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">TRO Standard Analysis</span>
                      <span className="text-sm font-semibold text-red-400">40%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Emergency relief standard questionable on merits</p>
                  </div>
                </motion.div>
              )}
              
              {currentPOV === 'colombia' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="p-4 border border-green-500/30 bg-green-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Foreign Investment Compliance</span>
                      <span className="text-sm font-semibold text-green-400">90%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Proper documentation for Colombian property acquisition</p>
                  </div>
                  <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Eviction Proceedings</span>
                      <span className="text-sm font-semibold text-amber-400">75%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Legal process requires specialized litigation counsel</p>
                  </div>
                  <div className="p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-foreground">Asset Recovery Rights</span>
                      <span className="text-sm font-semibold text-blue-400">80%</span>
                    </div>
                    <p className="text-sm text-muted-foreground">ARIBIA ownership of appliances well-documented</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

            {/* Financial Chart */}
            <FinancialChart data={financialData} />
            </div>
          </TabsContent>

          <TabsContent value="data-sources">
            <DataSourcesPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modern Footer */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center space-x-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1 }}
            >
              <div className="w-10 h-10 aribia-gradient rounded-xl flex items-center justify-center">
                <Brain className="text-white" size={16} />
              </div>
              <div>
                <div className="font-semibold text-foreground">ChittyIntel Platform</div>
                <div className="text-sm text-muted-foreground">Advanced Legal Intelligence & Analytics</div>
              </div>
            </motion.div>
            <div className="text-sm text-muted-foreground">
              Last updated: <span className="text-primary">{new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ChittyBeacon Monitor - Development Only */}
      {isDevelopment && (
        <ChittyBeaconMonitor 
          isVisible={beaconVisible} 
          onToggle={() => {
            setBeaconVisible(!beaconVisible);
            beacon.trackUserAction('toggle_beacon_monitor', beaconVisible ? 'close' : 'open');
          }}
        />
      )}
    </div>
  );
}
