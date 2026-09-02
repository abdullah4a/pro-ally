export function canCreateSession(
  currentSessionCount: number,
  isAdmin: boolean,
  maxSessions: number,
): boolean {
  return isAdmin || currentSessionCount < maxSessions;
}
