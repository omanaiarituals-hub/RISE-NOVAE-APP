'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useProgramProgress } from '@/hooks/useProgramProgress'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { AuthGuard } from '@/components/AuthGuard'
import missionsData from '@/data/missions.json'
import { supabase } from '@/lib/supabase/client'

interface Mission {
  day: number
  title: string
  phase: string
  guide: string
  tasks: Array<{
    id: number
    label: string
    type: string
  }>
  reflection: {
    question: string
    placeholder: string
    type: string
  }
}

interface MissionState {
  completedTasks: number[]
  reflection: string
  isCompleted: boolean
}

export default function ProgramPage() {
  const { 
    currentDay, 
    setCurrentDay: setSupabaseDay, 
    isLoaded, 
    loading, 
    addMissionResponse 
  } = useProgramProgress()

  const { user } = useSupabaseAuth()
  
  const [mission, setMission] = useState<Mission | null>(null)
  const [missionState, setMissionState] = useState<MissionState>({
    completedTasks: [],
    reflection: '',
    isCompleted: false
  })
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessage, setChatMessage] = useState("")
  const [chatResponse, setChatResponse] = useState("")
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const reflectionSaveTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (missionsData.length > 0 && currentDay) {
      const currentMission = missionsData.find(m => m.day === currentDay)
      if (currentMission) {
        setMission(currentMission)
        setMissionState({ completedTasks: [], reflection: '', isCompleted: false })
      }
    }
  }, [currentDay])

  const handleTaskToggle = async (taskId: number) => {
    const newCompletedTasks = missionState.completedTasks.includes(taskId)
      ? missionState.completedTasks.filter(id => id !== taskId)
      : [...missionState.completedTasks, taskId]
    const newState = { ...missionState, completedTasks: newCompletedTasks }
    setMissionState(newState)
    await saveMissionStateWithUpsert(newState)
  }

  const handleReflectionChange = (value: string) => {
    setMissionState(prev => ({ ...prev, reflection: value }))
    if (reflectionSaveTimer.current) clearTimeout(reflectionSaveTimer.current)
    reflectionSaveTimer.current = setTimeout(async () => {
      await saveMissionStateWithUpsert({ ...missionState, reflection: value })
    }, 1000)
  }

  const saveMissionStateWithUpsert = async (state: MissionState) => {
    if (!user || !mission) return
    try {
      const { data: currentData } = await supabase
        .from('program_progress')
        .select('mission_responses')
        .eq('user_id', user.id)
        .single()
      
      let updatedResponses = currentData?.mission_responses || []
      const newResponse = {
        day: mission.day,
        mission: mission.title,
        response: state.reflection,
        completedTasks: state.completedTasks,
        isCompleted: state.isCompleted,
        timestamp: new Date().toISOString()
      }
      const existingIndex = updatedResponses.findIndex((r: any) => r.day === mission.day)
      if (existingIndex >= 0) {
        updatedResponses[existingIndex] = newResponse
      } else {
        updatedResponses.push(newResponse)
      }
      await supabase
        .from('program_progress')
        .update({ mission_responses: updatedResponses, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
    }
  }

  // ─── MISSION COMPLETE avec mise à jour Tracker ─────────────────────────────
  const handleMissionComplete = async () => {
    if (!missionState.reflection.trim()) return

    const completedState = { ...missionState, isCompleted: true }
    setMissionState(completedState)
    await saveMissionStateWithUpsert(completedState)

    const displayedDay = selectedDay || mission?.day
    if (displayedDay === currentDay) {
      const nextDay = Math.min(currentDay + 1, 90)
      await setSupabaseDay(nextDay)

      // Mettre à jour completed_missions et streak_days pour le Tracker
      if (user) {
        const { data: prog } = await supabase
          .from('program_progress')
          .select('completed_missions, streak_days, last_access_date')
          .eq('user_id', user.id)
          .single()

        if (prog) {
          const today = new Date().toISOString().split('T')[0]
          const lastDate = prog.last_access_date ? prog.last_access_date.split('T')[0] : null
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
          const newStreak = (lastDate === yesterday || lastDate === today)
            ? (prog.streak_days || 0) + 1
            : 1

          await supabase
            .from('program_progress')
            .update({
              completed_missions: (prog.completed_missions || 0) + 1,
              streak_days: newStreak,
              last_access_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id)
        }
      }

      setSelectedDay(null)
    }

    setMissionState({ completedTasks: [], reflection: '', isCompleted: false })
  }

  const progressPercentage = mission?.tasks 
    ? Math.round((missionState.completedTasks.length / mission.tasks.length) * 100)
    : 0
  const canCompleteMission = missionState.reflection.trim() !== ''
  const globalProgressPercentage = Math.round((currentDay / 90) * 100)

  const saveMissionState = async (state: MissionState) => {
    try {
      const response = {
        day: currentDay,
        mission: mission?.title || '',
        completedTasks: state.completedTasks,
        reflection: state.reflection,
        timestamp: new Date().toISOString(),
        isCompleted: state.isCompleted
      }
      await addMissionResponse(response)
    } catch (error) {
      console.error('Erreur sauvegarde état mission:', error)
    }
  }

  const handleReset = async () => {
    if (!user) return
    try {
      await supabase
        .from('program_progress')
        .update({
          mission_responses: [],
          completed_missions: 0,
          streak_days: 0,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
      await setSupabaseDay(1)
      setSelectedDay(null)
      setMissionState({ completedTasks: [], reflection: '', isCompleted: false })
      const firstMission = missionsData.find(m => m.day === 1)
      if (firstMission) setMission(firstMission)
    } catch (error) {
      console.error('Erreur réinitialisation:', error)
    }
  }

  const loadSpecificDay = async (day: number) => {
    if (day > currentDay) return
    const specificMission = missionsData.find(m => m.day === day)
    if (specificMission) {
      setMission(specificMission)
      setSelectedDay(day)
      if (user) {
        try {
          const { data } = await supabase
            .from('program_progress')
            .select('mission_responses')
            .eq('user_id', user.id)
            .single()
          if (data?.mission_responses) {
            const dayResponse = data.mission_responses.find((r: any) => Number(r.day) === Number(day) && r.isCompleted === true) 
              || data.mission_responses.find((r: any) => Number(r.day) === Number(day))
            if (dayResponse) {
              setMissionState({
                completedTasks: dayResponse.completedTasks || [],
                reflection: dayResponse.response || '',
                isCompleted: dayResponse.isCompleted || false
              })
            } else {
              setMissionState({ completedTasks: [], reflection: '', isCompleted: false })
            }
          } else {
            setMissionState({ completedTasks: [], reflection: '', isCompleted: false })
          }
        } catch (error) {
          setMissionState({ completedTasks: [], reflection: '', isCompleted: false })
        }
      }
    }
  }

  const getDayStatus = (day: number) => {
    if (day === currentDay) return 'current'
    if (day < currentDay) return 'completed'
    return 'future'
  }

  const getDayStyle = (day: number) => {
    const status = getDayStatus(day)
    switch (status) {
      case 'current':   return 'text-white cursor-pointer hover:opacity-90'
      case 'completed': return 'text-white cursor-pointer hover:opacity-90'
      case 'future':    return 'bg-gray-200 text-gray-400 cursor-not-allowed'
      default:          return 'bg-gray-100 text-gray-300'
    }
  }

  const getDayInlineStyle = (day: number): React.CSSProperties => {
    const status = getDayStatus(day)
    if (status === 'current') return { background: '#7B6FA0' }
    if (status === 'completed') return { background: '#C4956A' }
    return {}
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-novae-cream flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-2xl text-novae-anthracite mb-4">Chargement...</div>
          <div className="text-novae-anthracite/60">Initialisation de Novae</div>
        </div>
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-novae-cream p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-serif text-novae-anthracite mb-4">Programme 90 Jours</h1>
            {mission?.phase && (
              <div className="mb-4">
                <span className="px-4 py-2 text-white rounded-full text-lg font-medium" style={{background:"#7B6FA0"}}>
                  {mission.phase}
                </span>
              </div>
            )}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-novae-anthracite/70 mb-2">
                <span>Jour {currentDay} sur 90</span>
                <span>{globalProgressPercentage}%</span>
              </div>
              <div className="w-full bg-novae-beige/30 rounded-full h-3">
                <div className="h-3 rounded-full transition-all duration-500" style={{background:"#C4956A", width: `${globalProgressPercentage}%`}} />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-center mb-8">
            <Link href="/" className="flex items-center gap-2 px-6 py-3 text-white rounded-lg hover:opacity-90 transition-colors" style={{background:"#C4956A"}}>
              Accueil
            </Link>
          </div>

          {/* Mission du jour */}
          {mission && (
            <div className="card mb-8">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-serif text-novae-anthracite">{mission.title}</h2>
                  <span className="px-3 py-1 rounded-full text-sm font-medium" style={{background:"rgba(196,149,106,0.15)", color:"#C4956A"}}>{mission.phase}</span>
                </div>
                <p className="text-novae-anthracite/70 mb-6">{mission.guide}</p>

                {/* Progression */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-novae-anthracite/70 mb-2">
                    <span>Progression de la mission</span>
                    <span>{progressPercentage}%</span>
                  </div>
                  <div className="w-full bg-novae-beige/30 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-300" style={{background:"#C4956A", width: `${progressPercentage}%`}} />
                  </div>
                </div>

                {/* Tâches */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-novae-anthracite mb-4">Tâches à accomplir</h3>
                  <div className="space-y-3">
                    {mission?.tasks?.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 bg-novae-beige/10 rounded-lg">
                        <input
                          type="checkbox"
                          id={`task-${task.id}`}
                          checked={missionState.completedTasks.includes(task.id)}
                          onChange={() => handleTaskToggle(task.id)}
                          className="w-5 h-5 border-novae-beige/30 rounded" style={{accentColor:"#C4956A"}}
                        />
                        <label htmlFor={`task-${task.id}`} className="flex-1 text-novae-anthracite cursor-pointer">
                          {task.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Réflexion */}
                <div className="mb-6">
                  <label className="block text-lg font-semibold text-novae-anthracite mb-3">
                    {mission?.reflection?.question}
                  </label>
                  <textarea
                    value={missionState.reflection}
                    onChange={(e) => handleReflectionChange(e.target.value)}
                    className="w-full px-4 py-3 border border-novae-beige/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-novae-gold/50 resize-none"
                    rows={4}
                    placeholder={mission?.reflection?.placeholder}
                  />
                  {!missionState.reflection.trim() && (
                    <p className="text-sm text-novae-anthracite/50 mt-2">La réflexion est obligatoire pour compléter la mission</p>
                  )}
                </div>

                <button
                  onClick={handleMissionComplete}
                  disabled={!canCompleteMission}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    canCompleteMission ? 'bg-novae-gold text-white hover:bg-novae-gold/80' : 'bg-novae-beige/30 text-novae-anthracite/50 cursor-not-allowed'
                  }`}
                >
                  Mission complétée ✓
                </button>
              </div>
            </div>
          )}

          {/* Agent NOVAÉ */}
          <div className="card">
            <h2 className="text-2xl font-serif text-novae-anthracite mb-6">Agent NOVAÉ</h2>
            <form onSubmit={async (e) => {
              e.preventDefault()
              if (!chatMessage.trim() || chatLoading) return
              setChatLoading(true)
              setChatResponse("")
              try {
                const response = await fetch('/api/chat', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: chatMessage, context: `Jour ${currentDay} - Mission: ${mission?.title}`, missionGuide: mission?.guide || '' })
                })
                const data = await response.json()
                if (data.response) setChatResponse(data.response)
              } catch (error) {
                setChatResponse("Désolé, une erreur est survenue. Veuillez réessayer.")
              } finally {
                setChatLoading(false)
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-novae-anthracite mb-2">Posez votre question à NOVAÉ :</label>
                <textarea
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="w-full px-4 py-3 border border-novae-beige/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-novae-gold/50 resize-none"
                  rows={3}
                  placeholder="Comment puis-je vous aider pour votre mission du jour ?"
                />
              </div>
              <button type="submit" disabled={chatLoading || !chatMessage.trim()} className="w-full py-3 rounded-lg font-medium text-white hover:opacity-90 transition-colors" style={{background:"#C4956A"}}>
                {chatLoading ? 'Réflexion en cours...' : 'Envoyer'}
              </button>
            </form>
            {chatResponse && (
              <div className="mt-6 p-4 bg-novae-beige/20 rounded-lg">
                <h3 className="font-medium text-novae-anthracite mb-2">Réponse de NOVAÉ :</h3>
                <p className="text-novae-anthracite/70 whitespace-pre-line">{chatResponse}</p>
              </div>
            )}
          </div>

          {/* Grille 90 jours */}
          <div className="card mt-8">
            <h3 className="text-xl font-serif text-novae-anthracite mb-6">Navigation 90 Jours</h3>
            <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-18 gap-2">
              {Array.from({ length: 90 }, (_, i) => i + 1).map((day) => {
                const status = getDayStatus(day)
                const isClickable = status !== 'future'
                return (
                  <button
                    key={day}
                    onClick={() => isClickable && loadSpecificDay(day)}
                    disabled={!isClickable}
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 flex items-center justify-center ${getDayStyle(day)} ${isClickable ? 'transform hover:scale-105' : ''}`}
                    style={getDayInlineStyle(day)}
                    title={`Jour ${day}`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-6 text-sm">
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded" style={{background:"#7B6FA0"}}></div><span className="text-novae-anthracite/70">Jour actuel</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded" style={{background:"#C4956A"}}></div><span className="text-novae-anthracite/70">Terminé</span></div>
              <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-200 rounded"></div><span className="text-novae-anthracite/70">Futur</span></div>
            </div>
          </div>

          {/* Reset */}
          <div className="card mt-8">
            <div className="text-center">
              <button
                onClick={() => {
                  if (window.confirm('Êtes-vous sûr de vouloir recommencer depuis le début ? Toute votre progression sera perdue.')) {
                    handleReset()
                  }
                }}
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                Recommencer depuis le début
              </button>
              <p className="text-sm text-novae-anthracite/50 mt-2">Cette action remettra le programme au jour 1 et effacera toutes vos réponses</p>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}