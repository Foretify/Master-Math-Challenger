import { useEffect, useMemo, useState } from 'react'
import './App.css'
import logo from './assets/logo-512.png'
import {
  DEFAULT_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
  buildAccuracyTrend,
  clampQuestionCount,
  createQuestion,
  getStartingLevel,
  summarizeSession,
  updateLevel,
} from './lib/game'
import { supabase } from './lib/supabaseClient'
import { useAuth } from './hooks/useAuth'
import { useGroups } from './hooks/useGroups'
import { useCompetitions } from './hooks/useCompetitions'
import { useSessions } from './hooks/useSessions'
import AdminPage from './components/AdminPage'

// Null entries keep 0 centered by reserving empty keypad cells in a 3x4 grid.
const KEYPAD_LAYOUT = ['7', '8', '9', '4', '5', '6', '1', '2', '3', null, '0', null]

function asDateInputValue(date) {
  return date.toISOString().slice(0, 10)
}

function formatMs(ms) {
  return `${(ms / 1000).toFixed(2)}s`
}

function formatAccuracy(value) {
  return `${value.toFixed(1)}%`
}

const CHART_Y_AXIS_TICKS = [0, 25, 50, 75, 100]
const CHART_LEFT_EDGE = 12
const CHART_TOP_EDGE = 12
const CHART_BOTTOM_EDGE = 92
const CHART_WIDTH = 84
const CHART_HEIGHT = 80
const CHART_LABEL_TOP_THRESHOLD = 18
const CHART_LABEL_BELOW_OFFSET = 7
const CHART_LABEL_ABOVE_OFFSET = 4

function App() {
  const auth = useAuth()
  const currentUserId = auth.user?.id ?? null

  const [screen, setScreen] = useState('dashboard')
  const [authMode, setAuthMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [authForm, setAuthForm] = useState({
    displayName: '',
    email: '',
    password: '',
    ageOrGrade: '',
  })
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resetMessage, setResetMessage] = useState('')

  const [allProfiles, setAllProfiles] = useState([])
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
    questionCount: DEFAULT_QUESTION_COUNT,
  })
  const [practiceQuestionCount, setPracticeQuestionCount] = useState(DEFAULT_QUESTION_COUNT)
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')
  const [leaderboardRows, setLeaderboardRows] = useState([])
  const [appLeaderboardRows, setAppLeaderboardRows] = useState([])
  const [appLeaderboardSort, setAppLeaderboardSort] = useState('score')

  const sortedAppLeaderboardRows = useMemo(() => {
    if (appLeaderboardSort === 'sessions') {
      return [...appLeaderboardRows].sort((a, b) => b.sessionCount - a.sessionCount)
    }
    return [...appLeaderboardRows].sort((a, b) => {
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect
      return (a.avgTime ?? Number.POSITIVE_INFINITY) - (b.avgTime ?? Number.POSITIVE_INFINITY)
    })
  }, [appLeaderboardRows, appLeaderboardSort])

  const [sessionState, setSessionState] = useState(null)
  const [lastSummary, setLastSummary] = useState(null)
  const [timerNowMs, setTimerNowMs] = useState(Date.now())

  const groupsApi = useGroups(currentUserId)
  const competitionsApi = useCompetitions(currentUserId)
  const sessionsApi = useSessions(currentUserId)

  const isPasswordRecovery = window.location.pathname === '/reset-password'

  useEffect(() => {
    if (!currentUserId) {
      setAllProfiles([])
      return
    }

    supabase
      .from('profiles')
      .select('*')
      .then(({ data }) => setAllProfiles(data ?? []))
  }, [currentUserId])

  const usersById = useMemo(
    () => Object.fromEntries(allProfiles.map((profile) => [profile.id, { displayName: profile.display_name }])),
    [allProfiles],
  )

  const userGroupMemberships = useMemo(
    () => groupsApi.members.filter((member) => member.user_id === currentUserId),
    [groupsApi.members, currentUserId],
  )

  const userGroups = useMemo(
    () =>
      groupsApi.groups.filter((group) =>
        userGroupMemberships.some((membership) => membership.group_id === group.id),
      ),
    [groupsApi.groups, userGroupMemberships],
  )

  const activeCompetitions = useMemo(() => {
    const now = Date.now()

    return competitionsApi.competitions.filter((competition) => {
      const isParticipant = competitionsApi.participants.some(
        (participant) =>
          participant.competition_id === competition.id && participant.user_id === currentUserId,
      )

      if (!isParticipant) {
        return false
      }

      const start = new Date(competition.start_date).getTime()
      const end = competition.end_date ? new Date(competition.end_date).getTime() : Infinity
      return now >= start && now <= end
    })
  }, [competitionsApi.competitions, competitionsApi.participants, currentUserId])

  const userSessions = sessionsApi.sessions

  const todayStats = useMemo(() => {
    const todayStamp = new Date().toISOString().slice(0, 10)
    const todaySessions = userSessions.filter(
      (session) => session.startedAt.slice(0, 10) === todayStamp,
    )

    const sessionCount = todaySessions.length
    const totalTimeMs = todaySessions.reduce((sum, session) => sum + session.totalSessionDurationMs, 0)
    const totalQuestions = todaySessions.reduce((sum, session) => sum + session.totalQuestions, 0)
    const totalCorrect = todaySessions.reduce((sum, session) => sum + session.correctCount, 0)

    return {
      sessionCount,
      totalTimeMs,
      totalQuestions,
      accuracyPercent: totalQuestions ? (totalCorrect / totalQuestions) * 100 : 0,
    }
  }, [userSessions])

  useEffect(() => {
    if (!sessionState) {
      return
    }

    const timer = setInterval(() => setTimerNowMs(Date.now()), 250)
    return () => clearInterval(timer)
  }, [sessionState])

  const leaderboardCompetitionId =
    selectedCompetitionId || activeCompetitions[0]?.id || competitionsApi.competitions[0]?.id || ''

  useEffect(() => {
    if (!leaderboardCompetitionId) {
      setLeaderboardRows([])
      return
    }

    competitionsApi.fetchLeaderboard(leaderboardCompetitionId).then(setLeaderboardRows)
  }, [leaderboardCompetitionId, competitionsApi])

  useEffect(() => {
    if (!currentUserId) {
      setAppLeaderboardRows([])
      return
    }

    competitionsApi.fetchAppLeaderboard().then(setAppLeaderboardRows)
  }, [currentUserId, competitionsApi])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    const email = authForm.email.trim().toLowerCase()
    const password = authForm.password.trim()

    if (!email || !password) {
      setAuthError('Email and password are required.')
      return
    }

    if (authMode === 'login') {
      const { error } = await auth.signIn({ email, password })
      if (error) {
        setAuthError(error.message)
        return
      }
      setAuthError('')
      setScreen('dashboard')
      return
    }

    const displayName = authForm.displayName.trim()
    if (!displayName) {
      setAuthError('Display name is required for sign up.')
      return
    }

    const { error } = await auth.signUp({
      email,
      password,
      displayName,
      ageOrGrade: authForm.ageOrGrade.trim(),
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    setAuthError('')
    setScreen('dashboard')
  }

  async function handleForgotPassword() {
    const email = authForm.email.trim().toLowerCase()
    if (!email) {
      setAuthError('Enter your email above, then click "Forgot password?" again.')
      return
    }

    const { error } = await auth.requestPasswordReset(email)
    setAuthError(error ? error.message : `Password reset email sent to ${email}.`)
  }

  async function handleResetPasswordSubmit(event) {
    event.preventDefault()
    if (!resetPasswordValue) {
      return
    }

    const { error } = await auth.updatePassword(resetPasswordValue)
    if (error) {
      setResetMessage(error.message)
      return
    }

    setResetMessage('Password updated. You can now use the app.')
    setResetPasswordValue('')
    window.history.replaceState({}, '', '/')
  }

  function startSession(competitionId = null) {
    if (!currentUserId) {
      return
    }

    const competition = competitionId
      ? competitionsApi.competitions.find((entry) => entry.id === competitionId)
      : null
    const totalQuestions = competition
      ? clampQuestionCount(competition.question_count)
      : clampQuestionCount(practiceQuestionCount)

    const startingLevel = getStartingLevel(userSessions)
    setSessionState({
      sessionId: globalThis.crypto.randomUUID(),
      competitionId,
      totalQuestions,
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

  async function submitAnswer(event) {
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

    if (nextResults.length === sessionState.totalQuestions) {
      const endedAt = new Date().toISOString()
      const summary = summarizeSession(nextResults, sessionState.startedAt, endedAt)

      await sessionsApi.saveSession({
        sessionId: sessionState.sessionId,
        competitionId: sessionState.competitionId,
        startedAt: sessionState.startedAt,
        endedAt,
        summary,
        results: nextResults,
      })

      setLastSummary({ ...summary, startedAt: sessionState.startedAt, endedAt })
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

      if (!/^[0-9]$/.test(digit)) {
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
    groupsApi.createGroup(groupName)
    setGroupName('')
  }

  function joinGroupByCode(event) {
    event.preventDefault()
    groupsApi.joinGroupByCode(joinCode)
    setJoinCode('')
  }

  async function createCompetition(event) {
    event.preventDefault()

    const groupMemberIds = groupsApi.members
      .filter((member) => member.group_id === competitionForm.groupId)
      .map((member) => member.user_id)

    const competition = await competitionsApi.createCompetition(competitionForm, groupMemberIds)

    setCompetitionForm({
      name: '',
      startDate: asDateInputValue(new Date()),
      endDate: '',
      scope: 'group',
      groupId: '',
      visibility: 'group-public',
      selectedUserIds: [],
      questionCount: DEFAULT_QUESTION_COUNT,
    })

    if (competition) {
      setSelectedCompetitionId(competition.id)
    }
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
        const x = accuracyChartX(index, values.length)
        const y = accuracyChartY(value)
        return `${x},${y}`
      })
      .join(' ')
  }

  function accuracyChartLabelY(y) {
    return y <= CHART_LABEL_TOP_THRESHOLD ? y + CHART_LABEL_BELOW_OFFSET : y - CHART_LABEL_ABOVE_OFFSET
  }

  function accuracyChartX(index, total) {
    return CHART_LEFT_EDGE + (index / Math.max(total - 1, 1)) * CHART_WIDTH
  }

  function accuracyChartY(value) {
    return CHART_BOTTOM_EDGE - (value / 100) * CHART_HEIGHT
  }

  if (isPasswordRecovery) {
    return (
      <main className="container">
        <h1>
          <img src={logo} alt="" className="app-logo" />
          Master Math Challenger
        </h1>
        <section className="panel stack">
          <h2>Choose a new password</h2>
          <form onSubmit={handleResetPasswordSubmit} className="stack">
            <label>
              New password
              <input
                type="password"
                value={resetPasswordValue}
                onChange={(event) => setResetPasswordValue(event.target.value)}
                required
              />
            </label>
            {resetMessage && <p className="error">{resetMessage}</p>}
            <button type="submit">Update password</button>
          </form>
        </section>
      </main>
    )
  }

  if (auth.loading) {
    return (
      <main className="container">
        <p>Loading...</p>
      </main>
    )
  }

  if (!currentUserId) {
    return (
      <main className="container">
        <div className="auth-hero">
          <img src={logo} alt="" className="app-logo app-logo-hero" />
        </div>
        <h1 className="centered-title">
          Master Math Challenger
        </h1>
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
          {authMode === 'login' && (
            <button type="button" className="ghost" onClick={handleForgotPassword}>
              Forgot password?
            </button>
          )}
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

  const bestSessions = getBestSessions()
  const trend = buildAccuracyTrend(userSessions, 12)
  const accuracyChartData = trend.map((value, index) => ({
    id: `session-${index + 1}`,
    sessionNumber: index + 1,
    value,
    x: accuracyChartX(index, trend.length),
    y: accuracyChartY(value),
  }))
  const tabs = ['dashboard', 'session', 'summary', 'groups', 'competitions', 'leaderboard', 'stats']
  if (auth.isAdmin) {
    tabs.push('admin')
  }

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>
            <img src={logo} alt="" className="app-logo" />
            Master Math Challenger
          </h1>
          <p className="subtitle">
            Hi {auth.profile?.display_name}! Ready for 30 multiplication questions?
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            auth.signOut()
            setScreen('dashboard')
          }}
        >
          Log out
        </button>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={screen === tab ? 'active' : ''}
            onClick={() => setScreen(tab)}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
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

          {selectedCompetitionId ? (
            <p>
              This competition's owner set the session length to{' '}
              {clampQuestionCount(
                activeCompetitions.find((competition) => competition.id === selectedCompetitionId)
                  ?.question_count,
              )}{' '}
              questions.
            </p>
          ) : (
            <label>
              Questions per session
              <input
                type="number"
                min={MIN_QUESTION_COUNT}
                max={MAX_QUESTION_COUNT}
                value={practiceQuestionCount}
                onChange={(event) =>
                  setPracticeQuestionCount(Number(event.target.value) || DEFAULT_QUESTION_COUNT)
                }
                onBlur={(event) =>
                  setPracticeQuestionCount(clampQuestionCount(Number(event.target.value)))
                }
              />
            </label>
          )}

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
                Question {sessionState.questionIndex}/{sessionState.totalQuestions} • Level{' '}
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
                  {KEYPAD_LAYOUT.map((digit, index) =>
                    digit ? (
                      <button
                        key={digit}
                        type="button"
                        className="number-pad-key"
                        onClick={() => appendAnswerDigit(digit)}
                        aria-label={`Enter digit ${digit}`}
                      >
                        {digit}
                      </button>
                    ) : (
                      <div
                        key={`spacer-${Math.floor(index / 3)}-${index % 3}`}
                        className="number-pad-spacer"
                        aria-hidden="true"
                      />
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
                    Back
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
          {groupsApi.error && <p className="error">{groupsApi.error}</p>}
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
                const groupMembers = groupsApi.members.filter((member) => member.group_id === group.id)
                const myMembership = groupMembers.find((member) => member.user_id === currentUserId)
                const canInvite =
                  myMembership?.role === 'admin' || group.owner_user_id === currentUserId

                return (
                  <article key={group.id} className="card stack">
                    <h3>{group.name}</h3>
                    <p>Owner: {usersById[group.owner_user_id]?.displayName ?? 'Unknown'}</p>
                    <p>
                      Members:{' '}
                      {groupMembers
                        .map((member) => usersById[member.user_id]?.displayName ?? 'Unknown')
                        .join(', ')}
                    </p>
                    {canInvite && (
                      <button type="button" onClick={() => groupsApi.createInvite(group.id)}>
                        Create invite code
                      </button>
                    )}
                    <ul>
                      {groupsApi.invites
                        .filter((invite) => invite.group_id === group.id && !invite.accepted_by_user_id)
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
          {competitionsApi.error && <p className="error">{competitionsApi.error}</p>}
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
            <label>
              Questions per session
              <input
                type="number"
                min={MIN_QUESTION_COUNT}
                max={MAX_QUESTION_COUNT}
                value={competitionForm.questionCount}
                onChange={(event) =>
                  setCompetitionForm({
                    ...competitionForm,
                    questionCount: Number(event.target.value) || DEFAULT_QUESTION_COUNT,
                  })
                }
                onBlur={(event) =>
                  setCompetitionForm({
                    ...competitionForm,
                    questionCount: clampQuestionCount(Number(event.target.value)),
                  })
                }
              />
            </label>

            <fieldset className="stack">
              <legend>Participants</legend>
              {allProfiles
                .filter((profile) => profile.id !== currentUserId)
                .map((profile) => (
                  <label key={profile.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={competitionForm.selectedUserIds.includes(profile.id)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...competitionForm.selectedUserIds, profile.id]
                          : competitionForm.selectedUserIds.filter((id) => id !== profile.id)

                        setCompetitionForm({ ...competitionForm, selectedUserIds: next })
                      }}
                    />
                    {profile.display_name}
                  </label>
                ))}
            </fieldset>

            <p>Scoring rule: total correct answers, tie-break by average question time.</p>
            <button type="submit">Create competition</button>
          </form>

          <h3>Available competitions</h3>
          <div className="stack">
            {competitionsApi.competitions.map((competition) => {
              const isParticipant = competitionsApi.participants.some(
                (participant) =>
                  participant.competition_id === competition.id &&
                  participant.user_id === currentUserId,
              )
              const canJoinGroupPublic =
                !isParticipant &&
                competition.visibility === 'group-public' &&
                competition.group_id &&
                userGroupMemberships.some((member) => member.group_id === competition.group_id)

              return (
                <article key={competition.id} className="card stack">
                  <h4>{competition.name}</h4>
                  <p>
                    {new Date(competition.start_date).toLocaleDateString()} -{' '}
                    {competition.end_date
                      ? new Date(competition.end_date).toLocaleDateString()
                      : 'Ongoing'}
                  </p>
                  <p>{competition.visibility === 'group-public' ? 'Public in group' : 'Invite-only'}</p>
                  {!isParticipant && canJoinGroupPublic && (
                    <button type="button" onClick={() => competitionsApi.joinCompetition(competition.id)}>
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
          <h2>App rankings</h2>
          <div className="inline-form">
            <span>Sort by:</span>
            <button
              type="button"
              className={appLeaderboardSort === 'score' ? 'active' : 'ghost'}
              onClick={() => setAppLeaderboardSort('score')}
            >
              Highest score
            </button>
            <button
              type="button"
              className={appLeaderboardSort === 'sessions' ? 'active' : 'ghost'}
              onClick={() => setAppLeaderboardSort('sessions')}
            >
              Most sessions
            </button>
          </div>

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
              {sortedAppLeaderboardRows.map((row, index) => (
                <tr key={row.userId}>
                  <td>{index + 1}</td>
                  <td>{row.displayName}</td>
                  <td>{row.totalCorrect}</td>
                  <td>{row.sessionCount}</td>
                  <td>{row.avgTime === null || row.avgTime === undefined ? '-' : formatMs(row.avgTime)}</td>
                </tr>
              ))}
              {sortedAppLeaderboardRows.length === 0 && (
                <tr>
                  <td colSpan="5">No scores yet.</td>
                </tr>
              )}
            </tbody>
          </table>

          <h2>Competition leaderboard</h2>
          <label>
            Competition
            <select
              value={leaderboardCompetitionId}
              onChange={(event) => setSelectedCompetitionId(event.target.value)}
            >
              {competitionsApi.competitions.length === 0 && <option value="">No competitions yet</option>}
              {competitionsApi.competitions.map((competition) => (
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
                  <td>{row.avgTime === null || row.avgTime === undefined ? '-' : formatMs(row.avgTime)}</td>
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
            {trend.length === 0 ? (
              <p>Complete a session to see charted accuracy percentages.</p>
            ) : (
              <>
                <svg viewBox="0 0 100 100" aria-label="Accuracy trend chart" className="chart">
                  {CHART_Y_AXIS_TICKS.map((tick) => {
                    const y = accuracyChartY(tick)
                    return (
                      <g key={tick}>
                        <line
                          x1={CHART_LEFT_EDGE}
                          y1={y}
                          x2={CHART_LEFT_EDGE + CHART_WIDTH}
                          y2={y}
                          className="chart-grid-line"
                        />
                        <text x="10" y={y + 1.5} textAnchor="end" className="chart-axis-label">
                          {tick}%
                        </text>
                      </g>
                    )
                  })}
                  <line
                    x1={CHART_LEFT_EDGE}
                    y1={CHART_TOP_EDGE}
                    x2={CHART_LEFT_EDGE}
                    y2={CHART_BOTTOM_EDGE}
                    className="chart-axis-line"
                  />
                  <line
                    x1={CHART_LEFT_EDGE}
                    y1={CHART_BOTTOM_EDGE}
                    x2={CHART_LEFT_EDGE + CHART_WIDTH}
                    y2={CHART_BOTTOM_EDGE}
                    className="chart-axis-line"
                  />
                  {trend.length > 1 && (
                    <polyline points={accuracyChartPoints(trend)} fill="none" strokeWidth="2" />
                  )}
                  {accuracyChartData.map((point) => (
                    <g key={point.id}>
                      <circle cx={point.x} cy={point.y} r="1.8" className="chart-point" />
                      <text
                        x={point.x}
                        y={accuracyChartLabelY(point.y)}
                        textAnchor="middle"
                        className="chart-point-label"
                      >
                        {formatAccuracy(point.value)}
                      </text>
                      <text x={point.x} y="98" textAnchor="middle" className="chart-axis-label">
                        {point.sessionNumber}
                      </text>
                    </g>
                  ))}
                </svg>
                <p className="chart-caption">
                  Session numbers run oldest to newest across the chart.
                </p>
              </>
            )}
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

      {screen === 'admin' && auth.isAdmin && <AdminPage />}
    </main>
  )
}

export default App
