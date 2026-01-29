import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendLabel?: string;
  color?: 'blue' | 'green' | 'purple' | 'indigo';
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color = 'blue',
}: MetricCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    indigo: 'text-indigo-600 bg-indigo-50',
  };

  const isPositiveTrend = trend?.startsWith('+');

  return (
    <div className='trust-card'>
      <div className='flex items-center justify-between'>
        <div className='flex-1'>
          <p className='text-sm font-medium text-gray-600'>{title}</p>
          <p className='text-2xl font-bold text-gray-900 mt-1'>{value}</p>

          {trend && trendLabel && (
            <div className='flex items-center mt-2'>
              {isPositiveTrend ? (
                <TrendingUp className='h-4 w-4 text-green-500 mr-1' />
              ) : (
                <TrendingDown className='h-4 w-4 text-red-500 mr-1' />
              )}
              <span
                className={`text-sm font-medium ${
                  isPositiveTrend ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend}
              </span>
              <span className='text-sm text-gray-500 ml-1'>{trendLabel}</span>
            </div>
          )}
        </div>

        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className='h-6 w-6' />
        </div>
      </div>
    </div>
  );
}
