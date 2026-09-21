/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';

export default function App() {
  return (
    <main
      id="main-container"
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#FBFBFA] px-6 py-12"
    >
      {/* Subtle architectural background texture and gradient glow */}
      <div
        id="ambient-background"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        <div className="h-[520px] w-[520px] rounded-full bg-stone-200/40 blur-[120px]" />
        <div className="absolute h-[320px] w-[320px] rounded-full bg-amber-100/25 blur-[90px]" />
      </div>

      {/* Main presentation card */}
      <motion.section
        id="presentation-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-stone-200/80 bg-white/80 px-8 py-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-sm sm:px-14 sm:py-20"
      >
        <span
          id="badge-status"
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600 select-none"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Online
        </span>

        <h1
          id="hero-title"
          style={{ fontFamily: "'Syne', sans-serif" }}
          className="text-4xl font-extrabold tracking-tight text-stone-900 sm:text-6xl md:text-7xl"
        >
          ImmerzoWapi
        </h1>

        <p
          id="hero-caption"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          className="mt-4 max-w-md text-base leading-relaxed text-stone-500 sm:text-lg"
        >
          A minimalist presentation and dedicated interface.
        </p>
      </motion.section>
    </main>
  );
}

