import type { SessionOptions } from "iron-session";

// SECURE_COOKIES=false lets you test a production build (npm run start) over plain
// HTTP without the browser refusing to send the session cookie. In all other
// production contexts — Vercel, Docker behind HTTPS, any reverse proxy — leave the
// variable unset so the secure flag is always enabled.
const secureCookies =
  process.env.NODE_ENV === "production" && process.env.SECURE_COOKIES !== "false";

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
