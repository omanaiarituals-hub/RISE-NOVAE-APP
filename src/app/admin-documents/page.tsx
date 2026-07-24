'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { AdministrativeDocumentExtractedData } from '@/lib/admin-documents/types'

const MAX_ORIGINAL_DOCUMENT_BYTES = 15 * 1024 * 1024
const MAX_COMPRESSED_DOCUMENT_BYTES = 3 * 1024 * 1024
const DOCUMENT_IMAGE_MAX_DIMENSION = 1800

const DEFAULT_EVENT_START_MINUTES = 9 * 60
const DEFAULT_EVENT_END_MINUTES = 10 * 60

async function compressImageForAdminDocument(file: File): Promise<File> {
  if (file.size <= MAX_COMPRESSED_DOCUMENT_BYTES) {
    return file
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Le fichier sélectionné doit être une image.')
  }

  const imageUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error("Impossible de lire l'image sélectionnée."))
      img.src = imageUrl
    })

    const ratio = Math.min(
      1,
      DOCUMENT_IMAGE_MAX_DIMENSION / Math.max(image.width, image.height)
    )

    const width = Math.max(1, Math.round(image.width * ratio))
    const height = Math.max(1, Math.round(image.height * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error("Impossible de préparer l'image pour l'analyse.")
    }

    ctx.drawImage(image, 0, 0, width, height)

    const qualities = [0.82, 0.72, 0.62, 0.52]

    for (const quality of qualities) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', quality)
      })

      if (!blob) continue

      const compressedFile = new File(
        [blob],
        file.name.replace(/\.[^.]+$/, '') + '-novae-admin-scan.jpg',
        { type: 'image/jpeg', lastModified: Date.now() }
      )

      if (compressedFile.size <= MAX_COMPRESSED_DOCUMENT_BYTES) {
        return compressedFile
      }
    }

    throw new Error("L'image reste trop lourde après compression. Recadre le document puis réessaie.")
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function getTodayLocalISODate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function minutesToTimeValue(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mins = String(minutes % 60).padStart(2, '0')
  return `${hours}:${mins}`
}

function urgencyToPriority(urgency: AdministrativeDocumentExtractedData['urgency']) {
  if (urgency === 'critical' || urgency === 'high') return 'high'
  if (urgency === 'medium') return 'medium'
  return 'low'
}

function dueDateStatusLabel(status: AdministrativeDocumentExtractedData['due_date_status']) {
  if (status === 'overdue') return 'Échéance dépassée'
  if (status === 'today') return 'Échéance aujourd’hui'
  if (status === 'upcoming') return 'À venir'
  if (status === 'unknown') return 'Date incertaine'
  return 'Non détecté'
}

function dueDateStatusColor(status: AdministrativeDocumentExtractedData['due_date_status']) {
  if (status === 'overdue') return '#9F2525'
  if (status === 'today') return '#A65E12'
  if (status === 'upcoming') return '#2F7A4F'
  return '#6F625C'
}

function getEventDateForExtraction(extraction: AdministrativeDocumentExtractedData): string | null {
  if (extraction.due_date_status === 'overdue') {
    return getTodayLocalISODate()
  }

  return extraction.due_date || extraction.suggested_event_date
}

function getEventTitleForExtraction(extraction: AdministrativeDocumentExtractedData): string {
  const baseTitle =
    extraction.suggested_event_title ||
    extraction.suggested_task_title ||
    extraction.action_required ||
    extraction.title ||
    'Traiter un document administratif'

  if (extraction.due_date_status === 'overdue') {
    return `URGENT - traiter échéance dépassée : ${baseTitle}`
  }

  if (extraction.due_date_status === 'today') {
    return `URGENT - échéance aujourd’hui : ${baseTitle}`
  }

  return `Échéance administrative : ${baseTitle}`
}

export default function AdminDocumentsTestPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [compressedSize, setCompressedSize] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<AdministrativeDocumentExtractedData | null>(null)

  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)
  const [taskMessage, setTaskMessage] = useState<string | null>(null)

  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  const [createdEventId, setCreatedEventId] = useState<string | null>(null)
  const [eventMessage, setEventMessage] = useState<string | null>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    setSelectedFile(file)
    setCompressedSize(null)
    setError(null)
    setExtraction(null)
    setCreatedTaskId(null)
    setTaskMessage(null)
    setCreatedEventId(null)
    setEventMessage(null)

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Pour cette première version, choisis une image.')
      return
    }

    if (file.size > MAX_ORIGINAL_DOCUMENT_BYTES) {
      setError('Image trop lourde. Choisis une photo de moins de 15 MB.')
      return
    }
  }

  const handleExtract = async () => {
    if (!selectedFile) {
      setError('Ajoute une photo de courrier avant de lancer le test.')
      return
    }

    setIsScanning(true)
    setError(null)
    setExtraction(null)
    setCompressedSize(null)
    setCreatedTaskId(null)
    setTaskMessage(null)
    setCreatedEventId(null)
    setEventMessage(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        throw new Error('Session introuvable. Déconnecte-toi puis reconnecte-toi avant de relancer le scan.')
      }

      const documentForExtraction = await compressImageForAdminDocument(selectedFile)
      setCompressedSize(formatBytes(documentForExtraction.size))

      const formData = new FormData()
      formData.append('document', documentForExtraction)

      const response = await fetch('/api/admin-documents/extract', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || "L'extraction a échoué.")
      }

      setExtraction(payload.extraction)
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Erreur inconnue pendant le scan.')
    } finally {
      setIsScanning(false)
    }
  }

  const handleCreateTask = async () => {
    if (!extraction) {
      setError('Aucune extraction disponible pour créer une tâche.')
      return
    }

    const baseTitle =
      extraction.suggested_task_title ||
      extraction.action_required ||
      extraction.title ||
      'Traiter un document administratif'

    const title = extraction.due_date_status === 'overdue'
      ? `URGENT - échéance dépassée : ${baseTitle}`
      : baseTitle

    setIsCreatingTask(true)
    setError(null)
    setTaskMessage(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Session introuvable. Reconnecte-toi avant de créer la tâche.')
      }

      const { data, error: insertError } = await supabase
        .from('todo_list')
        .insert({
          user_id: user.id,
          title,
          priority: extraction.due_date_status === 'overdue'
            ? 'high'
            : urgencyToPriority(extraction.urgency),
          status: 'pending',
        })
        .select('id')
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      setCreatedTaskId(data.id)
      setTaskMessage('Tâche créée dans ta to-do. Tu peux la retrouver dans le planner.')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Impossible de créer la tâche.')
    } finally {
      setIsCreatingTask(false)
    }
  }

  const handleCreateEvent = async () => {
    if (!extraction) {
      setError('Aucune extraction disponible pour créer une échéance.')
      return
    }

    const eventDate = getEventDateForExtraction(extraction)

    if (!eventDate) {
      setError("Aucune date fiable n'a été détectée. Crée d'abord une tâche, puis ajoute une échéance manuellement.")
      return
    }

    const eventTitle = getEventTitleForExtraction(extraction)
    const startTime = minutesToTimeValue(DEFAULT_EVENT_START_MINUTES)
    const endTime = minutesToTimeValue(DEFAULT_EVENT_END_MINUTES)

    setIsCreatingEvent(true)
    setError(null)
    setEventMessage(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error('Session introuvable. Reconnecte-toi avant de créer l’échéance.')
      }

      const { data, error: insertError } = await supabase
        .from('planner_events')
        .insert({
          user_id: user.id,
          title: eventTitle,
          start_date: `${eventDate}T${startTime}:00`,
          end_date: `${eventDate}T${endTime}:00`,
          start_minutes: DEFAULT_EVENT_START_MINUTES,
          end_minutes: DEFAULT_EVENT_END_MINUTES,
          category: 'pro',
          recurrence_days: [],
          reminder_minutes_before: [],
          reminder_sent: false,
        })
        .select('id')
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      setCreatedEventId(data.id)

      if (extraction.due_date_status === 'overdue') {
        setEventMessage("Rappel créé aujourd’hui dans le planner pour traiter cette échéance dépassée.")
      } else {
        setEventMessage('Échéance ajoutée dans le planner.')
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Impossible de créer l’échéance.")
    } finally {
      setIsCreatingEvent(false)
    }
  }

  const eventButtonLabel = (() => {
    if (createdEventId) return 'Échéance créée'
    if (isCreatingEvent) return 'Création...'
    if (!extraction) return 'Ajouter l’échéance'

    if (extraction.due_date_status === 'overdue') {
      return 'Créer un rappel aujourd’hui'
    }

    return 'Ajouter l’échéance'
  })()

  const eventDatePreview = extraction ? getEventDateForExtraction(extraction) : null

  return (
    <main style={{
      minHeight: '100vh',
      background: '#FBF7F2',
      padding: '32px 16px',
      color: '#2B2320',
    }}>
      <section style={{
        maxWidth: 880,
        margin: '0 auto',
        background: '#FFFFFF',
        border: '1px solid #EADDD2',
        borderRadius: 24,
        padding: 24,
        boxShadow: '0 18px 45px rgba(55, 35, 25, 0.08)',
      }}>
        <p style={{
          margin: '0 0 8px',
          fontSize: 13,
          color: '#9A6A5B',
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}>
          Test interne NOVAÉ
        </p>

        <h1 style={{
          margin: '0 0 12px',
          fontSize: 30,
          lineHeight: 1.15,
          color: '#4A1F1B',
        }}>
          Scan administratif
        </h1>

        <p style={{
          margin: '0 0 24px',
          color: '#6F625C',
          fontSize: 15,
          lineHeight: 1.6,
        }}>
          Cette page teste l’extraction IA. Le document n’est pas enregistré.
          Une tâche ou une échéance peut être créée seulement après validation manuelle.
        </p>

        <div style={{
          border: '1px dashed #D8B9A8',
          borderRadius: 18,
          padding: 20,
          background: '#FFF9F5',
          marginBottom: 20,
        }}>
          <label style={{
            display: 'block',
            fontWeight: 700,
            marginBottom: 10,
            color: '#4A1F1B',
          }}>
            Photo du document administratif
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isScanning}
          />

          {selectedFile && (
            <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6F625C' }}>
              Fichier sélectionné : {selectedFile.name} — {formatBytes(selectedFile.size)}
              {compressedSize ? ` — compressé à ${compressedSize}` : ''}
            </p>
          )}

          <button
            type="button"
            onClick={handleExtract}
            disabled={!selectedFile || isScanning}
            style={{
              marginTop: 18,
              border: 'none',
              borderRadius: 999,
              padding: '12px 18px',
              background: isScanning || !selectedFile ? '#D7C8BE' : '#7A2E2A',
              color: 'white',
              fontWeight: 700,
              cursor: isScanning || !selectedFile ? 'not-allowed' : 'pointer',
            }}
          >
            {isScanning ? 'Analyse en cours...' : 'Tester l’extraction'}
          </button>
        </div>

        {error && (
          <div style={{
            border: '1px solid #F1B5B5',
            background: '#FFF1F1',
            color: '#8A2525',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        {extraction && (
          <section style={{
            border: '1px solid #EADDD2',
            borderRadius: 18,
            padding: 20,
            background: '#FFFFFF',
          }}>
            <h2 style={{ margin: '0 0 16px', color: '#4A1F1B', fontSize: 22 }}>
              Résultat détecté
            </h2>

            {extraction.due_date_status === 'overdue' && (
              <div style={{
                border: '1px solid #E7A5A5',
                background: '#FFF1F1',
                color: '#8A2525',
                borderRadius: 16,
                padding: 16,
                marginBottom: 18,
              }}>
                <strong>Échéance dépassée détectée.</strong>
                <p style={{ margin: '8px 0 0', lineHeight: 1.55 }}>
                  Nova a repéré une date limite antérieure à aujourd’hui. Il faut vérifier rapidement
                  la situation officielle du dossier. Si le document concerne une amende, une facture
                  ou une pénalité, un montant majoré peut être possible selon le dossier.
                </p>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 18,
            }}>
              <Info label="Titre" value={extraction.title} />
              <Info label="Type" value={extraction.document_type} />
              <Info label="Expéditeur" value={extraction.sender} />
              <Info label="Date limite" value={extraction.due_date} />
              <Info
                label="Statut échéance"
                value={dueDateStatusLabel(extraction.due_date_status)}
                color={dueDateStatusColor(extraction.due_date_status)}
              />
              <Info label="Date proposée planner" value={eventDatePreview} />
              <Info label="Montant" value={extraction.amount === null ? null : `${extraction.amount} €`} />
              <Info label="Urgence" value={extraction.urgency} />
              <Info label="Confiance IA" value={`${Math.round(extraction.confidence * 100)} %`} />
            </div>

            <Block title="Résumé" value={extraction.summary} />
            <Block title="Action proposée" value={extraction.action_required} />
            <Block title="Prochaine action recommandée" value={extraction.recommended_next_step} />
            <Block title="Tâche suggérée" value={extraction.suggested_task_title} />
            <Block title="Description de tâche" value={extraction.suggested_task_description} />
            <Block title="Échéance suggérée" value={extraction.suggested_event_date} />

            {extraction.missing_information.length > 0 && (
              <ListBlock title="Informations manquantes" items={extraction.missing_information} />
            )}

            {extraction.warnings.length > 0 && (
              <ListBlock title="Points à vérifier" items={extraction.warnings} />
            )}

            <div style={{
              marginTop: 22,
              border: '1px solid #D8B9A8',
              background: '#FFF9F5',
              borderRadius: 18,
              padding: 18,
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#4A1F1B' }}>
                Validation utilisateur requise
              </h3>

              <p style={{ margin: '0 0 14px', color: '#5D504B', lineHeight: 1.55 }}>
                Nova a analysé le document. Rien n’est ajouté sans ton action.
              </p>

              <ul style={{ margin: '0 0 16px', paddingLeft: 20, color: '#5D504B', lineHeight: 1.6 }}>
                <li>{createdTaskId ? 'Une tâche a été créée après validation' : 'Aucune tâche créée'}</li>
                <li>{createdEventId ? 'Une échéance a été ajoutée au planner après validation' : 'Aucune échéance ajoutée au planner'}</li>
                <li>Aucun rappel automatique programmé</li>
                <li>Aucun document enregistré en base</li>
              </ul>

              {extraction.due_date_status === 'overdue' && !createdEventId && (
                <p style={{
                  margin: '0 0 14px',
                  color: '#8A2525',
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}>
                  L’échéance détectée est déjà dépassée : Nova ne va pas créer un événement dans le passé.
                  Le bouton va créer un rappel aujourd’hui pour traiter ce dossier.
                </p>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={isCreatingTask || Boolean(createdTaskId)}
                  style={{
                    border: 'none',
                    borderRadius: 999,
                    padding: '11px 16px',
                    background: isCreatingTask || createdTaskId ? '#D7C8BE' : '#7A2E2A',
                    color: 'white',
                    fontWeight: 700,
                    cursor: isCreatingTask || createdTaskId ? 'not-allowed' : 'pointer',
                  }}
                >
                  {createdTaskId
                    ? 'Tâche créée'
                    : isCreatingTask
                      ? 'Création...'
                      : 'Créer la tâche'}
                </button>

                <button
                  type="button"
                  onClick={handleCreateEvent}
                  disabled={isCreatingEvent || Boolean(createdEventId)}
                  style={{
                    border: '1px solid #D7C8BE',
                    borderRadius: 999,
                    padding: '11px 16px',
                    background: isCreatingEvent || createdEventId ? '#F0E7DF' : 'white',
                    color: isCreatingEvent || createdEventId ? '#9A6A5B' : '#7A2E2A',
                    fontWeight: 700,
                    cursor: isCreatingEvent || createdEventId ? 'not-allowed' : 'pointer',
                  }}
                >
                  {eventButtonLabel}
                </button>
              </div>

              {taskMessage && (
                <p style={{
                  margin: '14px 0 0',
                  color: '#2F7A4F',
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}>
                  {taskMessage}
                </p>
              )}

              {eventMessage && (
                <p style={{
                  margin: '10px 0 0',
                  color: '#2F7A4F',
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}>
                  {eventMessage}
                </p>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

function Info({
  label,
  value,
  color,
}: {
  label: string
  value: string | number | null
  color?: string
}) {
  return (
    <div style={{
      border: '1px solid #EFE2D8',
      borderRadius: 14,
      padding: 12,
      background: '#FFFCFA',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: '#9A6A5B', fontWeight: 700 }}>
        {label}
      </p>
      <p style={{ margin: 0, color: color || '#2B2320', fontWeight: color ? 700 : 400 }}>
        {value || 'Non détecté'}
      </p>
    </div>
  )
}

function Block({ title, value }: { title: string; value: string | null }) {
  if (!value) return null

  return (
    <div style={{ marginTop: 14 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, color: '#4A1F1B' }}>
        {title}
      </h3>
      <p style={{ margin: 0, color: '#5D504B', lineHeight: 1.55 }}>
        {value}
      </p>
    </div>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 14 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, color: '#4A1F1B' }}>
        {title}
      </h3>
      <ul style={{ margin: 0, paddingLeft: 20, color: '#5D504B', lineHeight: 1.55 }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}