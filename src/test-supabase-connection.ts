// Fichier de test simple pour vérifier la connexion Supabase
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('URL Supabase:', supabaseUrl)
console.log('Clé Anon présente:', supabaseAnonKey ? '✅' : '❌')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSupabaseConnection() {
  try {
    console.log('🔍 Test de connexion à Supabase...')
    
    // Test simple : vérifier si on peut accéder à la version de Supabase
    const { data, error } = await supabase.from('users').select('count').limit(1)
    
    if (error) {
      console.error('❌ Erreur de connexion:', error.message)
      return false
    }
    
    console.log('✅ Connexion Supabase réussie !')
    console.log('📊 Données reçues:', data)
    return true
    
  } catch (err) {
    console.error('❌ Erreur critique:', err)
    return false
  }
}

// Test de l'authentification
async function testAuth() {
  try {
    console.log('🔐 Test de l\'authentification...')
    
    // Test d'inscription
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'testpassword123'
    })
    
    if (signUpError) {
      console.log('⚠️ Erreur d\'inscription (attendu si utilisateur existe):', signUpError.message)
    } else {
      console.log('✅ Inscription test réussie:', signUpData.user?.email)
    }
    
    // Test de connexion
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword123'
    })
    
    if (signInError) {
      console.log('⚠️ Erreur de connexion:', signInError.message)
    } else {
      console.log('✅ Connexion test réussie:', signInData.user?.email)
    }
    
  } catch (err) {
    console.error('❌ Erreur critique auth:', err)
  }
}

// Exécuter les tests
async function runTests() {
  console.log('🚀 Début des tests Supabase...')
  
  const connectionOk = await testSupabaseConnection()
  
  if (connectionOk) {
    await testAuth()
  }
  
  console.log('🏁 Tests terminés')
}

// Exporter pour utilisation dans un composant React si besoin
export { testSupabaseConnection, testAuth, runTests }

// Exécuter les tests si ce fichier est lancé directement
if (typeof window === 'undefined') {
  runTests()
}
