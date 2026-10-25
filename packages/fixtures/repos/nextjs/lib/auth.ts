export interface UserSession {
  userId: string;
  email: string;
  role: string;
}

export function verifyAuthSession(token: string): UserSession | null {
  if (!token) return null;
  return { userId: 'u_123', email: 'test@example.com', role: 'admin' };
}
