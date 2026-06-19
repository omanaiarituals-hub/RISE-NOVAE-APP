// components/parcours-profonds/ThreeColumnList.tsx
'use client'

interface ThreeColumnListProps {
  columns: string[] // ex: ["Ce que je garde", "Ce que je relâche...", "Ce que je transforme"]
  value: string // stocke en JSON : { "0": ["item1", "item2"], "1": [...], "2": [...] }
  onChange: (value: string) => void
}

const COLUMN_ACCENTS = ['#8FAE8E', '#D9B98C', '#9DB89F']

export default function ThreeColumnList({ columns, value, onChange }: ThreeColumnListProps) {
  let data: Record<string, string[]> = { '0': [''], '1': [''], '2': [''] }
  try {
    const parsed = JSON.parse(value || '{}')
    if (parsed && typeof parsed === 'object') {
      data = {
        '0': parsed['0']?.length ? parsed['0'] : [''],
        '1': parsed['1']?.length ? parsed['1'] : [''],
        '2': parsed['2']?.length ? parsed['2'] : ['']
      }
    }
  } catch {
    // garde les valeurs par defaut
  }

  function updateItem(colIndex: number, itemIndex: number, newVal: string) {
    const updated = { ...data }
    const col = [...updated[String(colIndex)]]
    col[itemIndex] = newVal
    updated[String(colIndex)] = col
    onChange(JSON.stringify(updated))
  }

  function addItem(colIndex: number) {
    const updated = { ...data }
    updated[String(colIndex)] = [...updated[String(colIndex)], '']
    onChange(JSON.stringify(updated))
  }

  function removeItem(colIndex: number, itemIndex: number) {
    const updated = { ...data }
    const col = updated[String(colIndex)].filter((_, i) => i !== itemIndex)
    updated[String(colIndex)] = col.length ? col : ['']
    onChange(JSON.stringify(updated))
  }

  return (
    <div className="space-y-5">
      {columns.map((colTitle, colIndex) => (
        <div key={colIndex} className="rounded-2xl bg-white/60 border border-[rgba(127,160,134,0.2)] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: COLUMN_ACCENTS[colIndex] }}
            />
            <p className="text-[13.5px] font-medium text-[#3A3A36]">{colTitle}</p>
          </div>

          <div className="space-y-2">
            {data[String(colIndex)].map((item, itemIndex) => (
              <div key={itemIndex} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={e => updateItem(colIndex, itemIndex, e.target.value)}
                  placeholder="..."
                  className="flex-1 border-b border-[rgba(127,160,134,0.3)] bg-transparent py-1.5 text-[14px] text-[#3A3A36] placeholder:text-[#C8C8C2] focus:outline-none focus:border-[#8FAE8E]"
                />
                {data[String(colIndex)].length > 1 && (
                  <button
                    onClick={() => removeItem(colIndex, itemIndex)}
                    aria-label="Retirer cette ligne"
                    className="text-[#C8C8C2] text-sm flex-shrink-0"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => addItem(colIndex)}
            className="mt-2 text-[12px] text-[#7FA086]"
          >
            + ajouter une ligne
          </button>
        </div>
      ))}
    </div>
  )
}