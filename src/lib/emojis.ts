// Match complete emoji sequences, including flags, skin tones and joined families.
const emojiSequence = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)/gu;

export function withoutEmojis(text: string): string {
  return text.replace(emojiSequence, "");
}
