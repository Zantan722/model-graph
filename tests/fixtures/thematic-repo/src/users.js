const users = [{ id: 'u1', email: 'demo@example.test', password: 'example-only' }];
export function findUser(email) { return users.find(user => user.email === email); }
export function matchesPassword(user, password) { return user.password === password; }
export function issueSession(id) { return { userId: id, expiresIn: 3600 }; }
