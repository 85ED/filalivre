const sessions = new Map()

export function addSession(barbeariaId, client) {
  sessions.set(barbeariaId, client)
}

export function getSession(barbeariaId) {
  return sessions.get(barbeariaId)
}

export function hasSession(barbeariaId) {
  return sessions.has(barbeariaId)
}

export function removeSession(barbeariaId) {
  sessions.delete(barbeariaId)
}

export function listSessions() {
  return Array.from(sessions.keys())
}
