"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Activity, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    setAuthError(null);
    try {
      // Dynamic import to avoid SSR issues when Supabase isn't configured
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      router.push("/");
    } catch {
      // Demo mode: redirect directly if Supabase is not configured
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-axiom-body flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-axiom-amber/[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-64 h-64 bg-axiom-cyan/[0.04] rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-sm bg-axiom-amber flex items-center justify-center">
            <Activity size={18} className="text-black" strokeWidth={3} />
          </div>
          <div>
            <h1 className="font-display text-3xl tracking-widest text-white leading-none">
              AXIOM
            </h1>
            <p className="text-[10px] font-mono text-axiom-amber/70 tracking-[0.2em] uppercase">
              Intelligence Platform
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-axiom-panel border border-white/[0.08] rounded-sm overflow-hidden">
          {/* Amber accent */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-axiom-amber to-transparent" />

          <div className="p-7">
            <h2 className="font-display text-2xl tracking-widest text-white mb-1">
              SIGN IN
            </h2>
            <p className="text-xs text-white/40 mb-6 font-ui">
              Access your intelligence dashboard
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div>
                <label className="axiom-label">Email</label>
                <input
                  {...register("email")}
                  type="email"
                  className="axiom-input"
                  placeholder="analyst@institution.com"
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-[11px] text-axiom-red mt-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="axiom-label">Password</label>
                <div className="relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    className="axiom-input pr-9"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] text-axiom-red mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Auth error */}
              {authError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-3 bg-axiom-red/10 border border-axiom-red/30 rounded-[3px]"
                >
                  <p className="text-xs text-axiom-red">{authError}</p>
                </motion.div>
              )}

              {/* Forgot password */}
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-[11px] text-axiom-cyan/60 hover:text-axiom-cyan transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isSubmitting}
              >
                Sign In
              </Button>

              {/* Demo shortcut */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/[0.07]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 text-[10px] text-white/25 bg-axiom-panel font-mono uppercase tracking-wider">
                    or
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => router.push("/")}
              >
                Enter Demo Mode
              </Button>
            </form>
          </div>

          <div className="px-7 py-4 border-t border-white/[0.07] bg-white/[0.015]">
            <p className="text-xs text-white/40 text-center">
              No account?{" "}
              <Link
                href="/signup"
                className="text-axiom-amber hover:text-axiom-amber/80 transition-colors font-semibold"
              >
                Request access
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] font-mono text-white/20 mt-6 tracking-wider">
          CLASSIFICATION: RESTRICTED · AXIOM v1.0
        </p>
      </motion.div>
    </div>
  );
}
