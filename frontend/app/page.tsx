"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2 } from "lucide-react";

type Snowflake = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

export default function Home() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    const flakes = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.7 + 0.2,
    }));

    setSnowflakes(flakes);
  }, []);

  async function handleGenerateMidi() {
    try {
      setIsGenerating(true);
      setStatus("Generating frozen MIDI patterns...");

      const response = await fetch("http://localhost:8080/generate");

      if (!response.ok) {
        throw new Error("Generation failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "icepunk-midi-pack.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);

      setStatus("MIDI pack downloaded.");
    } catch {
      setStatus("Backend is not ready yet.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#38bdf822,transparent_35%),radial-gradient(circle_at_bottom,#1e3a8a55,transparent_40%)]" />

      <div className="pointer-events-none absolute inset-0">
        {snowflakes.map((snow) => (
          <motion.div
            key={snow.id}
            className="absolute top-[-10px] rounded-full bg-white"
            style={{
              left: `${snow.left}%`,
              width: snow.size,
              height: snow.size,
              opacity: snow.opacity,
            }}
            animate={{
              y: ["0vh", "110vh"],
              x: [0, 20, -20, 0],
            }}
            transition={{
              duration: snow.duration,
              repeat: Infinity,
              ease: "linear",
              delay: snow.delay,
            }}
          />
        ))}
      </div>

      <section className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="mx-auto max-w-4xl text-center">
          <motion.p
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-5 text-sm font-medium uppercase tracking-[0.5em] text-cyan-300"
          >
            MIDI GENERATOR
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1 }}
            className="bg-gradient-to-b from-white via-cyan-100 to-blue-400 bg-clip-text text-7xl font-black tracking-tight text-transparent sm:text-9xl"
          >
            iCEPUNK
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300"
          >
            Generate emotional frozen melodies and futuristic underground MIDI
            loops.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="mt-12 flex flex-col items-center gap-4"
          >
            <button
              onClick={handleGenerateMidi}
              disabled={isGenerating}
              className="group relative overflow-hidden rounded-full border border-cyan-300/30 bg-cyan-300 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_0_60px_rgba(34,211,238,0.45)] transition-all duration-300 hover:scale-105 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="relative z-10 flex items-center gap-3">
                {isGenerating ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Download size={20} />
                )}

                {isGenerating ? "Generating..." : "Generate MIDI Pack"}
              </span>

              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent transition duration-700 group-hover:translate-x-full" />
            </button>

            {status && <p className="text-sm text-cyan-200/80">{status}</p>}
          </motion.div>
        </div>
      </section>
    </main>
  );
}
