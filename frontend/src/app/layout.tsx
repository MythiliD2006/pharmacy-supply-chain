import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: {
    default: "PharmaChain – Medicine Verification",
    template: "%s | PharmaChain",
  },
  description:
    "Track and verify pharmaceutical supply chains on the blockchain. Know your medicine is real.",
  keywords: ["pharma", "blockchain", "medicine", "supply chain", "verification"],
  openGraph: {
    title: "PharmaChain – Know Your Medicine Is Real",
    description: "Blockchain-powered pharmaceutical supply chain verification.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontSize: "0.875rem",
                  borderRadius: "0.75rem",
                },
                classNames: {
                  toast:
                    "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--bg-border)] shadow-lg",
                  success: "!border-emerald-500/30",
                  error: "!border-rose-500/30",
                },
              }}
              richColors
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
