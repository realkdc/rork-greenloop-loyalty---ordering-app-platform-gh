import createContextHook from '@nkzw/create-context-hook';

interface MagicLinkState {
  // Placeholder for future use
}

export const [MagicLinkProvider, useMagicLink] = createContextHook<MagicLinkState>(() => {
  return {};
});
