import { supabase } from './supabaseClient'

export async function logActivity(eventType, metadata = {}) {
  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData?.session?.user?.id ?? null

  await supabase.from('activity_log').insert({
    user_id: userId,
    event_type: eventType,
    metadata,
  })
}
