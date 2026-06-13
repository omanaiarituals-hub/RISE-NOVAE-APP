'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import Link from 'next/link'
import { DemoBanner } from '@/components/DemoBanner'
import Navigation from '@/components/Navigation'
import { logEvent } from '@/lib/events'

interface Note {
  id: string
  title: string
  content: string
  color: string
  pinned: boolean
  created_at: string
  updated_at: string
}

const NOTE_COLORS = [
  { value: '#FAF7F2', label: 'Crème' },
  { value: '#F9EDE8', label: 'Rose' },
  { value: '#E8EFF9', label: 'Bleu' },
  { value: '#E8F5EE', label: 'Vert' },
  { value: '#FBF0CC', label: 'Jaune' },
  { value: '#F5D0DC', label: 'Mauve' },
]

export default function NotesPage() {
  const { user, loading } = useSupabaseAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (user) loadNotes()
  }, [user])

  useEffect(() => {
  if (!user) return
  logEvent(supabase, user.id, 'module_programme')
}, [user])

  const loadNotes = async () => {
    if (!user) return
    setIsLoading(true)
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    setNotes(data || [])
    setIsLoading(false)
  }

  const createNote = async () => {
    if (!user) return
    const newNote = {
      user_id: user.id,
      title: '',
      content: '',
      color: '#FAF7F2',
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    const { data } = await supabase.from('notes').insert(newNote).select().single()
    if (data) {
      setNotes(prev => [data, ...prev])
      setActiveNote(data)
      setIsCreating(true)
    }
  }

  const updateNote = async (note: Note, field: 'title' | 'content' | 'color' | 'pinned', value: string | boolean) => {
    const updated = { ...note, [field]: value, updated_at: new Date().toISOString() }
    setActiveNote(updated)
    setNotes(prev => prev.map(n => n.id === note.id ? updated : n))

    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    setSaving(true)
    saveTimeout.current = setTimeout(async () => {
      await supabase.from('notes').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', note.id)
      setSaving(false)
    }, 800)
  }

  const deleteNote = async (id: string) => {
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
    if (activeNote?.id === id) setActiveNote(null)
  }

  const filteredNotes = notes.filter(n =>
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.content?.toLowerCase().includes(search.toLowerCase())
  )

  const pinned = filteredNotes.filter(n => n.pinned)
  const unpinned = filteredNotes.filter(n => !n.pinned)

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 1) return 'À l\'instant'
    if (minutes < 60) return `Il y a ${minutes}min`
    if (hours < 24) return `Il y a ${hours}h`
    if (days < 7) return `Il y a ${days}j`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  if (loading || isLoading) return (
    <div className="min-h-screen bg-novae-cream flex items-center justify-center">
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 bg-novae-gold rounded-full animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
        ))}
      </div>
    </div>
  )

  return (
    <>
      <DemoBanner />
      <div className="min-h-screen bg-novae-cream flex flex-col md:flex-row pb-24 md:pb-0">

        {/* SIDEBAR — liste des notes */}
        <div className={`${activeNote ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 md:min-h-screen bg-white border-r border-novae-beige/30`}>

          {/* Header */}
          <div className="px-4 py-4 border-b border-novae-beige/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Link href="/" className="text-novae-anthracite/40 hover:text-novae-anthracite transition-colors text-sm">←</Link>
                <h1 className="font-serif text-xl text-novae-anthracite">Notes</h1>
                <span className="text-xs text-novae-anthracite/40">{notes.length}</span>
              </div>
              <button
                onClick={createNote}
                className="w-8 h-8 bg-novae-anthracite text-white rounded-lg flex items-center justify-center hover:bg-novae-gold transition-colors text-lg font-light"
              >
                +
              </button>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Rechercher..."
              className="w-full px-3 py-2 bg-novae-cream border border-novae-beige/40 rounded-xl text-sm text-novae-anthracite placeholder-novae-anthracite/30 focus:outline-none focus:ring-1 focus:ring-novae-gold/30"
            />
          </div>

          {/* Liste */}
          <div className="flex-1 overflow-y-auto pb-24">
            {notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
                <div className="text-4xl mb-3">📝</div>
                <p className="text-novae-anthracite/50 text-sm mb-4">Aucune note pour l'instant</p>
                <button onClick={createNote} className="px-4 py-2 bg-novae-anthracite text-white rounded-xl text-sm hover:bg-novae-gold transition-colors">
                  Créer ma première note
                </button>
              </div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-xs font-medium text-novae-anthracite/40 uppercase tracking-wide">📌 Épinglées</p>
                    {pinned.map(note => <NoteItem key={note.id} note={note} active={activeNote?.id === note.id} onClick={() => setActiveNote(note)} />)}
                  </div>
                )}
                {unpinned.length > 0 && (
                  <div>
                    {pinned.length > 0 && <p className="px-4 pt-3 pb-1 text-xs font-medium text-novae-anthracite/40 uppercase tracking-wide">Toutes les notes</p>}
                    {unpinned.map(note => <NoteItem key={note.id} note={note} active={activeNote?.id === note.id} onClick={() => setActiveNote(note)} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ÉDITEUR */}
        {activeNote ? (
          <div className="flex-1 flex flex-col" style={{ background: activeNote.color }}>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-novae-beige/20 bg-white/60 backdrop-blur-sm">
              <button
                onClick={() => setActiveNote(null)}
                className="md:hidden text-novae-anthracite/50 hover:text-novae-anthracite transition-colors text-sm flex items-center gap-1"
              >
                ← Notes
              </button>

              <div className="flex gap-1 ml-auto items-center">
                {/* Couleurs */}
                {NOTE_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => updateNote(activeNote, 'color', c.value)}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      background: c.value,
                      borderColor: activeNote.color === c.value ? '#C8956C' : 'transparent'
                    }}
                    title={c.label}
                  />
                ))}

                {/* Épingler */}
                <button
                  onClick={() => updateNote(activeNote, 'pinned', !activeNote.pinned)}
                  className={`ml-2 px-2 py-1 rounded-lg text-xs transition-colors ${activeNote.pinned ? 'bg-novae-gold/20 text-novae-gold' : 'text-novae-anthracite/40 hover:text-novae-anthracite'}`}
                  title="Épingler"
                >
                  📌
                </button>

                {/* Supprimer */}
                <button
                  onClick={() => deleteNote(activeNote.id)}
                  className="ml-1 px-2 py-1 rounded-lg text-xs text-red-400 hover:bg-red-50 transition-colors"
                  title="Supprimer"
                >
                  🗑
                </button>

                {/* Statut sauvegarde */}
                <span className="ml-2 text-xs text-novae-anthracite/30">
                  {saving ? 'Sauvegarde...' : '✓ Sauvegardé'}
                </span>
              </div>
            </div>

            {/* Contenu */}
            <div className="flex-1 px-6 py-6 overflow-y-auto pb-24">
              <input
                value={activeNote.title || ''}
                onChange={e => updateNote(activeNote, 'title', e.target.value)}
                placeholder="Titre..."
                className="w-full bg-transparent font-serif text-2xl text-novae-anthracite placeholder-novae-anthracite/20 focus:outline-none mb-4"
                autoFocus={isCreating}
              />
              <div className="text-xs text-novae-anthracite/30 mb-4">
                {formatDate(activeNote.updated_at)}
              </div>
              <textarea
                value={activeNote.content || ''}
                onChange={e => updateNote(activeNote, 'content', e.target.value)}
                placeholder="Commence à écrire..."
                className="w-full bg-transparent text-sm text-novae-anthracite placeholder-novae-anthracite/30 focus:outline-none resize-none leading-relaxed"
                style={{ minHeight: '60vh' }}
              />
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center bg-novae-cream/50">
            <div className="text-center">
              <div className="text-5xl mb-4">📝</div>
              <p className="text-novae-anthracite/40 text-sm">Sélectionne une note ou crée-en une nouvelle</p>
              <button onClick={createNote} className="mt-4 px-4 py-2 bg-novae-anthracite text-white rounded-xl text-sm hover:bg-novae-gold transition-colors">
                + Nouvelle note
              </button>
            </div>
          </div>
        )}
      </div>
      <Navigation />
    </>
  )
}

function NoteItem({ note, active, onClick }: { note: Note; active: boolean; onClick: () => void }) {
  const preview = note.content?.replace(/\n/g, ' ').slice(0, 80) || ''
  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 1) return 'À l\'instant'
    if (minutes < 60) return `${minutes}min`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}j`
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-novae-beige/20 transition-colors ${active ? 'bg-novae-gold/10' : 'hover:bg-novae-cream/50'}`}
    >
      <div className="flex items-start gap-2">
        <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: note.color === '#FAF7F2' ? '#C8956C' : note.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-novae-anthracite truncate">
              {note.title || <span className="text-novae-anthracite/40 italic">Sans titre</span>}
            </p>
            <span className="text-xs text-novae-anthracite/30 flex-shrink-0">{formatDate(note.updated_at)}</span>
          </div>
          {preview && <p className="text-xs text-novae-anthracite/50 mt-0.5 truncate">{preview}</p>}
        </div>
      </div>
    </button>
  )
} 