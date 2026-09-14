import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { MenuList } from '@/components/menu-list';
import {
  clearSolitaireInProgress,
  loadSolitaireInProgress,
} from '@/game/solitaire-progress';
import { recordIncompleteGame } from '@/game/user-stats-store';

export default function SolitaireMenuScreen() {
  const [canContinue, setCanContinue] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadSolitaireInProgress().then((saved) => {
        if (!cancelled) {
          setCanContinue(saved != null);
        }
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const startNew = (drawCount: 1 | 3) => {
    void (async () => {
      const saved = await loadSolitaireInProgress();
      if (saved) {
        await recordIncompleteGame(saved.elapsedMs, saved.game.drawCount);
        await clearSolitaireInProgress();
      }
      router.push({ pathname: '/solitaire/play', params: { mode: 'new', draw: String(drawCount) } });
    })();
  };

  return (
    <MenuList
      safeArea={false}
      items={[
        {
          label: '1 Card',
          onPress: () => startNew(1),
        },
        {
          label: '3 Card',
          onPress: () => startNew(3),
        },
        {
          label: 'Continue',
          disabled: !canContinue,
          onPress: () => router.push({ pathname: '/solitaire/play', params: { mode: 'continue' } }),
        },
      ]}
    />
  );
}
