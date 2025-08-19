import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity,
  TrendingUp,
  Clock,
  Target,
  Zap,
  Brain,
  Shield,
  BarChart3
} from "lucide-react";

interface AnalyticsData {
  totalSessions: number;
  avgSessionLength: number;
  featuresUsed: string[];
  platformInfo: {
    platform: string;
    environment: string;
    uptime: number;
  };
  privacyStatus: {
    trackingEnabled: boolean;
    dataRetention: string;
    personalDataCollected: false;
  };
}

export function AnalyticsDashboard() {
  const { data: analytics } = useQuery({
    queryKey: ["/api/analytics/beacon"],
    retry: false,
  });

  const mockData: AnalyticsData = {
    totalSessions: 42,
    avgSessionLength: 25,
    featuresUsed: ['focus_timer', 'decision_support', 'transition_rituals'],
    platformInfo: {
      platform: 'replit',
      environment: 'development',
      uptime: 3600
    },
    privacyStatus: {
      trackingEnabled: true,
      dataRetention: '30 days',
      personalDataCollected: false
    }
  };

  const data = analytics || mockData;

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <BarChart3 className="w-5 h-5 text-warm-blue" />
        <h2 className="text-xl font-semibold text-charcoal">Usage Analytics</h2>
      </div>

      <p className="text-charcoal/60 leading-relaxed">
        Privacy-focused insights about your Flow usage patterns. No personal data is collected.
      </p>

      {/* Privacy Notice */}
      <Card className="border-mint/20 bg-mint/5">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-mint" />
            <CardTitle className="text-lg text-charcoal">Privacy-First Analytics</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoal">Tracking Status</span>
            <Badge variant="outline" className="bg-mint/10 text-mint border-mint/20">
              {data.privacyStatus.trackingEnabled ? 'Active' : 'Disabled'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoal">Personal Data</span>
            <Badge variant="outline" className="bg-sage/10 text-sage border-sage/20">
              None Collected
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoal">Data Retention</span>
            <span className="text-sm text-charcoal/60">{data.privacyStatus.dataRetention}</span>
          </div>
          <div className="text-xs text-charcoal/50 pt-2 border-t border-mint/10">
            ChittyBeacon tracks only app usage patterns, platform info, and feature engagement. 
            No personal information, tasks, or sensitive data is collected.
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-warm-blue" />
              <CardTitle className="text-sm text-charcoal">Total Sessions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-charcoal">{data.totalSessions}</div>
            <p className="text-xs text-charcoal/60">Focus and transition sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-coral" />
              <CardTitle className="text-sm text-charcoal">Avg Session</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-charcoal">{data.avgSessionLength}m</div>
            <p className="text-xs text-charcoal/60">Optimal for ADHD focus</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-mint" />
              <CardTitle className="text-sm text-charcoal">Features Used</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-charcoal">{data.featuresUsed.length}</div>
            <p className="text-xs text-charcoal/60">Executive function tools</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-charcoal">Feature Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.featuresUsed.map((feature, index) => (
            <div key={feature} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-sage/20 rounded-full flex items-center justify-center">
                  {feature.includes('focus') && <Brain className="w-4 h-4 text-sage" />}
                  {feature.includes('decision') && <Target className="w-4 h-4 text-sage" />}
                  {feature.includes('transition') && <Zap className="w-4 h-4 text-sage" />}
                </div>
                <div>
                  <p className="font-medium text-charcoal capitalize">
                    {feature.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-charcoal/60">
                    {feature.includes('focus') && 'Time blindness support'}
                    {feature.includes('decision') && 'Decision paralysis help'}
                    {feature.includes('transition') && 'Gentle transitions'}
                  </p>
                </div>
              </div>
              <Progress value={(4 - index) * 25} className="w-16 h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Platform Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-charcoal">Platform Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoal">Platform</span>
            <Badge variant="outline" className="capitalize">
              {data.platformInfo.platform}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoal">Environment</span>
            <Badge variant="outline" className="capitalize">
              {data.platformInfo.environment}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-charcoal">Session Uptime</span>
            <span className="text-sm text-charcoal/60">
              {formatUptime(data.platformInfo.uptime)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card className="border-sage/20 bg-sage/5">
        <CardHeader>
          <CardTitle className="text-lg text-charcoal">What Gets Tracked</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-charcoal mb-2">✓ Anonymous Usage Data</h4>
              <ul className="space-y-1 text-charcoal/60">
                <li>• Feature interactions</li>
                <li>• Session durations</li>
                <li>• Platform detection</li>
                <li>• App startup/shutdown</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-charcoal mb-2">✗ Never Tracked</h4>
              <ul className="space-y-1 text-charcoal/60">
                <li>• Personal information</li>
                <li>• Task content</li>
                <li>• Emails or messages</li>
                <li>• Environment secrets</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}