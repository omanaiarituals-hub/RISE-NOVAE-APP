// src/app/test-scan/page.tsx
'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TestScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/recipes/extract', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Unknown error');
        if (data.raw_response) console.log('Raw AI response:', data.raw_response);
      } else {
        setResult(data.recipe);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    setError(null);

    try {
      // Récupérer l'user connectée
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Tu dois être connectée pour sauvegarder. Va sur /auth et reviens.');
      }

      // Format objets {name, quantity} pour matcher le schema existant
const ingredientsObjects = (result.ingredients || [])
  .map((ing: any) => {
    const qty = ing.quantity != null 
      ? `${ing.quantity}${ing.unit ? ' ' + ing.unit : ''}`.trim()
      : '';
    return {
      name: ing.name || '',
      quantity: qty,
    };
  });

      // Insertion dans la table recipes (adapté à ton schema existant)
     const { error: insertError } = await supabase.from('recipes').insert({
  user_id: user.id,
  title: result.title || 'Recette sans titre',
  servings: result.servings ?? null,
  cook_time: result.cooking_time_minutes ? `${result.cooking_time_minutes} min` : null,
  category: null,        // ← null, à éditer manuellement dans le form après
  emoji: result.emoji || '🍽️',
ingredients: ingredientsObjects,
  steps: result.steps || [],
  source: 'ai_scan',
  difficulty: null,      // ← null aussi pour éviter une 2e erreur
});

      if (insertError) throw insertError;

      setSaved(true);
    } catch (err) {
      setError(`Échec sauvegarde : ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 20, fontFamily: 'sans-serif' }}>
      <h1>🧪 Test Scan-to-Recipe</h1>
      <p style={{ color: '#666' }}>
        Upload une photo de recette → extraction IA en JSON → sauvegarde dans tes recettes.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setSaved(false);
            setResult(null);
          }}
          style={{ display: 'block', marginBottom: 16 }}
        />
        <button
          type="submit"
          disabled={!file || loading}
          style={{
            padding: '10px 20px',
            background: loading ? '#999' : '#C4956A',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'wait' : 'pointer',
            fontSize: 16,
          }}
        >
          {loading ? '⏳ Extraction en cours...' : '✨ Extraire la recette'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 20, padding: 16, background: '#fee', borderRadius: 8, color: '#900' }}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20 }}>
          <h2>📋 Résultat</h2>
          <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <h3>{result.emoji} {result.title}</h3>
            <p>👥 {result.servings ?? '?'} portions · ⏱️ {result.cooking_time_minutes ?? '?'} min</p>

            <h4>🥕 Ingrédients</h4>
            <ul>
              {result.ingredients?.map((ing: any, i: number) => (
                <li key={i}>
                  {ing.quantity ?? ''} {ing.unit ?? ''} {ing.name}
                </li>
              ))}
            </ul>

            <h4>📝 Étapes</h4>
            <ol>
              {result.steps?.map((step: string, i: number) => (
                <li key={i} style={{ marginBottom: 8 }}>{step}</li>
              ))}
            </ol>
          </div>

          {!saved ? (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: saving ? '#999' : '#22863a',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: saving ? 'wait' : 'pointer',
                fontSize: 16,
                width: '100%',
              }}
            >
              {saving ? '💾 Sauvegarde en cours...' : '💾 Sauvegarder dans mes recettes'}
            </button>
          ) : (
            <div style={{ padding: 16, background: '#d4edda', color: '#155724', borderRadius: 8, textAlign: 'center' }}>
              ✅ Recette sauvegardée ! Va sur <a href="/recipes" style={{ color: '#155724', fontWeight: 'bold' }}>/recipes</a> pour la voir.
            </div>
          )}

          <details style={{ marginTop: 16 }}>
            <summary>JSON brut (debug)</summary>
            <pre style={{ background: '#222', color: '#0f0', padding: 12, borderRadius: 6, overflow: 'auto', fontSize: 12 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}