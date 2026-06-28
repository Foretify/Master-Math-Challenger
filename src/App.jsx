import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  TOTAL_QUESTIONS,
  buildAccuracyTrend,
  createQuestion,
  getStartingLevel,
  scoreCompetitionSessions,
  summarizeSession,
  updateLevel,
} from './lib/game'
import { newId, readDb, writeDb } from './lib/storage'

const SCORING_RULE = 'total_correct_time_tiebreak'

function asDateInputValue(date) {
  return date.toISOString().slice(0, 10)
}

function toDayStamp(isoDate) {
  return new Date(isoDate).toISOString().slice(0, 10)
}

function formatMs(ms) {
  return `${(ms / 1000).toFixed(2)}s`
}

function formatAccuracy(value) {
  return `${value.toFixed(1)}%`
}

async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function App() {
  const [db, setDb] = useState(() => readDb())
  const [currentUserId, setCurrentUserId] = useState(null)
  const [screen, setScreen] = useState('dashboard')
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [authForm, setAuthForm] = useState({
    displayName: '',
    email: '',
    password: '',
    ageOrGrade: '',
  })

  const [groupName, setGroupName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [competitionForm, setCompetitionForm] = useState({
    name: '',
    startDate: asDateInputValue(new Date()),
    endDate: '',
    scope: 'group',
    groupId: '',
    visibility: 'group-public',
    selectedUserIds: [],
  })
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')

  const [sessionState, setSessionState] = useState(null)
  const [lastSummary, setLastSummary] = useState(null)
  const [timerNowMs, setTimerNowMs] = useState(Date.now())

  const currentUser = useMemo(
    () => db.users.find((user) => user.id === currentUserId) ?? null,
    [db.users, currentUserId],
  )

  const userSessions = useMemo(
    () => db.sessions.filter((session) => session.userId === currentUserId),
    [db.sessions, currentUserId],
  )

  const userGroupMemberships = useMemo(
    () => db.groupMembers.filter((member) => member.userId === currentUserId),
    [db.groupMembers, currentUserId],
  )

  const userGroups = useMemo(
    () =>
      db.groups.filter((group) =>
        userGroupMemberships.some((membership) => membership.groupId === group.id),
      ),
    [db.groups, userGroupMemberships],
  )

  const activeCompetitions = useMemo(() => {
    const now = Date.now()

    return db.competitions.filter((competition) => {
      const isParticipant = db.competitionParticipants.some(
        (participant) =>
          participant.competitionId === competition.id && participant.userId === currentUserId,
      )

      if (!isParticipant) {
        return false
      }

      const start = new Date(competition.startDate).getTime()
      const end = competition.endDate ? new Date(competition.endDate).getTime() : Infinity

      return now >= start && now <= end
    })
  }, [db.competitionParticipants, db.competitions, currentUserId])

  const todayStats = useMemo(() => {
    const today = toDayStamp(new Date().toISOString())
    const todaySessions = userSessions.filter((session) => toDayStamp(session.startedAt) === today)

    const sessionCount = todaySessions.length
    const totalTimeMs = todaySessions.reduce(
      (sum, session) => sum + session.totalSessionDurationMs,
      0,
    )
    const totalQuestions = todaySessions.reduce(
      (sum, session) => sum + session.totalQuestions,
      0,
    )
    const totalCorrect = todaySessions.reduce((sum, session) => sum + session.correctCount, 0)

    return {
      sessionCount,
      totalTimeMs,
      totalQuestions,
      accuracyPercent: totalQuestions ? (totalCorrect / totalQuestions) * 100 : 0,
    }
  }, [userSessions])

  function persist(nextDb) {
    setDb(nextDb)
    writeDb(nextDb)
  }

  useEffect(() => {
    if (!sessionState) {
      return
    }

    const timer = setInterval(() => setTimerNowMs(Date.now()), 250)
    return () => clearInterval(timer)
  }, [sessionState])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    const email = authForm.email.trim().toLowerCase()
    const password = authForm.password.trim()

    if (!email || !password) {
      setAuthError('Email and password are required.')
      return
    }

    if (authMode === 'login') {
      const passwordHash = await hashPassword(password)
      const match = db.users.find((user) => {
        if (user.email !== email) {
          return false
        }

        if (user.passwordHash) {
          return user.passwordHash === passwordHash
        }

        return user.password === password
      })

      if (!match) {
        setAuthError('Invalid credentials.')
        return
      }

      if (!match.passwordHash) {
        persist({
          ...db,
          users: db.users.map((user) =>
            user.id === match.id
              ? (() => {
                  const { password: _password, ...rest } = user
                  return { ...rest, passwordHash }
                })()
              : user,
          ),
        })
      }

      setCurrentUserId(match.id)
      setAuthError('')
      setScreen('dashboard')
      return
    }

    const displayName = authForm.displayName.trim()
    if (!displayName) {
      setAuthError('Display name is required for sign up.')
      return
    }

    if (db.users.some((user) => user.email === email)) {
      setAuthError('That email is already registered.')
      return
    }

    const passwordHash = await hashPassword(password)
    const user = {
      id: newId('usr'),
      displayName,
      email,
      passwordHash,
      avatar: '',
      ageOrGrade: authForm.ageOrGrade.trim(),
      createdAt: new Date().toISOString(),
    }

    persist({
      ...db,
      users: [...db.users, user],
    })

    setCurrentUserId(user.id)
    setScreen('dashboard')
    setAuthError('')
  }

  function startSession(competitionId = null) {
    if (!currentUser) {
      return
    }

    const startingLevel = getStartingLevel(userSessions)
    setSessionState({
      sessionId: newId('ses'),
      competitionId,
      startedAt: new Date().toISOString(),
      currentLevel: startingLevel,
      questionIndex: 1,
      currentQuestion: createQuestion(startingLevel),
      questionStartedAt: Date.now(),
      answer: '',
      results: [],
    })
    setScreen('session')
  }

  function submitAnswer(event) {
    event.preventDefault()

    if (!sessionState) {
      return
    }

    const numericAnswer = Number(sessionState.answer)
    const isCorrect = Number.isFinite(numericAnswer)
      ? numericAnswer === sessionState.currentQuestion.correctAnswer
      : false
    const timeTakenMs = Date.now() - sessionState.questionStartedAt

    const questionResult = {
      factorA: sessionState.currentQuestion.factorA,
      factorB: sessionState.currentQuestion.factorB,
      correctAnswer: sessionState.currentQuestion.correctAnswer,
      userAnswer: Number.isFinite(numericAnswer) ? numericAnswer : null,
      isCorrect,
      timeTakenMs,
      difficultyLevelAtTime: sessionState.currentQuestion.level,
      answeredAt: new Date().toISOString(),
    }

    const nextResults = [...sessionState.results, questionResult]
    const nextLevel = updateLevel(sessionState.currentLevel, isCorrect)

    if (nextResults.length === TOTAL_QUESTIONS) {
      const endedAt = new Date().toISOString()
      const summary = summarizeSession(nextResults, sessionState.startedAt, endedAt)
      const sessionRecord = {
        id: sessionState.sessionId,
        userId: currentUserId,
        competitionId: sessionState.competitionId,
        startedAt: sessionState.startedAt,
        endedAt,
        ...summary,
      }

      const questionLogs = nextResults.map((result) => ({
        id: newId('qlog'),
        sessionId: sessionState.sessionId,
        ...result,
      }))

      const nextDb = {
        ...db,
        sessions: [...db.sessions, sessionRecord],
        questionsLog: [...db.questionsLog, ...questionLogs],
      }

      persist(nextDb)
      setLastSummary(sessionRecord)
      setSessionState(null)
      setScreen('summary')
      return
    }

    setSessionState({
      ...sessionState,
      currentLevel: nextLevel,
      questionIndex: sessionState.questionIndex + 1,
      currentQuestion: createQuestion(nextLevel),
      questionStartedAt: Date.now(),
      answer: '',
      results: nextResults,
    })
  }

  function appendAnswerDigit(digit) {
    setSessionState((previous) => {
      if (!previous) {
        return previous
      }

      return { ...previous, answer: `${previous.answer}${digit}` }
    })
  }

  function clearAnswer() {
    setSessionState((previous) => {
      if (!previous) {
        return previous
      }

      return { ...previous, answer: '' }
    })
  }

  function removeLastAnswerDigit() {
    setSessionState((previous) => {
      if (!previous) {
        return previous
      }

      return { ...previous, answer: previous.answer.slice(0, -1) }
    })
  }

  function createGroup(event) {
    event.preventDefault()
    const name = groupName.trim()

    if (!name || !currentUser) {
      return
    }

    const group = {
      id: newId('grp'),
      name,
      ownerUserId: currentUser.id,
      createdAt: new Date().toISOString(),
    }

    persist({
      ...db,
      groups: [...db.groups, group],
      groupMembers: [
        ...db.groupMembers,
        {
          groupId: group.id,
          userId: currentUser.id,
          role: 'admin',
          joinedAt: new Date().toISOString(),
        },
      ],
    })

    setGroupName('')
  }

  function createInvite(groupId) {
    const code = newId('INV').replace('_', '-').toUpperCase()

    persist({
      ...db,
      groupInvites: [
        ...db.groupInvites,
        {
          id: newId('ginv'),
          groupId,
          code,
          createdByUserId: currentUserId,
          createdAt: new Date().toISOString(),
          acceptedByUserId: null,
        },
      ],
    })
  }

  function joinGroupByCode(event) {
    event.preventDefault()
    const code = joinCode.trim().toUpperCase()
    const invite = db.groupInvites.find(
      (entry) => entry.code === code && !entry.acceptedByUserId,
    )

    if (!invite || !currentUserId) {
      return
    }

    const alreadyMember = db.groupMembers.some(
      (member) => member.groupId === invite.groupId && member.userId === currentUserId,
    )

    const nextMembers = alreadyMember
      ? db.groupMembers
      : [
          ...db.groupMembers,
          {
            groupId: invite.groupId,
            userId: currentUserId,
            role: 'member',
            joinedAt: new Date().toISOString(),
          },
        ]

    persist({
      ...db,
      groupMembers: nextMembers,
      groupInvites: db.groupInvites.map((entry) =>
        entry.id === invite.id ? { ...entry, acceptedByUserId: currentUserId } : entry,
      ),
    })

    setJoinCode('')
  }

  function createCompetition(event) {
    event.preventDefault()
    const name = competitionForm.name.trim()

    if (!name || !currentUser) {
      return
    }

    let participants = [...competitionForm.selectedUserIds]
    if (competitionForm.scope === 'group' && competitionForm.groupId) {
      const groupMemberIds = db.groupMembers
        .filter((member) => member.groupId === competitionForm.groupId)
        .map((member) => member.userId)

      participants =
        competitionForm.visibility === 'group-public' ? groupMemberIds : participants
    }

    if (!participants.includes(currentUser.id)) {
      participants.push(currentUser.id)
    }

    participants = [...new Set(participants)]

    const competition = {
      id: newId('cmp'),
      groupId: competitionForm.scope === 'group' ? competitionForm.groupId || null : null,
      creatorUserId: currentUser.id,
      name,
      startDate: new Date(competitionForm.startDate).toISOString(),
      endDate: competitionForm.endDate
        ? new Date(competitionForm.endDate).toISOString()
        : null,
      scoringRule: SCORING_RULE,
      visibility:
        competitionForm.scope === 'group' ? competitionForm.visibility : 'invite-only',
      createdAt: new Date().toISOString(),
    }

    const participantsRows = participants.map((userId) => ({
      competitionId: competition.id,
      userId,
      joinedAt: new Date().toISOString(),
    }))

    persist({
      ...db,
      competitions: [...db.competitions, competition],
      competitionParticipants: [...db.competitionParticipants, ...participantsRows],
    })

    setCompetitionForm({
      name: '',
      startDate: asDateInputValue(new Date()),
      endDate: '',
      scope: 'group',
      groupId: '',
      visibility: 'group-public',
      selectedUserIds: [],
    })
    setSelectedCompetitionId(competition.id)
  }

  function joinCompetition(competition) {
    const alreadyParticipant = db.competitionParticipants.some(
      (entry) =>
        entry.competitionId === competition.id && entry.userId === currentUserId,
    )

    if (alreadyParticipant || !currentUserId) {
      return
    }

    persist({
      ...db,
      competitionParticipants: [
        ...db.competitionParticipants,
        {
          competitionId: competition.id,
          userId: currentUserId,
          joinedAt: new Date().toISOString(),
        },
      ],
    })
  }

  function leaderboardForCompetition(competitionId) {
    const competition = db.competitions.find((item) => item.id === competitionId)

    if (!competition) {
      return []
    }

    const start = new Date(competition.startDate).getTime()
    const end = competition.endDate ? new Date(competition.endDate).getTime() : Infinity
    const participantIds = db.competitionParticipants
      .filter((participant) => participant.competitionId === competition.id)
      .map((participant) => participant.userId)

    const rows = participantIds.map((participantId) => {
      const sessions = db.sessions.filter((session) => {
        const started = new Date(session.startedAt).getTime()
        return (
          session.userId === participantId &&
          session.competitionId === competition.id &&
          started >= start &&
          started <= end
        )
      })

      const score = scoreCompetitionSessions(sessions)
      const user = db.users.find((item) => item.id === participantId)

      return {
        userId: participantId,
        displayName: user?.displayName ?? 'Unknown',
        ...score,
      }
    })

    return rows.sort((a, b) => {
      if (b.totalCorrect !== a.totalCorrect) {
        return b.totalCorrect - a.totalCorrect
      }

      return (a.avgTime ?? Number.POSITIVE_INFINITY) - (b.avgTime ?? Number.POSITIVE_INFINITY)
    })
  }

  function getBestSessions() {
    if (!userSessions.length) {
      return null
    }

    const byAccuracy = [...userSessions].sort((a, b) => b.accuracyPercent - a.accuracyPercent)[0]
    const bySpeed = [...userSessions].sort((a, b) => a.avgTimePerQuestion - b.avgTimePerQuestion)[0]
    const byDifficulty = [...userSessions].sort(
      (a, b) => b.difficultyLevelReached - a.difficultyLevelReached,
    )[0]

    return { byAccuracy, bySpeed, byDifficulty }
  }

  function accuracyChartPoints(values) {
    if (values.length === 0) {
      return ''
    }

    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * 100
        const y = 100 - value
        return `${x},${y}`
      })
      .join(' ')
  }

  if (!currentUser) {
    return (
      <main className="container">
        <h1>Master Math Challenger</h1>
        <p className="subtitle">Family multiplication competitions with adaptive practice.</p>

        <section className="panel">
          <h2>{authMode === 'login' ? 'Log in' : 'Create account'}</h2>
          <form onSubmit={handleAuthSubmit} className="stack">
            {authMode === 'signup' && (
              <label>
                Display name
                <input
                  value={authForm.displayName}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, displayName: event.target.value })
                  }
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm({ ...authForm, password: event.target.value })
                }
                required
              />
            </label>
            {authMode === 'signup' && (
              <label>
                Age or grade (optional)
                <input
                  value={authForm.ageOrGrade}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, ageOrGrade: event.target.value })
                  }
                />
              </label>
            )}
            {authError && <p className="error">{authError}</p>}
            <button type="submit">
              {authMode === 'login' ? 'Log in' : 'Sign up'}
            </button>
          </form>
          <button
            type="button"
            className="ghost"
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
          >
            {authMode === 'login'
              ? 'Need an account? Sign up'
              : 'Already have an account? Log in'}
          </button>
        </section>
      </main>
    )
  }

  const usersById = Object.fromEntries(db.users.map((user) => [user.id, user]))
  const bestSessions = getBestSessions()
  const trend = buildAccuracyTrend(userSessions, 12)
  const leaderboardCompetitionId =
    selectedCompetitionId || activeCompetitions[0]?.id || db.competitions[0]?.id || ''
  const leaderboardRows = leaderboardCompetitionId
    ? leaderboardForCompetition(leaderboardCompetitionId)
    : []

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Master Math Challenger</h1>
          <p className="subtitle">Hi {currentUser.displayName}! Ready for 30 multiplication questions?</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCurrentUserId(null)
            setScreen('dashboard')
          }}
        >
          Log out
        </button>
      </header>

      <nav className="tabs">
        {['dashboard', 'session', 'summary', 'groups', 'competitions', 'leaderboard', 'stats'].map(
          (tab) => (
            <button
              key={tab}
              type="button"
              className={screen === tab ? 'active' : ''}
              onClick={() => setScreen(tab)}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ),
        )}
      </nav>

      {screen === 'dashboard' && (
        <section className="panel stack">
          <h2>Dashboard</h2>
          <div className="stats-grid">
            <article>
              <h3>Today</h3>
              <p>Sessions: {todayStats.sessionCount}</p>
              <p>Questions: {todayStats.totalQuestions}</p>
              <p>Accuracy: {formatAccuracy(todayStats.accuracyPercent)}</p>
              <p>Total time: {formatMs(todayStats.totalTimeMs)}</p>
            </article>
            <article>
              <h3>Active competitions</h3>
              {activeCompetitions.length === 0 ? (
                <p>No active competitions yet.</p>
              ) : (
                <ul>
                  {activeCompetitions.map((competition) => (
                    <li key={competition.id}>{competition.name}</li>
                  ))}
                </ul>
              )}
            </article>
          </div>

          <label>
            Session target competition (optional)
            <select
              value={selectedCompetitionId}
              onChange={(event) => setSelectedCompetitionId(event.target.value)}
            >
              <option value="">Practice only</option>
              {activeCompetitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => startSession(selectedCompetitionId || null)}
          >
            Start a session
          </button>
        </section>
      )}

      {screen === 'session' && (
        <section className="panel stack">
          <h2>Session gameplay</h2>
          {!sessionState ? (
            <p>Start a session from your dashboard.</p>
          ) : (
            <>
              <p>
                Question {sessionState.questionIndex}/{TOTAL_QUESTIONS} • Level{' '}
                {sessionState.currentQuestion.level}
              </p>
              <p className="question">
                {sessionState.currentQuestion.factorA} × {sessionState.currentQuestion.factorB} = ?
              </p>
              <form onSubmit={submitAnswer} className="stack">
                <label>
                  Your answer
                  <input
                    value={sessionState.answer}
                    onChange={(event) =>
                      setSessionState({ ...sessionState, answer: event.target.value })
                    }
                    inputMode="numeric"
                    autoFocus
                  />
                </label>
                <div className="number-pad" aria-label="Number pad">
                  {['7', '8', '9', '4', '5', '6', '1', '2', '3', null, '0', null].map(
                    (digit, index) =>
                      digit ? (
                        <button
                          key={digit}
                          type="button"
                          className="number-pad-key"
                          onClick={() => appendAnswerDigit(digit)}
                        >
                          {digit}
                        </button>
                      ) : (
                        <div key={`spacer-${index}`} className="number-pad-spacer" aria-hidden="true" />
                      ),
                  )}
                </div>
                <div className="number-pad-actions">
                  <button
                    type="button"
                    className="number-pad-key"
                    onClick={removeLastAnswerDigit}
                    aria-label="Delete last digit"
                  >
                    ⌫
                  </button>
                  <button
                    type="button"
                    className="number-pad-key"
                    onClick={clearAnswer}
                    aria-label="Clear answer"
                  >
                    Clear
                  </button>
                </div>
                <p>Question timer: {formatMs(timerNowMs - sessionState.questionStartedAt)}</p>
                <button type="submit">Submit answer</button>
              </form>
            </>
          )}
        </section>
      )}

      {screen === 'summary' && (
        <section className="panel stack">
          <h2>Session summary</h2>
          {!lastSummary ? (
            <p>Complete a session to see your summary.</p>
          ) : (
            <>
              <p>
                Score: {lastSummary.correctCount}/{lastSummary.totalQuestions}
              </p>
              <p>Accuracy: {formatAccuracy(lastSummary.accuracyPercent)}</p>
              <p>Average answer time: {formatMs(lastSummary.avgTimePerQuestion)}</p>
              <p>Highest level reached: {lastSummary.difficultyLevelReached}</p>
              <p>Session duration: {formatMs(lastSummary.totalSessionDurationMs)}</p>
              {bestSessions && (
                <p>
                  Personal best accuracy: {formatAccuracy(bestSessions.byAccuracy.accuracyPercent)}
                </p>
              )}
            </>
          )}
        </section>
      )}

      {screen === 'groups' && (
        <section className="panel stack">
          <h2>Group management</h2>
          <form onSubmit={createGroup} className="inline-form">
            <input
              placeholder="New group name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
            />
            <button type="submit">Create group</button>
          </form>

          <form onSubmit={joinGroupByCode} className="inline-form">
            <input
              placeholder="Invite code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
            />
            <button type="submit">Join group</button>
          </form>

          <div className="stack">
            {userGroups.length === 0 ? (
              <p>You are not in any groups yet.</p>
            ) : (
              userGroups.map((group) => {
                const members = db.groupMembers.filter((member) => member.groupId === group.id)
                const myMembership = members.find((member) => member.userId === currentUserId)
                const canInvite =
                  myMembership?.role === 'admin' || group.ownerUserId === currentUserId

                return (
                  <article key={group.id} className="card stack">
                    <h3>{group.name}</h3>
                    <p>Owner: {usersById[group.ownerUserId]?.displayName ?? 'Unknown'}</p>
                    <p>
                      Members:{' '}
                      {members
                        .map((member) => usersById[member.userId]?.displayName ?? 'Unknown')
                        .join(', ')}
                    </p>
                    {canInvite && (
                      <button type="button" onClick={() => createInvite(group.id)}>
                        Create invite code
                      </button>
                    )}
                    <ul>
                      {db.groupInvites
                        .filter((invite) => invite.groupId === group.id && !invite.acceptedByUserId)
                        .map((invite) => (
                          <li key={invite.id}>{invite.code}</li>
                        ))}
                    </ul>
                  </article>
                )
              })
            )}
          </div>
        </section>
      )}

      {screen === 'competitions' && (
        <section className="panel stack">
          <h2>Competition creation</h2>
          <form onSubmit={createCompetition} className="stack">
            <label>
              Competition name
              <input
                value={competitionForm.name}
                onChange={(event) =>
                  setCompetitionForm({ ...competitionForm, name: event.target.value })
                }
                required
              />
            </label>
            <label>
              Scope
              <select
                value={competitionForm.scope}
                onChange={(event) =>
                  setCompetitionForm({ ...competitionForm, scope: event.target.value })
                }
              >
                <option value="group">Within group</option>
                <option value="adhoc">Ad-hoc invites</option>
              </select>
            </label>

            {competitionForm.scope === 'group' && (
              <>
                <label>
                  Group
                  <select
                    value={competitionForm.groupId}
                    onChange={(event) =>
                      setCompetitionForm({ ...competitionForm, groupId: event.target.value })
                    }
                  >
                    <option value="">Choose a group</option>
                    {userGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Visibility
                  <select
                    value={competitionForm.visibility}
                    onChange={(event) =>
                      setCompetitionForm({ ...competitionForm, visibility: event.target.value })
                    }
                  >
                    <option value="group-public">Public in group</option>
                    <option value="invite-only">Invite only</option>
                  </select>
                </label>
              </>
            )}

            <label>
              Start date
              <input
                type="date"
                value={competitionForm.startDate}
                onChange={(event) =>
                  setCompetitionForm({ ...competitionForm, startDate: event.target.value })
                }
              />
            </label>
            <label>
              End date (optional)
              <input
                type="date"
                value={competitionForm.endDate}
                onChange={(event) =>
                  setCompetitionForm({ ...competitionForm, endDate: event.target.value })
                }
              />
            </label>

            <fieldset className="stack">
              <legend>Participants</legend>
              {db.users
                .filter((user) => user.id !== currentUserId)
                .map((user) => (
                  <label key={user.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={competitionForm.selectedUserIds.includes(user.id)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...competitionForm.selectedUserIds, user.id]
                          : competitionForm.selectedUserIds.filter((id) => id !== user.id)

                        setCompetitionForm({ ...competitionForm, selectedUserIds: next })
                      }}
                    />
                    {user.displayName}
                  </label>
                ))}
            </fieldset>

            <p>Scoring rule: total correct answers, tie-break by average question time.</p>
            <button type="submit">Create competition</button>
          </form>

          <h3>Available competitions</h3>
          <div className="stack">
            {db.competitions.map((competition) => {
              const isParticipant = db.competitionParticipants.some(
                (participant) =>
                  participant.competitionId === competition.id && participant.userId === currentUserId,
              )
              const canJoinGroupPublic =
                !isParticipant &&
                competition.visibility === 'group-public' &&
                competition.groupId &&
                userGroupMemberships.some(
                  (member) => member.groupId === competition.groupId,
                )

              return (
                <article key={competition.id} className="card stack">
                  <h4>{competition.name}</h4>
                  <p>
                    {new Date(competition.startDate).toLocaleDateString()} -{' '}
                    {competition.endDate
                      ? new Date(competition.endDate).toLocaleDateString()
                      : 'Ongoing'}
                  </p>
                  <p>{competition.visibility === 'group-public' ? 'Public in group' : 'Invite-only'}</p>
                  {!isParticipant && canJoinGroupPublic && (
                    <button type="button" onClick={() => joinCompetition(competition)}>
                      Join competition
                    </button>
                  )}
                  {isParticipant && <p>You are participating.</p>}
                </article>
              )
            })}
          </div>
        </section>
      )}

      {screen === 'leaderboard' && (
        <section className="panel stack">
          <h2>Competition leaderboard</h2>
          <label>
            Competition
            <select
              value={leaderboardCompetitionId}
              onChange={(event) => setSelectedCompetitionId(event.target.value)}
            >
              {db.competitions.length === 0 && <option value="">No competitions yet</option>}
              {db.competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
          </label>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Total correct</th>
                <th>Sessions</th>
                <th>Avg time</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardRows.map((row, index) => (
                <tr key={row.userId}>
                  <td>{index + 1}</td>
                  <td>{row.displayName}</td>
                  <td>{row.totalCorrect}</td>
                  <td>{row.sessionCount}</td>
                  <td>{row.avgTime == null ? '-' : formatMs(row.avgTime)}</td>
                </tr>
              ))}
              {leaderboardRows.length === 0 && (
                <tr>
                  <td colSpan="5">No scores yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {screen === 'stats' && (
        <section className="panel stack">
          <h2>Personal stats & history</h2>
          {!bestSessions ? (
            <p>No sessions yet.</p>
          ) : (
            <div className="stats-grid">
              <article>
                <h3>Best accuracy</h3>
                <p>{formatAccuracy(bestSessions.byAccuracy.accuracyPercent)}</p>
              </article>
              <article>
                <h3>Fastest average time</h3>
                <p>{formatMs(bestSessions.bySpeed.avgTimePerQuestion)}</p>
              </article>
              <article>
                <h3>Highest level reached</h3>
                <p>{bestSessions.byDifficulty.difficultyLevelReached}</p>
              </article>
            </div>
          )}

          <div className="stack">
            <h3>Accuracy trend (last {trend.length} sessions)</h3>
            <svg viewBox="0 0 100 100" aria-label="Accuracy trend chart" className="chart">
              <polyline points={accuracyChartPoints(trend)} fill="none" strokeWidth="2" />
            </svg>
          </div>

          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Correct</th>
                <th>Accuracy</th>
                <th>Avg time</th>
                <th>Level</th>
              </tr>
            </thead>
            <tbody>
              {userSessions
                .slice()
                .reverse()
                .map((session) => (
                  <tr key={session.id}>
                    <td>{new Date(session.startedAt).toLocaleString()}</td>
                    <td>
                      {session.correctCount}/{session.totalQuestions}
                    </td>
                    <td>{formatAccuracy(session.accuracyPercent)}</td>
                    <td>{formatMs(session.avgTimePerQuestion)}</td>
                    <td>{session.difficultyLevelReached}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

export default App
