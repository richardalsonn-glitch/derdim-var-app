import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { BadgePill } from '../components/BadgePill';
import { FormInput } from '../components/FormInput';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { badges, getAvatarById, profileStats, receivedGifts } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';

export function ProfileScreen({ navigation }: AppScreenProps<'Profile'>) {
  const { profile, updateProfile } = useAppState();
  const [usernameDraft, setUsernameDraft] = useState(profile.username);
  const [reportVisible, setReportVisible] = useState(false);
  const avatar = getAvatarById(profile.avatarId);

  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Profil, rozetler ve hediye istatistikleri" title="Profil" />

      <GlassCard style={styles.heroCard} toned="strong">
        <Avatar avatar={avatar} size={108} />
        <View style={styles.heroCopy}>
          <Text style={styles.alias}>{profile.username}</Text>
          <Text style={styles.packageLabel}>{profile.plan.toUpperCase()} plan aktif</Text>
          <Text style={styles.meta}>
            {profile.gender} • {profile.age} yaş • {profile.relationshipStatus}
          </Text>
          <Text style={styles.meta}>Kayıt tarihi {profile.joinDate}</Text>
          <Text style={styles.meta}>E-posta {profile.email}</Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Kullanıcı adı</Text>
        <FormInput icon="create-outline" label="Takma ad" onChangeText={setUsernameDraft} placeholder="takma ad" value={usernameDraft} />
        <Text style={styles.note}>Kullanıcı adını ayda 1 kez değiştirebilirsin.</Text>
        <GradientButton
          onPress={() => updateProfile({ username: usernameDraft })}
          title="Kullanıcı adını mock olarak güncelle"
          variant="secondary"
        />
      </GlassCard>

      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{profileStats.score}</Text>
          <Text style={styles.statLabel}>Derman puanı</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{profileStats.helpedCount}</Text>
          <Text style={styles.statLabel}>İyi geldiğin kişi</Text>
        </GlassCard>
        <GlassCard style={styles.statCard}>
          <Text style={styles.statValue}>{profileStats.likes}</Text>
          <Text style={styles.statLabel}>Toplam beğeni</Text>
        </GlassCard>
      </View>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Aldığı hediyeler</Text>
        <View style={styles.giftRow}>
          {receivedGifts.map((gift) => (
            <View key={gift.id} style={styles.giftCard}>
              <Text style={styles.giftSymbol}>{gift.symbol}</Text>
              <Text style={styles.giftName}>{gift.name}</Text>
              <Text style={styles.giftCount}>x{gift.count}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.giftNote}>Hediye gönderenlerin adı görünmez; yalnızca toplam destek sayısı gösterilir.</Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Rozetler</Text>
        <View style={styles.badgesWrap}>
          {badges.map((badge) => (
            <BadgePill badge={badge} key={badge.id} />
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Güvenlik ve konumlandırma</Text>
        <View style={styles.summaryRow}>
          <Ionicons color={colors.cyan} name="sparkles" size={16} />
          <Text style={styles.summaryText}>Bu uygulama terapi hizmeti değil; anonim sosyal destek alanıdır.</Text>
        </View>
        <View style={styles.summaryRow}>
          <Ionicons color={colors.gold} name="warning" size={16} />
          <Text style={styles.summaryText}>Acil durumlarda profesyonel destek alman önemlidir.</Text>
        </View>
      </GlassCard>

      <GradientButton onPress={() => navigation.navigate('Packages')} title="Paketimi Yönet" />
      <GradientButton onPress={() => setReportVisible(true)} title="Kullanıcıyı Şikayet Et" variant="ghost" />

      <NoticeModal
        actions={[
          { label: 'Şikayet et', onPress: () => navigation.navigate('Home'), variant: 'gold' },
          { label: 'Vazgeç', onPress: () => setReportVisible(false), variant: 'ghost' },
        ]}
        message="Moderasyon paneli ileride bağlanacak. Şimdilik bu akış mock olarak çalışır."
        title="Kullanıcıyı şikayet et"
        visible={reportVisible}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  alias: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  packageLabel: {
    color: colors.goldSoft,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  note: {
    color: colors.dim,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  sectionCard: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  giftRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  giftCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 2,
  },
  giftSymbol: {
    fontSize: 28,
  },
  giftName: {
    color: colors.text,
    fontWeight: '700',
  },
  giftCount: {
    color: colors.muted,
  },
  giftNote: {
    color: colors.muted,
    lineHeight: 20,
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryText: {
    color: colors.muted,
    flex: 1,
    lineHeight: 19,
  },
});
