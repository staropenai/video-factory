/**
 * JTG V5 改进2 — Trust Triangle Card component.
 *
 * Renders a structured evidence card following the "trust triangle" pattern:
 *   Title → Shortest answer (one line) → Why trustworthy (sources) → Next step
 *
 * This component is a pure presentational component with no side effects.
 */

'use client'

interface TrustSource {
  label: string
  url?: string
  type: 'official' | 'verified' | 'experience'
}

export interface TrustTriangleCardProps {
  /** Card title (e.g. "敷金の返還ルール"). */
  title: string
  /** One-line shortest answer. */
  shortAnswer: string
  /** Trust sources — evidence backing the answer. */
  sources: TrustSource[]
  /** Common misconception to address (optional). */
  commonMistake?: string
  /** Actionable next step. */
  nextStep: string
  /** Dismiss handler (optional). */
  onDismiss?: () => void
}

/** Badge color by source type. */
function sourceTypeLabel(type: TrustSource['type']): {
  text: string
  className: string
} {
  switch (type) {
    case 'official':
      return { text: '公式', className: 'bg-green-100 text-green-800' }
    case 'verified':
      return { text: '検証済', className: 'bg-blue-100 text-blue-800' }
    case 'experience':
      return { text: '体験', className: 'bg-yellow-100 text-yellow-800' }
  }
}

export function TrustTriangleCard({
  title,
  shortAnswer,
  sources,
  commonMistake,
  nextStep,
  onDismiss,
}: TrustTriangleCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm mt-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 text-xs ml-2"
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {/* Layer 1: Shortest answer */}
      <p className="text-sm text-gray-700 mt-2">{shortAnswer}</p>

      {/* Layer 2: Sources (why trustworthy) */}
      {sources.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 font-medium mb-1">
            情報源 / Sources
          </p>
          <ul className="space-y-1">
            {sources.map((src, i) => {
              const badge = sourceTypeLabel(src.type)
              return (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}
                  >
                    {badge.text}
                  </span>
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {src.label}
                    </a>
                  ) : (
                    <span className="text-gray-600">{src.label}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Layer 3: Common mistake (optional) */}
      {commonMistake && (
        <div className="mt-3 bg-amber-50 rounded px-3 py-2">
          <p className="text-xs text-amber-800">
            <span className="font-medium">よくある誤解:</span>{' '}
            {commonMistake}
          </p>
        </div>
      )}

      {/* Layer 4: Next step */}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-600">
          <span className="font-medium">次のステップ:</span> {nextStep}
        </p>
      </div>
    </div>
  )
}
