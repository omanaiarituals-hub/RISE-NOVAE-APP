'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import PremiumIcon from '@/components/ui/PremiumIcon'
import { supabase } from '@/lib/supabase/client'
import {
  USER_INTERFACE_PRESETS,
  getUserInterfacePreset,
  normalizeUserThemeKey,
  type UserInterfacePreset,
  type UserThemeKey,
} from '@/lib/theme/user-themes'

const CACHE_KEY = 'novae-interface-preferences'
const FIXED_HOME_MODULES = ['admin', 'planner', 'meals']

function previewTheme(themeKey: UserThemeKey) {
  window.localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ theme_key: themeKey }),
  )

  window.dispatchEvent(
    new CustomEvent('novae-theme-updated', {
      detail: { theme_key: themeKey },
    }),
  )
}

function PresetPreview({ preset }: { preset: UserInterfacePreset }) {
  const imageByPreset: Record<UserInterfacePreset['id'], string> = {
    choice_1: '/interface-previews/choice-1.svg',
    choice_2: '/interface-previews/choice-2.svg',
    choice_3: '/interface-previews/choice-3.svg',
    choice_4: '/interface-previews/choice-4.svg',
  }

  return (
    <div className="preset-preview">
      <img
        src={imageByPreset[preset.id]}
        alt={`AperÃ§u de lâ€™interface ${preset.label} â€” ${preset.description}`}
      />

      <style jsx>{`
        .preset-preview {
          position: relative;
          overflow: hidden;
          aspect-ratio: 760 / 470;
          background: var(--novae-surface-alt);
          border-bottom: 1px solid var(--novae-border);
        }

        .preset-preview img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
          transition: transform 180ms ease;
        }

        .preset-preview:hover img {
          transform: scale(1.015);
        }
      `}</style>
    </div>
  )
}

export default function PersonnalisationPage() {
  const [selected, setSelected] = useState<UserThemeKey>('deep_emerald')
  const [savedTheme, setSavedTheme] = useState<UserThemeKey>('deep_emerald')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setLoading(false)
          return
        }

        const { data } = await supabase
          .from('user_interface_preferences')
          .select('theme_key')
          .eq('user_id', user.id)
          .maybeSingle()

        if (cancelled) return

        const themeKey = normalizeUserThemeKey(data?.theme_key)
        setSelected(themeKey)
        setSavedTheme(themeKey)
        previewTheme(themeKey)
      } catch (loadError) {
        console.error('[Personnalisation] load error', loadError)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const choosePreset = (preset: UserInterfacePreset) => {
    setSelected(preset.themeKey)
    setSuccess(false)
    setError(null)
    previewTheme(preset.themeKey)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Tu dois être connectée pour enregistrer ton choix.')
      }

      const preset = getUserInterfacePreset(selected)

      const interfacePayload = {
        user_id: user.id,
        theme_key: preset.themeKey,
        font_style: preset.fontStyle,
        interface_density: preset.interfaceDensity,
        tile_style: preset.tileStyle,
        home_layout: preset.homeLayout,
        reduced_motion: preset.reducedMotion,
        high_contrast: preset.highContrast,
      }

      const { data: existing, error: lookupError } = await supabase
        .from('user_interface_preferences')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (lookupError) throw lookupError

      const saveResult = existing
        ? await supabase
            .from('user_interface_preferences')
            .update(interfacePayload)
            .eq('user_id', user.id)
        : await supabase
            .from('user_interface_preferences')
            .insert(interfacePayload)

      if (saveResult.error) throw saveResult.error

      // Les quatre accueils sont volontairement construits autour
      // des trois mêmes accès principaux.
      await supabase
        .from('user_nova_profiles')
        .update({ main_priorities: FIXED_HOME_MODULES })
        .eq('user_id', user.id)

      previewTheme(preset.themeKey)
      setSavedTheme(preset.themeKey)
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : 'Impossible d’enregistrer ce choix.'

      setError(message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setSelected(savedTheme)
    previewTheme(savedTheme)
  }

  return (
    <main className="preset-page">
      <div className="preset-shell">
        <header className="preset-header">
          <Link href="/" className="back-link">
            ← Retour à l’accueil
          </Link>

          <div className="preset-heading">
            <span className="eyebrow">Personnalisation</span>
            <h1>Choisir mon interface</h1>
            <p>Sélectionne l’un des quatre univers déjà prêts.</p>
          </div>
        </header>

        {error && <div className="message error">{error}</div>}
        {success && (
          <div className="message success">
            Ton interface est enregistrée.
          </div>
        )}

        {loading ? (
          <div className="loading-card">Chargement de tes interfaces…</div>
        ) : (
          <section className="preset-grid" aria-label="Choix de l’interface">
            {USER_INTERFACE_PRESETS.map((preset) => {
              const isSelected = selected === preset.themeKey

              return (
                <button
                  key={preset.id}
                  type="button"
                  className={isSelected ? 'preset-card selected' : 'preset-card'}
                  onClick={() => choosePreset(preset)}
                  aria-pressed={isSelected}
                >
                  <PresetPreview preset={preset} />

                  <div className="preset-meta">
                    <div>
                      <strong>{preset.label}</strong>
                      <span>{preset.description}</span>
                    </div>

                    <span className="selection-indicator">
                      {isSelected ? '✓' : ''}
                    </span>
                  </div>
                </button>
              )
            })}
          </section>
        )}

        <div className="sticky-actions">
          <button
            type="button"
            className="save-button"
            onClick={() => void save()}
            disabled={saving || loading}
          >
            <PremiumIcon name="sparkle" width={19} height={19} />
            {saving ? 'Enregistrement…' : 'Enregistrer mon choix'}
          </button>

          <button
            type="button"
            className="cancel-button"
            onClick={cancel}
            disabled={saving}
          >
            Annuler les changements
          </button>
        </div>
      </div>

      <style jsx>{`
        .preset-page {
          min-height: 100dvh;
          padding: 30px 16px 120px;
          color: var(--novae-text-main);
          background:
            radial-gradient(
              circle at 8% 2%,
              color-mix(in srgb, var(--novae-primary-soft) 62%, transparent),
              transparent 28%
            ),
            var(--novae-background);
        }

        .preset-shell {
          width: min(100%, 1040px);
          margin: 0 auto;
        }

        .preset-header {
          margin-bottom: 24px;
        }

        .back-link {
          display: inline-flex;
          margin-bottom: 20px;
          color: var(--novae-primary);
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
        }

        .preset-heading {
          max-width: 720px;
        }

        .eyebrow {
          color: var(--novae-metal);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        h1 {
          margin: 7px 0 8px;
          font-family: var(--novae-font-title);
          font-size: clamp(38px, 7vw, 62px);
          font-weight: var(--novae-title-weight);
          line-height: 0.98;
        }

        .preset-heading p {
          margin: 0;
          color: var(--novae-text-muted);
          font-size: 16px;
          line-height: 1.5;
        }

        .message,
        .loading-card {
          margin-bottom: 18px;
          padding: 15px 17px;
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 16px;
          font-weight: 800;
        }

        .message.success {
          color: var(--novae-success);
        }

        .message.error {
          color: var(--novae-danger);
        }

        .preset-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .preset-card {
          overflow: hidden;
          padding: 0;
          color: inherit;
          text-align: left;
          background: var(--novae-surface);
          border: 1px solid var(--novae-border);
          border-radius: 24px;
          cursor: pointer;
          box-shadow: 0 16px 44px var(--novae-shadow);
          transition:
            transform 180ms ease,
            border-color 180ms ease,
            box-shadow 180ms ease;
        }

        .preset-card:hover {
          transform: translateY(-3px);
        }

        .preset-card.selected {
          border: 2px solid var(--novae-metal);
          box-shadow:
            0 0 0 4px color-mix(in srgb, var(--novae-metal) 15%, transparent),
            0 20px 48px var(--novae-shadow);
        }

        .preset-preview {
          min-height: 330px;
          padding: 18px;
          color: #1e2c26;
          background: #fbf8f2;
        }

        .preview-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .preview-brand {
          color: #b58549;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 24px;
          letter-spacing: 0.12em;
        }

        .preview-avatar {
          width: 24px;
          height: 24px;
          background: linear-gradient(135deg, #dbc4b2, #9f8068);
          border: 1px solid rgba(255, 255, 255, 0.7);
          border-radius: 50%;
        }

        .preview-date {
          display: block;
          margin-top: 14px;
          color: #a16f35;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .preview-greeting {
          display: block;
          margin: 2px 0 12px;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 24px;
          font-weight: 500;
        }

        .preview-hero {
          position: relative;
          overflow: hidden;
          min-height: 154px;
          padding: 16px;
          color: #fffaf2;
          background: linear-gradient(135deg, #193d33, #0d2b25);
          border-radius: 18px;
        }

        .preview-hero > div:first-child {
          position: relative;
          z-index: 2;
          width: 62%;
        }

        .preview-hero strong {
          display: block;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 17px;
          font-weight: 600;
          line-height: 1.05;
        }

        .preview-hero small {
          display: block;
          margin-top: 7px;
          color: rgba(255, 255, 255, 0.74);
          font-size: 7px;
        }

        .preview-wordmark {
          position: absolute;
          top: 42px;
          right: 16px;
          color: #d4a45f;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 27px;
          letter-spacing: 0.05em;
        }

        .preview-actions {
          position: absolute;
          right: 12px;
          bottom: 12px;
          left: 12px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 5px;
        }

        .preview-actions i {
          padding: 6px 2px;
          font-size: 6px;
          font-style: normal;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 7px;
        }

        .preview-situation {
          margin-top: 12px;
        }

        .preview-situation > span {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 13px;
        }

        .preview-panels,
        .preview-metrics {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 7px;
          margin-top: 7px;
        }

        .preview-panels i {
          height: 48px;
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(160, 130, 90, 0.22);
          border-radius: 10px;
        }

        .preview-metrics {
          grid-template-columns: repeat(3, 1fr);
          padding: 10px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(160, 130, 90, 0.2);
          border-radius: 10px;
        }

        .preview-metrics i {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 18px;
          font-style: normal;
          text-align: center;
        }

        .preview-choice_2 .preview-hero {
          background:
            radial-gradient(circle at 86% 80%, rgba(232, 174, 83, 0.5), transparent 22%),
            linear-gradient(135deg, #061a33, #020d1d);
        }

        .preview-choice_3 {
          background:
            radial-gradient(circle at 90% 0, rgba(116, 72, 105, 0.14), transparent 28%),
            #fbf7f6;
        }

        .preview-choice_3 .preview-hero {
          background:
            radial-gradient(circle at 88% 85%, rgba(220, 159, 111, 0.34), transparent 24%),
            linear-gradient(135deg, #5a294f, #33182f);
        }

        .preview-choice_4 {
          color: #f4f0e9;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.025), transparent),
            #0b0f12;
        }

        .preview-choice_4 .preview-brand,
        .preview-choice_4 .preview-date,
        .preview-choice_4 .preview-wordmark {
          color: #d09a57;
        }

        .preview-choice_4 .preview-greeting,
        .preview-choice_4 .preview-situation > span {
          color: #f4f0e9;
        }

        .preview-choice_4 .preview-hero {
          background:
            radial-gradient(circle at 88% 85%, rgba(224, 174, 107, 0.32), transparent 23%),
            linear-gradient(135deg, #07131f, #03080d);
          border: 1px solid rgba(208, 154, 87, 0.38);
        }

        .preview-choice_4 .preview-panels i {
          background: #12171b;
          border-color: #5e4a32;
        }

        .preset-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px;
        }

        .preset-meta strong {
          display: block;
          font-family: var(--novae-font-title);
          font-size: 27px;
          font-weight: 500;
        }

        .preset-meta span:not(.selection-indicator) {
          display: block;
          margin-top: 2px;
          color: var(--novae-text-muted);
          font-size: 14px;
        }

        .selection-indicator {
          display: inline-flex;
          flex: 0 0 42px;
          width: 42px;
          height: 42px;
          align-items: center;
          justify-content: center;
          color: #fff;
          background: var(--novae-metal);
          border: 1px solid var(--novae-metal);
          border-radius: 50%;
          font-size: 20px;
          font-weight: 900;
        }

        .preset-card:not(.selected) .selection-indicator {
          color: transparent;
          background: transparent;
        }

        .sticky-actions {
          position: sticky;
          bottom: 12px;
          z-index: 20;
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 10px;
          margin-top: 22px;
          padding: 12px;
          background: color-mix(
            in srgb,
            var(--novae-surface) 90%,
            transparent
          );
          border: 1px solid var(--novae-border);
          border-radius: 22px;
          box-shadow: 0 14px 40px var(--novae-shadow);
          backdrop-filter: blur(18px);
        }

        .save-button,
        .cancel-button {
          display: inline-flex;
          min-height: 52px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 12px 18px;
          font-weight: 900;
          border-radius: 15px;
          cursor: pointer;
        }

        .save-button {
          color: var(--novae-background);
          background: var(--novae-primary);
          border: 1px solid var(--novae-primary);
        }

        .cancel-button {
          color: var(--novae-primary);
          background: transparent;
          border: 1px solid var(--novae-border);
        }

        button:disabled {
          cursor: wait;
          opacity: 0.6;
        }

        @media (max-width: 760px) {
          .preset-grid {
            grid-template-columns: 1fr;
          }

          .preset-preview {
            min-height: 310px;
          }

          .sticky-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  )
}

