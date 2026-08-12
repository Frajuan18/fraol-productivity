/**
 * Server-only environment access. Never import this module from client code or from
 * files that ship to the browser. MongoDB credentials live exclusively here and in the
 * connection module; they are never exposed through NEXT_PUBLIC_* variables.
 */
export interface ServerEnv {
  mongodbUri: string | null;
  mongodbDatabase: string;
  authSessionCookieName: string;
  authSessionTtlSeconds: number;
  mongoConfigured: boolean;
}

export function getServerEnv(): ServerEnv {
  const mongodbUri = process.env.MONGODB_URI || null;
  const mongodbDatabase = process.env.MONGODB_DATABASE || 'mywhiteboard';
  return {
    mongodbUri,
    mongodbDatabase,
    authSessionCookieName: process.env.AUTH_SESSION_COOKIE || 'mw_session',
    authSessionTtlSeconds: Number(process.env.AUTH_SESSION_TTL_SECONDS || 60 * 60 * 24 * 30),
    mongoConfigured: Boolean(mongodbUri),
  };
}
