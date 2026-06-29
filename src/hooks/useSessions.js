import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { logActivity } from '../lib/activityLog'

function toSessionRecord(row) {
  return {
    id: row.id,
    userId: row.user_id,
    competitionId: row.competition_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    totalQuestions: row.total_questions,
    correctCount: row.correct_count,
    accuracyPercent: row.accuracy_percent,
    avgTimePerQuestion: row.avg_time_per_question,
    difficultyLevelReached: row.difficulty_level_reached,
    totalSessionDurationMs: row.total_session_duration_ms,
  }
}

export function useSessions(userId) {
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!userId) {
      setSessions([])
      return
    }

    const { data } = await supabase.from('sessions').select('*').eq('user_id', userId)
    setSessions((data ?? []).map(toSessionRecord))
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function saveSession({ sessionId, competitionId, startedAt, endedAt, summary, results }) {
    const { error: insertError } = await supabase.from('sessions').insert({
      id: sessionId,
      user_id: userId,
      competition_id: competitionId,
      started_at: startedAt,
      ended_at: endedAt,
      total_questions: summary.totalQuestions,
      correct_count: summary.correctCount,
      accuracy_percent: summary.accuracyPercent,
      avg_time_per_question: summary.avgTimePerQuestion,
      difficulty_level_reached: summary.difficultyLevelReached,
      total_session_duration_ms: summary.totalSessionDurationMs,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    const logs = results.map((result) => ({
      session_id: sessionId,
      factor_a: result.factorA,
      factor_b: result.factorB,
      correct_answer: result.correctAnswer,
      user_answer: result.userAnswer,
      is_correct: result.isCorrect,
      time_taken_ms: result.timeTakenMs,
      difficulty_level_at_time: result.difficultyLevelAtTime,
      answered_at: result.answeredAt,
    }))

    await supabase.from('questions_log').insert(logs)

    setError('')
    await logActivity('session_completed', { session_id: sessionId })
    await refresh()
  }

  return { sessions, error, saveSession, refresh }
}
