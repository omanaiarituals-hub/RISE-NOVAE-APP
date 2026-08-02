'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import type { AdministrativeDocumentExtractedData } from '@/lib/admin-documents/types'
import { canAccessAdminDocuments } from '@/lib/admin-documents/access'

const MAX_ORIGINAL_DOCUMENT_BYTES = 15 * 1024 * 1024
const MAX_ORIGINAL_PDF_BYTES = 5 * 1024 * 1024
const MAX_COMPRESSED_DOCUMENT_BYTES = 3 * 1024 * 1024
const DOCUMENT_IMAGE_MAX_DIMENSION = 1800

const DEFAULT_EVENT_START_MINUTES = 9 * 60
const DEFAULT_EVENT_END_MINUTES = 10 * 60

type ActiveView = 'add' | 'archives' | 'vault'
type SensitivityLevel = 'standard' | 'sensitive' | 'very_sensitive'

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
  requiresVaultPin?: boolean
}

type ViewDocumentApiResponse = {
  success?: boolean
  signedUrl?: string
  expiresIn?: number
  filename?: string | null
  mimeType?: string | null
  error?: string
  requiresVaultPin?: boolean
}

type StatusApiResponse = {
  success?: boolean
  error?: string
}

type DeleteApiResponse = {
  success?: boolean
  message?: string
  error?: string
}

type VaultPinStatusApiResponse = {
  success?: boolean
  hasPin?: boolean
  isLocked?: boolean
  lockedUntil?: string | null
  error?: string
}

type VaultPinSetupApiResponse = {
  success?: boolean
  message?: string
  error?: string
}

type VaultPinVerifyApiResponse = {
  success?: boolean
  vaultAccessToken?: string
  unlockDurationMinutes?: number
  message?: string
  error?: string
  remainingAttempts?: number
  lockedUntil?: string | null
}

type VaultDocumentApiResponse = {
  success?: boolean
  error?: string
  requiresVaultPin?: boolean
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
  summary: string | null
  action_required: string | null
  recommended_next_step: string | null
  processing_status: 'todo' | 'in_progress' | 'done'
  processed_at: string | null
  vault_protected: boolean
  sensitivity_level: SensitivityLevel
  added_to_vault_at: string | null
}

type AdministrativeDocumentReminder = {
  id: string
  document_id: string
  reminder_type: string
  scheduled_for: string
  sent_at: string | null
  skipped_at: string | null
  skip_reason: string | null
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
  return 'var(--novae-text-muted, #6F625C)'
}

function processingStatusLabel(status: SavedAdministrativeDocument['processing_status']) {
  if (status === 'done') return 'Traité'
  if (status === 'in_progress') return 'En cours'
  return 'À traiter'
}

function processingStatusColor(status: SavedAdministrativeDocument['processing_status']) {
  if (status === 'done') return '#2F7A4F'
  if (status === 'in_progress') return '#A65E12'
  return '#8A2525'
}

function sensitivityLabel(level: SensitivityLevel) {
  if (level === 'very_sensitive') return 'Très sensible'
  if (level === 'sensitive') return 'Sensible'
  return 'Standard'
}

function reminderTypeLabel(type: string) {
  if (type === 'before_7_days') return '7 jours avant'
  if (type === 'before_3_days') return '3 jours avant'
  if (type === 'before_1_day') return '1 jour avant'
  if (type === 'due_today') return 'Le jour de l’échéance'
  if (type === 'overdue_1_day') return 'Relance J+1'
  if (type === 'overdue_3_days') return 'Relance J+3'
  return type
}

function reminderStatusLabel(reminder: AdministrativeDocumentReminder) {
  if (reminder.sent_at) return 'Envoyé'
  if (reminder.skipped_at) return 'Ignoré'
  return 'Programmé'
}

function reminderStatusColor(reminder: AdministrativeDocumentReminder) {
  if (reminder.sent_at) return '#2F7A4F'
  if (reminder.skipped_at) return 'var(--novae-secondary, #9A6A5B)'
  return '#A65E12'
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
  const [activeView, setActiveView] = useState<ActiveView>('add')
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

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
  const [documentReminders, setDocumentReminders] = useState<Record<string, AdministrativeDocumentReminder[]>>({})
  const [isLoadingSavedDocuments, setIsLoadingSavedDocuments] = useState(false)
  const [savedDocumentsError, setSavedDocumentsError] = useState<string | null>(null)
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null)

  const [managingDocumentId, setManagingDocumentId] = useState<string | null>(null)
  const [updatingDocumentId, setUpdatingDocumentId] = useState<string | null>(null)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)

  const [vaultAccessToken, setVaultAccessToken] = useState<string | null>(null)
  const [vaultUnlockedUntil, setVaultUnlockedUntil] = useState<number | null>(null)
  const [vaultPin, setVaultPin] = useState('')
  const [vaultPinConfirm, setVaultPinConfirm] = useState('')
  const [vaultModalMode, setVaultModalMode] = useState<'setup' | 'verify' | null>(null)
  const [pendingVaultAction, setPendingVaultAction] = useState<null | ((token: string) => Promise<void>)>(null)
  const [vaultMessage, setVaultMessage] = useState<string | null>(null)
  const [isVaultBusy, setIsVaultBusy] = useState(false)
  const [vaultUpdatingDocumentId, setVaultUpdatingDocumentId] = useState<string | null>(null)

  const isVaultUnlocked = () => {
    return Boolean(vaultAccessToken && vaultUnlockedUntil && vaultUnlockedUntil > Date.now())
  }

  const loadSavedDocuments = async () => {
    setIsLoadingSavedDocuments(true)
    setSavedDocumentsError(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        setSavedDocuments([])
        return
      }

      const { data, error: queryError } = await supabase
        .from('administrative_documents')
        .select('id, title, document_type, sender, due_date, due_date_status, amount, currency, created_at, summary, action_required, recommended_next_step, processing_status, processed_at, vault_protected, sensitivity_level, added_to_vault_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (queryError) {
        throw new Error(queryError.message)
      }

const documents = (data || []) as SavedAdministrativeDocument[]
setSavedDocuments(documents)

const documentIds = documents.map((document) => document.id)

if (documentIds.length === 0) {
  setDocumentReminders({})
  return
}

const { data: remindersData, error: remindersError } = await supabase
  .from('administrative_document_reminders')
  .select('id, document_id, reminder_type, scheduled_for, sent_at, skipped_at, skip_reason')
  .in('document_id', documentIds)
  .order('scheduled_for', { ascending: true })

if (remindersError) {
  throw new Error(remindersError.message)
}

const remindersByDocument = ((remindersData || []) as AdministrativeDocumentReminder[]).reduce(
  (acc, reminder) => {
    if (!acc[reminder.document_id]) {
      acc[reminder.document_id] = []
    }

    acc[reminder.document_id].push(reminder)
    return acc
  },
  {} as Record<string, AdministrativeDocumentReminder[]>
)

setDocumentReminders(remindersByDocument)
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

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || !canAccessAdminDocuments(user.email)) {
        setHasAccess(false)
        setIsCheckingAccess(false)
        return
      }

      setHasAccess(true)
      setIsCheckingAccess(false)
      await loadSavedDocuments()
    }

    checkAccess()
  }, [])

  const checkVaultStatus = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token

    if (!accessToken) {
      throw new Error('Session introuvable. Reconnecte-toi avant d’ouvrir le coffre.')
    }

    const response = await fetch('/api/vault/pin/status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const payload = await response.json().catch(() => null) as VaultPinStatusApiResponse | null

    if (!response.ok) {
      throw new Error(payload?.error || 'Impossible de vérifier le coffre.')
    }

    if (payload?.isLocked) {
      throw new Error('Le coffre est temporairement bloqué après plusieurs erreurs de code PIN.')
    }

    return Boolean(payload?.hasPin)
  }

  const requestVaultUnlock = async (action: (token: string) => Promise<void>) => {
    if (isVaultUnlocked() && vaultAccessToken) {
      await action(vaultAccessToken)
      return
    }

    try {
      const hasPin = await checkVaultStatus()
      setPendingVaultAction(() => action)
      setVaultModalMode(hasPin ? 'verify' : 'setup')
      setVaultMessage(null)
      setVaultPin('')
      setVaultPinConfirm('')
    } catch (vaultError) {
      const message =
        vaultError instanceof Error
          ? vaultError.message
          : 'Impossible d’ouvrir le coffre.'

      if (activeView === 'archives' || activeView === 'vault') {
        setSavedDocumentsError(message)
      } else {
        setError(message)
      }
    }
  }

  const handleSetupVaultPin = async () => {
    setIsVaultBusy(true)
    setVaultMessage(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        throw new Error('Session introuvable. Reconnecte-toi avant de créer le code PIN.')
      }

      const response = await fetch('/api/vault/pin/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pin: vaultPin,
          confirmPin: vaultPinConfirm,
        }),
      })

      const payload = await response.json().catch(() => null) as VaultPinSetupApiResponse | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Impossible de créer le code PIN.')
      }

      setVaultPin('')
      setVaultPinConfirm('')
      setVaultModalMode('verify')
      setVaultMessage('Code PIN créé. Entre-le maintenant pour déverrouiller le coffre.')
    } catch (setupError) {
      setVaultMessage(
        setupError instanceof Error
          ? setupError.message
          : 'Impossible de créer le code PIN.'
      )
    } finally {
      setIsVaultBusy(false)
    }
  }

  const handleVerifyVaultPin = async () => {
    setIsVaultBusy(true)
    setVaultMessage(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        throw new Error('Session introuvable. Reconnecte-toi avant de déverrouiller le coffre.')
      }

      const response = await fetch('/api/vault/pin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pin: vaultPin,
        }),
      })

      const payload = await response.json().catch(() => null) as VaultPinVerifyApiResponse | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Code PIN incorrect.')
      }

      if (!payload?.vaultAccessToken) {
        throw new Error('Token coffre manquant.')
      }

      const unlockMinutes = payload.unlockDurationMinutes || 5
      const token = payload.vaultAccessToken
      const action = pendingVaultAction

      setVaultAccessToken(token)
      setVaultUnlockedUntil(Date.now() + unlockMinutes * 60 * 1000)
      setVaultPin('')
      setVaultPinConfirm('')
      setVaultModalMode(null)
      setPendingVaultAction(null)

      if (action) {
        await action(token)
      }
    } catch (verifyError) {
      setVaultMessage(
        verifyError instanceof Error
          ? verifyError.message
          : 'Impossible de déverrouiller le coffre.'
      )
    } finally {
      setIsVaultBusy(false)
    }
  }

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

  const handleExtract = async () => {
    if (!selectedFile) {
      setError('Ajoute une photo ou un PDF avant de lancer l’analyse.')
      return
    }

    if (isPdfFile(selectedFile) && selectedFile.size > MAX_ORIGINAL_PDF_BYTES) {
      setError('PDF trop lourd. Pour cette version, choisis un PDF de moins de 5 MB ou prends une photo/capture du document.')
      return
    }

    if (isImageFile(selectedFile) && selectedFile.size > MAX_ORIGINAL_DOCUMENT_BYTES) {
      setError('Image trop lourde. Choisis une photo de moins de 15 MB.')
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
          "Le serveur n'a pas retourné une réponse lisible. Le document a peut-être provoqué une erreur d'analyse. Réessaie avec une image nette ou un PDF texte simple."
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

  const saveDocumentWithVaultOption = async (vaultProtected: boolean, token?: string) => {
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
      formData.append('vaultProtected', vaultProtected ? 'true' : 'false')
      formData.append('sensitivityLevel', vaultProtected ? 'sensitive' : 'standard')

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
          ...(vaultProtected && token ? { 'x-vault-access-token': token } : {}),
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
      setSaveMessage(
        payload.message ||
        (vaultProtected
          ? 'Document enregistré dans le coffre sécurisé.'
          : 'Document enregistré dans ton espace sécurisé.')
      )
      await loadSavedDocuments()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Impossible d'enregistrer le document.")
    } finally {
      setIsSavingDocument(false)
    }
  }

  const handleSaveDocument = async () => {
    await saveDocumentWithVaultOption(false)
  }

  const handleSaveDocumentToVault = async () => {
    await requestVaultUnlock(async (token) => {
      await saveDocumentWithVaultOption(true, token)
    })
  }

  const openSavedDocumentWithToken = async (documentId: string, token?: string) => {
    setOpeningDocumentId(documentId)
    setSavedDocumentsError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        throw new Error('Session introuvable. Reconnecte-toi avant d’ouvrir le document.')
      }

      const response = await fetch(`/api/admin-documents/view?documentId=${encodeURIComponent(documentId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(token ? { 'x-vault-access-token': token } : {}),
        },
      })

      const responseText = await response.text()

      let payload: ViewDocumentApiResponse
      try {
        payload = JSON.parse(responseText) as ViewDocumentApiResponse
      } catch {
        throw new Error("Le serveur n'a pas retourné une réponse lisible.")
      }

      if (!response.ok) {
        throw new Error(payload.error || "Impossible d'ouvrir ce document.")
      }

      if (!payload.signedUrl) {
        throw new Error("Lien temporaire manquant pour ce document.")
      }

      window.open(payload.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (openError) {
      setSavedDocumentsError(
        openError instanceof Error
          ? openError.message
          : "Impossible d'ouvrir ce document."
      )
    } finally {
      setOpeningDocumentId(null)
    }
  }

  const handleOpenSavedDocument = async (document: SavedAdministrativeDocument) => {
    if (document.vault_protected) {
      await requestVaultUnlock(async (token) => {
        await openSavedDocumentWithToken(document.id, token)
      })
      return
    }

    await openSavedDocumentWithToken(document.id)
  }

  const handleUpdateProcessingStatus = async (
    documentId: string,
    processingStatus: SavedAdministrativeDocument['processing_status']
  ) => {
    setUpdatingDocumentId(documentId)
    setSavedDocumentsError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        throw new Error('Session introuvable. Reconnecte-toi avant de modifier le document.')
      }

      const response = await fetch('/api/admin-documents/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          documentId,
          processingStatus,
        }),
      })

      const payload = await response.json().catch(() => null) as StatusApiResponse | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Impossible de mettre à jour le statut.')
      }

      await loadSavedDocuments()
    } catch (statusError) {
      setSavedDocumentsError(
        statusError instanceof Error
          ? statusError.message
          : 'Impossible de mettre à jour le statut.'
      )
    } finally {
      setUpdatingDocumentId(null)
    }
  }

  const handleToggleVaultProtection = async (
    document: SavedAdministrativeDocument,
    vaultProtected: boolean,
    sensitivityLevel: Exclude<SensitivityLevel, 'standard'> = 'sensitive'
  ) => {
    const action = async (token: string) => {
      setVaultUpdatingDocumentId(document.id)
      setSavedDocumentsError(null)

      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData.session?.access_token

        if (!accessToken) {
          throw new Error('Session introuvable. Reconnecte-toi avant de modifier le coffre.')
        }

        const response = await fetch('/api/admin-documents/vault', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'x-vault-access-token': token,
          },
          body: JSON.stringify({
            documentId: document.id,
            vaultProtected,
            sensitivityLevel,
          }),
        })

        const payload = await response.json().catch(() => null) as VaultDocumentApiResponse | null

        if (!response.ok) {
          throw new Error(payload?.error || 'Impossible de modifier la protection coffre.')
        }

        await loadSavedDocuments()
      } catch (vaultError) {
        setSavedDocumentsError(
          vaultError instanceof Error
            ? vaultError.message
            : 'Impossible de modifier la protection coffre.'
        )
      } finally {
        setVaultUpdatingDocumentId(null)
      }
    }

    if (vaultProtected) {
      await requestVaultUnlock(action)
      return
    }

    const confirmed = window.confirm('Retirer ce document du coffre sécurisé ?')
    if (!confirmed) return

    await requestVaultUnlock(action)
  }

  const performDeleteSavedDocument = async (documentId: string, vaultToken?: string) => {
    setDeletingDocumentId(documentId)
    setSavedDocumentsError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        throw new Error('Session introuvable. Reconnecte-toi avant de supprimer le document.')
      }

      const response = await fetch('/api/admin-documents/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(vaultToken ? { 'x-vault-access-token': vaultToken } : {}),
        },
        body: JSON.stringify({ documentId }),
      })

      const payload = await response.json().catch(() => null) as DeleteApiResponse | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Impossible de supprimer ce document.')
      }

      if (managingDocumentId === documentId) {
        setManagingDocumentId(null)
      }

      await loadSavedDocuments()
    } catch (deleteError) {
      setSavedDocumentsError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Impossible de supprimer ce document.'
      )
    } finally {
      setDeletingDocumentId(null)
    }
  }

  const handleDeleteSavedDocument = async (documentId: string) => {
    const confirmed = window.confirm(
      'Supprimer ce document ? Le fichier et sa fiche seront supprimés définitivement.'
    )

    if (!confirmed) return

    const target = savedDocuments.find((document) => document.id === documentId)

    // Pour un document du coffre, on est déjà entré (porte unique à l'ouverture
    // de l'onglet). On transmet le jeton de session courant ; plus de PIN ici.
    if (target?.vault_protected) {
      await performDeleteSavedDocument(documentId, vaultAccessToken || undefined)
      return
    }

    await performDeleteSavedDocument(documentId)
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

  const saveVaultButtonLabel = (() => {
    if (savedDocumentId) return 'Document enregistré'
    if (isSavingDocument) return 'Enregistrement...'
    return 'Enregistrer dans le coffre'
  })()

  const eventDatePreview = extraction ? getEventDateForExtraction(extraction) : null
  const archivedDocuments = savedDocuments.filter((document) => !document.vault_protected)
  const vaultDocuments = savedDocuments.filter((document) => document.vault_protected)

  if (isCheckingAccess) {
    return (
      <main style={{
        minHeight: '100vh',
        background: 'var(--novae-background, #FBF7F2)',
        padding: '32px 16px',
        color: 'var(--novae-text-main, #2B2320)',
      }}>
        <section style={{
          maxWidth: 720,
          margin: '0 auto',
          background: 'var(--novae-surface, #FFFFFF)',
          border: '1px solid var(--novae-border, #EADDD2)',
          borderRadius: 24,
          padding: 24,
        }}>
          Chargement...
        </section>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main style={{
        minHeight: '100vh',
        background: 'var(--novae-background, #FBF7F2)',
        padding: '32px 16px',
        color: 'var(--novae-text-main, #2B2320)',
      }}>
        <section style={{
          maxWidth: 720,
          margin: '0 auto',
          background: 'var(--novae-surface, #FFFFFF)',
          border: '1px solid var(--novae-border, #EADDD2)',
          borderRadius: 24,
          padding: 24,
        }}>
          <h1 style={{ margin: '0 0 12px', color: 'var(--novae-primary, #4A1F1B)' }}>
            Module en test privé
          </h1>
          <p style={{ margin: 0, color: 'var(--novae-text-muted, #6F625C)', lineHeight: 1.6 }}>
            Le module administratif est en cours de test et n’est pas encore disponible pour tous les comptes.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'var(--novae-background, #FBF7F2)',
      padding: '32px 16px',
      color: 'var(--novae-text-main, #2B2320)',
    }}>
      <section style={{
        maxWidth: 880,
        margin: '0 auto',
        background: 'var(--novae-surface, #FFFFFF)',
        border: '1px solid var(--novae-border, #EADDD2)',
        borderRadius: 24,
        padding: 24,
        boxShadow: '0 18px 45px rgba(55, 35, 25, 0.08)',
      }}>
        <div style={{ display: 'block', marginBottom: 14 }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--novae-primary, #7A2E2A)',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ← Retour à l’accueil
          </Link>
        </div>

        <p style={{
          display: 'block',
          clear: 'both',
          margin: '0 0 8px',
          fontSize: 13,
          color: 'var(--novae-secondary, #9A6A5B)',
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
          color: 'var(--novae-primary, #4A1F1B)',
        }}>
          Mes documents administratifs
        </h1>

        <p style={{
          margin: '0 0 22px',
          color: 'var(--novae-text-muted, #6F625C)',
          fontSize: 15,
          lineHeight: 1.6,
        }}>
          Ajoute un courrier, une facture, une amende ou retrouve les documents que tu as déjà enregistrés.
          Nova t’aide à repérer les dates limites et à transformer les papiers en actions concrètes.
        </p>

        <div style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 22,
        }}>
          <button
            type="button"
            onClick={() => setActiveView('add')}
            style={{
              border: activeView === 'add' ? '1px solid var(--novae-primary, #7A2E2A)' : '1px solid var(--novae-border, #D7C8BE)',
              borderRadius: 999,
              padding: '11px 16px',
              background: activeView === 'add' ? 'var(--novae-primary, #7A2E2A)' : 'var(--novae-surface, #FFFFFF)',
              color: activeView === 'add' ? 'var(--novae-surface, #FFFFFF)' : 'var(--novae-primary, #7A2E2A)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Ajouter un document
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveView('archives')
              loadSavedDocuments()
            }}
            style={{
              border: activeView === 'archives' ? '1px solid var(--novae-primary, #7A2E2A)' : '1px solid var(--novae-border, #D7C8BE)',
              borderRadius: 999,
              padding: '11px 16px',
              background: activeView === 'archives' ? 'var(--novae-primary, #7A2E2A)' : 'var(--novae-surface, #FFFFFF)',
              color: activeView === 'archives' ? 'var(--novae-surface, #FFFFFF)' : 'var(--novae-primary, #7A2E2A)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
Mes documents archivés ({archivedDocuments.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveView('vault')
              loadSavedDocuments()
            }}
            style={{
              border: activeView === 'vault' ? '1px solid var(--novae-primary, #7A2E2A)' : '1px solid var(--novae-border, #D7C8BE)',
              borderRadius: 999,
              padding: '11px 16px',
              background: activeView === 'vault' ? 'var(--novae-primary, #7A2E2A)' : 'var(--novae-surface, #FFFFFF)',
              color: activeView === 'vault' ? 'var(--novae-surface, #FFFFFF)' : 'var(--novae-primary, #7A2E2A)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔒 Coffre
          </button>
        </div>

        {activeView === 'add' && (
          <>
            <div style={{
              border: '1px dashed var(--novae-border, #D8B9A8)',
              borderRadius: 18,
              padding: 20,
              background: 'var(--novae-surface-alt, #FFF9F5)',
              marginBottom: 20,
            }}>
              <label style={{
                display: 'block',
                fontWeight: 700,
                marginBottom: 10,
                color: 'var(--novae-primary, #4A1F1B)',
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
                <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--novae-text-muted, #6F625C)' }}>
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
                  background: isScanning || !selectedFile ? 'var(--novae-border, #D7C8BE)' : 'var(--novae-primary, #7A2E2A)',
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
                border: '1px solid var(--novae-border, #EADDD2)',
                borderRadius: 18,
                padding: 20,
                background: 'var(--novae-surface, #FFFFFF)',
              }}>
                <h2 style={{ margin: '0 0 16px', color: 'var(--novae-primary, #4A1F1B)', fontSize: 22 }}>
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
                  border: '1px solid var(--novae-border, #D8B9A8)',
                  background: 'var(--novae-surface-alt, #FFF9F5)',
                  borderRadius: 18,
                  padding: 18,
                }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--novae-primary, #4A1F1B)' }}>
                    Validation utilisateur requise
                  </h3>

                  <p style={{ margin: '0 0 14px', color: 'var(--novae-text-muted, #5D504B)', lineHeight: 1.55 }}>
                    Nova a analysé le document. À toi de choisir ce que tu veux ajouter.
                  </p>

                  <ul style={{ margin: '0 0 16px', paddingLeft: 20, color: 'var(--novae-text-muted, #5D504B)', lineHeight: 1.6 }}>
                    <li>{createdTaskId ? 'Une tâche a été créée après validation' : 'Aucune tâche créée'}</li>
                    <li>{createdEventId ? 'Une échéance a été ajoutée au planner après validation' : 'Aucune échéance ajoutée au planner'}</li>
                    <li>Aucun rappel automatique programmé</li>
                    <li>{savedDocumentId ? 'Document enregistré' : 'Aucun document enregistré en base'}</li>
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
                        background: isCreatingTask || createdTaskId ? 'var(--novae-border, #D7C8BE)' : 'var(--novae-primary, #7A2E2A)',
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
                        border: '1px solid var(--novae-border, #D7C8BE)',
                        borderRadius: 999,
                        padding: '11px 16px',
                        background: isCreatingEvent || createdEventId ? 'var(--novae-primary-soft, #F0E7DF)' : 'white',
                        color: isCreatingEvent || createdEventId ? 'var(--novae-secondary, #9A6A5B)' : 'var(--novae-primary, #7A2E2A)',
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
                        border: '1px solid var(--novae-secondary, #B8895E)',
                        borderRadius: 999,
                        padding: '11px 16px',
                        background: isSavingDocument || savedDocumentId ? 'var(--novae-primary-soft, #F0E7DF)' : 'var(--novae-surface, #FFFFFF)',
                        color: isSavingDocument || savedDocumentId ? 'var(--novae-secondary, #9A6A5B)' : 'var(--novae-primary, #7A2E2A)',
                        fontWeight: 700,
                        cursor: isSavingDocument || savedDocumentId ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {saveButtonLabel}
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveDocumentToVault}
                      disabled={isSavingDocument || Boolean(savedDocumentId)}
                      style={{
                        border: '1px solid var(--novae-primary, #7A2E2A)',
                        borderRadius: 999,
                        padding: '11px 16px',
                        background: isSavingDocument || savedDocumentId ? 'var(--novae-primary-soft, #F0E7DF)' : 'var(--novae-surface-alt, #FFF9F5)',
                        color: isSavingDocument || savedDocumentId ? 'var(--novae-secondary, #9A6A5B)' : 'var(--novae-primary, #7A2E2A)',
                        fontWeight: 800,
                        cursor: isSavingDocument || savedDocumentId ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {saveVaultButtonLabel}
                    </button>
                  </div>

                  <p style={{ margin: '12px 0 0', color: 'var(--novae-text-muted, #6F625C)', fontSize: 13, lineHeight: 1.45 }}>
                    Le coffre demande un code PIN et utilise un accès temporaire. À utiliser pour les documents sensibles.
                  </p>

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
          </>
        )}

        {activeView === 'archives' && (
          <SavedDocumentsSection
            documents={archivedDocuments}
            documentReminders={documentReminders}
            isLoading={isLoadingSavedDocuments}
            error={savedDocumentsError}
            openingDocumentId={openingDocumentId}
            managingDocumentId={managingDocumentId}
            updatingDocumentId={updatingDocumentId}
            deletingDocumentId={deletingDocumentId}
            vaultUpdatingDocumentId={vaultUpdatingDocumentId}
            onRefresh={loadSavedDocuments}
            onOpenDocument={handleOpenSavedDocument}
            onManageDocument={setManagingDocumentId}
            onUpdateProcessingStatus={handleUpdateProcessingStatus}
            onDeleteDocument={handleDeleteSavedDocument}
            onToggleVaultProtection={handleToggleVaultProtection}
            title="Mes documents archivés"
            description="Documents enregistrés normalement, sans protection coffre."
            emptyMessage="Aucun document classique enregistré pour l’instant."
          />
        )}

        {activeView === 'vault' && !isVaultUnlocked() && (
          <div style={{
            border: '1px solid var(--novae-border, #EADDD2)',
            borderRadius: 22,
            padding: '40px 24px',
            background: 'var(--novae-surface, #FFFFFF)',
            textAlign: 'center',
            maxWidth: 460,
            margin: '0 auto',
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
            <h2 style={{ margin: '0 0 8px', color: 'var(--novae-primary, #4A1F1B)', fontSize: 21 }}>
              Coffre verrouillé
            </h2>
            <p style={{ margin: '0 0 20px', color: 'var(--novae-text-muted, #6F625C)', lineHeight: 1.5 }}>
              Entre ton code PIN pour accéder à tes documents sensibles. Rien n’est
              affiché tant que le coffre est verrouillé.
            </p>
            <button
              type="button"
              onClick={() => { void requestVaultUnlock(async () => { await loadSavedDocuments() }) }}
              style={{
                border: 'none',
                borderRadius: 14,
                padding: '13px 26px',
                background: 'var(--novae-primary, #7A2E2A)',
                color: 'var(--novae-surface, #FFFFFF)',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Déverrouiller le coffre
            </button>
            {savedDocumentsError && (
              <p style={{ margin: '16px 0 0', color: '#B0281F', fontSize: 13 }}>{savedDocumentsError}</p>
            )}
          </div>
        )}

        {activeView === 'vault' && isVaultUnlocked() && (
          <SavedDocumentsSection
            documents={vaultDocuments}
            documentReminders={documentReminders}
            isLoading={isLoadingSavedDocuments}
            error={savedDocumentsError}
            openingDocumentId={openingDocumentId}
            managingDocumentId={managingDocumentId}
            updatingDocumentId={updatingDocumentId}
            deletingDocumentId={deletingDocumentId}
            vaultUpdatingDocumentId={vaultUpdatingDocumentId}
            onRefresh={loadSavedDocuments}
            onOpenDocument={handleOpenSavedDocument}
            onManageDocument={setManagingDocumentId}
            onUpdateProcessingStatus={handleUpdateProcessingStatus}
            onDeleteDocument={handleDeleteSavedDocument}
            onToggleVaultProtection={handleToggleVaultProtection}
            title="Coffre sécurisé"
            description="Documents sensibles protégés par code PIN et accès temporaire."
            emptyMessage="Aucun document dans le coffre pour l’instant."
          />
        )}
      </section>

      {vaultModalMode && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(43, 35, 32, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16,
        }}>
          <div style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--novae-surface, #FFFFFF)',
            borderRadius: 22,
            padding: 22,
            border: '1px solid var(--novae-border, #EADDD2)',
            boxShadow: '0 18px 45px rgba(55, 35, 25, 0.18)',
          }}>
            <h2 style={{ margin: '0 0 8px', color: 'var(--novae-primary, #4A1F1B)', fontSize: 22 }}>
              {vaultModalMode === 'setup' ? 'Créer ton code coffre' : 'Déverrouiller le coffre'}
            </h2>

            <p style={{ margin: '0 0 16px', color: 'var(--novae-text-muted, #6F625C)', lineHeight: 1.5 }}>
              {vaultModalMode === 'setup'
                ? 'Choisis un code PIN de 4 à 8 chiffres. Il ne sera jamais stocké en clair.'
                : 'Entre ton code PIN pour accéder au coffre sécurisé pendant quelques minutes.'}
            </p>

            <input
              type="password"
              inputMode="numeric"
              value={vaultPin}
              onChange={(event) => setVaultPin(event.target.value)}
              placeholder="Code PIN"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid var(--novae-border, #D7C8BE)',
                borderRadius: 12,
                padding: '12px 14px',
                fontSize: 16,
                marginBottom: 10,
              }}
            />

            {vaultModalMode === 'setup' && (
              <input
                type="password"
                inputMode="numeric"
                value={vaultPinConfirm}
                onChange={(event) => setVaultPinConfirm(event.target.value)}
                placeholder="Confirmer le code PIN"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '1px solid var(--novae-border, #D7C8BE)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontSize: 16,
                  marginBottom: 10,
                }}
              />
            )}

            {vaultMessage && (
              <p style={{
                margin: '0 0 12px',
                color: vaultMessage.includes('créé') ? '#2F7A4F' : '#8A2525',
                fontWeight: 700,
                lineHeight: 1.4,
              }}>
                {vaultMessage}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setVaultModalMode(null)
                  setPendingVaultAction(null)
                  setVaultPin('')
                  setVaultPinConfirm('')
                  setVaultMessage(null)
                }}
                disabled={isVaultBusy}
                style={{
                  border: '1px solid var(--novae-border, #D7C8BE)',
                  borderRadius: 999,
                  padding: '10px 14px',
                  background: 'var(--novae-surface, #FFFFFF)',
                  color: 'var(--novae-primary, #7A2E2A)',
                  fontWeight: 700,
                  cursor: isVaultBusy ? 'not-allowed' : 'pointer',
                }}
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={vaultModalMode === 'setup' ? handleSetupVaultPin : handleVerifyVaultPin}
                disabled={isVaultBusy}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  padding: '10px 14px',
                  background: 'var(--novae-primary, #7A2E2A)',
                  color: 'var(--novae-surface, #FFFFFF)',
                  fontWeight: 700,
                  cursor: isVaultBusy ? 'not-allowed' : 'pointer',
                }}
              >
                {isVaultBusy
                  ? 'Vérification...'
                  : vaultModalMode === 'setup'
                    ? 'Créer le PIN'
                    : 'Déverrouiller'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function SavedDocumentsSection({
  documents,
  documentReminders,
  isLoading,
  error,
  openingDocumentId,
  managingDocumentId,
  updatingDocumentId,
  deletingDocumentId,
  vaultUpdatingDocumentId,
  onRefresh,
  onOpenDocument,
  onManageDocument,
  onUpdateProcessingStatus,
  onDeleteDocument,
  onToggleVaultProtection,
  title = 'Mes documents archivés',
  description = 'Historique sécurisé des documents que tu as choisi d’enregistrer.',
  emptyMessage = 'Aucun document enregistré pour l’instant.',
}: {
  documents: SavedAdministrativeDocument[]
  documentReminders: Record<string, AdministrativeDocumentReminder[]>
  isLoading: boolean
  error: string | null
  openingDocumentId: string | null
  managingDocumentId: string | null
  updatingDocumentId: string | null
  deletingDocumentId: string | null
  vaultUpdatingDocumentId: string | null
  onRefresh: () => void
  onOpenDocument: (document: SavedAdministrativeDocument) => void
  onManageDocument: (documentId: string | null) => void
  onUpdateProcessingStatus: (
    documentId: string,
    status: SavedAdministrativeDocument['processing_status']
  ) => void
  onDeleteDocument: (documentId: string) => void
  onToggleVaultProtection: (
    document: SavedAdministrativeDocument,
    vaultProtected: boolean,
    sensitivityLevel?: Exclude<SensitivityLevel, 'standard'>
  ) => void
  title?: string
  description?: string
  emptyMessage?: string
}) {
  return (
    <section style={{
      border: '1px solid var(--novae-border, #EADDD2)',
      borderRadius: 18,
      padding: 20,
      background: 'var(--novae-surface, #FFFFFF)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'center',
        marginBottom: 14,
      }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--novae-primary, #4A1F1B)', fontSize: 22 }}>
            {title}
          </h2>
          <p style={{ margin: '6px 0 0', color: 'var(--novae-text-muted, #6F625C)', lineHeight: 1.5 }}>
            {description}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          style={{
            border: '1px solid var(--novae-border, #D7C8BE)',
            borderRadius: 999,
            padding: '9px 13px',
            background: 'var(--novae-surface, #FFFFFF)',
            color: 'var(--novae-primary, #7A2E2A)',
            fontWeight: 700,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Chargement...' : 'Actualiser'}
        </button>
      </div>

      {error && (
        <div style={{
          border: '1px solid #F1B5B5',
          background: '#FFF1F1',
          color: '#8A2525',
          borderRadius: 14,
          padding: 12,
          marginBottom: 14,
        }}>
          {error}
        </div>
      )}

      {!isLoading && documents.length === 0 && (
        <p style={{ margin: 0, color: 'var(--novae-text-muted, #6F625C)', lineHeight: 1.5 }}>
          {emptyMessage}
        </p>
      )}

      {documents.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {documents.map((document) => {
            const isManaging = managingDocumentId === document.id
            const isUpdating = updatingDocumentId === document.id
            const isDeleting = deletingDocumentId === document.id
            const isVaultUpdating = vaultUpdatingDocumentId === document.id

            return (
              <div
                key={document.id}
                style={{
                  border: '1px solid var(--novae-border, #EFE2D8)',
                  borderRadius: 14,
                  padding: 14,
                  background: 'var(--novae-surface-alt, #FFFCFA)',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px', color: 'var(--novae-primary, #4A1F1B)', fontSize: 16 }}>
                      {document.title || 'Document administratif'}
                    </h3>

                    <p style={{ margin: 0, color: 'var(--novae-text-muted, #6F625C)', lineHeight: 1.5 }}>
                      {document.sender ? `${document.sender} · ` : ''}
                      {document.document_type || 'type non détecté'}
                    </p>

                    <p style={{ margin: '6px 0 0', color: 'var(--novae-text-muted, #6F625C)', lineHeight: 1.5 }}>
                      {document.due_date
                        ? `Date limite : ${document.due_date}`
                        : 'Aucune date limite détectée'}
                    </p>

                    <p style={{
                      margin: '8px 0 0',
                      color: processingStatusColor(document.processing_status),
                      fontWeight: 700,
                    }}>
                      Statut : {processingStatusLabel(document.processing_status)}
                    </p>

                    {document.vault_protected && (
                      <p style={{
                        margin: '6px 0 0',
                        color: 'var(--novae-primary, #7A2E2A)',
                        fontWeight: 800,
                        fontSize: 13,
                      }}>
                        🔐 Coffre sécurisé · {sensitivityLabel(document.sensitivity_level)}
                      </p>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 140 }}>
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

                    <p style={{ margin: 0, color: 'var(--novae-text-muted, #6F625C)', fontSize: 13 }}>
                      {new Date(document.created_at).toLocaleDateString('fr-FR')}
                    </p>

                    {document.amount !== null && (
                      <p style={{ margin: '6px 0 0', color: 'var(--novae-primary, #4A1F1B)', fontWeight: 700 }}>
                        {document.amount} {document.currency || 'EUR'}
                      </p>
                    )}

                    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => onOpenDocument(document)}
                        disabled={openingDocumentId === document.id}
                        style={{
                          border: '1px solid var(--novae-border, #D7C8BE)',
                          borderRadius: 999,
                          padding: '8px 12px',
                          background: openingDocumentId === document.id ? 'var(--novae-primary-soft, #F0E7DF)' : 'var(--novae-surface, #FFFFFF)',
                          color: openingDocumentId === document.id ? 'var(--novae-secondary, #9A6A5B)' : 'var(--novae-primary, #7A2E2A)',
                          fontWeight: 700,
                          cursor: openingDocumentId === document.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {openingDocumentId === document.id ? 'Ouverture...' : document.vault_protected ? 'Voir coffre' : 'Voir'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onManageDocument(isManaging ? null : document.id)}
                        style={{
                          border: '1px solid var(--novae-border, #D7C8BE)',
                          borderRadius: 999,
                          padding: '8px 12px',
                          background: isManaging ? 'var(--novae-primary, #7A2E2A)' : 'var(--novae-surface, #FFFFFF)',
                          color: isManaging ? 'var(--novae-surface, #FFFFFF)' : 'var(--novae-primary, #7A2E2A)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {isManaging ? 'Fermer' : 'Gérer'}
                      </button>
                    </div>
                  </div>
                </div>

                {isManaging && (
                  <div style={{
                    marginTop: 14,
                    borderTop: '1px solid var(--novae-border, #EFE2D8)',
                    paddingTop: 14,
                  }}>
                    {document.summary && (
                      <Block title="Résumé" value={document.summary} />
                    )}

                    {document.action_required && (
                      <Block title="Action à faire" value={document.action_required} />
                    )}

                   {document.recommended_next_step && (
  <Block title="Prochaine action recommandée" value={document.recommended_next_step} />
)}

<ReminderBlock reminders={documentReminders[document.id] || []} />

                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 14,
                    }}>
                      <button
                        type="button"
                        onClick={() => onUpdateProcessingStatus(document.id, 'in_progress')}
                        disabled={isUpdating || document.processing_status === 'in_progress'}
                        style={{
                          border: '1px solid var(--novae-border, #D7C8BE)',
                          borderRadius: 999,
                          padding: '8px 12px',
                          background: 'var(--novae-surface, #FFFFFF)',
                          color: 'var(--novae-primary, #7A2E2A)',
                          fontWeight: 700,
                          cursor: isUpdating ? 'not-allowed' : 'pointer',
                        }}
                      >
                        En cours
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateProcessingStatus(document.id, 'done')}
                        disabled={isUpdating || document.processing_status === 'done'}
                        style={{
                          border: 'none',
                          borderRadius: 999,
                          padding: '8px 12px',
                          background: '#2F7A4F',
                          color: 'var(--novae-surface, #FFFFFF)',
                          fontWeight: 700,
                          cursor: isUpdating ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Marquer comme traité
                      </button>

                      <button
                        type="button"
                        onClick={() => onUpdateProcessingStatus(document.id, 'todo')}
                        disabled={isUpdating || document.processing_status === 'todo'}
                        style={{
                          border: '1px solid var(--novae-border, #D7C8BE)',
                          borderRadius: 999,
                          padding: '8px 12px',
                          background: 'var(--novae-surface, #FFFFFF)',
                          color: 'var(--novae-primary, #7A2E2A)',
                          fontWeight: 700,
                          cursor: isUpdating ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Remettre à traiter
                      </button>

                      {document.vault_protected ? (
                        <button
                          type="button"
                          onClick={() => onToggleVaultProtection(document, false)}
                          disabled={isVaultUpdating}
                          style={{
                            border: '1px solid var(--novae-border, #D7C8BE)',
                            borderRadius: 999,
                            padding: '8px 12px',
                            background: 'var(--novae-surface, #FFFFFF)',
                            color: 'var(--novae-primary, #7A2E2A)',
                            fontWeight: 700,
                            cursor: isVaultUpdating ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isVaultUpdating ? 'Modification...' : 'Retirer du coffre'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleVaultProtection(document, true, 'sensitive')}
                          disabled={isVaultUpdating}
                          style={{
                            border: '1px solid var(--novae-secondary, #B8895E)',
                            borderRadius: 999,
                            padding: '8px 12px',
                            background: 'var(--novae-surface-alt, #FFF9F5)',
                            color: 'var(--novae-primary, #7A2E2A)',
                            fontWeight: 800,
                            cursor: isVaultUpdating ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isVaultUpdating ? 'Protection...' : 'Ajouter au coffre'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onDeleteDocument(document.id)}
                        disabled={isDeleting}
                        style={{
                          border: '1px solid #E7A5A5',
                          borderRadius: 999,
                          padding: '8px 12px',
                          background: '#FFF1F1',
                          color: '#8A2525',
                          fontWeight: 700,
                          cursor: isDeleting ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isDeleting ? 'Suppression...' : 'Supprimer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
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
      border: '1px solid var(--novae-border, #EFE2D8)',
      borderRadius: 14,
      padding: 12,
      background: 'var(--novae-surface-alt, #FFFCFA)',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--novae-secondary, #9A6A5B)', fontWeight: 700 }}>
        {label}
      </p>
      <p style={{ margin: 0, color: color || 'var(--novae-text-main, #2B2320)', fontWeight: color ? 700 : 400 }}>
        {value || 'Non détecté'}
      </p>
    </div>
  )
}

function Block({ title, value }: { title: string; value: string | null }) {
  if (!value) return null

  return (
    <div style={{ marginTop: 14 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--novae-primary, #4A1F1B)' }}>
        {title}
      </h3>
      <p style={{ margin: 0, color: 'var(--novae-text-muted, #5D504B)', lineHeight: 1.55 }}>
        {value}
      </p>
    </div>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 14 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--novae-primary, #4A1F1B)' }}>
        {title}
      </h3>
      <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--novae-text-muted, #5D504B)', lineHeight: 1.55 }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function ReminderBlock({ reminders }: { reminders: AdministrativeDocumentReminder[] }) {
  if (reminders.length === 0) {
    return (
      <div style={{
        marginTop: 14,
        border: '1px solid var(--novae-border, #EFE2D8)',
        borderRadius: 14,
        padding: 12,
        background: 'var(--novae-surface-alt, #FFFCFA)',
      }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, color: 'var(--novae-primary, #4A1F1B)' }}>
          Rappels programmés
        </h3>
        <p style={{ margin: 0, color: 'var(--novae-text-muted, #6F625C)', lineHeight: 1.5 }}>
          Aucun rappel automatique programmé pour ce document.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      marginTop: 14,
      border: '1px solid var(--novae-border, #EFE2D8)',
      borderRadius: 14,
      padding: 12,
      background: 'var(--novae-surface-alt, #FFFCFA)',
    }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 15, color: 'var(--novae-primary, #4A1F1B)' }}>
        Rappels programmés
      </h3>

      <div style={{ display: 'grid', gap: 8 }}>
        {reminders.map((reminder) => (
          <div
            key={reminder.id}
            style={{
              border: '1px solid var(--novae-border, #EFE2D8)',
              borderRadius: 12,
              padding: 10,
              background: 'var(--novae-surface, #FFFFFF)',
            }}
          >
            <p style={{ margin: '0 0 4px', color: 'var(--novae-primary, #4A1F1B)', fontWeight: 700 }}>
              {reminderTypeLabel(reminder.reminder_type)}
            </p>

            <p style={{ margin: '0 0 4px', color: 'var(--novae-text-muted, #6F625C)', fontSize: 13 }}>
              Prévu le {new Date(reminder.scheduled_for).toLocaleString('fr-FR')}
            </p>

            <p style={{
              margin: 0,
              color: reminderStatusColor(reminder),
              fontWeight: 700,
              fontSize: 13,
            }}>
              {reminderStatusLabel(reminder)}
            </p>

            {reminder.skip_reason && (
              <p style={{ margin: '4px 0 0', color: 'var(--novae-secondary, #9A6A5B)', fontSize: 12 }}>
                Raison : {reminder.skip_reason}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}