import { z } from "zod";

export const loginSchema = z.object({
  accessCode: z
    .string()
    .min(4, "Access code must be at least 4 characters")
    .max(64, "Access code too long"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const composeSchema = z.object({
  text: z
    .string()
    .min(1, "Message cannot be empty")
    .max(132, "Message exceeds maximum board capacity"),
  style: z.enum(["default", "bold", "narrow", "extraBold", "script"]).default("default"),
  alignment: z.enum(["left", "center", "right"]).default("center"),
});

export type ComposeFormValues = z.infer<typeof composeSchema>;
