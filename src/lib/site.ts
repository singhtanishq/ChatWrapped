/** Site-wide constants. Single source of truth for URLs, naming and disclaimers. */
export const SITE = {
  name: "ChatWrapped",
  tagline: "Your conversations. Your memories. Your story.",
  url: "https://singhtanishq.github.io",
  base: "/ChatWrapped/",
  repo: "https://github.com/singhtanishq/ChatWrapped",
  tagline_short: "Your chats have a story. Let's unwrap it.",
} as const;

/** Independence disclaimer used across pages and cards. */
export const DISCLAIMER =
  "ChatWrapped is an independent project and is not affiliated with, endorsed by or sponsored by WhatsApp, Meta, Telegram or Spotify.";

export const PRIVACY_PROMISE =
  "Your uploaded conversations are processed entirely in your browser. ChatWrapped does not upload your chat files to its servers.";
