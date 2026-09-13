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

  const startNew = () => {
    void (async () => {
      const saved = await loadSolitaireInProgress();
      if (saved) {
        await recordIncompleteGame();
        await clearSolitaireInProgress();
      }
      router.push({ pathname: '/solitaire/play', params: { mode: 'new' } });
    })();
  };

  return (
    <MenuList
      safeArea={false}
      items={[
        {
          number: '1',
          label: 'New',
          onPress: startNew,
        },
        {
          number: '2',
          label: 'Continue',
          disabled: !canContinue,
          onPress: () => router.push({ pathname: '/solitaire/play', params: { mode: 'continue' } }),
        },
      ]}
    />
  );
}
