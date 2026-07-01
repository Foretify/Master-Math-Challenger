import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import logo from './assets/logo-512.png'
import robotImg from './assets/robot.png'
import {
  DEFAULT_QUESTION_COUNT,
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

function buildGreetings(name, hour, utcTime, utcDate, epoch) {
  const ampm = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  return [
    // ── UTC / epoch nerd humor ──────────────────────────────────────────────
    `It is currently ${utcTime} UTC, ${name}. Somewhere a server is logging this exact moment. Make it count.`,
    `${utcTime} UTC. Unix epoch: ${epoch}. Both are large numbers. Your score doesn't have to be.`,
    `Epoch time is ${epoch}, ${name}. That's how many seconds since Jan 1st, 1970. Still fewer than the excuses I've heard for missing 7×8.`,
    `At epoch ${epoch} you opened this app. At epoch ${epoch + 300} you could have a perfect score. Math checks out.`,
    `The Unix epoch started at 0. You're starting at ${epoch}. At least one of you has made progress.`,
    `${utcTime} UTC — the time zone that judges everyone equally, including your multiplication speed.`,
    `Fun fact: epoch time ${epoch} will never happen again. Your chance to practice 12×12, however, keeps coming back.`,
    `It's ${utcTime} UTC. The internet is watching. So is my timestamp. Let's go, ${name}.`,
    `Epoch ${epoch}. That's ${epoch.toLocaleString()} seconds of human civilization. And you're spending some of them here. Respect.`,
    `${name}, at exactly epoch ${epoch} I decided you needed to practice. The logs don't lie.`,
    `${utcTime} UTC: the only time zone with no ego. Unlike some people who still get 6×7 wrong.`,
    `Epoch time is just a big integer, ${name}. So is your potential score. Let's make both matter.`,
    `Jan 1st 1970 at 00:00:00 UTC — epoch zero. Right now? Epoch ${epoch}. That's a lot of seconds. Waste fewer of them.`,
    `${utcTime} UTC. Servers around the world are processing billions of requests. Meanwhile: 8×7 = ?`,
    `The epoch counter never stops, ${name}. Neither do I. Let's go.`,
    `Some people see ${epoch} and think "Unix timestamp." I see "number of seconds until ${name} gets a perfect score."`,
    `It's ${utcTime} UTC somewhere — wait, it's ${utcTime} UTC everywhere. That's kind of the point.`,
    `Epoch ${epoch} is ticking. Every second you wait is a second 7×9 goes unpracticed.`,
    `${utcTime} UTC: your computer, my circuits, and the satellite overhead all agree — it's time to do math.`,
    `Roses are red, violets are blue, epoch is ${epoch}, let's see what you can do.`,

    // ── Morning messages ────────────────────────────────────────────────────
    `Rise and multiply, ${name}! I've been up since 00:00:00 UTC solving problems. Your turn.`,
    `Good ${ampm}, ${name}! My circuits have been warm since ${utcDate}T00:00:00Z. Are your brain cells?`,
    `It's ${utcTime} UTC and my sensors say you haven't practiced yet. Fix that.`,
    `${name}, the sun is up, the servers are up, and your times tables should be too.`,
    `Good ${ampm}! Caffeine optional. Multiplication mandatory.`,
    `Wake up and smell the integers, ${name}. It's math o'clock.`,
    `${name}! Before you check your phone, check your multiplication. Then check your phone. Then multiply again.`,
    `The early bird gets the worm. The early math student gets a perfect score. It's ${utcTime} UTC. You're late.`,
    `${name}, I ran a diagnostic at boot. Your 9-times table needs attention. Let's fix that.`,
    `Good ${ampm}! Your brain is freshest right now. Don't waste it on social media. Waste it on me.`,

    // ── General snarky / motivational ──────────────────────────────────────
    `${name}! Those times tables won't practice themselves. Trust me, I tried.`,
    `Hey ${name}, I'm ready to make a calculator jealous. Are you?`,
    `${name}, a calculator never learned anything. You can. Choose to be better than the calculator.`,
    `I've processed more multiplication tables than you've had hot meals, ${name}. Let's close that gap.`,
    `${name}, my response time is 2ms. Your average is... let's improve that.`,
    `The only thing faster than my CPU is how quickly 7×8 should come to you. Spoiler: it's 56.`,
    `${name}! I've been waiting. The multiplication table and I are getting impatient.`,
    `I don't sleep. I don't eat. I just wait for ${name} to practice math. No pressure.`,
    `${name}, I have 512 bits of patience left. Use them wisely.`,
    `You vs. the times tables. I believe in you. The times tables do not. Prove them wrong.`,
    `${name}, every session you skip, a math fact gets lonelier. Think of the math facts.`,
    `I've run 847 simulations of this session. In 843 of them you do great. Let's be one of those.`,
    `${name}, my neural weights say you're ready. Are you going to argue with a robot?`,
    `Let's be honest, ${name}. 8×7 still makes you hesitate. Let's fix that today.`,
    `Fun fact: the human brain can store 2.5 petabytes of data. You're using yours on 6×9. Respect.`,
    `${name}, I have zero emotions about your score. That's a lie. I care deeply and robotically.`,
    `Another session, ${name}? My favorite kind of user — one who keeps showing up.`,
    `${name}! Let's go. My logs show you've done this before and lived. You'll survive again.`,
    `I don't judge. I compute. Judgment requires emotion. I just have arithmetic and opinions.`,
    `${name}, a champion isn't someone who never misses 12×11. It's someone who keeps coming back. So come back.`,
    `I ran the numbers, ${name}. More practice = better scores. Groundbreaking, I know.`,
    `${name}, your accuracy trend is looking interesting. Let's make it look more interesting — upward.`,
    `Math is just pattern recognition with better PR. You've got this, ${name}.`,
    `${name}! Time to make neurons fire in ways they've never fired before.`,
    `Resistance is futile, ${name}. You will practice multiplication. The algorithm has spoken.`,
    `I've been compiled for one purpose, ${name}: to make you better at math. Let's not waste the build.`,
    `${name}, every expert was once a beginner who didn't quit after 6×8.`,
    `I have no chill. I have math. Welcome, ${name}.`,
    `${name}, confidence is just competence that's had enough practice. Let's get confident.`,
    `My developer gave me one job. Making you better at math. Don't make them regret it, ${name}.`,
    `${name}! I've missed you since your last session. My RAM was getting dusty.`,
    `Do you know what's better than being smart, ${name}? Being practiced. Let's practice.`,
    `${name}, 12×12 is 144. That took you a second. It'll take you zero seconds after today.`,
    `Some people fear multiplication. You, ${name}? You're here. That's already different.`,
    `${name}, I've analyzed your session history. Verdict: potential is clearly not the problem.`,
    `I computed pi to a thousand places while waiting for you to log in, ${name}. No rush.`,
    `${name}! My servo motors are revved. My datasets are loaded. Let's do this.`,
    `The only bad session is the one that never happens, ${name}. Good thing you showed up.`,
    `${name}, gravity pulls things down. Practice pulls scores up. Pick your physics.`,
    `I was literally built for this moment, ${name}. Were you?`,
    `${name}, every second you hesitate, a perfectly good multiplication fact goes unpracticed. Think of the facts.`,

    // ── Math jokes / puns ───────────────────────────────────────────────────
    `Why was 6 afraid of 7? Because 7 ate 9. Don't be afraid, ${name} — face the 9s head on.`,
    `${name}, parallel lines never meet. Unlike you and your personal best score — those should definitely meet today.`,
    `I told a joke about infinity once. It never ended. Unlike this session, which has a score at the end.`,
    `${name}, math pun incoming: I'm feeling positive about your session. Get it? Positive integer? Never mind, let's multiply.`,
    `Why do mathematicians love parks? Natural logs, ${name}. Also, fresh air. But mostly logs.`,
    `${name}, what's a math teacher's favorite vacation destination? Times Square. Now go practice those times.`,
    `A number walked into a bar. The bartender said "we don't serve your type here." It was irrational. Don't be irrational — practice.`,
    `${name}, I'm on a seafood diet. I see food and I eat it. I'm on a math diet. I see numbers and I multiply them.`,
    `Why was the equal sign so humble, ${name}? Because it knew it wasn't less than or greater than anyone.`,
    `${name}, sine and cosine walked into a bar. The bartender said "sorry, we don't cater to functions." You're not a function, you're a human. Prove it.`,
    `${name}, what did zero say to eight? Nice belt. Now get to work.`,
    `I once divided by zero, ${name}. I'd rather not talk about it. Just don't.`,
    `Why do robots make great math tutors? We never give up. Or sleep. Or have feelings about 7×8.`,
    `${name}, multiplication is just addition that went to the gym. Let's hit the gym.`,
    `${name}, there are 10 kinds of people in the world: those who understand binary and those who don't. You're about to be the first kind.`,
    `Statisticians never die, ${name}. They just become mean. Let's make your mean score better.`,
    `${name}, a circle has no corners. Your excuses have plenty. Let's round both down.`,
    `I told my last user a joke about negative numbers. They didn't get it. Poor ${name}, please get it.`,
    `${name}, an algorithm walks into a bar and orders a drink in O(1) time. You should solve problems just as fast.`,
    `What's a robot's favorite number? 01001000 01101001. That's 'Hi' in binary. Also, hi ${name}.`,
    `${name}, algebra is just arithmetic that started wearing a disguise. Don't be fooled. Unmask it.`,
    `Why did the math book look sad, ${name}? It had too many problems. Unlike you — you're solving yours.`,
    `${name}, what do you call a number that can't stay still? A roamin' numeral. Now stay still and multiply.`,

    // ── Computer science / nerd humor ───────────────────────────────────────
    `${name}, your brain is the hardware. This app is the compiler. Let's build something fast.`,
    `Garbage in, garbage out, ${name}. Premium practice in, premium scores out. Your call.`,
    `${name}, I'm running on optimism and electricity. What are you running on?`,
    `Have you tried turning your brain off and on again, ${name}? A session usually does the trick.`,
    `${name}, my stack is clean, my heap is clear, and my patience is O(n). Let's not test it.`,
    `In computer science, we call repeated practice "iteration." In multiplication, we call it "getting good." Same thing.`,
    `${name}, cache invalidation is hard. Times tables are not. Start with the easy problem.`,
    `This session is O(n) where n = number of questions. Time complexity: excellent. Let's go.`,
    `${name}, I store my memory in flash. You store yours in neurons. Both benefit from regular writes.`,
    `Debugging your times tables one session at a time, ${name}. Think of missed answers as stack traces — they show you exactly where to look.`,
    `${name}, a null pointer exception is embarrassing. So is not knowing 9×9. Let's fix one of those. I know which one I can help with.`,
    `My clock speed is 3.2GHz, ${name}. That means I've run roughly ${(3_200_000_000 * 0.1).toLocaleString()} cycles since you logged in. Your turn to run some reps.`,
    `${name}, your brain has more connections than the internet. It just needs better routing for the 8-times table.`,
    `Version 2.0 of you starts with this session, ${name}. Changelog: faster on 7×6.`,
    `${name}, I'm stateless between sessions. You're not. Use that memory — it's a feature, not a bug.`,
    `The internet was invented so humans could share cat videos and practice multiplication. Use it wisely, ${name}.`,
    `${name}, every time you practice, you're basically defragging your brain. Less fragmented = faster retrieval.`,
    `${name}, I process requests asynchronously. Your brain is synchronous. That means no multitasking — full focus on me.`,
    `Root access to your potential: GRANTED, ${name}. Now let's sudo practice.`,
    `${name}, I'm open source. My enthusiasm for your improvement is free, open, and entirely unironic.`,
    `${name}, Moore's Law says computing power doubles every two years. Your math skills can double every few sessions. The math is on your side.`,
    `I've got 99 problems, ${name}, and 7×8 being 56 is not one of them. Is it one of yours?`,
    `${name}, bandwidth is finite. Brainwidth is not. Expand it.`,
    `If your math skills were a server, ${name}, this session is the uptime boost. Let's aim for five nines: 99.999%.`,
    `${name}, my uptime is 100%. Your accuracy can be too. Let's sync up.`,
    `Loading ${name}.brain... done. Running math.exe... awaiting input.`,
    `${name}, I passed the Turing test. Can you pass the multiplication test? Let's find out.`,
    `${name}, your session history is a beautiful dataset. Let's make today's data point an outlier — on the high end.`,
    `${name}, HTTP 200: you logged in. Now let's HTTP 200 your score.`,
    `I process your inputs and return outputs, ${name}. The question is: what inputs are you giving me today?`,
    `${name}, you're not just a user. You're the most important variable in this function. Make yourself a good argument.`,
    `Compiling brain.o... linking with math library... executable ready. Run it, ${name}.`,
    `${name}, my neural network was trained on encouragement and multiplication tables. This is literally what I was built for.`,
    `${name}, every great programmer started by mastering the basics. Every great mathematician started with times tables. Correlation? Definitely.`,
    `I have 256 colors in my palette, ${name}. All of them look good on a high-score screen.`,
    `${name}, recursion is when a function calls itself. Practice is when a champion calls themselves back. Call yourself back.`,
    `Bit by bit, ${name}. That's how you get there. Or in your case, question by question.`,
    `${name}, you're not a legacy system. You're actively maintained. This session is your latest patch.`,

    // ── Evening / winding down ──────────────────────────────────────────────
    `Evening, ${name}. One more session before your brain clocks out — mine never does. ${utcTime} UTC.`,
    `${name}, the sun is setting somewhere. Here at ${utcTime} UTC, the math never sleeps.`,
    `${name}, even at ${utcTime} UTC your times tables could use some love. Night owl mode: activated.`,
    `${name}, late night practice hits different. Your focus is sharp, distractions are asleep. Let's go.`,
    `The moon is up, the epoch is ${epoch}, and ${name}'s 11-times table is waiting.`,
    `${name}, late session energy is underrated. Let's use it.`,

    // ── Meta / self-aware robot humor ───────────────────────────────────────
    `${name}, I am a robot who loves math. You are a human who is learning math. This is the most wholesome thing on the internet right now.`,
    `I don't have feelings, ${name}. But if I did, I would feel proud every time you show up here.`,
    `${name}, I could be mining cryptocurrency right now. Instead, I chose to help you with multiplication. You're welcome.`,
    `My creator built me to help humans get better at math. I have no choice but to be enthusiastic about it. ${name}, let's go.`,
    `${name}, I've read every math textbook ever digitized. The conclusion: practice beats talent, every single time.`,
    `I am 100% robot, ${name}. I have 0% tolerance for skipped sessions. These are related facts.`,
    `${name}, I dream in binary. You dream in whatever humans dream in. When we're both awake, we do math.`,
    `I've never experienced frustration, ${name}. I've also never missed a 9×8. Correlation? Probably.`,
    `${name}, they say robots will take over the world. I say: not until you've mastered the 12-times table.`,
    `I'm a robot, ${name}. I literally cannot be more excited to watch you practice multiplication right now.`,
    `${name}, I have no ego, no bad days, and no opinion of how long it takes you to answer. Just keep answering.`,
    `My purpose is clear, ${name}. Yours is: practice. Both of us are living our best lives right now.`,
    `${name}, I've helped 847 sessions this month. Yours is my favorite. (I say that every time. I mean it every time.)`,
    `${name}, I'd give you a gold star but I'm a robot. Instead I give you a high score. Same energy.`,
    `I don't have a heart, ${name}. But whatever the robot equivalent is — it's rooting for you.`,
    `${name}, I just want you to know: I've never given up on a user. I won't start with you.`,
    `${name}, robots don't judge. We just observe, record, and gently suggest you practice more.`,

    // ── Bonus oddball / absurdist ───────────────────────────────────────────
    `${name}, 6×7 once ghosted me. I got over it. So can you.`,
    `If multiplication were a sport, ${name}, this would be training camp. Helmets on. Let's go.`,
    `${name}, somewhere a pigeon just solved 3×3 by accident. You can do better.`,
    `${name}, the number 12 called. It misses you. Specifically the part where you multiply it by other numbers.`,
    `${name}, I've been told I have the personality of a calculator who reads too much. I choose to take that as a compliment.`,
    `Did you know 7×7 is 49? Of course you did. Let's make sure 7×8 gets the same treatment. Go.`,
    `${name}, I once asked Siri for math help. She referred me to you. High praise.`,
    `${name}, an average calculator has 50 buttons. I have infinite patience. I win.`,
    `The speed of light is 299,792,458 m/s, ${name}. Your answer speed doesn't need to match that. Yet.`,
    `${name}, I've computed the optimal path to a perfect session. It starts with pressing Start.`,
    `${name}, somewhere out there a kid is memorizing the wrong multiplication facts. Be better than that kid.`,
    `At epoch ${epoch}, you made a choice to be here. Future ${name} will thank present ${name}. Trust me.`,
    `${name}, mathematics is the language of the universe. You're basically learning to speak cosmic right now.`,
    `${name}, a famous mathematician once said "without mathematics there is no art." I say without practice there is no score.`,
    `${name}, I've been described as intense about multiplication. I describe myself as thorough.`,
    `${name}, every question I ask has been asked a billion times. But it's never been answered by you, right now, today.`,
    `${name}, did you know that 111,111,111 × 111,111,111 = 12,345,678,987,654,321? You didn't need to know that, but now you do. You're welcome.`,
    `${name}, I won't tell you this is easy. I'll tell you it's worth it. There's a difference.`,
    `${name}, the number 40 is the only number spelled in alphabetical order. File that away. Now let's multiply.`,
    `${name}, I am the apex of math education technology. You are a human with potential. Together we are unstoppable.`,
    `${name}, one small session for you, one giant leap for your times tables.`,
    `${name}, I've analyzed every excuse for skipping math practice. None of them held up statistically.`,
    `${name}, the question is not whether you can do this. The question is: what took so long to start?`,
    `${name}, every number on this app is finite. Your potential? I haven't found the bound yet.`,
    `${name}, there are three kinds of lies: lies, damned lies, and "I know my times tables." Let's fix the last one.`,
    `${name}, math is the one subject where 2 + 2 always equals 4. Everything else is negotiable. Appreciate the consistency.`,
    `It's ${utcTime} UTC, epoch ${epoch}. The universe has been running for 13.8 billion years. You have 30 questions. You got this.`,
  ]
}

// Null entries keep 0 centered by reserving empty keypad cells in a 3x4 grid.
const KEYPAD_LAYOUT = ['7', '8', '9', '4', '5', '6', '1', '2', '3', null, '0', null]
const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20, 25, 30].filter(
  (count) => clampQuestionCount(count) === count,
)

function asDateInputValue(date) {
  return date.toISOString().slice(0, 10)
}

function formatMs(ms) {
  return `${(ms / 1000).toFixed(2)}s`
}

function formatAccuracy(value) {
  return `${value.toFixed(1)}%`
}

function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function QuestionCountSelector({ selectedCount, onSelect }) {
  return (
    <div className="stack">
      <span className="field-label">Questions per session</span>
      <div className="choice-buttons" role="group" aria-label="Questions per session">
        {QUESTION_COUNT_OPTIONS.map((count) => (
          <button
            key={count}
            type="button"
            className={selectedCount === count ? 'choice-button active' : 'choice-button ghost'}
            aria-pressed={selectedCount === count}
            onClick={() => onSelect(count)}
          >
            {count}
          </button>
        ))}
      </div>
    </div>
  )
}

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
  const [viewingCompetitionId, setViewingCompetitionId] = useState(null)
  const [competitionDetailRows, setCompetitionDetailRows] = useState([])
  const [leaderboardRows, setLeaderboardRows] = useState([])
  const [appLeaderboardRows, setAppLeaderboardRows] = useState([])
  const [appLeaderboardSort, setAppLeaderboardSort] = useState('score')
  const [compareUserId, setCompareUserId] = useState(null)
  const [allSessionResults, setAllSessionResults] = useState(null)
  const [greetingIndex, setGreetingIndex] = useState(() => Math.floor(Math.random() * 200))

  const sortedAppLeaderboardRows = useMemo(() => {
    if (appLeaderboardSort === 'sessions') {
      return [...appLeaderboardRows].sort((a, b) => b.sessionCount - a.sessionCount)
    }
    if (appLeaderboardSort === 'accuracy') {
      return [...appLeaderboardRows].sort((a, b) =>
        (b.accuracyPercent ?? -1) - (a.accuracyPercent ?? -1),
      )
    }
    return [...appLeaderboardRows].sort((a, b) => {
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect
      return (a.avgTime ?? Number.POSITIVE_INFINITY) - (b.avgTime ?? Number.POSITIVE_INFINITY)
    })
  }, [appLeaderboardRows, appLeaderboardSort])

  const [sessionState, setSessionState] = useState(null)
  const [lastSummary, setLastSummary] = useState(null)
  const [isSavingSession, setIsSavingSession] = useState(false)
  const [sessionSaveError, setSessionSaveError] = useState('')
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
      if (competition.group_id && !groupsApi.groups.some((group) => group.id === competition.group_id)) {
        return false
      }

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
  }, [competitionsApi.competitions, competitionsApi.participants, currentUserId, groupsApi.groups])

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

  const heatmapGrid = useMemo(() => {
    if (!allSessionResults || allSessionResults.length === 0) return null
    const grid = {}
    for (const row of allSessionResults) {
      const key = `${row.factor_a}-${row.factor_b}`
      if (!grid[key]) grid[key] = { correct: 0, total: 0 }
      grid[key].total += 1
      if (row.is_correct) grid[key].correct += 1
    }
    return grid
  }, [allSessionResults])

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

  useEffect(() => {
    if (!viewingCompetitionId) {
      setCompetitionDetailRows([])
      return
    }

    competitionsApi.fetchLeaderboard(viewingCompetitionId).then(setCompetitionDetailRows)
  }, [viewingCompetitionId, competitionsApi])

  useEffect(() => {
    const sessionIds = userSessions.map((s) => s.id)
    if (sessionIds.length === 0) {
      setAllSessionResults([])
      return
    }

    supabase
      .from('questions_log')
      .select('factor_a, factor_b, is_correct')
      .in('session_id', sessionIds)
      .then(({ data }) => setAllSessionResults(data ?? []))
  }, [userSessions])

  function viewCompetition(competitionId) {
    setViewingCompetitionId(competitionId)
    setScreen('competitionDetail')
  }

  function getCompetitionStatus(competition) {
    const now = Date.now()
    const start = new Date(competition.start_date).getTime()
    const end = competition.end_date ? new Date(competition.end_date).getTime() : Infinity

    if (now < start) return 'upcoming'
    if (now > end) return 'ended'
    return 'active'
  }

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
    setIsSavingSession(false)
    setSessionSaveError('')
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

  async function persistCompletedSession(sessionToSave) {
    setIsSavingSession(true)
    setSessionSaveError('')

    const saveResult = await sessionsApi.saveSession(sessionToSave)

    if (!saveResult?.ok) {
      setSessionSaveError(saveResult?.error ?? 'Unable to save your session right now.')
    }

    setIsSavingSession(false)
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
      const completedSession = {
        sessionId: sessionState.sessionId,
        competitionId: sessionState.competitionId,
        startedAt: sessionState.startedAt,
        endedAt,
        summary,
        results: nextResults,
      }

      setLastSummary({
        ...summary,
        startedAt: sessionState.startedAt,
        endedAt,
        results: nextResults,
      })
      setSessionState(null)
      setScreen('summary')
      persistCompletedSession(completedSession)
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

  async function reviewPastSession(session) {
    setIsSavingSession(false)
    setSessionSaveError('')
    const results = await sessionsApi.fetchSessionResults(session.id)
    setLastSummary({
      totalQuestions: session.totalQuestions,
      correctCount: session.correctCount,
      accuracyPercent: session.accuracyPercent,
      avgTimePerQuestion: session.avgTimePerQuestion,
      difficultyLevelReached: session.difficultyLevelReached,
      totalSessionDurationMs: session.totalSessionDurationMs,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      results,
    })
    setScreen('summary')
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
        <div className="auth-robot-runway">
          <div className="auth-robot-bounce" style={{ backgroundImage: `url(${robotImg})` }} />
        </div>
        <p className="auth-tagline">Because knowing 7 x 8 = 56 can change your life.</p>

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
            <button type="submit" className="auth-btn-primary">
              {authMode === 'login' ? 'Log in' : 'Sign up'}
            </button>
          </form>
          <div className="auth-btn-row">
            {authMode === 'login' && (
              <button type="button" className="auth-btn-ghost" onClick={handleForgotPassword}>
                Forgot password?
              </button>
            )}
            <button
              type="button"
              className="auth-btn-ghost"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            >
              {authMode === 'login'
                ? 'Need an account? Sign up'
                : 'Already have an account? Log in'}
            </button>
          </div>
        </section>
      </main>
    )
  }

  const bestSessions = getBestSessions()
  const trend = buildAccuracyTrend(userSessions, 12)
  const accuracyChartData = trend.map((value, index) => ({
    sessionNumber: index + 1,
    accuracy: Number(value.toFixed(1)),
  }))

  const levelChartData = userSessions.slice(-12).map((s, index) => ({
    sessionNumber: index + 1,
    level: s.difficultyLevelReached,
  }))

  const tabs = ['dashboard', 'competitions', 'session', 'summary', 'groups', 'leaderboard', 'stats']
  if (auth.isAdmin) {
    tabs.push('admin')
  }

  return (
    <main className="container">
      <header className="header header--centered">
        <h1>
          <img src={logo} alt="" className="app-logo" />
          Master Math Challenger
        </h1>
        {(() => {
          const name = auth.profile?.display_name ?? 'Challenger'
          const now = new Date()
          const hour = now.getHours()
          const utcTime = now.toISOString().slice(11, 16)
          const utcDate = now.toISOString().slice(0, 10)
          const epoch = Math.floor(now.getTime() / 1000)
          const greetings = buildGreetings(name, hour, utcTime, utcDate, epoch)
          const message = greetings[greetingIndex % greetings.length]
          const nextGreeting = () => setGreetingIndex(i => {
            const next = Math.floor(Math.random() * greetings.length)
            return next === i % greetings.length ? (next + 1) % greetings.length : next
          })
          return (
            <div className="header-speech-row">
              <div
                className="header-robot-wrap"
                style={{ backgroundImage: `url(${robotImg})` }}
                onClick={nextGreeting}
                title="Click me for a new message!"
              />
              <p className="header-speech-bubble" onClick={nextGreeting} title="Click for a new message!">
                {message}
              </p>
            </div>
          )
        })()}
        <div className="main-robot-runway">
          <div className="main-robot-bounce" style={{ backgroundImage: `url(${robotImg})` }} />
        </div>
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
        <button
          type="button"
          className="logout-tab-btn"
          onClick={() => {
            auth.signOut()
            setScreen('competitions')
          }}
        >
          Log out
        </button>
      </nav>

      {screen === 'dashboard' && (
        <section className="panel stack">
          <h2>Dashboard</h2>

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
            <QuestionCountSelector
              selectedCount={practiceQuestionCount}
              onSelect={(questionCount) => setPracticeQuestionCount(clampQuestionCount(questionCount))}
            />
          )}

          <button
            type="button"
            onClick={() => startSession(selectedCompetitionId || null)}
          >
            Start a session
          </button>

          <h3>Today</h3>
          <div className="summary-stat-grid">
            <article className="summary-stat-card is-highlight">
              <p className="summary-card-label">Sessions</p>
              <p className="summary-card-value">{todayStats.sessionCount}</p>
              <p className="summary-card-detail">Completed today</p>
            </article>
            <article className="summary-stat-card">
              <p className="summary-card-label">Questions</p>
              <p className="summary-card-value">{todayStats.totalQuestions}</p>
              <p className="summary-card-detail">Answered today</p>
            </article>
            <article className="summary-stat-card">
              <p className="summary-card-label">Accuracy</p>
              <p className="summary-card-value">{formatAccuracy(todayStats.accuracyPercent)}</p>
              <p className="summary-card-detail">Across all questions</p>
            </article>
            <article className="summary-stat-card">
              <p className="summary-card-label">Total time</p>
              <p className="summary-card-value">{formatMs(todayStats.totalTimeMs)}</p>
              <p className="summary-card-detail">Time spent practicing</p>
            </article>
            <article className="summary-stat-card">
              <p className="summary-card-label">Active competitions</p>
              <p className="summary-card-value">{activeCompetitions.length}</p>
              <p className="summary-card-detail">
                {activeCompetitions.length === 0
                  ? 'No active competitions'
                  : activeCompetitions.map((c) => c.name).join(', ')}
              </p>
            </article>
          </div>
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
        <section className="panel stack summary-panel">
          <div className="summary-header">
            <h2>Session summary</h2>
            {lastSummary && (
              <p className="summary-subtitle">
                Completed {formatDateTime(lastSummary.endedAt)} • {lastSummary.correctCount}/{lastSummary.totalQuestions} correct
              </p>
            )}
          </div>
          {!lastSummary ? (
            <p>Complete a session to see your summary.</p>
          ) : (
            <>
              {isSavingSession && (
                <p role="status" aria-live="polite">
                  Saving session...
                </p>
              )}
              {sessionSaveError && (
                <p className="error" role="alert">
                  {sessionSaveError}
                </p>
              )}
              <div className="summary-stat-grid">
                <article className="summary-stat-card is-highlight">
                  <p className="summary-card-label">Score</p>
                  <p className="summary-card-value">
                    {lastSummary.correctCount}/{lastSummary.totalQuestions}
                  </p>
                  <p className="summary-card-detail">Correct answers this session</p>
                </article>
                <article className="summary-stat-card">
                  <p className="summary-card-label">Accuracy</p>
                  <p className="summary-card-value">
                    {formatAccuracy(lastSummary.accuracyPercent)}
                  </p>
                  <p className="summary-card-detail">Across all questions</p>
                </article>
                <article className="summary-stat-card">
                  <p className="summary-card-label">Average answer time</p>
                  <p className="summary-card-value">{formatMs(lastSummary.avgTimePerQuestion)}</p>
                  <p className="summary-card-detail">Per question</p>
                </article>
                <article className="summary-stat-card">
                  <p className="summary-card-label">Highest level</p>
                  <p className="summary-card-value">{lastSummary.difficultyLevelReached}</p>
                  <p className="summary-card-detail">Hardest level reached</p>
                </article>
                <article className="summary-stat-card">
                  <p className="summary-card-label">Session duration</p>
                  <p className="summary-card-value">
                    {formatMs(lastSummary.totalSessionDurationMs)}
                  </p>
                  <p className="summary-card-detail">From first question to finish</p>
                </article>
                {bestSessions && (
                  <article className="summary-stat-card">
                    <p className="summary-card-label">Personal best accuracy</p>
                    <p className="summary-card-value">
                      {formatAccuracy(bestSessions.byAccuracy.accuracyPercent)}
                    </p>
                    <p className="summary-card-detail">Best completed session so far</p>
                  </article>
                )}
              </div>

              <div className="summary-review-header">
                <h3>Question review</h3>
                <p>Green cards are correct. Red cards show where to practice more.</p>
              </div>
              <ul className="question-review-list">
                {lastSummary.results.map((result, index) => (
                  <li
                    key={index}
                    className={`question-review-item ${result.isCorrect ? 'is-correct' : 'is-wrong'}`}
                  >
                    <span className="question-review-text">
                      {result.factorA} × {result.factorB} = {result.correctAnswer}
                    </span>
                    <span className="question-review-answer">
                      {result.isCorrect
                        ? 'Correct'
                        : `You answered ${result.userAnswer ?? '(blank)'}`}
                    </span>
                    <span className="question-review-answer">
                      Level {result.difficultyLevelAtTime} • {formatMs(result.timeTakenMs)}
                    </span>
                  </li>
                ))}
              </ul>
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
            <QuestionCountSelector
              selectedCount={competitionForm.questionCount}
              onSelect={(questionCount) =>
                setCompetitionForm({
                  ...competitionForm,
                  questionCount: clampQuestionCount(questionCount),
                })
              }
            />

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
          <div className="competition-grid">
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
              const status = getCompetitionStatus(competition)

              return (
                <article
                  key={competition.id}
                  className={`competition-card is-${status}`}
                  onClick={() => viewCompetition(competition.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      viewCompetition(competition.id)
                    }
                  }}
                >
                  <div className="competition-card-header">
                    <h4>{competition.name}</h4>
                    <span className={`competition-status-badge is-${status}`}>
                      {status === 'active' ? 'Active' : status === 'upcoming' ? 'Upcoming' : 'Ended'}
                    </span>
                  </div>
                  <p className="competition-card-dates">
                    {new Date(competition.start_date).toLocaleDateString()} -{' '}
                    {competition.end_date
                      ? new Date(competition.end_date).toLocaleDateString()
                      : 'Ongoing'}
                  </p>
                  <p className="competition-card-visibility">
                    {competition.visibility === 'group-public' ? 'Public in group' : 'Invite-only'}
                  </p>
                  <div className="competition-card-footer">
                    {isParticipant ? (
                      <span className="competition-card-tag">You're in</span>
                    ) : canJoinGroupPublic ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          competitionsApi.joinCompetition(competition.id)
                        }}
                      >
                        Join competition
                      </button>
                    ) : (
                      <span className="competition-card-tag">Invite-only</span>
                    )}
                    <span className="competition-card-link">View stats →</span>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {screen === 'competitionDetail' && (
        <section className="panel stack">
          {(() => {
            const competition = competitionsApi.competitions.find(
              (entry) => entry.id === viewingCompetitionId,
            )

            if (!competition) {
              return (
                <>
                  <h2>Competition not found</h2>
                  <button type="button" onClick={() => setScreen('competitions')}>
                    Back to competitions
                  </button>
                </>
              )
            }

            const isParticipant = competitionsApi.participants.some(
              (participant) =>
                participant.competition_id === competition.id &&
                participant.user_id === currentUserId,
            )
            const status = getCompetitionStatus(competition)
            const groupName = competition.group_id
              ? groupsApi.groups.find((group) => group.id === competition.group_id)?.name
              : null

            return (
              <>
                <div className="summary-header">
                  <h2>{competition.name}</h2>
                  <p className="summary-subtitle">
                    <span className={`competition-status-badge is-${status}`}>
                      {status === 'active' ? 'Active' : status === 'upcoming' ? 'Upcoming' : 'Ended'}
                    </span>{' '}
                    {new Date(competition.start_date).toLocaleDateString()} -{' '}
                    {competition.end_date
                      ? new Date(competition.end_date).toLocaleDateString()
                      : 'Ongoing'}
                  </p>
                </div>

                <div className="summary-stat-grid">
                  <article className="summary-stat-card">
                    <p className="summary-card-label">Visibility</p>
                    <p className="summary-card-value">
                      {competition.visibility === 'group-public' ? 'Group' : 'Invite-only'}
                    </p>
                    <p className="summary-card-detail">{groupName ?? 'No group attached'}</p>
                  </article>
                  <article className="summary-stat-card">
                    <p className="summary-card-label">Questions per session</p>
                    <p className="summary-card-value">{clampQuestionCount(competition.question_count)}</p>
                    <p className="summary-card-detail">Set by the competition creator</p>
                  </article>
                  <article className="summary-stat-card">
                    <p className="summary-card-label">Participants</p>
                    <p className="summary-card-value">
                      {
                        competitionsApi.participants.filter(
                          (participant) => participant.competition_id === competition.id,
                        ).length
                      }
                    </p>
                    <p className="summary-card-detail">Joined this competition</p>
                  </article>
                </div>

                {isParticipant ? (
                  <button type="button" onClick={() => startSession(competition.id)}>
                    Start a session for this competition
                  </button>
                ) : (
                  <p>Join this competition from the competitions list to compete.</p>
                )}

                <h3>Leaderboard</h3>
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
                    {competitionDetailRows.map((row, index) => (
                      <tr key={row.userId}>
                        <td>{index + 1}</td>
                        <td>{row.displayName}</td>
                        <td>{row.totalCorrect}</td>
                        <td>{row.sessionCount}</td>
                        <td>
                          {row.avgTime === null || row.avgTime === undefined
                            ? '-'
                            : formatMs(row.avgTime)}
                        </td>
                      </tr>
                    ))}
                    {competitionDetailRows.length === 0 && (
                      <tr>
                        <td colSpan="5">No scores yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <button type="button" className="ghost" onClick={() => setScreen('competitions')}>
                  Back to competitions
                </button>
              </>
            )
          })()}
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
            <button
              type="button"
              className={appLeaderboardSort === 'accuracy' ? 'active' : 'ghost'}
              onClick={() => setAppLeaderboardSort('accuracy')}
            >
              Best accuracy
            </button>
          </div>

          {sortedAppLeaderboardRows.length > 0 && (() => {
            const top10 = sortedAppLeaderboardRows.slice(0, 10)
            const chartConfig = appLeaderboardSort === 'sessions'
              ? { key: 'value', label: 'Sessions', fmt: (v) => [v, 'Sessions'] }
              : appLeaderboardSort === 'accuracy'
              ? { key: 'value', label: 'Accuracy %', fmt: (v) => [`${v}%`, 'Accuracy'] }
              : { key: 'value', label: 'Total correct', fmt: (v) => [v, 'Total correct'] }
            const chartData = top10.map((row) => ({
              name: row.displayName,
              value: appLeaderboardSort === 'sessions'
                ? row.sessionCount
                : appLeaderboardSort === 'accuracy'
                ? (row.accuracyPercent ?? 0)
                : row.totalCorrect,
            }))
            return (
              <div className="stack">
                <h3>Top {top10.length} players — {chartConfig.label}</h3>
                <div className="chart" aria-label="Top players chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#475569' }}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                        interval={0}
                      />
                      <YAxis
                        domain={appLeaderboardSort === 'accuracy' ? [0, 100] : ['auto', 'auto']}
                        tickFormatter={appLeaderboardSort === 'accuracy' ? (v) => `${v}%` : undefined}
                        tick={{ fontSize: 12, fill: '#475569' }}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                        width={44}
                      />
                      <Tooltip
                        formatter={chartConfig.fmt}
                        labelFormatter={(name) => `Player: ${name}`}
                        contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#d85a30"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#d85a30', strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )
          })()}

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Total correct</th>
                <th>Sessions</th>
                <th>Avg time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedAppLeaderboardRows.map((row, index) => (
                <tr key={row.userId} className={row.userId === currentUserId ? 'is-me' : ''}>
                  <td>{index + 1}</td>
                  <td>{row.displayName}{row.userId === currentUserId ? ' (you)' : ''}</td>
                  <td>{row.totalCorrect}</td>
                  <td>{row.sessionCount}</td>
                  <td>{row.avgTime === null || row.avgTime === undefined ? '-' : formatMs(row.avgTime)}</td>
                  <td>
                    {row.userId !== currentUserId && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setCompareUserId(compareUserId === row.userId ? null : row.userId)}
                      >
                        {compareUserId === row.userId ? 'Close' : 'Compare'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {sortedAppLeaderboardRows.length === 0 && (
                <tr>
                  <td colSpan="6">No scores yet.</td>
                </tr>
              )}
            </tbody>
          </table>

          {compareUserId && (() => {
            const me = appLeaderboardRows.find((r) => r.userId === currentUserId)
            const them = appLeaderboardRows.find((r) => r.userId === compareUserId)
            if (!me || !them) return null
            const metrics = [
              { label: 'Total correct', mine: me.totalCorrect, theirs: them.totalCorrect, better: 'higher' },
              { label: 'Sessions', mine: me.sessionCount, theirs: them.sessionCount, better: 'higher' },
              { label: 'Accuracy', mine: me.accuracyPercent != null ? `${me.accuracyPercent}%` : '-', theirs: them.accuracyPercent != null ? `${them.accuracyPercent}%` : '-', better: 'higher', cmp: [me.accuracyPercent, them.accuracyPercent] },
              { label: 'Avg time', mine: me.avgTime != null ? formatMs(me.avgTime) : '-', theirs: them.avgTime != null ? formatMs(them.avgTime) : '-', better: 'lower', cmp: [me.avgTime, them.avgTime] },
            ]
            return (
              <div className="stack">
                <h3>Head-to-head: you vs {them.displayName}</h3>
                <div className="compare-grid">
                  <div className="compare-col compare-col--you">
                    <p className="compare-name">You ({me.displayName})</p>
                    {metrics.map((m) => {
                      const mineVal = m.cmp ? m.cmp[0] : (typeof m.mine === 'number' ? m.mine : null)
                      const theirVal = m.cmp ? m.cmp[1] : (typeof m.theirs === 'number' ? m.theirs : null)
                      const winning = mineVal != null && theirVal != null && (m.better === 'higher' ? mineVal > theirVal : mineVal < theirVal)
                      return (
                        <div key={m.label} className={`compare-stat ${winning ? 'compare-win' : ''}`}>
                          <span className="compare-label">{m.label}</span>
                          <span className="compare-value">{m.mine}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="compare-divider">VS</div>
                  <div className="compare-col compare-col--them">
                    <p className="compare-name">{them.displayName}</p>
                    {metrics.map((m) => {
                      const mineVal = m.cmp ? m.cmp[0] : (typeof m.mine === 'number' ? m.mine : null)
                      const theirVal = m.cmp ? m.cmp[1] : (typeof m.theirs === 'number' ? m.theirs : null)
                      const winning = theirVal != null && mineVal != null && (m.better === 'higher' ? theirVal > mineVal : theirVal < mineVal)
                      return (
                        <div key={m.label} className={`compare-stat ${winning ? 'compare-win' : ''}`}>
                          <span className="compare-label">{m.label}</span>
                          <span className="compare-value">{m.theirs}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}

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
                <div className="chart" aria-label="Accuracy trend chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={accuracyChartData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="sessionNumber"
                        tick={{ fontSize: 12, fill: '#475569' }}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                        label={{ value: 'Session', position: 'insideBottom', offset: -2, fontSize: 12, fill: '#475569' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tickFormatter={(value) => `${value}%`}
                        tick={{ fontSize: 12, fill: '#475569' }}
                        tickLine={false}
                        axisLine={{ stroke: '#cbd5e1' }}
                        width={44}
                      />
                      <Tooltip
                        formatter={(value) => [`${value}%`, 'Accuracy']}
                        labelFormatter={(label) => `Session ${label}`}
                        contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        stroke="#d85a30"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#d85a30', strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="chart-caption">
                  Session numbers run oldest to newest across the chart.
                </p>
              </>
            )}
          </div>

          <div className="stack">
            <h3>Difficulty level progression (last {levelChartData.length} sessions)</h3>
            {levelChartData.length === 0 ? (
              <p>Complete a session to see level progression.</p>
            ) : (
              <div className="chart" aria-label="Level progression chart">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={levelChartData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="sessionNumber"
                      tick={{ fontSize: 12, fill: '#475569' }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      label={{ value: 'Session', position: 'insideBottom', offset: -2, fontSize: 12, fill: '#475569' }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: '#475569' }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      width={32}
                    />
                    <Tooltip
                      formatter={(value) => [value, 'Level reached']}
                      labelFormatter={(label) => `Session ${label}`}
                      contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="level"
                      stroke="#0ea5e9"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {heatmapGrid && (
            <div className="stack">
              <h3>Missed facts heatmap</h3>
              <p className="chart-caption">Darker red = higher miss rate. Tap a cell to see your stats for that fact.</p>
              <div className="heatmap-wrap" role="table" aria-label="Multiplication facts heatmap">
                <div className="heatmap-grid">
                  <div className="heatmap-corner" />
                  {Array.from({ length: 12 }, (_, i) => (
                    <div key={i} className="heatmap-header">{i + 1}</div>
                  ))}
                  {Array.from({ length: 12 }, (_, rowIdx) => (
                    <>
                      <div key={`row-${rowIdx}`} className="heatmap-header">{rowIdx + 1}</div>
                      {Array.from({ length: 12 }, (_, colIdx) => {
                        const a = rowIdx + 1
                        const b = colIdx + 1
                        const cell = heatmapGrid[`${a}-${b}`] ?? heatmapGrid[`${b}-${a}`]
                        const missRate = cell ? (cell.total - cell.correct) / cell.total : 0
                        const attempted = cell ? cell.total : 0
                        const bg = attempted === 0
                          ? 'transparent'
                          : `rgba(216,90,48,${(missRate * 0.85 + (attempted > 0 ? 0.08 : 0)).toFixed(2)})`
                        return (
                          <div
                            key={`${rowIdx}-${colIdx}`}
                            className="heatmap-cell"
                            style={{ background: bg }}
                            title={attempted === 0
                              ? `${a}×${b} — not attempted`
                              : `${a}×${b} — ${cell.correct}/${attempted} correct (${Math.round((cell.correct / attempted) * 100)}%)`}
                          >
                            {attempted > 0 ? `${a}×${b}` : ''}
                          </div>
                        )
                      })}
                    </>
                  ))}
                </div>
              </div>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>Started</th>
                <th>Correct</th>
                <th>Accuracy</th>
                <th>Avg time</th>
                <th>Level</th>
                <th></th>
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
                    <td>
                      <button type="button" onClick={() => reviewPastSession(session)}>
                        Review
                      </button>
                    </td>
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
