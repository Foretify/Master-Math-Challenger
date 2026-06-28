const STORAGE_KEY = 'master-math-challenger-db'

const defaultDb = {
  users: [],
  groups: [],
  groupMembers: [],
  groupInvites: [],
  competitions: [],
  competitionParticipants: [],
  sessions: [],
  questionsLog: [],
}

export function newId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function readDb() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return defaultDb
  }

  try {
    const parsed = JSON.parse(raw)
    return {
      ...defaultDb,
      ...parsed,
    }
  } catch {
    return defaultDb
  }
}

export function writeDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

export function updateDb(updater) {
  const current = readDb()
  const next = updater(current)
  writeDb(next)

  return next
}
