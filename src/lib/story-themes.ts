// The themes a story can be set in: the moods of the writing voices (narrators table)
// and of the ready-made quests (worlds table). The ids match the database checks.
export const storyThemes = [
  {
    id: "classic",
    name: "Classic & Cinematic",
    sigil: "🐉",
    tagline: "Dragons, heists and blockbuster drama.",
    hue: "#c6a96b",
  },
  {
    id: "medieval",
    name: "Medieval & Historical",
    sigil: "🏰",
    tagline: "Crowns, curses and terribly serious knights.",
    hue: "#b9824a",
  },
  {
    id: "pirate",
    name: "Pirates & High Seas",
    sigil: "🏴‍☠️",
    tagline: "Rum, treasure maps and questionable loyalty.",
    hue: "#4f9bb0",
  },
  {
    id: "ancient",
    name: "Ancient & Eastern",
    sigil: "🏛️",
    tagline: "Oracles, emperors and meddling gods.",
    hue: "#c98b4f",
  },
  {
    id: "crime",
    name: "Crime & Frontier",
    sigil: "🕵️",
    tagline: "Rain-soaked alleys, saloons and family business.",
    hue: "#a0534a",
  },
  {
    id: "eccentric",
    name: "Eccentric",
    sigil: "🌀",
    tagline: "Starships, bureaucracy and gloriously weird.",
    hue: "#8b74c9",
  },
] as const;
export const themeOf = (id?: string | null) =>
  storyThemes.find((t) => t.id === id);
