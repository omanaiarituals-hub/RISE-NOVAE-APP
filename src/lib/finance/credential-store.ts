import { supabaseAdmin } from '@/lib/supabase-admin'
import { decryptCredential, encryptCredential } from './security/credentials'
import type { BankingProviderId } from './types'

type CredentialRow = {
  user_id: string
  provider: BankingProviderId
  provider_user_id: string | null
  access_token_ciphertext: string
  access_token_iv: string
  access_token_auth_tag: string
}

export async function saveProviderCredential(input: {
  userId: string
  provider: BankingProviderId
  providerUserId?: string
  accessToken: string
}) {
  const encrypted = encryptCredential(input.accessToken)
  const { error } = await supabaseAdmin
    .from('finance_provider_credentials')
    .upsert({
      user_id: input.userId,
      provider: input.provider,
      provider_user_id: input.providerUserId || null,
      access_token_ciphertext: encrypted.ciphertext,
      access_token_iv: encrypted.iv,
      access_token_auth_tag: encrypted.authTag,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

  if (error) throw new Error(`Impossible d’enregistrer le jeton bancaire: ${error.message}`)
}

export async function getProviderCredential(userId: string, provider: BankingProviderId) {
  const { data, error } = await supabaseAdmin
    .from('finance_provider_credentials')
    .select('user_id,provider,provider_user_id,access_token_ciphertext,access_token_iv,access_token_auth_tag')
    .eq('user_id', userId)
    .eq('provider', provider)
    .maybeSingle()

  if (error) throw new Error(`Impossible de lire le jeton bancaire: ${error.message}`)
  if (!data) return null

  const row = data as CredentialRow
  return {
    providerUserId: row.provider_user_id || undefined,
    accessToken: decryptCredential({
      ciphertext: row.access_token_ciphertext,
      iv: row.access_token_iv,
      authTag: row.access_token_auth_tag,
    }),
  }
}

export async function deleteProviderCredential(userId: string, provider: BankingProviderId) {
  const { error } = await supabaseAdmin
    .from('finance_provider_credentials')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)
  if (error) throw new Error(`Impossible de supprimer le jeton bancaire: ${error.message}`)
}
