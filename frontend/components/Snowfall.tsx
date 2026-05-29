"use client";

import { useEffect, useState } from "react";

type Snowflake = {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

export default function Snowfall() {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);

  useEffect(() => {
    const flakes = Array.from({ length: 70 }, (_, index) => ({
      id: index,
      left: Math.random() * 100,
      size: Math.random() * 5 + 3,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 6,
      opacity: Math.random() * 0.6 + 0.4,
    }));

    setSnowflakes(flakes);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {snowflakes.map((flake) => (
        <span
          key={flake.id}
          className="absolute -top-6 rounded-full bg-white shadow-[0_0_10px_rgba(125,211,252,0.9)]"
          style={{
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animation: `snowfall ${flake.duration}s linear ${flake.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
