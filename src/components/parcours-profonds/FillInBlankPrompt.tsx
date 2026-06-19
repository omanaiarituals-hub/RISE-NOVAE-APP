// components/parcours-profonds/FillInBlankPrompt.tsx
'use client'

interface FillInBlankPromptProps {
  template: string // ex: "Aujourd'hui, je reconnais que je suis devenue ___. Ce chemin m'a appris ___."
  value: string // stocke en JSON : ["valeur du 1er trou", "valeur du 2e trou", ...]
  onChange: (value: string) => void
}

export default function FillInBlankPrompt({ template, value, onChange }: FillInBlankPromptProps) {
  const parts = template.split('___')
  const blanksCount = parts.length - 1

  let filledValues: string[] = []
  try {
    const parsed = JSON.parse(value || '[]')
    if (Array.isArray(parsed)) filledValues = parsed
  } catch {
    filledValues = []
  }

  function handleBlankChange(index: number, newVal: string) {
    const updated = [...filledValues]
    updated[index] = newVal
    while (updated.length < blanksCount) updated.push('')
    onChange(JSON.stringify(updated))
  }

  return (
    <div className="rounded-2xl border border-[rgba(127,160,134,0.25)] bg-white/60 p-5">
      <p className="text-[15px] text-[#3A3A36] leading-[2.1]">
        {parts.map((part, idx) => (
          <span key={idx}>
            {part}
            {idx < blanksCount && (
              <input
                type="text"
                value={filledValues[idx] || ''}
                onChange={e => handleBlankChange(idx, e.target.value)}
                className="inline-block mx-1 min-w-[90px] border-b-2 border-[#8FAE8E] bg-transparent px-1 text-[#2F4D38] font-medium focus:outline-none focus:border-[#5C7A66]"
                style={{ width: `${Math.max(90, (filledValues[idx]?.length || 0) * 9)}px` }}
              />
            )}
          </span>
        ))}
      </p>
    </div>
  )
}