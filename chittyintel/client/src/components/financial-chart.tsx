import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartArea } from "lucide-react";

interface FinancialData {
  capitalContributions: Array<{ date: string; amount: number }>;
  outstandingObligations: Array<{ date: string; amount: number }>;
}

interface FinancialChartProps {
  data: FinancialData;
}

export function FinancialChart({ data }: FinancialChartProps) {
  // Combine the data for the chart
  const chartData = data.capitalContributions.map((contribution, index) => ({
    date: contribution.date,
    contributions: contribution.amount,
    obligations: data.outstandingObligations[index]?.amount || 0
  }));

  const formatCurrency = (value: number) => {
    return `$${(value / 1000)}K`;
  };

  return (
    <div className="modern-card rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Financial Flow Analysis</h3>
          <p className="text-muted-foreground text-sm">Capital contributions vs outstanding obligations</p>
        </div>
        <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
          <ChartArea className="text-primary" size={16} />
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={formatCurrency}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'contributions' ? 'Capital Contributions' : 'Outstanding Obligations'
              ]}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--surface))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: '0 8px 32px hsla(0, 0%, 0%, 0.3)'
              }}
            />
            <Line
              type="monotone"
              dataKey="contributions"
              stroke="var(--chitty-primary)"
              strokeWidth={3}
              fill="url(#contributionsGradient)"
              dot={{ fill: 'var(--chitty-primary)', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: 'var(--chitty-primary)', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="obligations"
              stroke="var(--chitty-red)"
              strokeWidth={3}
              fill="url(#obligationsGradient)"
              dot={{ fill: 'var(--chitty-red)', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: 'var(--chitty-red)', strokeWidth: 2 }}
            />
            <defs>
              <linearGradient id="contributionsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chitty-primary)" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="var(--chitty-primary)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="obligationsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chitty-red)" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="var(--chitty-red)" stopOpacity={0}/>
              </linearGradient>
            </defs>
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 flex justify-between text-sm border-t border-border pt-4">
        <div className="text-center">
          <div className="font-semibold text-foreground">$120K</div>
          <div className="text-muted-foreground">Initial Capital</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-foreground">$302K</div>
          <div className="text-muted-foreground">Total Contributions</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-foreground">$100K</div>
          <div className="text-muted-foreground">Active Loan</div>
        </div>
      </div>
    </div>
  );
}
