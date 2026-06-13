// test-env.js
// Lance depuis la racine du projet : node test-env.js
// Vérifie que toutes les variables d'env critiques sont présentes et valides

require('dotenv').config({ path: '.env.local' })

const vars = [
  { key: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-', label: 'Anthropic (NOVA)' },
  { key: 'NEXT_PUBLIC_SUPABASE_URL', prefix: 'https://', label: 'Supabase URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', prefix: 'eyJ', label: 'Supabase Anon Key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', prefix: 'eyJ', label: 'Supabase Service Role' },
  { key: 'STRIPE_SECRET_KEY', prefix: 'sk_', label: 'Stripe Secret' },
  { key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', prefix: 'pk_', label: 'Stripe Public' },
  { key: 'STRIPE_WEBHOOK_SECRET', prefix: 'whsec_', label: 'Stripe Webhook' },
  { key: 'BREVO_API_KEY', prefix: 'xkeysib-', label: 'Brevo' },
]

console.log('\n🔍 Vérification des variables d\'environnement NOVAÉ\n')
console.log('─'.repeat(55))

let allGood = true

for (const v of vars) {
  const value = process.env[v.key]
  if (!value) {
    console.log(`❌ MANQUANTE   ${v.label.padEnd(25)} (${v.key})`)
    allGood = false
  } else if (!value.startsWith(v.prefix)) {
    console.log(`⚠️  FORMAT KO   ${v.label.padEnd(25)} — devrait commencer par "${v.prefix}"`)
    allGood = false
  } else {
    const masked = value.substring(0, 12) + '...' + value.slice(-4)
    console.log(`✅ OK           ${v.label.padEnd(25)} ${masked}`)
  }
}

console.log('─'.repeat(55))
if (allGood) {
  console.log('\n🎉 Toutes les variables sont en ordre !\n')
} else {
  console.log('\n⚠️  Certaines variables sont manquantes ou incorrectes.\n')
  console.log('→ Vérifie ton fichier .env.local et tes variables Vercel.\n')
}