export interface Sticker {
  id: string;
  emoji: string;
  label: string;
}

export interface StickerPack {
  id: string;
  name: string;
  stickers: Sticker[];
}

/**
 * Built-in sticker packs using emoji characters.
 * Zero storage cost — stickers are just emoji rendered at large size.
 */
export const stickerPacks: StickerPack[] = [
  {
    id: 'reactions',
    name: 'Reactions',
    stickers: [
      { id: 'thumbs-up', emoji: '👍', label: 'Thumbs Up' },
      { id: 'thumbs-down', emoji: '👎', label: 'Thumbs Down' },
      { id: 'heart', emoji: '❤️', label: 'Heart' },
      { id: 'fire', emoji: '🔥', label: 'Fire' },
      { id: 'laugh', emoji: '😂', label: 'Laughing' },
      { id: 'cry', emoji: '😢', label: 'Crying' },
      { id: 'mind-blown', emoji: '🤯', label: 'Mind Blown' },
      { id: 'clap', emoji: '👏', label: 'Clap' },
      { id: 'party', emoji: '🎉', label: 'Party' },
      { id: 'thinking', emoji: '🤔', label: 'Thinking' },
    ],
  },
  {
    id: 'study',
    name: 'Study Mode',
    stickers: [
      { id: 'brain', emoji: '🧠', label: 'Big Brain' },
      { id: 'books', emoji: '📚', label: 'Books' },
      { id: 'pencil', emoji: '✏️', label: 'Pencil' },
      { id: 'bulb', emoji: '💡', label: 'Idea' },
      { id: 'rocket', emoji: '🚀', label: 'Rocket' },
      { id: 'trophy', emoji: '🏆', label: 'Trophy' },
      { id: 'target', emoji: '🎯', label: 'Target' },
      { id: 'sleep', emoji: '😴', label: 'Sleepy' },
      { id: 'coffee', emoji: '☕', label: 'Coffee' },
      { id: 'nerd', emoji: '🤓', label: 'Nerd' },
    ],
  },
  {
    id: 'vibes',
    name: 'Vibes',
    stickers: [
      { id: 'cool', emoji: '😎', label: 'Cool' },
      { id: 'skull', emoji: '💀', label: 'Dead' },
      { id: 'ghost', emoji: '👻', label: 'Ghost' },
      { id: 'alien', emoji: '👽', label: 'Alien' },
      { id: 'crown', emoji: '👑', label: 'Crown' },
      { id: 'diamond', emoji: '💎', label: 'Diamond' },
      { id: 'shield', emoji: '🛡️', label: 'Shield' },
      { id: 'lock', emoji: '🔒', label: 'Locked' },
      { id: 'key', emoji: '🔑', label: 'Key' },
      { id: 'eyes', emoji: '👀', label: 'Eyes' },
    ],
  },
];

export function getStickerById(id: string): Sticker | undefined {
  for (const pack of stickerPacks) {
    const sticker = pack.stickers.find(s => s.id === id);
    if (sticker) return sticker;
  }
  return undefined;
}
