import { useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';

interface MagicLinkState {
  pendingMagicLink: string | null;
  setPendingMagicLink: (link: string | null) => void;
}

export const [MagicLinkProvider, useMagicLink] = createContextHook<MagicLinkState>(() => {
  const [pendingMagicLink, setPendingMagicLink] = useState<string | null>(null);

  return {
    pendingMagicLink,
    setPendingMagicLink,
  };
});
