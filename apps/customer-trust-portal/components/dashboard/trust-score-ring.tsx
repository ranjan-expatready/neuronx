'use client';

interface TrustScoreRingProps {
  score: number;
  label: string;
  description: string;
  size?: number;
}

export function TrustScoreRing({
  score,
  label,
  description,
  size = 120,
}: TrustScoreRingProps) {
  const normalizedScore = Math.min(100, Math.max(0, score));
  const circumference = 2 * Math.PI * (size / 2 - 8);
  const strokeDasharray = circumference;
  const strokeDashoffset =
    circumference - (normalizedScore / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-green-500', text: 'text-green-600' };
    if (score >= 70) return { bg: 'bg-yellow-500', text: 'text-yellow-600' };
    return { bg: 'bg-red-500', text: 'text-red-600' };
  };

  const colors = getScoreColor(normalizedScore);

  return (
    <div className='trust-card'>
      <div className='text-center'>
        <div className='relative inline-flex items-center justify-center'>
          <svg width={size} height={size} className='transform -rotate-90'>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 8}
              stroke='currentColor'
              strokeWidth='4'
              fill='transparent'
              className='text-gray-200'
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 8}
              stroke='currentColor'
              strokeWidth='4'
              fill='transparent'
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap='round'
              className={`${colors.bg} transition-all duration-300 ease-in-out`}
            />
          </svg>

          {/* Score text */}
          <div className='absolute inset-0 flex items-center justify-center'>
            <div className='text-center'>
              <div className={`text-2xl font-bold ${colors.text}`}>
                {normalizedScore}
              </div>
              <div className='text-xs text-gray-500'>/100</div>
            </div>
          </div>
        </div>

        <h3 className='text-lg font-semibold text-gray-900 mt-4'>{label}</h3>
        <p className='text-sm text-gray-600 mt-1'>{description}</p>

        {/* Score interpretation */}
        <div className='mt-4'>
          <div
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              normalizedScore >= 90
                ? 'bg-green-100 text-green-800'
                : normalizedScore >= 70
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {normalizedScore >= 90
              ? 'Excellent'
              : normalizedScore >= 70
                ? 'Good'
                : 'Needs Attention'}
          </div>
        </div>
      </div>
    </div>
  );
}
