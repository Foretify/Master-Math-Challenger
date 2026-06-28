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
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
  }

  const bytes = new Uint8Array(8)
  globalThis.crypto?.getRandomValues?.(bytes)
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${suffix || Date.now().toString(16)}`
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
