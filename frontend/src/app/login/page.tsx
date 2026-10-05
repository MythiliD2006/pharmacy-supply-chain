"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { Navbar } from "@/components/layout/Navbar";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <Navbar />

      {/* Background blobs */}
      <div className="blob w-80 h-80 top-20 -left-20 bg-teal-400 opacity-10" />
      <div className="blob w-64 h-64 bottom-20 right-10 bg-violet-500 opacity-8" />
      <div className="absolute inset-0 grid-pattern opacity-40 dark:opacity-15" />

      <div className="flex-1 flex items-center justify-center px-4 pt-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] flex items-center justify-center shadow-lg">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold">Partner Login</h1>
            <p className="text-[var(--text-secondary)] mt-2">
              Sign in to manage batches and transfers
            </p>
          </div>

          {/* Card */}
          <div className="card p-7">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Error banner */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-sm border border-rose-200 dark:border-rose-800"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </motion.div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="login-email">Email address</label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                  />
                  <input
                    id="login-email"
                    type="email"
                    className="input pl-9"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="login-password">Password</label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                  />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    className="input pl-9 pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                id="login-submit"
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3 text-base mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </div>

          {/* Public verify link */}
          <p className="text-center text-sm text-[var(--text-tertiary)] mt-6">
            Not a partner?{" "}
            <Link href="/verify" className="text-[var(--brand-to)] hover:underline font-medium">
              Verify a medicine instead
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
