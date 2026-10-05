"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export default function ScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(true);
  const [scannedBatchId, setScannedBatchId] = useState<string | null>(null);

  useEffect(() => {
    // Mocking a scan event after 3 seconds for demo purposes
    // In a real app, you would use a library like html5-qrcode or @zxing/browser
    const timer = setTimeout(() => {
      setScanning(false);
      setScannedBatchId("BATCH-2024-0001");
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (scannedBatchId) {
      const redirectTimer = setTimeout(() => {
        router.push(`/verify/${encodeURIComponent(scannedBatchId)}`);
      }, 1500);
      return () => clearTimeout(redirectTimer);
    }
  }, [scannedBatchId, router]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Custom transparent navbar for scanner */}
      <header className="absolute top-0 left-0 right-0 z-50 p-4">
        <div className="max-w-screen-md mx-auto flex items-center justify-between">
          <Link 
            href="/verify" 
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="text-sm font-medium bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full">
            Scan QR Code
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </header>

      <div className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
        
        {/* Mock camera feed background */}
        <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center opacity-50">
          <Camera size={48} className="text-zinc-700" />
        </div>

        <AnimatePresence>
          {scanning ? (
            <motion.div 
              key="scanner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 w-64 h-64 sm:w-80 sm:h-80"
            >
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />

              {/* Scanning line */}
              <div 
                className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]"
                style={{ animation: "scan-line 2s ease-in-out infinite" }}
              />

              {/* Instructions */}
              <div className="absolute -bottom-16 left-0 right-0 text-center">
                <p className="text-white/80 text-sm">
                  Align QR code within the frame
                </p>
                <p className="text-xs text-white/50 mt-2">
                  (Simulating camera feed for demo)
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative z-10 bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/20 text-center max-w-sm mx-4"
            >
              <div className="w-16 h-16 mx-auto bg-emerald-500 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-bold mb-2">Code Scanned!</h2>
              <p className="text-white/80 text-sm mb-4">
                Found batch: <span className="font-mono bg-white/20 px-2 py-0.5 rounded">{scannedBatchId}</span>
              </p>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-xs text-white/60 mt-4">Redirecting to verification...</p>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
