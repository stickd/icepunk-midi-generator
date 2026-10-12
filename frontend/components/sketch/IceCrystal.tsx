/** Static vector artwork: no canvas, animation loop, or external asset request. */
export default function IceCrystal() {
  return (
    <svg className="ice-crystal" viewBox="0 0 400 320" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="crystal-glass" x1="80" y1="40" x2="305" y2="290" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e2ffff" stopOpacity=".8" /><stop offset=".34" stopColor="#90cbce" stopOpacity=".08" /><stop offset=".65" stopColor="#7196ad" stopOpacity=".32" /><stop offset="1" stopColor="#b8ffe6" stopOpacity=".65" />
        </linearGradient>
        <linearGradient id="crystal-edge" x1="100" y1="40" x2="290" y2="260" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" /><stop offset=".5" stopColor="#b4ffe9" stopOpacity=".15" /><stop offset="1" stopColor="#b4ffe9" />
        </linearGradient>
      </defs>
      <ellipse cx="200" cy="274" rx="135" ry="23" stroke="#c4ffeb" strokeOpacity=".12" />
      <ellipse cx="200" cy="274" rx="105" ry="14" stroke="#c4ffeb" strokeOpacity=".08" />
      <g stroke="url(#crystal-edge)" strokeWidth="1.1" strokeLinejoin="round">
        <path d="m200 22 105 66 25 133-130 68L70 221 95 88Z" fill="url(#crystal-glass)" />
        <path d="m200 22 54 111-54 156-54-156Z" fill="url(#crystal-glass)" />
        <path d="m95 88 51 45-76 88m235-133-51 45 76 88M95 88l105 201L305 88M70 221l130-199 130 199M146 133h108" />
      </g>
      <path d="M345 75v18m-9-9h18M55 167v12m-6-6h12" stroke="#cbffe9" strokeOpacity=".7" />
      <circle cx="306" cy="245" r="2" fill="#c4ffeb" />
    </svg>
  );
}
