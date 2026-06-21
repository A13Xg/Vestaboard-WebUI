import type { SessionOptions } from "iron-session";

// Set SECURE_COOKIES=true in production HTTPS environments (Vercel, Docker behind a
// reverse proxy, any host serving over HTTPS). Leave it unset for local use —
// the launchers (run.sh / runWebApp.bat) serve over plain HTTP and the browser will
// silently refuse to send a secure-flagged cookie on that connection.
const secureCookies = process.env.SECURE_COOKIES === "true";

export const SESSION_OPTIONS: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "vestaboard_session",
  cookieOptions: {
    secure: secureCookies,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  },
};
