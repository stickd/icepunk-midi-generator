type Snowflake = {
  id: number;
  left: string;
  size: string;
  duration: string;
  delay: string;
  opacity: string;
};

function pseudoRandom(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function fixed(value: number) {
  return value.toFixed(4);
}

const SNOWFLAKES: Snowflake[] = Array.from({ length: 70 }, (_, index) => {
  const size = fixed(pseudoRandom(index + 101) * 5 + 3);

  return {
    id: index,
    left: `${fixed(pseudoRandom(index + 1) * 100)}%`,
    size: `${size}px`,
    duration: `${fixed(pseudoRandom(index + 201) * 8 + 6)}s`,
    delay: `${fixed(pseudoRandom(index + 301) * 6)}s`,
    opacity: fixed(pseudoRandom(index + 401) * 0.6 + 0.4),
  };
});

export default function Snowfall() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {SNOWFLAKES.map((flake) => (
        <span
          key={flake.id}
          className="absolute -top-6 rounded-full bg-white shadow-[0_0_10px_rgba(125,211,252,0.9)]"
          style={{
            left: flake.left,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            animationName: "snowfall",
            animationDuration: flake.duration,
            animationTimingFunction: "linear",
            animationDelay: flake.delay,
            animationIterationCount: "infinite",
          }}
        />
      ))}
    </div>
  );
}
