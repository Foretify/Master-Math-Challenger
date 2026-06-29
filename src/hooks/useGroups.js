import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { logActivity } from '../lib/activityLog'

function randomInviteCode() {
  return Array.from({ length: 8 }, () =>
    '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[Math.floor(Math.random() * 32)],
  ).join('')
}

export function useGroups(userId) {
  const [groups, setGroups] = useState([])
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!userId) {
      setGroups([])
      setMembers([])
      setInvites([])
      return
    }

    const [groupsRes, membersRes, invitesRes] = await Promise.all([
      supabase.from('groups').select('*'),
      supabase.from('group_members').select('*'),
      supabase.from('group_invites').select('*'),
    ])

    setGroups(groupsRes.data ?? [])
    setMembers(membersRes.data ?? [])
    setInvites(invitesRes.data ?? [])
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createGroup = useCallback(async (name) => {
    const trimmed = name.trim()
    if (!trimmed || !userId) {
      setError('Group name is required.')
      return
    }

    const { data: group, error: insertError } = await supabase
      .from('groups')
      .insert({ name: trimmed, owner_user_id: userId })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      return
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: userId, role: 'admin' })

    if (memberError) {
      setError(memberError.message)
      return
    }

    setError('')
    await logActivity('group_created', { group_id: group.id })
    await refresh()
  }, [userId, refresh])

  const createInvite = useCallback(async (groupId) => {
    const code = randomInviteCode()

    const { error: inviteError } = await supabase.from('group_invites').insert({
      group_id: groupId,
      code,
      created_by_user_id: userId,
    })

    if (inviteError) {
      setError(inviteError.message)
      return
    }

    await refresh()
  }, [userId, refresh])

  const joinGroupByCode = useCallback(async (code) => {
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode || !userId) {
      return
    }

    const { data: invite, error: lookupError } = await supabase
      .from('group_invites')
      .select('*')
      .eq('code', trimmedCode)
      .is('accepted_by_user_id', null)
      .single()

    if (lookupError || !invite) {
      setError('Invite code not found or already used.')
      return
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .upsert({ group_id: invite.group_id, user_id: userId, role: 'member' }, { onConflict: 'group_id,user_id' })

    if (memberError) {
      setError(memberError.message)
      return
    }

    await supabase
      .from('group_invites')
      .update({ accepted_by_user_id: userId })
      .eq('id', invite.id)

    setError('')
    await logActivity('group_joined', { group_id: invite.group_id })
    await refresh()
  }, [userId, refresh])

  return useMemo(
    () => ({ groups, members, invites, error, createGroup, createInvite, joinGroupByCode, refresh }),
    [groups, members, invites, error, createGroup, createInvite, joinGroupByCode, refresh],
  )
}
