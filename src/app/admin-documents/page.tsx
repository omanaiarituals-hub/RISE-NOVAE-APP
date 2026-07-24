'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { AdministrativeDocumentExtractedData } from '@/lib/admin-documents/types'

const MAX_ORIGINAL_DOCUMENT_BYTES = 15 * 1024 * 1024
const MAX_COMPRESSED_DOCUMENT_BYTES = 3 * 1024 * 1024
const DOCUMENT_IMAGE_MAX_DIMENSION = 1800

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

export default function AdminDocumentsTestPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [compressedSize, setCompressedSize] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<AdministrativeDocumentExtractedData | null>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null

    setSelectedFile(file)
    setCompressedSize(null)
    setError(null)
    setExtraction(null)

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
          Cette page teste seulement l’extraction IA. Aucun document n’est enregistré,
          aucune tâche n’est créée, aucune échéance n’est ajoutée au planner.
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
              <Info label="Montant" value={extraction.amount === null ? null : `${extraction.amount} €`} />
              <Info label="Urgence" value={extraction.urgency} />
              <Info label="Confiance IA" value={`${Math.round(extraction.confidence * 100)} %`} />
            </div>

            <Block title="Résumé" value={extraction.summary} />
            <Block title="Action proposée" value={extraction.action_required} />
            <Block title="Tâche suggérée" value={extraction.suggested_task_title} />
            <Block title="Description de tâche" value={extraction.suggested_task_description} />
            <Block title="Échéance suggérée" value={extraction.suggested_event_date} />

            {extraction.missing_information.length > 0 && (
              <ListBlock title="Informations manquantes" items={extraction.missing_information} />
            )}

            {extraction.warnings.length > 0 && (
              <ListBlock title="Points à vérifier" items={extraction.warnings} />
            )}

            <details style={{ marginTop: 18 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#4A1F1B' }}>
                Voir le JSON brut
              </summary>
              <pre style={{
                whiteSpace: 'pre-wrap',
                background: '#2B2320',
                color: '#FFF9F5',
                borderRadius: 14,
                padding: 14,
                overflowX: 'auto',
                fontSize: 12,
              }}>
                {JSON.stringify(extraction, null, 2)}
              </pre>
            </details>
          </section>
        )}
      </section>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string | number | null }) {
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
      <p style={{ margin: 0, color: '#2B2320' }}>
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