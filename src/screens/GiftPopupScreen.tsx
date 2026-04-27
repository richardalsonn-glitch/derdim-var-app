import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GiftCelebrationOverlay, GiftModal } from '../components/GiftModal';
import { AppScreenProps } from '../navigation/types';
import { GiftItem } from '../types';

export function GiftPopupScreen({ navigation }: AppScreenProps<'GiftPopup'>) {
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);

  return (
    <View style={styles.fill}>
      <GiftModal
        onClose={() => navigation.goBack()}
        onSelect={(gift) => {
          setSelectedGift(gift);
          setCelebrationVisible(true);
          setTimeout(() => {
            setCelebrationVisible(false);
            navigation.goBack();
          }, 5000);
        }}
        visible
      />
      <GiftCelebrationOverlay gift={selectedGift} visible={celebrationVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
