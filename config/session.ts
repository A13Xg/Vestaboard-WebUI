import type { SessionOptions } from "iron-session";

export const SESSION_OPTIONS: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "vestaboard_session",
  cookieOptions: {
    // Keep cookies secure in deployed production, but allow localhost smoke tests over HTTP.
    secure: process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  },
};
