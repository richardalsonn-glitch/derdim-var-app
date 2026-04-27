import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '../components/Avatar';
import { GradientButton } from '../components/GradientButton';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { getAvatarById } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';

export function RematchScreen({ navigation }: AppScreenProps<'Rematch'>) {
  return (
    <PremiumScreen contentStyle={styles.content} scroll={false}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Kaçırdığın biri mi vardı?" title="Tekrar Eşleşme" />

      <View style={styles.center}>
        <Avatar avatar={getAvatarById('m-2')} size={140} />
        <Text style={styles.title}>Keşke numaramız olsaydı...</Text>
        <Text style={styles.text}>Tekrar karşına çıkma şansını kaybetme. VIP kullanıcılar bu avantajı ücretsiz kullanır.</Text>
      </View>

      <GradientButton icon="refresh" onPress={() => navigation.navigate('Matching')} title="Tekrar Karşıma Çıkar - 39.99 TL" />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  text: {
    color: colors.muted,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
});
