import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import { updateCurrentUserAvatarSelection } from '../services/authService';
import { resolveAvatarId } from '../utils/avatarResolver';
import { getContentMaxWidth, getHorizontalPadding } from '../utils/responsive';
import { SymbolAvatarDefinition, symbolAvatarOptions } from '../utils/symbolAvatar';

const avatarSelectionBackground = require('../../arkaplanavatar.png');

type StepIndicatorProps = {
  activeStep: number;
  compact: boolean;
};

function StepIndicator({ activeStep, compact }: StepIndicatorProps) {
  const size = compact ? 34 : 38;
  const lineWidth = compact ? 28 : 34;

  return (
    <View style={styles.stepRow}>
      {[1, 2, 3, 4].map((step, index) => (
        <View key={step} style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              { height: size, width: size, borderRadius: size / 2 },
              step === activeStep && styles.activeStepDot,
            ]}
          >
            {step === activeStep ? (
              <LinearGradient colors={['#9A46FF', '#C370FF']} style={styles.activeStepFill}>
                <Text style={[styles.stepLabel, compact && styles.stepLabelCompact]}>{step}</Text>
              </LinearGradient>
            ) : (
              <Text style={[styles.stepLabel, styles.inactiveStepLabel, compact && styles.stepLabelCompact]}>{step}</Text>
            )}
          </View>
          {index < 3 ? <View style={[styles.stepLine, { width: lineWidth }, index + 1 < activeStep && styles.activeStepLine]} /> : null}
        </View>
      ))}
    </View>
  );
}

type SymbolCardProps = {
  height: number;
  item: SymbolAvatarDefinition;
  onPress: () => void;
  selected: boolean;
  width: number;
};

function SymbolCard({ height, item, onPress, selected, width }: SymbolCardProps) {
  const orbSize = height <= 120 ? 54 : 62;
  const iconSize = height <= 120 ? 27 : 32;

  return (
    <Pressable onPress={onPress} style={[styles.symbolCard, { height, width }, selected && styles.symbolCardSelected]}>
      {selected ? <LinearGradient colors={['rgba(110,202,255,0.24)', 'rgba(213,111,255,0.08)']} style={StyleSheet.absoluteFill} /> : null}
      {selected ? (
        <LinearGradient colors={['#44E5FF', '#A04DFF']} style={styles.checkBadge}>
          <Ionicons color="#FFFFFF" name="checkmark" size={16} />
        </LinearGradient>
      ) : null}

      <LinearGradient colors={item.palette} style={[styles.symbolOrb, { height: orbSize, width: orbSize, borderRadius: orbSize / 2, shadowColor: item.glow }]}>
        <View style={[styles.symbolHalo, { backgroundColor: item.accent }]} />
        <Ionicons color={item.accent} name={item.icon} size={iconSize} />
      </LinearGradient>

      <Text numberOfLines={1} style={[styles.symbolTitle, selected && styles.symbolTitleSelected]}>{item.title}</Text>
      <Text numberOfLines={1} style={styles.symbolSubtitle}>{item.subtitle}</Text>
    </Pressable>
  );
}

export function AvatarSelectionScreen({ navigation, route }: AppScreenProps<'AvatarSelection'>) {
  const { profile, updateProfile } = useAppState();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width <= 390 || height <= 844;
  const horizontalPadding = getHorizontalPadding(width);
  const contentWidth = Math.min(width, getContentMaxWidth(width)) - horizontalPadding * 2;
  const cardGap = compact ? 10 : 14;
  const cardWidth = Math.floor((contentWidth - 24 - cardGap) / 2);
  const cardHeight = compact
    ? Math.min(136, Math.max(116, Math.floor((height - 430) / 2)))
    : Math.min(150, Math.max(128, Math.floor((height - 470) / 2)));
  const screenPaddingBottom = Math.max(insets.bottom, compact ? 8 : 10);
  const mode = route.params?.mode ?? (route.params?.entry === 'profile' ? 'profile-edit' : 'onboarding');
  const isProfileEntry = mode === 'profile-edit';
  const [selectedSymbolId, setSelectedSymbolId] = useState(() => resolveAvatarId(profile.avatarId, profile.gender));
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const selectedSymbol = useMemo(
    () => symbolAvatarOptions.find((symbol) => symbol.id === selectedSymbolId) ?? symbolAvatarOptions[0],
    [selectedSymbolId],
  );

  const handleComplete = async () => {
    if (isCompleting) {
      return;
    }

    setIsCompleting(true);
    if (!isProfileEntry) {
      updateProfile({ plan: 'free' });
    }

    const result = await updateCurrentUserAvatarSelection(selectedSymbol.id, profile.gender);
    setIsCompleting(false);

    if (result.error) {
      setErrorMessage(result.error.message);
      setErrorVisible(true);
      return;
    }

    updateProfile({
      avatarId: result.data?.avatarId ?? selectedSymbol.id,
      gender: result.data?.gender ?? profile.gender,
      plan: result.data?.plan ?? profile.plan,
      isFrozen: result.data?.isFrozen ?? profile.isFrozen,
    }, { source: isProfileEntry ? 'profile-edit' : 'register-onboarding' });

    if (isProfileEntry) {
      navigation.goBack();
      return;
    }

    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <PremiumScreen
      backgroundImage={avatarSelectionBackground}
      bottomInsetMode="none"
      contentStyle={[styles.content, { paddingBottom: screenPaddingBottom }]}
      scroll={false}
    >
      <View style={[styles.headerSection, compact && styles.headerSectionCompact]}>
        <ScreenHeader
          onBack={() => navigation.goBack()}
          subtitle="Seni anlatan sembolü seç"
          title={isProfileEntry ? 'Sembolünü Değiştir' : 'Sembolünü Seç'}
        />
        <StepIndicator activeStep={4} compact={compact} />
      </View>

      <View style={[styles.gridCard, compact && styles.gridCardCompact]}>
        <View style={[styles.gridRow, { marginBottom: cardGap }]}>
          {symbolAvatarOptions.slice(0, 2).map((item) => (
            <SymbolCard
              height={cardHeight}
              item={item}
              key={item.id}
              onPress={() => setSelectedSymbolId(item.id)}
              selected={selectedSymbolId === item.id}
              width={cardWidth}
            />
          ))}
        </View>
        <View style={styles.gridRow}>
          {symbolAvatarOptions.slice(2, 4).map((item) => (
            <SymbolCard
              height={cardHeight}
              item={item}
              key={item.id}
              onPress={() => setSelectedSymbolId(item.id)}
              selected={selectedSymbolId === item.id}
              width={cardWidth}
            />
          ))}
        </View>
      </View>

      <View style={[styles.footerSection, compact && styles.footerSectionCompact]}>
        <View style={[styles.selectionCard, compact && styles.selectionCardCompact]}>
          <LinearGradient colors={selectedSymbol.palette} style={[styles.selectionThumb, compact && styles.selectionThumbCompact]}>
            <Ionicons color={selectedSymbol.accent} name={selectedSymbol.icon} size={compact ? 20 : 22} />
          </LinearGradient>
          <Text numberOfLines={2} style={[styles.selectionText, compact && styles.selectionTextCompact]}>
            {selectedSymbol.title} seçili. Profilinde ve görüşmelerde bu sembol görünecek.
          </Text>
        </View>

        <GradientButton
          disabled={isCompleting}
          icon="sparkles"
          onPress={handleComplete}
          title={
            isCompleting
              ? (isProfileEntry ? 'Sembol güncelleniyor...' : 'Kayıt tamamlanıyor...')
              : (isProfileEntry ? 'Sembolü Güncelle' : 'Kaydı Tamamla')
          }
        />
      </View>

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setErrorVisible(false) }]}
        message={errorMessage}
        onClose={() => setErrorVisible(false)}
        title="Sembol kaydedilemedi"
        visible={errorVisible}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerSection: {
    gap: 12,
    paddingTop: 18,
  },
  headerSectionCompact: {
    gap: 8,
    paddingTop: 10,
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stepDot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activeStepDot: {
    borderColor: 'rgba(193, 109, 255, 0.85)',
    elevation: 9,
    shadowColor: '#B25EFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
  },
  activeStepFill: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  stepLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stepLabelCompact: {
    fontSize: 12,
  },
  inactiveStepLabel: {
    color: '#C2B5E8',
  },
  stepLine: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    height: 1.5,
    marginHorizontal: 7,
  },
  activeStepLine: {
    backgroundColor: 'rgba(154, 70, 255, 0.6)',
  },
  gridCard: {
    backgroundColor: 'rgba(17, 14, 45, 0.9)',
    borderColor: 'rgba(214, 117, 255, 0.35)',
    borderRadius: 24,
    borderWidth: 1,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
  },
  gridCardCompact: {
    borderRadius: 22,
    padding: 10,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  symbolCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 10,
    position: 'relative',
  },
  symbolCardSelected: {
    borderColor: '#67DFFF',
    elevation: 10,
    shadowColor: '#66DFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  checkBadge: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 28,
    zIndex: 2,
  },
  symbolOrb: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.44,
    shadowRadius: 14,
  },
  symbolHalo: {
    borderRadius: 999,
    height: '74%',
    opacity: 0.18,
    position: 'absolute',
    width: '74%',
  },
  symbolTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  symbolTitleSelected: {
    color: '#F1FBFF',
  },
  symbolSubtitle: {
    color: '#CEC6E8',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  footerSection: {
    gap: 10,
  },
  footerSectionCompact: {
    gap: 8,
  },
  selectionCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 14, 45, 0.88)',
    borderColor: 'rgba(214, 117, 255, 0.3)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  selectionCardCompact: {
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectionThumb: {
    alignItems: 'center',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 42,
  },
  selectionThumbCompact: {
    height: 38,
    width: 38,
  },
  selectionText: {
    color: '#E8E2F7',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  selectionTextCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
});
