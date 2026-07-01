import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { logActivity } from '../lib/activityLog'
import { clampQuestionCount } from '../lib/game'

const SCORING_RULE = 'total_correct_time_tiebreak'

export function useCompetitions(userId) {
  const [competitions, setCompetitions] = useState([])
  const [participants, setParticipants] = useState([])
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!userId) {
      setCompetitions([])
      setParticipants([])
      return
    }

    const [competitionsRes, participantsRes] = await Promise.all([
      supabase.from('competitions').select('*'),
      supabase.from('competition_participants').select('*'),
    ])

    setCompetitions(competitionsRes.data ?? [])
    setParticipants(participantsRes.data ?? [])
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createCompetition = useCallback(async (form, groupMemberIds) => {
    const name = form.name.trim()
    if (!name || !userId) {
      setError('Competition name is required.')
      return
    }

    let participantIds = [...form.selectedUserIds]
    if (form.scope === 'group' && form.groupId && form.visibility === 'group-public') {
      participantIds = groupMemberIds
    }

    if (!participantIds.includes(userId)) {
      participantIds.push(userId)
    }

    participantIds = [...new Set(participantIds)]

    const { data: competition, error: insertError } = await supabase
      .from('competitions')
      .insert({
        group_id: form.scope === 'group' ? form.groupId || null : null,
        creator_user_id: userId,
        name,
        start_date: new Date(form.startDate).toISOString(),
        end_date: form.endDate ? new Date(form.endDate).toISOString() : null,
        scoring_rule: SCORING_RULE,
        visibility: form.scope === 'group' ? form.visibility : 'invite-only',
        question_count: clampQuestionCount(form.questionCount),
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      return
    }

    const rows = participantIds.map((id) => ({ competition_id: competition.id, user_id: id }))
    const { error: participantsError } = await supabase.from('competition_participants').insert(rows)

    if (participantsError) {
      setError(participantsError.message)
      return
    }

    setError('')
    await logActivity('competition_created', { competition_id: competition.id })
    await refresh()
    return competition
  }, [userId, refresh])

  const joinCompetition = useCallback(async (competitionId) => {
    const alreadyParticipant = participants.some(
      (entry) => entry.competition_id === competitionId && entry.user_id === userId,
    )

    if (alreadyParticipant || !userId) {
      return
    }

    await supabase
      .from('competition_participants')
      .insert({ competition_id: competitionId, user_id: userId })

    await refresh()
  }, [userId, participants, refresh])

  const fetchAppLeaderboard = useCallback(async () => {
    const [{ data, error: rpcError }, { data: sessionRows }] = await Promise.all([
      supabase.rpc('get_app_leaderboard'),
      supabase.from('sessions').select('user_id, total_questions, correct_count'),
    ])

    if (rpcError) {
      setError(rpcError.message)
      return []
    }

    const questionTotals = {}
    for (const s of sessionRows ?? []) {
      if (!questionTotals[s.user_id]) questionTotals[s.user_id] = { totalQuestions: 0, totalCorrect: 0 }
      questionTotals[s.user_id].totalQuestions += Number(s.total_questions ?? 0)
      questionTotals[s.user_id].totalCorrect += Number(s.correct_count ?? 0)
    }

    return (data ?? [])
      .map((row) => {
        const qt = questionTotals[row.user_id]
        const accuracyPercent = qt && qt.totalQuestions > 0
          ? Number(((qt.totalCorrect / qt.totalQuestions) * 100).toFixed(1))
          : null
        return {
          userId: row.user_id,
          displayName: row.display_name,
          totalCorrect: Number(row.total_correct),
          sessionCount: Number(row.session_count),
          avgTime: row.avg_time ?? null,
          accuracyPercent,
        }
      })
      .sort((a, b) => {
        if (b.totalCorrect !== a.totalCorrect) {
          return b.totalCorrect - a.totalCorrect
        }
        return (a.avgTime ?? Number.POSITIVE_INFINITY) - (b.avgTime ?? Number.POSITIVE_INFINITY)
      })
  }, [])

  const fetchLeaderboard = useCallback(async (competitionId) => {
    if (!competitionId) {
      return []
    }

    const { data, error: rpcError } = await supabase.rpc('get_leaderboard', {
      p_competition_id: competitionId,
    })

    if (rpcError) {
      setError(rpcError.message)
      return []
    }

    return (data ?? [])
      .map((row) => ({
        userId: row.user_id,
        displayName: row.display_name,
        totalCorrect: row.total_correct,
        sessionCount: row.session_count,
        avgTime: row.avg_time ?? null,
      }))
      .sort((a, b) => {
        if (b.totalCorrect !== a.totalCorrect) {
          return b.totalCorrect - a.totalCorrect
        }
        return (a.avgTime ?? Number.POSITIVE_INFINITY) - (b.avgTime ?? Number.POSITIVE_INFINITY)
      })
  }, [])

  return useMemo(
    () => ({
      competitions,
      participants,
      error,
      createCompetition,
      joinCompetition,
      fetchLeaderboard,
      fetchAppLeaderboard,
      refresh,
    }),
    [competitions, participants, error, createCompetition, joinCompetition, fetchLeaderboard, fetchAppLeaderboard, refresh],
  )
}
