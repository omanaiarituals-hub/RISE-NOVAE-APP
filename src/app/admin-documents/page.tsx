'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { AdministrativeDocumentExtractedData } from '@/lib/admin-documents/types'

const MAX_ORIGINAL_DOCUMENT_BYTES = 15 * 1024 * 1024
const MAX_ORIGINAL_PDF_BYTES = 5 * 1024 * 1024
const MAX_COMPRESSED_DOCUMENT_BYTES = 3 * 1024 * 1024
const DOCUMENT_IMAGE_MAX_DIMENSION = 1800

const DEFAULT_EVENT_START_MINUTES = 9 * 60
const DEFAULT_EVENT_END_MINUTES = 10 * 60

type ExtractionApiResponse = {
  success?: boolean
  extraction?: AdministrativeDocumentExtractedData
  error?: string
  notice?: string
}

type SaveApiResponse = {
  success?: boolean
  documentId?: string
  storagePath?: string
  message?: string
  error?: string
}

type SavedAdministrativeDocument = {
  id: string
  title: string | null
  document_type: string | null
  sender: string | null
  due_date: string | null
  due_date_status: string | null
  amount: number | null
  currency: string | null
  created_at: string
}

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

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
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

  const [isSavingDocument, setIsSavingDocument] = useState(false)
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const [savedDocuments, setSavedDocuments] = useState<SavedAdministrativeDocument[]>([])
const [isLoadingSavedDocuments, setIsLoadingSavedDocuments] = useState(false)
const [savedDocumentsError, setSavedDocumentsError] = useState<string | null>(null)

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

    setSavedDocumentId(null)
    setSaveMessage(null)

    if (!file) return

    if (!isImageFile(file) && !isPdfFile(file)) {
      setError('Pour cette version, choisis une image ou un PDF texte.')
      return
    }

    if (isImageFile(file) && file.size > MAX_ORIGINAL_DOCUMENT_BYTES) {
      setError('Image trop lourde. Choisis une photo de moins de 15 MB.')
      return
    }

    if (isPdfFile(file) && file.size > MAX_ORIGINAL_PDF_BYTES) {
      setError('PDF trop lourd. Choisis un PDF de moins de 5 MB.')
      return
    }
  }

  const loadSavedDocuments = async () => {
  setIsLoadingSavedDocuments(true)
  setSavedDocumentsError(null)

  useEffect(() => {
  loadSavedDocuments()
}, [])

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      setSavedDocuments([])
      return
    }

    const { data, error: queryError } = await supabase
      .from('administrative_documents')
      .select('id, title, document_type, sender, due_date, due_date_status, amount, currency, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (queryError) {
      throw new Error(queryError.message)
    }

    setSavedDocuments((data || []) as SavedAdministrativeDocument[])
  } catch (loadError) {
    setSavedDocumentsError(
      loadError instanceof Error
        ? loadError.message
        : 'Impossible de charger les documents enregistrés.'
    )
  } finally {
    setIsLoadingSavedDocuments(false)
  }
}

  const handleExtract = async () => {
    if (!selectedFile) {
      setError('Ajoute une photo ou un PDF avant de lancer l’analyse.')
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

    setSavedDocumentId(null)
    setSaveMessage(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        throw new Error('Session introuvable. Déconnecte-toi puis reconnecte-toi avant de relancer le scan.')
      }

      const documentForExtraction = isPdfFile(selectedFile)
        ? selectedFile
        : await compressImageForAdminDocument(selectedFile)

      setCompressedSize(
        isPdfFile(documentForExtraction)
          ? null
          : formatBytes(documentForExtraction.size)
      )

      const formData = new FormData()
      formData.append('document', documentForExtraction)

      const response = await fetch('/api/admin-documents/extract', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })

      const responseText = await response.text()

      let payload: ExtractionApiResponse
      try {
        payload = JSON.parse(responseText) as ExtractionApiResponse
      } catch {
        throw new Error(
          "Le serveur n'a pas retourné une réponse lisible. Le PDF a peut-être provoqué une erreur d'analyse. Réessaie avec un PDF texte simple ou une image du document."
        )
      }

      if (!response.ok) {
        throw new Error(payload.error || "L'extraction a échoué.")
      }

      if (!payload.extraction) {
        throw new Error("L'analyse n'a pas retourné de résultat exploitable.")
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

  const handleSaveDocument = async () => {
    if (!selectedFile || !extraction) {
      setError('Analyse un document avant de l’enregistrer.')
      return
    }

    setIsSavingDocument(true)
    setError(null)
    setSaveMessage(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        throw new Error('Session introuvable. Reconnecte-toi avant d’enregistrer le document.')
      }

      const documentForSave = isPdfFile(selectedFile)
        ? selectedFile
        : await compressImageForAdminDocument(selectedFile)

      const formData = new FormData()
      formData.append('document', documentForSave)
      formData.append('extraction', JSON.stringify(extraction))

      if (createdTaskId) {
        formData.append('linkedTodoId', createdTaskId)
      }

      if (createdEventId) {
        formData.append('linkedPlannerEventId', createdEventId)
      }

      const response = await fetch('/api/admin-documents/save', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })

      const responseText = await response.text()

      let payload: SaveApiResponse
      try {
        payload = JSON.parse(responseText) as SaveApiResponse
      } catch {
        throw new Error("Le serveur n'a pas retourné une réponse lisible pendant l'enregistrement.")
      }

      if (!response.ok) {
        throw new Error(payload.error || "L'enregistrement du document a échoué.")
      }

      if (!payload.documentId) {
        throw new Error("Le document semble enregistré, mais l'identifiant est manquant.")
      }

      setSavedDocumentId(payload.documentId)
setSaveMessage(payload.message || 'Document enregistré dans ton espace sécurisé.')
await loadSavedDocuments()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d'enregistrer le document.")
    } finally {
      setIsSavingDocument(false)
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

  const saveButtonLabel = (() => {
    if (savedDocumentId) return 'Document enregistré'
    if (isSavingDocument) return 'Enregistrement...'
    return 'Enregistrer ce document'
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
          Assistant administratif
        </p>

        <h1 style={{
          margin: '0 0 12px',
          fontSize: 30,
          lineHeight: 1.15,
          color: '#4A1F1B',
        }}>
          Mes documents administratifs
        </h1>

        <p style={{
          margin: '0 0 24px',
          color: '#6F625C',
          fontSize: 15,
          lineHeight: 1.6,
        }}>
          Ajoute une photo de courrier, d’amende, de facture ou de document important.
          Nova analyse le contenu, repère les dates limites et te propose une action.
          Rien n’est ajouté sans ta validation.
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
            Photo ou PDF du document à analyser
          </label>

          <input
            type="file"
            accept="image/*,.pdf,application/pdf"
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
            {isScanning ? 'Analyse en cours...' : 'Analyser le document'}
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
            <section style={{
  marginTop: 24,
  border: '1px solid #EADDD2',
  borderRadius: 18,
  padding: 20,
  background: '#FFFFFF',
}}>
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
  }}>
    <div>
      <h2 style={{ margin: 0, color: '#4A1F1B', fontSize: 22 }}>
        Mes documents enregistrés
      </h2>
      <p style={{ margin: '6px 0 0', color: '#6F625C', lineHeight: 1.5 }}>
        Historique sécurisé des documents que tu as choisi d’enregistrer.
      </p>
    </div>

    <button
      type="button"
      onClick={loadSavedDocuments}
      disabled={isLoadingSavedDocuments}
      style={{
        border: '1px solid #D7C8BE',
        borderRadius: 999,
        padding: '9px 13px',
        background: '#FFFFFF',
        color: '#7A2E2A',
        fontWeight: 700,
        cursor: isLoadingSavedDocuments ? 'not-allowed' : 'pointer',
      }}
    >
      {isLoadingSavedDocuments ? 'Chargement...' : 'Actualiser'}
    </button>
  </div>

  {savedDocumentsError && (
    <div style={{
      border: '1px solid #F1B5B5',
      background: '#FFF1F1',
      color: '#8A2525',
      borderRadius: 14,
      padding: 12,
      marginBottom: 14,
    }}>
      {savedDocumentsError}
    </div>
  )}

  {!isLoadingSavedDocuments && savedDocuments.length === 0 && (
    <p style={{ margin: 0, color: '#6F625C', lineHeight: 1.5 }}>
      Aucun document enregistré pour l’instant.
    </p>
  )}

  {savedDocuments.length > 0 && (
    <div style={{ display: 'grid', gap: 10 }}>
      {savedDocuments.map((document) => (
        <div
          key={document.id}
          style={{
            border: '1px solid #EFE2D8',
            borderRadius: 14,
            padding: 14,
            background: '#FFFCFA',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <div>
              <h3 style={{ margin: '0 0 6px', color: '#4A1F1B', fontSize: 16 }}>
                {document.title || 'Document administratif'}
              </h3>

              <p style={{ margin: 0, color: '#6F625C', lineHeight: 1.5 }}>
                {document.sender ? `${document.sender} · ` : ''}
                {document.document_type || 'type non détecté'}
              </p>

              <p style={{ margin: '6px 0 0', color: '#6F625C', lineHeight: 1.5 }}>
                {document.due_date
                  ? `Date limite : ${document.due_date}`
                  : 'Aucune date limite détectée'}
              </p>
            </div>

            <div style={{ textAlign: 'right', minWidth: 120 }}>
              <p style={{
                margin: '0 0 6px',
                color: dueDateStatusColor(
                  (document.due_date_status || 'none') as AdministrativeDocumentExtractedData['due_date_status']
                ),
                fontWeight: 700,
              }}>
                {dueDateStatusLabel(
                  (document.due_date_status || 'none') as AdministrativeDocumentExtractedData['due_date_status']
                )}
              </p>

              <p style={{ margin: 0, color: '#6F625C', fontSize: 13 }}>
                {new Date(document.created_at).toLocaleDateString('fr-FR')}
              </p>

              {document.amount !== null && (
                <p style={{ margin: '6px 0 0', color: '#4A1F1B', fontWeight: 700 }}>
                  {document.amount} {document.currency || 'EUR'}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</section>
            <h2 style={{ margin: '0 0 16px', color: '#4A1F1B', fontSize: 22 }}>
              Analyse du document
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
                Nova a analysé le document. À toi de choisir ce que tu veux ajouter.
              </p>

              <ul style={{ margin: '0 0 16px', paddingLeft: 20, color: '#5D504B', lineHeight: 1.6 }}>
                <li>{createdTaskId ? 'Une tâche a été créée après validation' : 'Aucune tâche créée'}</li>
                <li>{createdEventId ? 'Une échéance a été ajoutée au planner après validation' : 'Aucune échéance ajoutée au planner'}</li>
                <li>Aucun rappel automatique programmé</li>
                <li>{savedDocumentId ? 'Document enregistré dans ton espace sécurisé' : 'Aucun document enregistré en base'}</li>
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

                <button
                  type="button"
                  onClick={handleSaveDocument}
                  disabled={isSavingDocument || Boolean(savedDocumentId)}
                  style={{
                    border: '1px solid #B8895E',
                    borderRadius: 999,
                    padding: '11px 16px',
                    background: isSavingDocument || savedDocumentId ? '#F0E7DF' : '#FFFFFF',
                    color: isSavingDocument || savedDocumentId ? '#9A6A5B' : '#7A2E2A',
                    fontWeight: 700,
                    cursor: isSavingDocument || savedDocumentId ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saveButtonLabel}
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

              {saveMessage && (
                <p style={{
                  margin: '10px 0 0',
                  color: '#2F7A4F',
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}>
                  {saveMessage}
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