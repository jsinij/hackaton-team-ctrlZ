interface Props {
  score: number // 0–100
  size?: number
}

function scoreColor(score: number): string {
  if (score >= 70) return '#0f766e' // teal / green
  if (score >= 40) return '#d97706' // amber
  return '#dc2626'                  // red
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Cumplimiento alto'
  if (score >= 40) return 'Cumplimiento medio'
  return 'Cumplimiento bajo'
}

export default function ScoreGauge({ score, size = 180 }: Props) {
  const clampedScore = Math.max(0, Math.min(100, score))
  const radius = (size - 20) / 2
  const cx = size / 2
  const cy = size / 2

  // Full circle circumference
  const circumference = 2 * Math.PI * radius
  // We show 270° of the circle (starting from bottom-left, going clockwise)
  const arcLength = (270 / 360) * circumference
  const dashOffset = arcLength - (clampedScore / 100) * arcLength

  const color = scoreColor(clampedScore)
  const label = scoreLabel(clampedScore)

  // Rotate so the arc starts at 135° (bottom-left) and goes to 45° (bottom-right)
  const rotation = 135

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} role="img" aria-label={`Puntaje: ${clampedScore}%`}>
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={14}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
        />
        {/* Filled arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
        {/* Center text */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.22}
          fontWeight="700"
          fill={color}
        >
          {clampedScore}
        </text>
        <text
          x={cx}
          y={cy + size * 0.14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.085}
          fill="#6b7280"
        >
          / 100
        </text>
      </svg>
      <span
        className="text-sm font-semibold"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  )
}
