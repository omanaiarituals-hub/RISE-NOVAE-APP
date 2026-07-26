'use client'

import { supabase } from '@/lib/supabase/client'

export type NovaConversationSummary = {
  id: string
  title: string
  created_at: string
  updated_at: string
  last_message_at: string
}

export type NovaStoredMessage = {
  id: string
  role: 'user' | 'nova' | 'system'
  text: string
  metadata: Record<string, unknown>
  created_at: string
}

function titleFromMessage(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim()
  if (!clean) return 'Nouvelle conversation'
  return clean.length > 58 ? `${clean.slice(0, 58).trim()}…` : clean
}

export function useNovaConversationHistory(userId?: string) {
  async function listConversations(): Promise<NovaConversationSummary[]> {
    if (!userId) return []

    const { data, error } = await supabase
      .from('nova_conversations')
      .select('id,title,created_at,updated_at,last_message_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (error) throw error
    return (data || []) as NovaConversationSummary[]
  }

  async function createConversation(firstMessage: string): Promise<NovaConversationSummary> {
    if (!userId) throw new Error('Utilisateur introuvable.')

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('nova_conversations')
      .insert({
        user_id: userId,
        title: titleFromMessage(firstMessage),
        status: 'active',
        created_at: now,
        updated_at: now,
        last_message_at: now,
      })
      .select('id,title,created_at,updated_at,last_message_at')
      .single()

    if (error) throw error
    return data as NovaConversationSummary
  }

  async function saveMessage(
    conversationId: string,
    role: NovaStoredMessage['role'],
    text: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    if (!userId) throw new Error('Utilisateur introuvable.')
    const now = new Date().toISOString()
    const databaseRole = role === 'nova' ? 'assistant' : role

    const { error: messageError } = await supabase
      .from('nova_conversation_messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: databaseRole,
        content: text,
        metadata,
        created_at: now,
      })

    if (messageError) throw messageError

    const { error: conversationError } = await supabase
      .from('nova_conversations')
      .update({ updated_at: now, last_message_at: now })
      .eq('id', conversationId)
      .eq('user_id', userId)

    if (conversationError) throw conversationError
  }

  async function loadMessages(conversationId: string): Promise<NovaStoredMessage[]> {
    if (!userId) return []

    const { data, error } = await supabase
      .from('nova_conversation_messages')
      .select('id,role,content,metadata,created_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return (data || []).map((row) => ({
      id: row.id,
      role: row.role === 'assistant' ? 'nova' : row.role,
      text: row.content,
      metadata: (row.metadata || {}) as Record<string, unknown>,
      created_at: row.created_at,
    })) as NovaStoredMessage[]
  }

  async function deleteConversation(conversationId: string): Promise<void> {
    if (!userId) return

    const { error } = await supabase
      .from('nova_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async function renameConversation(conversationId: string, title: string): Promise<void> {
    if (!userId) return
    const clean = title.trim()
    if (!clean) return

    const { error } = await supabase
      .from('nova_conversations')
      .update({ title: clean.slice(0, 120), updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', userId)

    if (error) throw error
  }

  return {
    listConversations,
    createConversation,
    saveMessage,
    loadMessages,
    deleteConversation,
    renameConversation,
  }
}
