import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { logSafeWarn } from '../lib/safeLogger';
import { AppScreenProps } from '../navigation/types';
import { updateCurrentUserProfileDetails } from '../services/authService';

const genderOptions = [
  { label: 'Kadın', value: 'Kadın' as const, icon: 'female' as const },
  { label: 'Erkek', value: 'Erkek' as const, icon: 'male' as const },
];

const relationshipOptions = ['Bekar', 'İlişki', 'Evli', 'Dul'] as const;
const reasonOptions = [
  'İçimi dökmek istiyorum',
  'Birini dinlemek istiyorum',
  'Yalnız hissetmemek için',
  'Yeni insanlarla tanışmak',
] as const;
const monthOptions = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

type PickerField = 'day' | 'month' | 'year' | null;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function parseBirthDate(value?: string) {
  if (!value) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

function getDaysInMonth(year?: number | null, month?: number | null) {
  if (!year || !month) {
    return 31;
  }

  return new Date(year, month, 0).getDate();
}

function calculateAge(day?: number | null, month?: number | null, year?: number | null) {
  if (!day || !month || !year) {
    return null;
  }

  const birthDate = new Date(year, month - 1, day);

  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const monthPassed =
    today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);

  if (!monthPassed) {
    age -= 1;
  }

  return age;
}

type StepIndicatorProps = {
  activeStep: number;
  compact: boolean;
};

function StepIndicator({ activeStep, compact }: StepIndicatorProps) {
  const size = compact ? 36 : 42;
  const lineWidth = compact ? 34 : 42;

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
              <LinearGradient colors={['#FF4FB9', '#9A46FF']} style={styles.activeStepFill}>
                <Text style={[styles.stepLabel, compact && styles.stepLabelCompact]}>{step}</Text>
              </LinearGradient>
            ) : (
              <Text style={[styles.stepLabel, styles.inactiveStepLabel, compact && styles.stepLabelCompact]}>
                {step}
              </Text>
            )}
          </View>
          {index < 3 ? (
            <View
              style={[
                styles.stepLine,
                { width: lineWidth },
                index + 1 < activeStep && styles.activeStepLine,
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

type PickerButtonProps = {
  active?: boolean;
  compact?: boolean;
  label: string;
  onPress: () => void;
  value: string;
};

function PickerButton({ active = false, compact = false, label, onPress, value }: PickerButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pickerButton, compact && styles.pickerButtonCompact, active && styles.pickerButtonActive]}
    >
      <Text style={[styles.pickerLabel, compact && styles.pickerLabelCompact]}>{label}</Text>
      <View style={styles.pickerValueRow}>
        <Text
          numberOfLines={1}
          style={[styles.pickerValue, compact && styles.pickerValueCompact, !value && styles.pickerPlaceholder]}
        >
          {value || 'Seç'}
        </Text>
        <Ionicons color={active ? '#BC8BFF' : colors.dim} name="chevron-down" size={compact ? 16 : 18} />
      </View>
    </Pressable>
  );
}

export function ProfileInfoScreen({ navigation }: AppScreenProps<'ProfileInfo'>) {
  const { profile, updateProfile } = useAppState();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width <= 390 || height <= 844;
  const sectionPadding = compact ? 14 : 16;
  const contentBottomPadding = compact ? Math.max(insets.bottom, 6) : Math.max(insets.bottom, 8);
  const seededBirthDate = parseBirthDate(profile.birthDate);
  const [selectedGender, setSelectedGender] = useState<(typeof genderOptions)[number]['value'] | null>(
    profile.birthDate ? profile.gender : null,
  );
  const [relationshipStatus, setRelationshipStatus] = useState<(typeof relationshipOptions)[number] | null>(
    profile.birthDate && relationshipOptions.includes(profile.relationshipStatus as (typeof relationshipOptions)[number])
      ? (profile.relationshipStatus as (typeof relationshipOptions)[number])
      : null,
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(seededBirthDate?.day ?? null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(seededBirthDate?.month ?? null);
  const [selectedYear, setSelectedYear] = useState<number | null>(seededBirthDate?.year ?? null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [activePicker, setActivePicker] = useState<PickerField>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorVisible, setErrorVisible] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const currentYear = new Date().getFullYear();

  const dayOptions = useMemo(
    () => Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, index) => index + 1),
    [selectedMonth, selectedYear],
  );
  const yearOptions = useMemo(
    () => Array.from({ length: 63 }, (_, index) => currentYear - 18 - index),
    [currentYear],
  );
  const calculatedAge = useMemo(
    () => calculateAge(selectedDay, selectedMonth, selectedYear),
    [selectedDay, selectedMonth, selectedYear],
  );

  const pickerTitle =
    activePicker === 'day'
      ? 'Gün seç'
      : activePicker === 'month'
        ? 'Ay seç'
        : activePicker === 'year'
          ? 'Yıl seç'
          : '';
  const pickerOptions =
    activePicker === 'day'
      ? dayOptions.map((item) => ({ label: String(item), value: item }))
      : activePicker === 'month'
        ? monthOptions.map((item, index) => ({ label: item, value: index + 1 }))
        : activePicker === 'year'
          ? yearOptions.map((item) => ({ label: String(item), value: item }))
          : [];

  const handlePickerValue = (value: number) => {
    if (activePicker === 'day') {
      setSelectedDay(value);
    }

    if (activePicker === 'month') {
      setSelectedMonth(value);
      if (selectedDay && selectedYear && selectedDay > getDaysInMonth(selectedYear, value)) {
        setSelectedDay(getDaysInMonth(selectedYear, value));
      }
    }

    if (activePicker === 'year') {
      setSelectedYear(value);
      if (selectedDay && selectedMonth && selectedDay > getDaysInMonth(value, selectedMonth)) {
        setSelectedDay(getDaysInMonth(value, selectedMonth));
      }
    }

    setActivePicker(null);
  };

  const handleContinue = async () => {
    if (!selectedGender) {
      setErrorMessage('Devam etmek için cinsiyetini seçmelisin.');
      setErrorVisible(true);
      return;
    }

    if (!selectedDay || !selectedMonth || !selectedYear || !calculatedAge) {
      setErrorMessage('Devam etmek için doğum tarihini tamamlamalısın.');
      setErrorVisible(true);
      return;
    }

    if (!relationshipStatus) {
      setErrorMessage('Lütfen medeni durumunu seç.');
      setErrorVisible(true);
      return;
    }

    if (calculatedAge < 18) {
      setErrorMessage('Bu uygulamayı kullanmak için en az 18 yaşında olmalısın.');
      setErrorVisible(true);
      return;
    }

    if (isContinuing) {
      return;
    }

    updateProfile({
      age: calculatedAge,
      birthDate: `${selectedYear}-${pad(selectedMonth)}-${pad(selectedDay)}`,
      gender: selectedGender,
      onboardingReasons: selectedReasons,
      relationshipStatus,
      plan: 'free',
    }, { source: 'profile-info' });

    setIsContinuing(true);
    const profileResult = await updateCurrentUserProfileDetails({ gender: selectedGender });

    if (profileResult.error) {
      logSafeWarn('[profile-info] save failed', profileResult.error, {
        functionName: 'ProfileInfoScreen.handleContinue',
        source: 'profile-info',
        table: 'profiles',
      });
    }

    setIsContinuing(false);
    navigation.navigate('AvatarSelection', { entry: 'onboarding', mode: 'onboarding' });
  };

  const toggleReason = (reason: string) => {
    setSelectedReasons((current) =>
      current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason],
    );
  };

  return (
    <PremiumScreen bottomInsetMode="none" contentStyle={[styles.content, { paddingBottom: contentBottomPadding }]} scroll={false}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Profil detaylarını tamamla" title="Profil Bilgilerin" />
      <StepIndicator activeStep={2} compact={compact} />

      <View style={styles.formFlow}>
        <View style={[styles.sectionCard, { padding: sectionPadding }, compact && styles.sectionCardCompact]}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIconWrap}>
              <Ionicons color="#FF77D5" name="male-female" size={compact ? 22 : 24} />
            </View>
            <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>Cinsiyet</Text>
          </View>

          <View style={styles.genderRow}>
            {genderOptions.map((gender) => {
              const selected = selectedGender === gender.value;
              return (
                <Pressable
                  key={gender.value}
                  onPress={() => setSelectedGender(gender.value)}
                  style={[styles.genderCard, compact && styles.genderCardCompact, selected && styles.genderCardSelected]}
                >
                  {selected ? (
                    <LinearGradient colors={['rgba(255,79,185,0.22)', 'rgba(154,70,255,0.1)']} style={StyleSheet.absoluteFill} />
                  ) : null}
                  <View style={[styles.genderBadge, compact && styles.genderBadgeCompact, selected && styles.genderBadgeSelected]}>
                    <Ionicons color={selected ? '#FF77D5' : '#CABAF0'} name={gender.icon} size={compact ? 22 : 24} />
                  </View>
                  <Text style={[styles.genderLabel, compact && styles.genderLabelCompact, selected && styles.genderLabelSelected]}>
                    {gender.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.sectionCard, { padding: sectionPadding }, compact && styles.sectionCardCompact]}>
          <View style={styles.sectionHeaderBetween}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIconWrap}>
                <Ionicons color="#C879FF" name="calendar-clear-outline" size={compact ? 20 : 22} />
              </View>
              <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>Doğum tarihi</Text>
            </View>
            <Text style={[styles.birthInfo, compact && styles.birthInfoCompact]}>Yaşın hesaplanacak ✦</Text>
          </View>

          <View style={styles.birthRow}>
            <PickerButton
              active={activePicker === 'day'}
              compact={compact}
              label="Gün"
              onPress={() => setActivePicker('day')}
              value={selectedDay ? String(selectedDay) : ''}
            />
            <PickerButton
              active={activePicker === 'month'}
              compact={compact}
              label="Ay"
              onPress={() => setActivePicker('month')}
              value={selectedMonth ? monthOptions[selectedMonth - 1] : ''}
            />
            <PickerButton
              active={activePicker === 'year'}
              compact={compact}
              label="Yıl"
              onPress={() => setActivePicker('year')}
              value={selectedYear ? String(selectedYear) : ''}
            />
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            styles.relationshipSectionLift,
            { padding: sectionPadding },
            compact && styles.sectionCardCompact,
            compact && styles.relationshipSectionLiftCompact,
          ]}
        >
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionIconWrap}>
              <Ionicons color="#FF77D5" name="heart-outline" size={compact ? 20 : 22} />
            </View>
            <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>Medeni durum</Text>
          </View>

          <View style={styles.relationshipGrid}>
            {relationshipOptions.map((status) => {
              const selected = relationshipStatus === status;
              return (
                <Pressable
                  key={status}
                  onPress={() => setRelationshipStatus(status)}
                  style={[styles.relationshipChip, compact && styles.relationshipChipCompact, selected && styles.relationshipChipSelected]}
                >
                  {selected ? (
                    <LinearGradient colors={['rgba(255,79,185,0.22)', 'rgba(154,70,255,0.1)']} style={StyleSheet.absoluteFill} />
                  ) : null}
                  <Text style={[styles.relationshipText, compact && styles.relationshipTextCompact, selected && styles.relationshipTextSelected]}>
                    {status}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            styles.reasonSectionLift,
            { padding: sectionPadding },
            compact && styles.sectionCardCompact,
            compact && styles.reasonSectionLiftCompact,
          ]}
        >
          <View style={styles.reasonHeader}>
            <Text style={[styles.sectionTitle, compact && styles.sectionTitleCompact]}>Ne için buradasın?</Text>
            <Text style={[styles.reasonHint, compact && styles.reasonHintCompact]}>
              İstersen seç, deneyimini sana göre şekillendirelim.
            </Text>
          </View>

          <View style={styles.reasonGrid}>
            {reasonOptions.map((reason) => {
              const selected = selectedReasons.includes(reason);

              return (
                <Pressable
                  key={reason}
                  onPress={() => toggleReason(reason)}
                  style={[styles.reasonChip, compact && styles.reasonChipCompact, selected && styles.reasonChipSelected]}
                >
                  {selected ? (
                    <LinearGradient colors={['rgba(255,79,185,0.22)', 'rgba(154,70,255,0.1)']} style={StyleSheet.absoluteFill} />
                  ) : null}
                  <Text style={[styles.reasonText, compact && styles.reasonTextCompact, selected && styles.reasonTextSelected]}>
                    {reason}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.ctaSection, compact && styles.ctaSectionCompact]}>
        <GradientButton
          disabled={isContinuing}
          icon="arrow-forward"
          onPress={handleContinue}
          title={isContinuing ? 'Devam ediliyor...' : 'Devam Et'}
        />
      </View>

      <Modal animationType="fade" onRequestClose={() => setActivePicker(null)} transparent visible={activePicker !== null}>
        <View style={styles.modalBackdrop}>
          <Pressable onPress={() => setActivePicker(null)} style={StyleSheet.absoluteFill} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerTitle}</Text>
              <Pressable onPress={() => setActivePicker(null)} style={styles.modalClose}>
                <Ionicons color={colors.text} name="close" size={18} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalOptions}>
                {pickerOptions.map((option) => (
                  <Pressable
                    key={`${activePicker}-${option.value}`}
                    onPress={() => handlePickerValue(option.value)}
                    style={styles.modalOption}
                  >
                    <Text style={styles.modalOptionText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setErrorVisible(false), variant: 'secondary' }]}
        message={errorMessage}
        title="Eksik bilgi"
        visible={errorVisible}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 10,
  },
  formFlow: {
    gap: 10,
    flexShrink: 1,
  },
  relationshipSectionLift: {
    marginTop: -4,
  },
  relationshipSectionLiftCompact: {
    marginTop: -3,
  },
  reasonSectionLift: {
    marginTop: -6,
  },
  reasonSectionLiftCompact: {
    marginTop: -5,
  },
  ctaSection: {
    marginTop: -4,
  },
  ctaSectionCompact: {
    marginTop: -6,
  },
  stepRow: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: -2,
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
    borderColor: 'rgba(255,134,234,0.82)',
    shadowColor: '#D46BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 12,
    elevation: 8,
  },
  activeStepFill: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  stepLine: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    height: 1.5,
    marginHorizontal: 8,
  },
  activeStepLine: {
    backgroundColor: 'rgba(255,120,214,0.76)',
  },
  stepLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  stepLabelCompact: {
    fontSize: 13,
  },
  inactiveStepLabel: {
    color: '#C2B5E8',
  },
  sectionCard: {
    backgroundColor: 'rgba(16, 15, 44, 0.72)',
    borderColor: 'rgba(203, 108, 255, 0.24)',
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  sectionCardCompact: {
    borderRadius: 22,
    gap: 8,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  sectionHeaderBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitleCompact: {
    fontSize: 17,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(180, 132, 255, 0.24)',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 62,
    overflow: 'hidden',
    paddingHorizontal: 14,
  },
  genderCardCompact: {
    minHeight: 58,
    paddingHorizontal: 12,
  },
  genderCardSelected: {
    borderColor: '#FF7ED9',
    shadowColor: '#FF63BB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 7,
  },
  genderBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(42, 25, 76, 0.9)',
    borderColor: 'rgba(198, 171, 255, 0.35)',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  genderBadgeCompact: {
    height: 36,
    width: 36,
  },
  genderBadgeSelected: {
    borderColor: '#FF7ED9',
  },
  genderLabel: {
    color: '#D5C9F3',
    fontSize: 18,
    fontWeight: '800',
  },
  genderLabelCompact: {
    fontSize: 16,
  },
  genderLabelSelected: {
    color: '#FF7ED9',
  },
  birthInfo: {
    color: '#50E6FF',
    fontSize: 12,
    fontWeight: '700',
  },
  birthInfoCompact: {
    fontSize: 11,
  },
  birthRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pickerButton: {
    backgroundColor: 'rgba(17, 14, 45, 0.96)',
    borderColor: 'rgba(166, 121, 255, 0.35)',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minHeight: 68,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerButtonCompact: {
    minHeight: 64,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  pickerButtonActive: {
    borderColor: '#BC8BFF',
    shadowColor: '#9A46FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 7,
  },
  pickerLabel: {
    color: '#AFA0D8',
    fontSize: 12,
    fontWeight: '600',
  },
  pickerLabelCompact: {
    fontSize: 11,
  },
  pickerValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerValue: {
    color: colors.text,
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
  },
  pickerValueCompact: {
    fontSize: 15,
  },
  pickerPlaceholder: {
    color: '#988ABD',
  },
  relationshipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  relationshipChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,18,52,0.92)',
    borderColor: 'rgba(180, 132, 255, 0.24)',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    overflow: 'hidden',
    paddingHorizontal: 12,
    width: '48%',
  },
  relationshipChipCompact: {
    minHeight: 40,
  },
  relationshipChipSelected: {
    borderColor: '#FF77D5',
    shadowColor: '#FF63BB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 7,
  },
  relationshipText: {
    color: '#CFC3EF',
    fontSize: 15,
    fontWeight: '700',
  },
  relationshipTextCompact: {
    fontSize: 14,
  },
  relationshipTextSelected: {
    color: '#FF83DB',
  },
  reasonHeader: {
    gap: 6,
  },
  reasonHint: {
    color: '#C4BDDE',
    fontSize: 13,
    lineHeight: 19,
  },
  reasonHintCompact: {
    fontSize: 12,
    lineHeight: 18,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  reasonChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,18,52,0.92)',
    borderColor: 'rgba(180, 132, 255, 0.24)',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '48%',
  },
  reasonChipCompact: {
    minHeight: 40,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  reasonChipSelected: {
    borderColor: '#FF77D5',
    shadowColor: '#FF63BB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 7,
  },
  reasonText: {
    color: '#CFC3EF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  reasonTextCompact: {
    fontSize: 13,
  },
  reasonTextSelected: {
    color: '#FF83DB',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(3, 5, 16, 0.74)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: 'rgba(10, 12, 31, 0.98)',
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    maxHeight: '70%',
    padding: spacing.md,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalClose: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  modalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modalOption: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: '30%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
