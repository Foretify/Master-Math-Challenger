import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getStartingLevel,
  scoreCompetitionSessions,
  summarizeSession,
  updateLevel,
} from './game.js'

test('adaptive level moves up/down and stays in bounds', () => {
  assert.equal(updateLevel(1, false), 1)
  assert.equal(updateLevel(10, true), 10)
  assert.equal(updateLevel(5, true), 6)
  assert.equal(updateLevel(5, false), 4)
})

test('starting level uses rolling average of recent sessions', () => {
  const sessions = [
    { difficultyLevelReached: 2 },
    { difficultyLevelReached: 4 },
    { difficultyLevelReached: 6 },
    { difficultyLevelReached: 8 },
    { difficultyLevelReached: 10 },
  ]

  assert.equal(getStartingLevel(sessions), 6)
})

test('session summary aggregates question outcomes', () => {
  const summary = summarizeSession(
    [
      { isCorrect: true, timeTakenMs: 1000, difficultyLevelAtTime: 2 },
      { isCorrect: false, timeTakenMs: 2000, difficultyLevelAtTime: 3 },
    ],
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:05.000Z',
  )

  assert.equal(summary.correctCount, 1)
  assert.equal(summary.totalQuestions, 2)
  assert.equal(summary.avgTimePerQuestion, 1500)
  assert.equal(summary.difficultyLevelReached, 3)
  assert.equal(summary.totalSessionDurationMs, 5000)
})

test('competition scoring sums total correct and averages time', () => {
  const score = scoreCompetitionSessions([
    { correctCount: 20, totalQuestions: 30, avgTimePerQuestion: 1000 },
    { correctCount: 25, totalQuestions: 30, avgTimePerQuestion: 1500 },
  ])

  assert.equal(score.totalCorrect, 45)
  assert.equal(score.totalQuestions, 60)
  assert.equal(score.avgTime, 1250)
  assert.equal(score.sessionCount, 2)
})
