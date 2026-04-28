import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../components/Avatar';
import { FormInput } from '../components/FormInput';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { badges, getAvatarById, receivedGifts } from '../data/mockData';
import { AppScreenProps } from '../navigation/types';
import { FriendRequestItem, MembershipPlan } from '../types';

const USERNAME_CHANGE_WINDOW_DAYS = 7;

function getRemainingDays(lastChangeDate: string) {
  const elapsedMs = Date.now() - new Date(lastChangeDate).getTime();
  const fullDaysElapsed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  return Math.max(0, USERNAME_CHANGE_WINDOW_DAYS - fullDaysElapsed);
}

function getPlanBadge(plan: MembershipPlan) {
  if (plan === 'vip') {
    return {
      label: 'VIP',
      icon: 'trophy' as const,
      color: colors.goldSoft,
      background: 'rgba(231, 188, 78, 0.14)',
    };
  }

  return {
    label: 'Plus',
    icon: 'flash' as const,
    color: colors.cyan,
    background: 'rgba(80, 143, 255, 0.16)',
  };
}

function FriendRequestRow({
  request,
  onAccept,
  onReject,
}: {
  request: FriendRequestItem;
  onAccept: () => void;
  onReject: () => void;
}) {
  const avatar = getAvatarById(request.avatarId);
  const badge = getPlanBadge(request.plan);

  return (
    <View style={styles.requestRow}>
      <View style={styles.requestIdentity}>
        <Avatar avatar={avatar} size={42} />
        <View style={styles.requestCopy}>
          <Text numberOfLines={1} style={styles.requestName}>
            {request.username}
          </Text>
          <View style={[styles.requestBadge, { backgroundColor: badge.background }]}>
            <Ionicons color={badge.color} name={badge.icon} size={12} />
            <Text numberOfLines={1} style={[styles.requestBadgeText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.requestActions}>
        <Pressable onPress={onAccept} style={[styles.requestAction, styles.requestAccept]}>
          <Text numberOfLines={1} style={styles.requestActionText}>
            Kabul et
          </Text>
        </Pressable>
        <Pressable onPress={onReject} style={[styles.requestAction, styles.requestReject]}>
          <Text numberOfLines={1} style={styles.requestActionText}>
            Reddet
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ProfileScreen({ navigation }: AppScreenProps<'Profile'>) {
  const {
    profile,
    updateUsername,
    userLevel,
    userScore,
    pendingIncomingFriendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
  } = useAppState();
  const [usernameDraft, setUsernameDraft] = useState(profile.username);
  const [reportVisible, setReportVisible] = useState(false);
  const [usernameNoticeVisible, setUsernameNoticeVisible] = useState(false);
  const avatar = useMemo(() => getAvatarById(profile.avatarId), [profile.avatarId]);
  const remainingDays = useMemo(() => getRemainingDays(profile.lastUsernameChangeDate), [profile.lastUsernameChangeDate]);
  const canChangeUsername = remainingDays === 0;

  useEffect(() => {
    setUsernameDraft(profile.username);
  }, [profile.username]);

  const handleUsernameUpdate = () => {
    if (!canChangeUsername) {
      setUsernameNoticeVisible(true);
      return;
    }

    updateUsername(usernameDraft.trim() || profile.username);
  };

  return (
    <PremiumScreen>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Anonim profil ve güvenlik özeti" title="Profil" />

      <GlassCard style={styles.heroCard} toned="strong">
        <Avatar avatar={avatar} size={84} />
        <View style={styles.heroCopy}>
          <Text style={styles.alias}>{profile.username}</Text>
          <Text style={styles.packageLabel}>{profile.plan.toUpperCase()} plan aktif</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{profile.age} yaş</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{profile.gender}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{profile.relationshipStatus}</Text>
            </View>
          </View>
          <Text style={styles.meta}>Kayıt tarihi {profile.joinDate}</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreChip}>
              <Text style={styles.scoreValue}>{userScore}</Text>
              <Text style={styles.scoreLabel}>Derman Puanı</Text>
            </View>
            <View style={styles.scoreChip}>
              <Text style={styles.scoreValue}>Level {userLevel}</Text>
              <Text style={styles.scoreLabel}>İyilik Seviyesi</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Profil Bilgileri</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Kullanıcı adı</Text>
            <Text style={styles.infoValue}>{profile.username}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Yaş</Text>
            <Text style={styles.infoValue}>{profile.age}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Cinsiyet</Text>
            <Text style={styles.infoValue}>{profile.gender}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Medeni durum</Text>
            <Text style={styles.infoValue}>{profile.relationshipStatus}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Paket</Text>
            <Text style={styles.infoValue}>{profile.plan.toUpperCase()}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Kayıt tarihi</Text>
            <Text style={styles.infoValue}>{profile.joinDate}</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Gelen arkadaşlık istekleri</Text>
        {pendingIncomingFriendRequests.length === 0 ? (
          <Text style={styles.emptyState}>Şu an bekleyen arkadaşlık isteği yok.</Text>
        ) : (
          <View style={styles.requestList}>
            {pendingIncomingFriendRequests.map((request) => (
              <FriendRequestRow
                key={`${request.id}-${request.createdAt}`}
                onAccept={() => acceptFriendRequest(request.id)}
                onReject={() => rejectFriendRequest(request.id)}
                request={request}
              />
            ))}
          </View>
        )}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Kullanıcı adını güncelle</Text>
        <FormInput icon="create-outline" label="Kullanıcı adı" onChangeText={setUsernameDraft} placeholder="Yeni kullanıcı adı" value={usernameDraft} />
        <Text style={styles.note}>Kullanıcı adını 7 günde 1 kez değiştirebilirsin.</Text>
        {!canChangeUsername ? <Text style={styles.cooldown}>Tekrar değiştirmek için {remainingDays} gün beklemelisin.</Text> : null}
        <GradientButton disabled={!canChangeUsername} onPress={handleUsernameUpdate} title="Kullanıcı adını güncelle" variant="secondary" />
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Aldığı Hediyeler</Text>
        <View style={styles.grid}>
          {receivedGifts.map((gift) => (
            <View key={gift.id} style={styles.gridCard}>
              <Text style={styles.giftSymbol}>{gift.symbol}</Text>
              <Text style={styles.gridTitle}>{gift.name}</Text>
              <Text style={styles.gridMeta}>x{gift.count}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.giftNote}>Hediye veren kişinin adı görünmez; yalnızca destek sayısı gösterilir.</Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Rozetler</Text>
        <View style={styles.badgeGrid}>
          {badges.map((badge) => (
            <View key={badge.id} style={styles.badgeCard}>
              <View style={styles.badgeIconWrap}>
                <Ionicons color={colors.text} name={badge.icon} size={18} />
              </View>
              <Text numberOfLines={1} style={styles.gridTitle}>
                {badge.name}
              </Text>
              <Text numberOfLines={2} style={styles.badgeMeta}>
                {badge.description}
              </Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Güvenlik</Text>
        <View style={styles.summaryRow}>
          <Ionicons color={colors.cyan} name="sparkles" size={16} />
          <Text style={styles.summaryText}>Bu uygulama terapi hizmeti değil; anonim sosyal destek alanıdır.</Text>
        </View>
        <View style={styles.summaryRow}>
          <Ionicons color={colors.gold} name="warning" size={16} />
          <Text style={styles.summaryText}>Acil durumlarda profesyonel destek alman önemlidir.</Text>
        </View>
      </GlassCard>

      <View style={styles.actionRow}>
        <Pressable onPress={() => navigation.navigate('Packages')} style={styles.inlineAction}>
          <Ionicons color={colors.text} name="diamond" size={16} />
          <Text style={styles.inlineActionText}>Paketimi Yönet</Text>
        </Pressable>
        <Pressable onPress={() => setReportVisible(true)} style={styles.inlineAction}>
          <Ionicons color={colors.text} name="shield-checkmark" size={16} />
          <Text style={styles.inlineActionText}>Şikayet Et</Text>
        </Pressable>
      </View>

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setUsernameNoticeVisible(false), variant: 'secondary' }]}
        message="Kullanıcı adını tekrar değiştirmek için 7 gün beklemelisin."
        title="Kullanıcı adı limiti"
        visible={usernameNoticeVisible}
      />

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setReportVisible(false), variant: 'secondary' }]}
        message="Şikayet kaydın güvenlik kuyruğuna alındı. Moderasyon paneli ayrı aşamada bağlanacak."
        title="Kullanıcıyı şikayet et"
        visible={reportVisible}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  alias: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  packageLabel: {
    color: colors.goldSoft,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  metaText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scoreChip: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  scoreValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  sectionCard: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  infoCell: {
    width: '48%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  infoLabel: {
    color: colors.dim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  requestList: {
    gap: spacing.sm,
  },
  requestRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  requestIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requestCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  requestName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  requestBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  requestBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  requestAction: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  requestAccept: {
    backgroundColor: 'rgba(80, 143, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(80, 143, 255, 0.38)',
  },
  requestReject: {
    backgroundColor: 'rgba(255, 92, 154, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 154, 0.34)',
  },
  requestActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    color: colors.muted,
    lineHeight: 18,
    fontSize: 12,
  },
  note: {
    color: colors.dim,
    lineHeight: 18,
    fontSize: 12,
  },
  cooldown: {
    color: colors.pink,
    fontWeight: '700',
    lineHeight: 18,
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 4,
  },
  giftSymbol: {
    fontSize: 24,
  },
  gridTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  gridMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  giftNote: {
    color: colors.muted,
    lineHeight: 18,
    fontSize: 12,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badgeCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 6,
  },
  badgeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  badgeMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryText: {
    color: colors.muted,
    flex: 1,
    lineHeight: 18,
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  inlineAction: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
  },
  inlineActionText: {
    color: colors.text,
    fontWeight: '700',
  },
});
