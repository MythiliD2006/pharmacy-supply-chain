"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, ShieldCheck, QrCode, Globe,
  Zap, Lock, BarChart3, ChevronRight, GitBranch
} from "lucide-react";
import { SupplyChainAnimation } from "@/components/landing/SupplyChainAnimation";
import { StatsStrip } from "@/components/ui/CountUp";
import { Navbar } from "@/components/layout/Navbar";

const stats = [
  { label: "Batches Tracked", value: 12400, suffix: "+" },
  { label: "Verified Medicines", value: 980000, suffix: "+" },
  { label: "Supply Chain Partners", value: 340, suffix: "+" },
];

const howItWorks = [
  {
    icon: <ShieldCheck size={24} className="text-emerald-500" />,
    title: "Registered on Blockchain",
    desc: "Every medicine batch gets a unique on-chain identity the moment it leaves the manufacturer — immutable and tamper-proof.",
    span: "col-span-2",
  },
  {
    icon: <QrCode size={24} className="text-violet-500" />,
    title: "Scan & Verify",
    desc: "Patients scan a QR code or enter a batch ID. The result is instant and pulled directly from the blockchain.",
    span: "col-span-1",
  },
  {
    icon: <Globe size={24} className="text-sky-500" />,
    title: "Full Transfer History",
    desc: "See exactly where a batch has been: from factory floor to pharmacy shelf, every custody change is recorded.",
    span: "col-span-1",
  },
  {
    icon: <Lock size={24} className="text-rose-500" />,
    title: "Counterfeit Detection",
    desc: "If a batch's history looks wrong, was modified, or never existed on-chain, the system flags it immediately.",
    span: "col-span-1",
  },
  {
    icon: <BarChart3 size={24} className="text-amber-500" />,
    title: "Real-time Analytics",
    desc: "Supply chain partners get live dashboards showing batch status, transfer activity and expiry warnings.",
    span: "col-span-1",
  },
  {
    icon: <Zap size={24} className="text-teal-500" />,
    title: "Instant Results",
    desc: "Verification completes in seconds — no logins, no apps, no friction. Just answers.",
    span: "col-span-1",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-20 px-4">
        {/* Background blobs */}
        <div className="blob w-96 h-96 -top-20 -left-20 bg-teal-400 dark:opacity-10" />
        <div className="blob w-80 h-80 top-10 right-10 bg-violet-500 dark:opacity-8" style={{ opacity: 0.08 }} />

        {/* Grid pattern */}
        <div className="absolute inset-0 grid-pattern opacity-50 dark:opacity-20" />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 pill pill-accent"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            Powered by Ethereum · Sepolia Testnet
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl font-display font-bold tracking-tight mb-6"
          >
            Know your{" "}
            <span className="gradient-text">medicine</span>
            <br />
            is real.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            PharmaChain tracks every medicine batch from manufacturer to pharmacy
            on the blockchain. Scan a QR code to instantly verify authenticity,
            expiry, and chain of custody.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              href="/verify"
              id="hero-verify-btn"
              className="btn btn-primary text-base px-7 py-3.5 text-lg"
            >
              <QrCode size={20} />
              Verify a Medicine
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              id="hero-login-btn"
              className="btn btn-secondary text-base px-7 py-3.5"
            >
              Partner Login
              <ChevronRight size={16} />
            </Link>
          </motion.div>

          {/* Supply chain animation */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-16 card p-6 mx-auto max-w-2xl"
          >
            <p className="text-xs text-[var(--text-tertiary)] font-semibold uppercase tracking-widest mb-4">
              Live supply chain tracking
            </p>
            <SupplyChainAnimation />
          </motion.div>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────────── */}
      <section className="py-16 px-4 border-y border-[var(--bg-border)]">
        <div className="max-w-2xl mx-auto">
          <StatsStrip stats={stats} />
        </div>
      </section>

      {/* ── How it works (bento) ──────────────────────────────────── */}
      <section className="py-20 px-4 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-3">
            How it works
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto">
            A simple, transparent system that keeps fake medicines out of the supply chain.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {howItWorks.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              className={`card p-6 flex flex-col gap-4 ${i === 0 ? "sm:col-span-2 lg:col-span-2" : ""}`}
            >
              <div className="w-11 h-11 rounded-xl bg-[var(--bg-lifted)] flex items-center justify-center">
                {item.icon}
              </div>
              <div>
                <h3 className="text-base font-display font-semibold mb-1.5">{item.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto rounded-3xl overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, var(--brand-from), #0D9488, var(--brand-to))",
          }}
        >
          <div className="blob w-64 h-64 top-0 right-0 bg-white opacity-10" />
          <div className="relative p-10 sm:p-16 text-center text-white">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              Ready to verify your medicine?
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
              No account needed. Just scan the QR code on your medicine packaging and get an instant result.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/verify"
                className="btn text-base px-7 py-3.5 bg-white text-[var(--brand-from)] hover:bg-white/90 font-bold"
              >
                <QrCode size={20} />
                Start Verifying
              </Link>
              <Link
                href="/login"
                className="btn text-base px-7 py-3.5 bg-white/10 text-white border border-white/20 hover:bg-white/20"
              >
                Supply Chain Partners
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--bg-border)] py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] flex items-center justify-center">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-sm">PharmaChain</span>
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">
            © 2026 PharmaChain. Built on Ethereum Sepolia.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/verify" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Verify
            </Link>
            <Link href="/login" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Login
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="GitHub"
            >
              <GitBranch size={16} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
