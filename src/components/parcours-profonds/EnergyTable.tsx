// components/parcours-profonds/EnergyTable.tsx
'use client'

interface EnergyTableProps {
  columns: string[] // ex: ["Activité / situation", "+ ou -", "Pourquoi"]
  rowsCount: number
  value: string // stocke en JSON : [{ activite: "", signe: "" | "+" | "-", pourquoi: "" }, ...]
  onChange: (value: string) => void
}

interface EnergyRow {
  activite: string
  signe: '' | '+' | '-'
  pourquoi: string
}

export default function EnergyTable({ columns, rowsCount, value, onChange }: EnergyTableProps) {
  let rows: EnergyRow[] = Array.from({ length: rowsCount }, () => ({ activite: '', signe: '', pourquoi: '' }))
  try {
    const parsed = JSON.parse(value || '[]')
    if (Array.isArray(parsed) && parsed.length === rowsCount) rows = parsed
  } catch {
    // garde les valeurs par defaut
  }

  function updateRow(index: number, field: keyof EnergyRow, newVal: string) {
    const updated = rows.map((row, i) =>
      i === index ? { ...row, [field]: newVal } : row
    )
    onChange(JSON.stringify(updated))
  }

  const plusCount = rows.filter(r => r.signe === '+').length
  const minusCount = rows.filter(r => r.signe === '-').length

  return (
    <div>
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-white/60 border border-[rgba(127,160,134,0.2)] p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-[#9A9A94] font-medium w-5">{idx + 1}.</span>
              <input
                type="text"
                value={row.activite}
                onChange={e => updateRow(idx, 'activite', e.target.value)}
                placeholder={columns[0] || 'Activité ou situation'}
                className="flex-1 border-b border-[rgba(127,160,134,0.3)] bg-transparent py-1 text-[14px] text-[#3A3A36] placeholder:text-[#C8C8C2] focus:outline-none focus:border-[#8FAE8E]"
              />
            </div>

            <div className="flex items-center gap-2 pl-7">
              <div className="flex gap-1.5">
                <button
                  onClick={() => updateRow(idx, 'signe', row.signe === '+' ? '' : '+')}
                  className={`w-8 h-8 rounded-lg text-[15px] font-medium transition ${
                    row.signe === '+'
                      ? 'bg-[#8FAE8E] text-white'
                      : 'bg-[#EAF1E8] text-[#8FAE8E]'
                  }`}
                >
                  +
                </button>
                <button
                  onClick={() => updateRow(idx, 'signe', row.signe === '-' ? '' : '-')}
                  className={`w-8 h-8 rounded-lg text-[15px] font-medium transition ${
                    row.signe === '-'
                      ? 'bg-[#D9B98C] text-white'
                      : 'bg-[#F3EBDD] text-[#B89A6A]'
                  }`}
                >
                  −
                </button>
              </div>
              <input
                type="text"
                value={row.pourquoi}
                onChange={e => updateRow(idx, 'pourquoi', e.target.value)}
                placeholder={columns[2] || 'Pourquoi'}
                className="flex-1 border-b border-[rgba(127,160,134,0.2)] bg-transparent py-1 text-[13px] text-[#6B6B66] placeholder:text-[#C8C8C2] focus:outline-none focus:border-[#8FAE8E]"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 text-[12px] text-[#6B6B66]">
        <span>{plusCount} activité{plusCount !== 1 ? 's' : ''} qui donnent de l'énergie</span>
        <span className="text-[#C8C8C2]">·</span>
        <span>{minusCount} qui en prennent</span>
      </div>
    </div>
  )
}