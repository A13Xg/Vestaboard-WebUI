"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppLogo } from "@/components/images/AppLogo";
import { Input, Button } from "@/components/ui";
import { loginSchema, type LoginFormValues } from "@/lib/schemas";
import { authApi } from "@/lib/api-client";
import { APP_NAME, APP_TAGLINE, ROUTES } from "@/config";

export function AccessCodeForm() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await authApi.login(values);
    if (result.error === null && result.data.success) {
      router.push(ROUTES.quickSend);
    } else {
      setError(result.data?.error ?? result.error?.error ?? "Invalid access code");
    }
  });

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center mb-10"
      >
        <AppLogo className="w-14 h-14 mb-4 shadow-xl shadow-black/40" priority />
        <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">{APP_NAME}</h1>
        <p className="text-sm text-neutral-500 mt-1">{APP_TAGLINE}</p>
      </motion.div>

      {/* Form */}
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-col gap-4"
      >
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-neutral-600" />
            <p className="text-xs text-neutral-500">Enter your access code to continue</p>
          </div>
          <Input
            id="accessCode"
            label="Access Code"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            autoFocus
            error={errors.accessCode?.message}
            {...register("accessCode")}
          />
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-400 text-center"
              role="alert"
            >
              {error}
            </motion.p>
          )}
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting} className="w-full mt-1">
            Authenticate
          </Button>
        </div>
        <p className="text-center text-[11px] text-neutral-700">
          Authorized devices only · Access logs are recorded
        </p>
      </motion.form>
    </div>
  );
}
