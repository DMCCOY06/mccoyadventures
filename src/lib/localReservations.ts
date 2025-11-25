export type LocalReservationRecord = {
  id: string
  user_id: string
  user_email?: string | null
  tour_id: string
  date: string
  pax: number
  status: string
  created_at: string
  localOnly?: boolean
  tour?: {
    id: string
    title: string
    cover_image?: string | null
    duration?: string | null
  } | null
}

const STORAGE_KEY = 'mccoy_reservations'

function readStorage(): LocalReservationRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LocalReservationRecord[]) : []
  } catch {
    return []
  }
}

function writeStorage(records: LocalReservationRecord[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function loadLocalReservations(): LocalReservationRecord[] {
  return readStorage()
}

export function addLocalReservationRecords(records: LocalReservationRecord[]) {
  if (!records.length) return
  const existing = readStorage()
  const map = new Map(existing.map(r => [r.id, r]))
  records.forEach(record => map.set(record.id, record))
  writeStorage([...map.values()])
}

export function updateLocalReservationRecord(id: string, patch: Partial<LocalReservationRecord>) {
  const existing = readStorage()
  const idx = existing.findIndex(r => r.id === id)
  if (idx >= 0) {
    existing[idx] = { ...existing[idx], ...patch }
    writeStorage(existing)
  }
  return existing
}

export function removeLocalReservation(id: string) {
  const next = readStorage().filter(r => r.id !== id)
  writeStorage(next)
  return next
}
