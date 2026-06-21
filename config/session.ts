import type { SessionOptions } from "iron-session";

// Fail-closed: secure=true whenever NODE_ENV=production unless explicitly overridden.
// The local launchers (run.sh / runWebApp.bat) pass SECURE_COOKIES=false so plain-HTTP
// localhost works without hassle. HTTPS deployments (Vercel, Docker + TLS proxy) need
// no override — the production NODE_ENV default is already secure.
// To force either direction: SECURE_COOKIES=true | SECURE_COOKIES=false.
const secureCookies = process.env.SECURE_COOKIES
  ? process.env.SECURE_COOKIES === "true"
  : process.env.NODE_ENV === "production";

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
