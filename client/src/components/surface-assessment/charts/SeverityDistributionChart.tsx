import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SeverityDistributionChartProps {
  data: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
}

const COLORS = {
  critical: '#dc2626',      // red-600
  high: '#ea580c',          // orange-600
  medium: '#ca8a04',        // yellow-600
  low: '#16a34a',           // green-600
  informational: '#0284c7'  // sky-600
};

export default function SeverityDistributionChart({ data }: SeverityDistributionChartProps) {
  const chartData = [
    { name: 'Critical', value: data.critical, color: COLORS.critical },
    { name: 'High', value: data.high, color: COLORS.high },
    { name: 'Medium', value: data.medium, color: COLORS.medium },
    { name: 'Low', value: data.low, color: COLORS.low },
    { name: 'Info', value: data.informational, color: COLORS.informational },
  ].filter(item => item.value > 0);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h3 className="text-lg font-semibold mb-4">Vulnerabilities by Severity</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No vulnerabilities found
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Vulnerabilities by Severity</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [value, 'Count']}
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem'
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value, entry: any) => `${value}: ${entry.payload.value}`}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
