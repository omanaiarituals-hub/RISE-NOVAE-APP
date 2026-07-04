// components/parcours-profonds/HabitTracker.tsx
'use client'

interface HabitTrackerProps {
  slots: string[] // ex: ["Matin", "Journée", "Soir"]
  fields: string[] // ex: ["Quoi", "Quand (ancrage)", "Pourquoi"]
  durationWeeks: number // ex: 3
  value: string // stocke en JSON : { habits: [{quoi,quand,pourquoi}, ...], startDate: "", checks: { "week1": [bool,...7], ... } }
  onChange: (value: string) => void
}

interface HabitDefinition {
  quoi: string
  quand: string
  pourquoi: string
}

interface TrackerData {
  habits: HabitDefinition[]
  startDate: string
  checks: Record<string, boolean[]>
}

export default function HabitTracker({ slots, fields, durationWeeks, value, onChange }: HabitTrackerProps) {
  let data: TrackerData = {
    habits: slots.map(() => ({ quoi: '', quand: '', pourquoi: '' })),
    startDate: '',
    checks: (() => {
      const initialChecks: Record<string, boolean[]> = {}
      for (let i = 0; i < durationWeeks; i++) {
        initialChecks[`week${i + 1}`] = Array(7).fill(false)
      }
      return initialChecks
    })()
  }

  try {
    const parsed = JSON.parse(value || '{}')
    if (parsed && parsed.habits) data = parsed
  } catch {
    // garde les valeurs par defaut
  }

  function updateHabit(slotIndex: number, field: keyof HabitDefinition, newVal: string) {
    const updated = { ...data }
    updated.habits = data.habits.map((h, i) => (i === slotIndex ? { ...h, [field]: newVal } : h))
    onChange(JSON.stringify(updated))
  }

  function updateStartDate(newDate: string) {
    onChange(JSON.stringify({ ...data, startDate: newDate }))
  }

  function toggleCheck(week: string, dayIndex: number) {
    const updated = { ...data }
    const weekChecks = [...(updated.checks[week] || Array(7).fill(false))]
    weekChecks[dayIndex] = !weekChecks[dayIndex]
    updated.checks = { ...updated.checks, [week]: weekChecks }
    onChange(JSON.stringify(updated))
  }

  return (
    <div className="space-y-5">
      {/* Definition des 3 habitudes */}
      {slots.map((slotLabel, slotIndex) => (
        <div key={slotIndex} className="rounded-2xl bg-white/60 border border-[rgba(127,160,134,0.2)] p-4">
          <p className="text-[12px] uppercase tracking-wide text-[#7FA086] font-medium mb-3">
            Habitude {slotIndex + 1} : {slotLabel}
          </p>
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] text-[#9A9A94]">{fields[0] || 'Quoi'}</label>
              <input
                type="text"
                value={data.habits[slotIndex]?.quoi || ''}
                onChange={e => updateHabit(slotIndex, 'quoi', e.target.value)}
                placeholder="5 minutes max..."
                className="w-full border-b border-[rgba(127,160,134,0.3)] bg-transparent py-1 text-[14px] text-[#3A3A36] placeholder:text-[#C8C8C2] focus:outline-none focus:border-[#8FAE8E]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#9A9A94]">{fields[1] || 'Quand'}</label>
              <input
                type="text"
                value={data.habits[slotIndex]?.quand || ''}
                onChange={e => updateHabit(slotIndex, 'quand', e.target.value)}
                placeholder="Juste après..."
                className="w-full border-b border-[rgba(127,160,134,0.3)] bg-transparent py-1 text-[14px] text-[#3A3A36] placeholder:text-[#C8C8C2] focus:outline-none focus:border-[#8FAE8E]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#9A9A94]">{fields[2] || 'Pourquoi'}</label>
              <input
                type="text"
                value={data.habits[slotIndex]?.pourquoi || ''}
                onChange={e => updateHabit(slotIndex, 'pourquoi', e.target.value)}
                className="w-full border-b border-[rgba(127,160,134,0.3)] bg-transparent py-1 text-[14px] text-[#3A3A36] focus:outline-none focus:border-[#8FAE8E]"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Date de debut */}
      <div className="rounded-2xl bg-[#EAF1E8] p-4">
        <label className="text-[12px] text-[#4D7257] font-medium block mb-2">
          Je commence ces 3 habitudes le
        </label>
        <input
          type="date"
          value={data.startDate}
          onChange={e => updateStartDate(e.target.value)}
          className="w-full bg-white/70 rounded-xl px-3 py-2 text-[14px] text-[#3A3A36] focus:outline-none"
        />
      </div>

      {/* Suivi quotidien sur N semaines, affiche seulement si une date de debut est posee */}
      {data.startDate && (
        <div className="space-y-3">
          <p className="text-[12px] text-[#6B6B66] text-center">
            Coche les jours où tu as fait au moins une de tes 3 habitudes.
          </p>
          {Array.from({ length: durationWeeks }, (_, weekIdx) => {
            const weekKey = `week${weekIdx + 1}`
            const weekChecks = data.checks[weekKey] || Array(7).fill(false)
            return (
              <div key={weekKey} className="rounded-2xl bg-white/60 border border-[rgba(127,160,134,0.2)] p-3">
                <p className="text-[11px] uppercase tracking-wide text-[#7FA086] font-medium mb-2 px-1">
                  Semaine {weekIdx + 1}
                </p>
                <div className="flex justify-between gap-1">
                  {weekChecks.map((checked, dayIdx) => (
                    <button
                      key={dayIdx}
                      onClick={() => toggleCheck(weekKey, dayIdx)}
                      aria-label={`Jour ${dayIdx + 1}, semaine ${weekIdx + 1}`}
                      className={`flex-1 h-9 rounded-lg text-[12px] font-medium transition ${
                        checked ? 'bg-[#8FAE8E] text-white' : 'bg-[#EFEFEA] text-[#B8B8B2]'
                      }`}
                    >
                      {checked ? '✓' : dayIdx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}