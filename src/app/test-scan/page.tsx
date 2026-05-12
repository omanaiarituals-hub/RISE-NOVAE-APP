// src/app/test-scan/page.tsx
'use client';

import { useState } from 'react';

export default function TestScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

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
        if (data.raw_response) {
          console.log('Raw AI response:', data.raw_response);
        }
      } else {
        setResult(data.recipe);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 20, fontFamily: 'sans-serif' }}>
      <h1>🧪 Test Scan-to-Recipe</h1>
      <p style={{ color: '#666' }}>
        Upload une photo de recette → extraction IA en JSON.
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
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

          <details>
            <summary>JSON brut (pour debug)</summary>
            <pre style={{ background: '#222', color: '#0f0', padding: 12, borderRadius: 6, overflow: 'auto', fontSize: 12 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}