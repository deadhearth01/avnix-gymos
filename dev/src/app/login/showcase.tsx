"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCheck, IndianRupee, MessageCircle, TrendingUp, UsersRound, Zap } from "lucide-react";

const EVENTS = [
  { icon: MessageCircle, title: "Renewal reminder delivered", body: "Ravi Kumar · 3 days before expiry", tone: "#22c55e" },
  { icon: IndianRupee, title: "₹4,500 collected via UPI", body: "Sneha P. renewed Quarterly", tone: "#a3e635" },
  { icon: UsersRound, title: "New trial booked", body: "From your gym website · 6:30 AM tomorrow", tone: "#60a5fa" },
  { icon: Zap, title: "Win-back sent to 12 members", body: "Telugu + English templates", tone: "#fbbf24" },
];

const BARS = [34, 52, 78, 58, 40, 30, 44, 62, 70, 84, 66, 92];

export function AuthShowcase() {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % EVENTS.length), 2800);
    return () => clearInterval(t);
  }, []);
  const ev = EVENTS[i];

  return (
    <div className="relative hidden p-3 lg:block">
      <div className="relative h-full overflow-hidden rounded-[28px] bg-[#0b0f0c] text-white">
        {/* ambient light */}
        <div className="absolute -top-40 -right-32 size-[520px] rounded-full bg-[radial-gradient(circle,rgb(34_197_94/0.35),transparent_65%)] blur-2xl" />
        <div className="absolute -bottom-48 -left-24 size-[480px] rounded-full bg-[radial-gradient(circle,rgb(163_230_53/0.2),transparent_65%)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.035)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] bg-[size:44px_44px]" />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur">
              <span className="size-1.5 animate-pulse rounded-full bg-[#22c55e]" /> Live across your gym
            </p>
            <h2 className="mt-6 max-w-md text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
              Fees collected. Members retained. <span className="text-[#a3e635]">On autopilot.</span>
            </h2>
            <p className="mt-4 max-w-md text-[15px] text-white/60">
              WhatsApp reminders in Telugu &amp; English, GST invoices, front-desk check-ins and a website for your gym — all in one calm dashboard.
            </p>
          </div>

          {/* floating preview */}
          <div className="relative mt-10 grid grid-cols-5 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="col-span-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md"
            >
              <p className="text-xs text-white/50">Collections this month</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-3xl font-semibold tracking-tight">₹3,84,200</span>
                <span className="rounded-md bg-[#a3e635]/20 px-1.5 text-xs font-semibold text-[#bef264]">+18.4%</span>
              </div>
              <div className="mt-5 flex h-28 items-end gap-1.5">
                {BARS.map((h, k) => (
                  <div key={k} className="relative flex-1 overflow-hidden rounded-md bg-white/[0.06]" style={{ height: "100%" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 0.4 + k * 0.05, type: "spring", stiffness: 120, damping: 18 }}
                      className="absolute right-0 bottom-0 left-0 rounded-md bg-[#a3e635]"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="col-span-2 flex flex-col gap-3"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
                <p className="text-xs text-white/50">Renewal rate</p>
                <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                  82% <TrendingUp className="size-4 text-[#a3e635]" />
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
                <p className="text-xs text-white/50">Checked in today</p>
                <div className="mt-2 flex -space-x-2">
                  {["#86efac", "#fde68a", "#c4b5fd", "#93c5fd", "#fca5a5"].map((c, k) => (
                    <span key={k} className="size-7 rounded-full border-2 border-[#0b0f0c]" style={{ background: c }} />
                  ))}
                  <span className="grid size-7 place-items-center rounded-full border-2 border-[#0b0f0c] bg-white/10 text-[10px]">+86</span>
                </div>
              </div>
            </motion.div>

            <div className="col-span-5 h-[74px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-md"
                >
                  <span className="grid size-10 place-items-center rounded-xl" style={{ background: `${ev.tone}26`, color: ev.tone }}>
                    <ev.icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{ev.title}</span>
                    <span className="block truncate text-xs text-white/50">{ev.body}</span>
                  </span>
                  <CheckCheck className="size-4 text-[#22c55e]" />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
