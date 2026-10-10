export function CompassRose() {
  return <svg className="captain-compass" viewBox="0 0 160 160" aria-hidden="true">
    <circle cx="80" cy="80" r="58" fill="none" stroke="currentColor" strokeWidth="1" />
    <circle cx="80" cy="80" r="50" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 5" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => <g key={angle} transform={`rotate(${angle} 80 80)`}>
      <path d="M80 20 88 80 80 88Z" fill="currentColor" opacity={angle % 90 === 0 ? "0.9" : "0.4"} />
      <path d="M80 20 72 80 80 88Z" fill="none" stroke="currentColor" strokeWidth="0.8" />
    </g>)}
    <circle cx="80" cy="80" r="5" fill="currentColor" />
    <g fill="currentColor" fontSize="12" fontFamily="Georgia, serif" textAnchor="middle">
      <text x="80" y="14">N</text><text x="80" y="155">S</text><text x="8" y="84">W</text><text x="152" y="84">E</text>
    </g>
  </svg>;
}
