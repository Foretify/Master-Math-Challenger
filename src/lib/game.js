export const TOTAL_QUESTIONS = 30

export function clampLevel(level) {
  return Math.max(1, Math.min(10, level))
}

export function levelToFactorMax(level) {
  return Math.min(5 + clampLevel(level) - 1, 12)
}

export function createQuestion(level) {
  const max = levelToFactorMax(level)
  const factorA = 1 + Math.floor(Math.random() * max)
  const factorB = 1 + Math.floor(Math.random() * max)

  return {
    factorA,
    factorB,
    correctAnswer: factorA * factorB,
    level,
  }
}

export function getStartingLevel(previousSessions) {
  if (!previousSessions.length) {
    return 1
  }

  const recent = previousSessions.slice(-5)
  const avg =
    recent.reduce((total, session) => total + session.difficultyLevelReached, 0) /
    recent.length

  return clampLevel(Math.round(avg))
}

export function updateLevel(currentLevel, isCorrect) {
  if (isCorrect) {
    return clampLevel(currentLevel + 1)
  }

  return clampLevel(currentLevel - 1)
}

export function summarizeSession(questionResults, startedAt, endedAt) {
  const totalQuestions = questionResults.length
  const correctCount = questionResults.filter((item) => item.isCorrect).length
  const totalMs = questionResults.reduce((sum, item) => sum + item.timeTakenMs, 0)
  const avgTimePerQuestion = totalQuestions ? totalMs / totalQuestions : 0
  const difficultyLevelReached = questionResults.reduce(
    (max, item) => Math.max(max, item.difficultyLevelAtTime),
    1,
  )

  return {
    totalQuestions,
    correctCount,
    accuracyPercent: totalQuestions ? (correctCount / totalQuestions) * 100 : 0,
    avgTimePerQuestion,
    difficultyLevelReached,
    totalSessionDurationMs: new Date(endedAt).getTime() - new Date(startedAt).getTime(),
  }
}

export function buildAccuracyTrend(sessions, count = 10) {
  return sessions.slice(-count).map((session) => Number(session.accuracyPercent.toFixed(1)))
}

export function scoreCompetitionSessions(sessions) {
  const totalCorrect = sessions.reduce((sum, session) => sum + session.correctCount, 0)
  const totalQuestions = sessions.reduce((sum, session) => sum + session.totalQuestions, 0)
  const avgTime =
    sessions.length > 0
      ? sessions.reduce((sum, session) => sum + session.avgTimePerQuestion, 0) / sessions.length
      : Infinity

  return {
    totalCorrect,
    totalQuestions,
    avgTime,
    sessionCount: sessions.length,
  }
}
