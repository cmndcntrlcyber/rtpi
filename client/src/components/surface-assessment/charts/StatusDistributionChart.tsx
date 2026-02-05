import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface StatusDistributionChartProps {
  data: {
    open: number;
    in_progress: number;
    fixed: number;
    false_positive: number;
    accepted_risk: number;
  };
}

const COLORS = {
  open: '#dc2626',           // red-600
  in_progress: '#f59e0b',    // amber-500
  fixed: '#16a34a',          // green-600
  false_positive: '#6b7280', // gray-500
  accepted_risk: '#8b5cf6'   // violet-500
};

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  fixed: 'Fixed',
  false_positive: 'False Positive',
  accepted_risk: 'Accepted Risk'
};

export default function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  const chartData = [
    { name: STATUS_LABELS.open, value: data.open, color: COLORS.open },
    { name: STATUS_LABELS.in_progress, value: data.in_progress, color: COLORS.in_progress },
    { name: STATUS_LABELS.fixed, value: data.fixed, color: COLORS.fixed },
    { name: STATUS_LABELS.false_positive, value: data.false_positive, color: COLORS.false_positive },
    { name: STATUS_LABELS.accepted_risk, value: data.accepted_risk, color: COLORS.accepted_risk },
  ].filter(item => item.value > 0);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h3 className="text-lg font-semibold mb-4">Vulnerabilities by Status</h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No vulnerabilities found
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <h3 className="text-lg font-semibold mb-4">Vulnerabilities by Status</h3>
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
              backgroundColor: 'hsl(var(--popover))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '0.5rem',
              color: 'hsl(var(--popover-foreground))'
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
