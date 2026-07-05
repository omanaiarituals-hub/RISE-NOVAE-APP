// src/app/admin/blog/page.tsx
// Espace admin dédié au blog, réservé à Ness (vérif par email, comme /admin).
// Permet de créer, modifier, publier/dépublier et supprimer des articles en
// collant du HTML. Écrit directement dans la table Supabase "articles".
// La RLS de la table n'autorise l'écriture qu'au compte propriétaire, donc
// même si l'URL fuitait, personne d'autre ne pourrait publier.
//
// NOTE : tant que la bascule B4 n'est pas faite, les articles créés ici sont
// enregistrés dans la table mais le blog public affiche encore les 3 articles
// du fichier. Après B4, tout ce qui est publié ici sera visible en ligne.
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

const ADMIN_EMAILS = ['nesserinesediri@gmail.com']

interface FaqItem { q: string; a: string }
interface Article {
  id?: string
  slug: string
  title: string
  excerpt: string
  cover_image: string
  image_alt: string
  category: string
  read_time: string
  display_date: string
  meta_title: string
  meta_description: string
  body_html: string
  faq: FaqItem[]
  published: boolean
}

const EMPTY: Article = {
  slug: '', title: '', excerpt: '', cover_image: '', image_alt: '',
  category: '', read_time: '', display_date: new Date().toISOString().slice(0, 10),
  meta_title: '', meta_description: '', body_html: '', faq: [], published: false,
}

// Génère un slug propre depuis le titre (minuscules, tirets, sans accents).
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function AdminBlogPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useSupabaseAuth()

  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Article>({ ...EMPTY })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [slugTouched, setSlugTouched] = useState(false)

  // Garde d'accès : uniquement l'email admin.
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/auth'); return }
    if (!user.email || !ADMIN_EMAILS.includes(user.email)) { router.push('/'); return }
  }, [user, authLoading, router])

  const loadArticles = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('display_date', { ascending: false })
    if (!error && data) setArticles(data as Article[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (user?.email && ADMIN_EMAILS.includes(user.email)) loadArticles()
  }, [user, loadArticles])

  function set<K extends keyof Article>(key: K, value: Article[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function onTitleChange(value: string) {
    set('title', value)
    // Auto-génère le slug depuis le titre tant que tu ne l'as pas édité à la main.
    if (!slugTouched && !editingId) set('slug', slugify(value))
  }

  function addFaq() { set('faq', [...form.faq, { q: '', a: '' }]) }
  function updateFaq(i: number, field: 'q' | 'a', value: string) {
    const next = form.faq.slice()
    next[i] = { ...next[i], [field]: value }
    set('faq', next)
  }
  function removeFaq(i: number) { set('faq', form.faq.filter((_, idx) => idx !== i)) }

  function resetForm() {
    setForm({ ...EMPTY })
    setEditingId(null)
    setSlugTouched(false)
    setMessage(null)
  }

  function editArticle(a: Article) {
    setForm({ ...EMPTY, ...a, faq: Array.isArray(a.faq) ? a.faq : [] })
    setEditingId(a.id || null)
    setSlugTouched(true)
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    setMessage(null)
    if (!form.title.trim()) { setMessage({ type: 'err', text: 'Le titre est obligatoire.' }); return }
    if (!form.slug.trim()) { setMessage({ type: 'err', text: "L'identifiant d'URL (slug) est obligatoire." }); return }
    if (!form.body_html.trim()) { setMessage({ type: 'err', text: 'Le contenu HTML est obligatoire.' }); return }

    setSaving(true)
    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      excerpt: form.excerpt.trim() || null,
      cover_image: form.cover_image.trim() || null,
      image_alt: form.image_alt.trim() || null,
      category: form.category.trim() || null,
      read_time: form.read_time.trim() || null,
      display_date: form.display_date || null,
      meta_title: form.meta_title.trim() || form.title.trim(),
      meta_description: form.meta_description.trim() || form.excerpt.trim() || null,
      body_html: form.body_html,
      faq: form.faq.filter(f => f.q.trim() && f.a.trim()),
      published: form.published,
      updated_at: new Date().toISOString(),
    }

    let error
    if (editingId) {
      ({ error } = await supabase.from('articles').update(payload).eq('id', editingId))
    } else {
      ({ error } = await supabase.from('articles').insert(payload))
    }
    setSaving(false)

    if (error) {
      const dup = error.code === '23505' || /duplicate|unique/i.test(error.message)
      setMessage({ type: 'err', text: dup
        ? "Cet identifiant d'URL (slug) existe déjà. Choisis-en un autre."
        : `Erreur : ${error.message}` })
      return
    }
    setMessage({ type: 'ok', text: editingId ? 'Article mis à jour.' : 'Article créé.' })
    resetForm()
    loadArticles()
  }

  async function togglePublished(a: Article) {
    if (!a.id) return
    const { error } = await supabase.from('articles')
      .update({ published: !a.published, updated_at: new Date().toISOString() })
      .eq('id', a.id)
    if (!error) loadArticles()
  }

  async function remove(a: Article) {
    if (!a.id) return
    if (!confirm(`Supprimer définitivement l'article "${a.title}" ? Cette action est irréversible.`)) return
    const { error } = await supabase.from('articles').delete().eq('id', a.id)
    if (!error) { if (editingId === a.id) resetForm(); loadArticles() }
    else setMessage({ type: 'err', text: `Erreur suppression : ${error.message}` })
  }

  if (authLoading || !user) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#8a7a6a' }}>Chargement...</div>
  }
  if (!user.email || !ADMIN_EMAILS.includes(user.email)) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#8a7a6a' }}>Accès réservé.</div>
  }

  const L = '#8A6FB0'
  const input: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid #e4ddd3',
    fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff',
  }
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#8a7a6a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' }
  const field: React.CSSProperties = { marginBottom: 14 }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 18px 80px', fontFamily: 'system-ui, sans-serif', color: '#3d2618' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Link href="/admin" style={{ fontSize: 13, color: L, textDecoration: 'none' }}>← Admin</Link>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, margin: '6px 0 0' }}>Blog, publication</h1>
          <p style={{ fontSize: 13, color: '#8a7a6a', margin: '2px 0 0' }}>Colle ton HTML, remplis les champs, publie.</p>
        </div>
      </div>

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16, fontSize: 14,
          background: message.type === 'ok' ? 'rgba(120,180,120,0.14)' : 'rgba(220,90,90,0.12)',
          color: message.type === 'ok' ? '#3a7a3a' : '#b23b3b' }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* COLONNE GAUCHE : formulaire */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #eee5da', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: L, marginBottom: 14 }}>
              {editingId ? 'Modifier un article' : 'Nouvel article'}
            </div>

            <div style={field}>
              <label style={label}>Titre *</label>
              <input style={input} value={form.title} onChange={e => onTitleChange(e.target.value)} placeholder="Le titre visible de l'article" />
            </div>

            <div style={field}>
              <label style={label}>Identifiant d'URL (slug) *</label>
              <input style={input} value={form.slug}
                onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)) }}
                placeholder="charge-mentale-femmes" />
              <p style={{ fontSize: 11, color: '#a89a8a', margin: '4px 0 0' }}>
                L'adresse sera novae-by-omanaia.com/blog/{form.slug || '...'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={field}>
                <label style={label}>Catégorie</label>
                <input style={input} value={form.category} onChange={e => set('category', e.target.value)} placeholder="Neurosciences" />
              </div>
              <div style={field}>
                <label style={label}>Temps de lecture</label>
                <input style={input} value={form.read_time} onChange={e => set('read_time', e.target.value)} placeholder="5 min" />
              </div>
            </div>

            <div style={field}>
              <label style={label}>Date d'affichage</label>
              <input style={input} type="date" value={form.display_date} onChange={e => set('display_date', e.target.value)} />
            </div>

            <div style={field}>
              <label style={label}>Image de couverture (URL)</label>
              <input style={input} value={form.cover_image} onChange={e => set('cover_image', e.target.value)} placeholder="https://..." />
            </div>
            <div style={field}>
              <label style={label}>Texte alternatif de l'image</label>
              <input style={input} value={form.image_alt} onChange={e => set('image_alt', e.target.value)} placeholder="Décris l'image en quelques mots" />
            </div>

            <div style={field}>
              <label style={label}>Extrait (résumé court)</label>
              <textarea style={{ ...input, minHeight: 60, resize: 'vertical' }} value={form.excerpt} onChange={e => set('excerpt', e.target.value)} placeholder="La phrase d'accroche affichée dans la liste du blog." />
            </div>

            <div style={{ borderTop: '1px solid #f0e9df', margin: '4px 0 14px' }} />

            <div style={field}>
              <label style={label}>Contenu HTML de l'article *</label>
              <textarea
                style={{ ...input, minHeight: 260, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, lineHeight: 1.5 }}
                value={form.body_html}
                onChange={e => set('body_html', e.target.value)}
                placeholder="<p>Colle ici le HTML mis en forme de ton article...</p>"
              />
            </div>

            <div style={{ borderTop: '1px solid #f0e9df', margin: '4px 0 14px' }} />

            <div style={field}>
              <label style={label}>Titre SEO (balise title Google)</label>
              <input style={input} value={form.meta_title} onChange={e => set('meta_title', e.target.value)} placeholder="Laisse vide pour reprendre le titre" />
            </div>
            <div style={field}>
              <label style={label}>Description SEO (meta description)</label>
              <textarea style={{ ...input, minHeight: 56, resize: 'vertical' }} value={form.meta_description} onChange={e => set('meta_description', e.target.value)} placeholder="140 à 160 caractères qui donnent envie de cliquer." />
            </div>

            {/* FAQ */}
            <div style={field}>
              <label style={label}>FAQ (questions/réponses, bon pour le SEO)</label>
              {form.faq.map((f, i) => (
                <div key={i} style={{ border: '1px solid #eee5da', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                  <input style={{ ...input, marginBottom: 6 }} value={f.q} onChange={e => updateFaq(i, 'q', e.target.value)} placeholder="Question" />
                  <textarea style={{ ...input, minHeight: 48, resize: 'vertical' }} value={f.a} onChange={e => updateFaq(i, 'a', e.target.value)} placeholder="Réponse" />
                  <button onClick={() => removeFaq(i)} style={{ marginTop: 6, fontSize: 12, color: '#b23b3b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Retirer cette question</button>
                </div>
              ))}
              <button onClick={addFaq} style={{ fontSize: 13, color: L, background: 'none', border: `1px dashed ${L}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>+ Ajouter une question</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px' }}>
              <input id="pub" type="checkbox" checked={form.published} onChange={e => set('published', e.target.checked)} style={{ width: 18, height: 18 }} />
              <label htmlFor="pub" style={{ fontSize: 14 }}>Publier (visible publiquement). Décoché = brouillon.</label>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={save} disabled={saving}
                style={{ flex: 1, padding: '11px 16px', borderRadius: 10, border: 'none', cursor: saving ? 'default' : 'pointer',
                  background: `linear-gradient(135deg, ${L}, #6f57a0)`, color: '#fff', fontWeight: 700, fontSize: 14, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Enregistrement...' : editingId ? 'Enregistrer les modifications' : 'Créer l\'article'}
              </button>
              {editingId && (
                <button onClick={resetForm} style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid #e4ddd3', background: '#fff', cursor: 'pointer', fontSize: 14 }}>Annuler</button>
              )}
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : aperçu + liste */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #eee5da', borderRadius: 16, padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: L }}>Aperçu du rendu</div>
              <button onClick={() => setShowPreview(p => !p)} style={{ fontSize: 12, color: L, background: 'none', border: 'none', cursor: 'pointer' }}>
                {showPreview ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            {showPreview && (
              <div style={{ border: '1px solid #f0e9df', borderRadius: 10, padding: 14, maxHeight: 420, overflow: 'auto', fontSize: 15, lineHeight: 1.6 }}>
                {form.title && <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, margin: '0 0 10px' }}>{form.title}</h2>}
                {form.body_html
                  ? <div dangerouslySetInnerHTML={{ __html: form.body_html }} />
                  : <p style={{ color: '#a89a8a' }}>Le rendu de ton HTML s'affichera ici au fur et à mesure.</p>}
              </div>
            )}
          </div>

          <div style={{ background: '#fff', border: '1px solid #eee5da', borderRadius: 16, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: L, marginBottom: 12 }}>
              Articles ({articles.length})
            </div>
            {loading ? (
              <p style={{ color: '#a89a8a', fontSize: 14 }}>Chargement...</p>
            ) : articles.length === 0 ? (
              <p style={{ color: '#a89a8a', fontSize: 14 }}>Aucun article pour le moment.</p>
            ) : (
              articles.map(a => (
                <div key={a.id} style={{ borderTop: '1px solid #f0e9df', padding: '12px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: '#a89a8a' }}>
                      /{a.slug} · {a.category || 'sans catégorie'} · {a.display_date || 'sans date'}
                    </div>
                    <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: a.published ? 'rgba(120,180,120,0.16)' : 'rgba(180,160,120,0.16)',
                      color: a.published ? '#3a7a3a' : '#8a6a3a' }}>
                      {a.published ? 'Publié' : 'Brouillon'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => editArticle(a)} style={{ fontSize: 12, color: L, background: 'none', border: `1px solid ${L}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Modifier</button>
                    <button onClick={() => togglePublished(a)} style={{ fontSize: 12, color: '#8a6a3a', background: 'none', border: '1px solid #d8c8a8', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
                      {a.published ? 'Dépublier' : 'Publier'}
                    </button>
                    <button onClick={() => remove(a)} style={{ fontSize: 12, color: '#b23b3b', background: 'none', border: '1px solid #e8c4c4', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Supprimer</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}