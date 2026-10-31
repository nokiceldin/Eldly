type AppName = "checkly" | "progress" | "mapping" | "packly" | "journal";
/** Shared dimensional app tiles; Pack keeps its original bag-and-check mark. */
export default function AppIcon({ app }: { app: AppName }) {
  const palette = { journal: ["#c2a38c", "#92715e", "#89654e"], checkly: ["#89d68c", "#3a9b60", "#39965a"], progress: ["#7eaffb", "#4672d6", "#4a77d9"], mapping: ["#f1cf76", "#d89745", "#cc8d3c"], packly: ["#8970ff", "#6349ed", "#7054ef"] }[app];
  const id = `app-icon-${app}`;
  return <svg className="eldly-app-icon" viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-bg`} x1="14" y1="6" x2="81" y2="96" gradientUnits="userSpaceOnUse"><stop stopColor={palette[0]} /><stop offset="1" stopColor={palette[1]} /></linearGradient>
      <linearGradient id={`${id}-white`} x1="30" y1="25" x2="69" y2="78" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" /><stop offset=".5" stopColor="#fff" /><stop offset="1" stopColor={app === "packly" ? "#d7ccff" : "#e6f0ef"} /></linearGradient>
      <linearGradient id={`${id}-rim`} x1="19" y1="3" x2="72" y2="92" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" stopOpacity=".65" /><stop offset=".45" stopColor="#fff" stopOpacity=".08" /><stop offset="1" stopColor="#fff" stopOpacity=".25" /></linearGradient>
      <filter id={`${id}-shadow`} x="-40%" y="-30%" width="180%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#24164e" floodOpacity=".25" /></filter>
    </defs>
    <rect x="4" y="7" width="88" height="86" rx="26" fill="#000" opacity=".24" />
    <rect x="4" y="3" width="88" height="88" rx="26" fill={`url(#${id}-bg)`} />
    <rect x="4.8" y="3.8" width="86.4" height="86.4" rx="25.2" stroke={`url(#${id}-rim)`} strokeWidth="1.6" />
    <g filter={`url(#${id}-shadow)`}>
      {app === "journal" && <>
        <path d="M48 33c-8-7-18-8-25-5v39c8-3 17-2 25 4 8-6 17-7 25-4V28c-7-3-17-2-25 5Z" fill="#fff9e8" />
        <path d="M48 34v36M30 39l11 3m-11 7 11 3m14-10 11-3m-11 13 11-3" stroke={palette[2]} strokeWidth="2.4" strokeLinecap="round" />
      </>}
      {app === "packly" && <>
        <path d="M39 32v-2a9 9 0 0 1 18 0v2" stroke="#fff" strokeWidth="4.8" />
        <rect x="25" y="34" width="46" height="43" rx="12" fill={`url(#${id}-white)`} />
        <rect x="26" y="35" width="44" height="41" rx="11" stroke="#fff" strokeOpacity=".65" />
        <path d="m36 55 9 9 17-21" stroke={palette[2]} strokeWidth="7.5" strokeLinejoin="round" />
      </>}
      {app === "checkly" && <>
        <rect x="25" y="26" width="46" height="46" rx="14" fill={`url(#${id}-white)`} />
        <path d="m35 49 9 9 18-21" stroke={palette[2]} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </>}
      {app === "progress" && <>
        <rect x="25" y="52" width="10" height="20" rx="3" fill={`url(#${id}-white)`} /><rect x="43" y="42" width="10" height="30" rx="3" fill={`url(#${id}-white)`} /><rect x="61" y="29" width="10" height="43" rx="3" fill={`url(#${id}-white)`} />
        <path d="m27 40 15-13 10 4 15-12m-10 0h10v10" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </>}
      {app === "mapping" && <>
        <circle cx="48" cy="49" r="21" stroke="#fff" strokeOpacity=".28" strokeWidth="7" />
        <path d="M48 28a21 21 0 0 1 21 21M48 70a21 21 0 0 1-21-21" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
        <circle cx="48" cy="28" r="6" fill="#6dbb92" stroke="#fff" strokeWidth="2" />
        <circle cx="69" cy="49" r="6" fill="#7db8ed" stroke="#fff" strokeWidth="2" />
        <circle cx="48" cy="70" r="6" fill="#dc90b9" stroke="#fff" strokeWidth="2" />
        <circle cx="27" cy="49" r="6" fill="#fff" />
        <circle cx="48" cy="49" r="6" fill={`url(#${id}-white)`} />
      </>}
    </g>
  </svg>;
}
