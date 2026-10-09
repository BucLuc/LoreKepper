export function EpicSigil({
  kind,
}: {
  kind: "glorious" | "prophecy" | "poetry";
}) {
  return (
    <svg
      className={`epic-sigil sigil-${kind}`}
      viewBox="0 0 320 190"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M30 154 Q40 84 113 40 M290 154 Q280 84 207 40"
        stroke="currentColor"
        strokeWidth="2"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(0 ${i * 21})`}>
          <path
            d={`M${83 - i * 9} 51 q-34 -16 -34 6 q23 9 34 -6 M${237 + i * 9} 51 q34 -16 34 6 q-23 9 -34 -6`}
            fill="currentColor"
            opacity={0.35 + i * 0.1}
          />
        </g>
      ))}
      {kind === "poetry" ? (
        <g stroke="currentColor">
          <path
            d="M126 60 Q113 142 160 149 Q207 142 194 60 M126 67 Q110 49 125 41 Q141 40 140 58 M194 67 Q210 49 195 41 Q179 40 180 58 M131 77 H189 M133 123 H187"
            strokeWidth="4"
          />
          {[143, 154, 166, 177].map((x) => (
            <path key={x} d={`M${x} 78 V123`} strokeWidth="1.5" />
          ))}
        </g>
      ) : (
        <g stroke="currentColor">
          <circle cx="160" cy="91" r="61" strokeWidth="1" />
          <circle
            cx="160"
            cy="91"
            r="51"
            strokeDasharray={kind === "prophecy" ? "2 8" : "1 5"}
          />
          <path
            d="M160 18 V164 M87 91 H233 M109 40 L211 142 M109 142 L211 40"
            opacity=".3"
          />
          {kind === "glorious" ? (
            <path
              d="M160 37 L173 77 L214 91 L173 105 L160 145 L147 105 L106 91 L147 77 Z"
              fill="currentColor"
              opacity=".8"
            />
          ) : (
            <>
              <path
                d="M175 47 A46 46 0 1 0 175 135 A37 37 0 0 1 175 47Z"
                fill="currentColor"
                opacity=".8"
              />
              <path
                d="M200 67 L206 81 L220 87 L206 93 L200 107 L194 93 L180 87 L194 81Z"
                fill="currentColor"
              />
            </>
          )}
        </g>
      )}
      <path d="M72 171 H130 L160 181 L190 171 H248" stroke="currentColor" />
    </svg>
  );
}
