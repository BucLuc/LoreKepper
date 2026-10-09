export function Flourish({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 160"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 148V12h136M23 137V23h114"
        stroke="currentColor"
        strokeWidth="1"
        opacity=".65"
      />
      <path
        d="M18 110c29-15 56-37 45-67-7-19-31-13-25 2 4 10 20 6 21-1M31 90c23-2 49-17 62-42 13-26 33-33 47-21M43 66c3 14 23 19 38 8M70 34c-5 14-2 24 8 31"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M26 112c-19-9-13-29 2-29 11 0 8 12-1 15m23-31c-22-2-29-18-19-26 8-7 15 2 8 9m45-8c-8-26 9-34 18-24 5 6-2 14-9 8m8 24c12-16 31-13 32-2 1 9-12 10-13 1"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m51 108 7-15 6 12-13 3Zm46-42 6-15 8 11-14 4Zm-21 34 5-16 9 13-14 3Z"
        fill="currentColor"
        opacity=".7"
      />
      <circle cx="29" cy="125" r="3" fill="currentColor" />
      <circle cx="124" cy="28" r="3" fill="currentColor" />
      <path d="m15 15 13 1-12 12-1-13Z" fill="currentColor" />
    </svg>
  );
}
export function RoyalCrest({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`royal-crest ${className}`}
      viewBox="0 0 300 220"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.5">
        <path
          d="M106 55 99 19l25 15 26-26 26 26 25-15-7 36Z"
          fill="currentColor"
          fillOpacity=".17"
        />
        <path d="M110 49h80M117 63h66M127 30l5 17m18-30v30m23-17-5 17" />
        <circle cx="99" cy="16" r="3" />
        <circle cx="150" cy="5" r="3" />
        <circle cx="201" cy="16" r="3" />
        <path
          d="M102 75h96v60c0 35-26 54-48 66-22-12-48-31-48-66Z"
          fill="currentColor"
          fillOpacity=".09"
        />
        <path d="M111 84h78v51c0 29-21 46-39 56-18-10-39-27-39-56Z" />
        <path d="M150 84v107M111 127h78" strokeOpacity=".5" />
        <path
          d="m133 103 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Zm34 36 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"
          fill="currentColor"
          strokeWidth=".5"
        />
        <path d="M132 158v-14m-5 5h10m29-39v-14m-5 5h10" />
        <path
          d="M91 188C36 157 26 107 51 63M209 188c55-31 65-81 40-125M80 181c-25-4-31-19-31-19 20 1 31 19 31 19ZM64 164c-27-11-26-25-26-25 17 5 26 25 26 25ZM51 142c-24-13-21-28-21-28 18 9 21 28 21 28ZM46 119c-21-19-14-32-14-32 17 13 14 32 14 32ZM46 94c-15-24-4-34-4-34 12 17 4 34 4 34ZM47 87c9-24 24-24 24-24-3 18-24 24-24 24ZM45 111c13-19 27-15 27-15-8 16-27 15-27 15ZM51 135c12-15 27-10 27-10-9 13-27 10-27 10ZM66 160c6-19 23-18 23-18-6 18-23 18-23 18Z"
          fill="currentColor"
          fillOpacity=".12"
        />
        <g transform="translate(300 0) scale(-1 1)">
          <path
            d="M80 181c-25-4-31-19-31-19 20 1 31 19 31 19ZM64 164c-27-11-26-25-26-25 17 5 26 25 26 25ZM51 142c-24-13-21-28-21-28 18 9 21 28 21 28ZM46 119c-21-19-14-32-14-32 17 13 14 32 14 32ZM46 94c-15-24-4-34-4-34 12 17 4 34 4 34ZM47 87c9-24 24-24 24-24-3 18-24 24-24 24ZM45 111c13-19 27-15 27-15-8 16-27 15-27 15ZM51 135c12-15 27-10 27-10-9 13-27 10-27 10ZM66 160c6-19 23-18 23-18-6 18-23 18-23 18Z"
            fill="currentColor"
            fillOpacity=".12"
          />
        </g>
        <path
          d="M91 186h118l12 18-22-4-7 9h-84l-7-9-22 4 12-18Z"
          fill="currentColor"
          fillOpacity=".08"
        />
      </g>
      <text
        x="150"
        y="201"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="Georgia,serif"
        fontSize="8"
        letterSpacing="3"
      >
        AMICITIA · AETERNA
      </text>
    </svg>
  );
}
export function HistoricalDecorations({
  kind,
  number,
}: {
  kind: string;
  number: number;
}) {
  return (
    <div className="artifact-decoration" aria-hidden="true">
      <span className="artifact-folio">
        {kind === "manuscript" ? "Folio" : "Charter"}{" "}
        {String(number).padStart(3, "0")}
      </span>
      {["nw", "ne", "sw", "se"].map((corner) => (
        <Flourish key={corner} className={`artifact-corner corner-${corner}`} />
      ))}
      {kind === "manuscript" && (
        <div className="scribe-margin">Ex libris amicorum</div>
      )}
    </div>
  );
}
