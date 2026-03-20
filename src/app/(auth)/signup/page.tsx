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
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  org_name: z.string().min(2, "Organization name is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

type FormValues = z.infer<typeof schema>;

export default function SignupPage() {
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
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.full_name,
            org_name: values.org_name,
          },
        },
      });

      if (error) {
        setAuthError(error.message);
        return;
      }

      router.push("/");
    } catch {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-axiom-body flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-axiom-cyan/[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-axiom-amber/[0.04] rounded-full blur-3xl" />
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
          <div className="h-[2px] bg-gradient-to-r from-transparent via-axiom-cyan to-transparent" />

          <div className="p-7">
            <h2 className="font-display text-2xl tracking-widest text-white mb-1">
              REQUEST ACCESS
            </h2>
            <p className="text-xs text-white/40 mb-6 font-ui">
              Create your organization account
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Full name */}
              <div>
                <label className="axiom-label">Full Name</label>
                <input
                  {...register("full_name")}
                  type="text"
                  className="axiom-input"
                  placeholder="Your full name"
                  autoComplete="name"
                />
                {errors.full_name && (
                  <p className="text-[11px] text-axiom-red mt-1">
                    {errors.full_name.message}
                  </p>
                )}
              </div>

              {/* Org name */}
              <div>
                <label className="axiom-label">Organization</label>
                <input
                  {...register("org_name")}
                  type="text"
                  className="axiom-input"
                  placeholder="Hedge fund, bank, policy institution..."
                  autoComplete="organization"
                />
                {errors.org_name && (
                  <p className="text-[11px] text-axiom-red mt-1">
                    {errors.org_name.message}
                  </p>
                )}
              </div>

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
                    autoComplete="new-password"
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

              {/* Confirm password */}
              <div>
                <label className="axiom-label">Confirm Password</label>
                <input
                  {...register("confirm_password")}
                  type={showPassword ? "text" : "password"}
                  className="axiom-input"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                {errors.confirm_password && (
                  <p className="text-[11px] text-axiom-red mt-1">
                    {errors.confirm_password.message}
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

              {/* Terms */}
              <p className="text-[10px] text-white/30 leading-relaxed">
                By creating an account you agree to our{" "}
                <button type="button" className="text-axiom-cyan/60 hover:text-axiom-cyan">
                  Terms of Service
                </button>{" "}
                and{" "}
                <button type="button" className="text-axiom-cyan/60 hover:text-axiom-cyan">
                  Privacy Policy
                </button>
                .
              </p>

              {/* Submit */}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={isSubmitting}
              >
                Create Account
              </Button>
            </form>
          </div>

          <div className="px-7 py-4 border-t border-white/[0.07] bg-white/[0.015]">
            <p className="text-xs text-white/40 text-center">
              Already have access?{" "}
              <Link
                href="/login"
                className="text-axiom-amber hover:text-axiom-amber/80 transition-colors font-semibold"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
