'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

// Images esthétiques Unsplash (libres, style NOVAÉ)
const AESTHETIC_IMAGES = [
  'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&q=80', // vases beige minimaliste
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', // fleurs roses douces
  'https://images.unsplash.com/photo-1616486029423-aaa4789e8c9a?w=800&q=80', // intérieur beige
  'https://images.unsplash.com/photo-1602024242516-fbc9d4fda4b6?w=800&q=80', // carnet & stylo doré
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80', // zen minimaliste
  'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80', // carnet ouvert lumière
  'https://images.unsplash.com/photo-1484980972926-edee96e0960d?w=800&q=80', // petit-déjeuner aesthetic
]

// Citations d'inspiration rotatives
const CITATIONS = [
  { text: "Chaque jour est une nouvelle page.", auteur: "NOVAÉ" },
  { text: "La discipline, c'est te choisir toi, encore.", auteur: "NOVAÉ" },
  { text: "Tu construis en silence ce que le monde verra demain.", auteur: "NOVAÉ" },
  { text: "Le changement commence dans l'espace entre deux respirations.", auteur: "NOVAÉ" },
  { text: "Avancer, même lentement, c'est ne pas reculer.", auteur: "NOVAÉ" },
  { text: "Ta routine est ta révolution silencieuse.", auteur: "NOVAÉ" },
  { text: "Ce que tu nourris chaque jour finit par te nourrir.", auteur: "NOVAÉ" },
]

interface Todo {
  id: string
  text: string
  completed: boolean
  priority: string
  due_date?: string
}

export function HomeAestheticBanner() {
  const { user } = useSupabaseAuth()
  const [todayTodos, setTodayTodos] = useState<Todo[]>([])
  const [imageIndex, setImageIndex] = useState(0)
  const [citationIndex, setCitationIndex] = useState(0)

  useEffect(() => {
    // Image et citation basées sur le jour
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
    setImageIndex(dayOfYear % AESTHETIC_IMAGES.length)
    setCitationIndex(dayOfYear % CITATIONS.length)

    if (user) loadTodayTodos()
  }, [user])

  const loadTodayTodos = async () => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .eq('due_date', today)
      .order('priority', { ascending: true })
      .limit(4)
    setTodayTodos(data || [])
  }

  const toggleTodo = async (todo: Todo) => {
    await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id)
    setTodayTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))
  }

  const citation = CITATIONS[citationIndex]
  const completedCount = todayTodos.filter(t => t.completed).length

  return (
    <div className="mx-4 mb-4 rounded-3xl overflow-hidden shadow-sm" style={{ border: '1px solid rgba(196,149,106,0.15)' }}>
      
      {/* Image esthétique avec citation overlay */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={AESTHETIC_IMAGES[imageIndex]}
          alt="inspiration du jour"
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.88) saturate(0.9)' }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(26,20,15,0.55) 100%)'
        }} />
        {/* Citation */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '15px',
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.92)',
            lineHeight: 1.4,
            letterSpacing: '0.01em'
          }}>
            "{citation.text}"
          </p>
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: 4, letterSpacing: '0.15em' }}>
            — {citation.auteur}
          </p>
        </div>
      </div>

      {/* Aperçu Planner du jour */}
      <div style={{ background: '#FDFAF7', padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>📋</span>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: 600,
              color: '#1A1A1A',
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}>
              Aujourd'hui
            </span>
            {todayTodos.length > 0 && (
              <span style={{
                fontSize: '10px',
                background: completedCount === todayTodos.length ? 'rgba(76,175,80,0.15)' : 'rgba(196,149,106,0.15)',
                color: completedCount === todayTodos.length ? '#4CAF50' : '#C4956A',
                padding: '2px 7px',
                borderRadius: 20,
                fontWeight: 600
              }}>
                {completedCount}/{todayTodos.length}
              </span>
            )}
          </div>
          <Link href="/planner" style={{
            fontSize: '11px',
            color: '#C4956A',
            textDecoration: 'none',
            fontWeight: 500,
            letterSpacing: '0.05em'
          }}>
            Voir tout →
          </Link>
        </div>

        {todayTodos.length === 0 ? (
          <Link href="/planner" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'rgba(196,149,106,0.06)',
              borderRadius: 12,
              border: '1px dashed rgba(196,149,106,0.25)'
            }}>
              <span style={{ fontSize: 16 }}>✨</span>
              <span style={{ fontSize: 12, color: 'rgba(26,26,26,0.45)', fontStyle: 'italic' }}>
                Planifie ta journée dans le Planner
              </span>
            </div>
          </Link>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {todayTodos.map(todo => (
              <div
                key={todo.id}
                onClick={() => toggleTodo(todo)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: todo.completed ? 'rgba(76,175,80,0.05)' : 'rgba(196,149,106,0.05)',
                  borderRadius: 10,
                  border: `1px solid ${todo.completed ? 'rgba(76,175,80,0.15)' : 'rgba(196,149,106,0.12)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {/* Checkbox custom */}
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: `2px solid ${todo.completed ? '#4CAF50' : '#C4956A'}`,
                  background: todo.completed ? '#4CAF50' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.2s'
                }}>
                  {todo.completed && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{
                  fontSize: '12.5px',
                  color: todo.completed ? 'rgba(26,26,26,0.35)' : '#1A1A1A',
                  textDecoration: todo.completed ? 'line-through' : 'none',
                  flex: 1,
                  transition: 'all 0.2s'
                }}>
                  {todo.text}
                </span>
                {/* Priorité dot */}
                {todo.priority === 'high' && !todo.completed && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#E57373', flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}