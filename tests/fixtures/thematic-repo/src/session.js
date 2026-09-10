import { findUser, matchesPassword, issueSession } from './users.js';
export function login(email, password) {
  const user = findUser(email);
  if (!user || !matchesPassword(user, password)) return { status: 401, error: 'invalid_credentials' };
  return { status: 200, session: issueSession(user.id) };
}
