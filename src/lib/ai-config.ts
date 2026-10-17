// Shared by server requests and the AI access form so defaults cannot diverge.
export const providers: Record<string, { url: string; model: string }> = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "openai/gpt-oss-120b",
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "openrouter/free",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini",
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/messages",
    model: "claude-sonnet-4-6",
  },
};
export const providerName = (p: string) =>
  ({
    groq: "Groq",
    gemini: "Google Gemini",
    openrouter: "OpenRouter",
    openai: "OpenAI",
    anthropic: "Anthropic",
  })[p] || p;
