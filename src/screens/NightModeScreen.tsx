import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { getAvatarById, nightRoomUsers } from '../data/mockData';
import { requestMicrophonePermission } from '../services/permissionsService';
import { AppScreenProps } from '../navigation/types';

export function NightModeScreen({ navigation }: AppScreenProps<'NightMode'>) {
  const { setActiveRole } = useAppState();
  const glow = useRef(new Animated.Value(0.7)).current;
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [glow]);

  const handleWordTake = async () => {
    const result = await requestMicrophonePermission();
    if (!result.granted) {
      setPermissionModalVisible(true);
      return;
    }
    setActiveRole('derdim-var');
    navigation.navigate('Matching');
  };

  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="22:00 - 02:00 • demo modunda erişilebilir" title="Gece Modu" />

      <GlassCard style={styles.banner}>
        <Text style={styles.bannerTitle}>4 kişilik oda, düşük gürültü, derin gece akışı</Text>
        <Text style={styles.bannerText}>Konuşan kişi neon çerçeveyle öne çıkar. Demo modunda saate bakmadan içeri girebilirsin.</Text>
      </GlassCard>

      <View style={styles.grid}>
        {nightRoomUsers.map((user) => {
          const avatar = getAvatarById(user.avatarId);
          const isSpeaker = Boolean(user.speaking);

          return (
            <Animated.View key={user.id} style={[styles.userWrap, isSpeaker && { opacity: glow }]}>
              <GlassCard style={[styles.userCard, isSpeaker && styles.speakingCard]}>
                <Avatar avatar={avatar} size={94} />
                <Text style={styles.userAlias}>{user.alias}</Text>
                <Text style={[styles.userRole, isSpeaker && styles.speakingRole]}>{user.role}</Text>
                <View style={styles.metaRow}>
                  <Ionicons color={isSpeaker ? colors.cyan : colors.muted} name={isSpeaker ? 'radio' : 'ear'} size={14} />
                  <Text style={styles.metaText}>{isSpeaker ? 'Aktif anlatıcı' : 'Sessiz dinleyici'}</Text>
                </View>
              </GlassCard>
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <GradientButton icon="mic" onPress={handleWordTake} title="Söz Al" />
        <GradientButton
          icon="headset"
          onPress={() => {
            setActiveRole('derman-olan');
            navigation.navigate('Matching');
          }}
          title="Dinleyici Olarak Katıl"
          variant="secondary"
        />
      </View>

      <NoticeModal
        actions={[
          { label: 'Tekrar Dene', onPress: handleWordTake },
          { label: 'Şimdilik Vazgeç', onPress: () => setPermissionModalVisible(false), variant: 'ghost' },
        ]}
        message="Sesli görüşme için mikrofon izni gerekli."
        title="Mikrofon izni gerekli"
        visible={permissionModalVisible}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: 6,
  },
  bannerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  bannerText: {
    color: colors.muted,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  userWrap: {
    width: '48%',
  },
  userCard: {
    alignItems: 'center',
    gap: 8,
    minHeight: 226,
  },
  speakingCard: {
    borderColor: 'rgba(69, 224, 255, 0.55)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.55,
    shadowRadius: 24,
  },
  userAlias: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  userRole: {
    color: colors.muted,
    fontSize: 13,
  },
  speakingRole: {
    color: colors.cyan,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
  },
  actions: {
    gap: spacing.sm,
  },
});
