import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ChoiceChip } from '../components/ChoiceChip';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ProgressDots } from '../components/ProgressDots';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';

const genderOptions = ['Kadın', 'Erkek'] as const;
const relationshipOptions = ['Bekar', 'İlişki', 'Karışık'] as const;
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

type PickerButtonProps = {
  label: string;
  value: string;
  active?: boolean;
  onPress: () => void;
};

function PickerButton({ label, value, active = false, onPress }: PickerButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.pickerButton, active && styles.pickerButtonActive]}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerValueRow}>
        <Text numberOfLines={1} style={[styles.pickerValue, !value && styles.pickerPlaceholder]}>
          {value || 'Seç'}
        </Text>
        <Ionicons color={active ? colors.cyan : colors.dim} name="chevron-down" size={16} />
      </View>
    </Pressable>
  );
}

export function ProfileInfoScreen({ navigation }: AppScreenProps<'ProfileInfo'>) {
  const { profile, updateProfile } = useAppState();
  const seededBirthDate = parseBirthDate(profile.birthDate);
  const [selectedGender, setSelectedGender] = useState<(typeof genderOptions)[number] | null>(profile.birthDate ? profile.gender : null);
  const [relationshipStatus, setRelationshipStatus] = useState<(typeof relationshipOptions)[number] | null>(
    profile.birthDate && relationshipOptions.includes(profile.relationshipStatus as (typeof relationshipOptions)[number])
      ? (profile.relationshipStatus as (typeof relationshipOptions)[number])
      : null,
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(seededBirthDate?.day ?? null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(seededBirthDate?.month ?? null);
  const [selectedYear, setSelectedYear] = useState<number | null>(seededBirthDate?.year ?? null);
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
    activePicker === 'day' ? 'Gün seç' : activePicker === 'month' ? 'Ay seç' : activePicker === 'year' ? 'Yıl seç' : '';
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

  const handleContinue = () => {
    if (!selectedGender || !relationshipStatus || !selectedDay || !selectedMonth || !selectedYear || !calculatedAge) {
      setErrorMessage('Lütfen tüm alanları doldur.');
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

    setIsContinuing(true);
    updateProfile({
      age: calculatedAge,
      birthDate: `${selectedYear}-${pad(selectedMonth)}-${pad(selectedDay)}`,
      gender: selectedGender,
      relationshipStatus,
      plan: 'free',
    });
    setIsContinuing(false);
    navigation.navigate('AvatarSelection');
  };

  return (
    <PremiumScreen contentStyle={styles.content} scroll={false}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Profil detaylarını tamamla" title="Profil Bilgilerin" />
      <ProgressDots current={2} total={4} />

      <GlassCard style={styles.card}>
        <View style={styles.block}>
          <Text style={styles.label}>Cinsiyet</Text>
          <View style={styles.row}>
            {genderOptions.map((gender) => (
              <ChoiceChip key={gender} label={gender} onPress={() => setSelectedGender(gender)} selected={selectedGender === gender} />
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.birthHeader}>
            <Text style={styles.label}>Doğum tarihi</Text>
            <Text style={styles.ageText}>{calculatedAge ? `Yaşın: ${calculatedAge}` : 'Yaşın hesaplanacak'}</Text>
          </View>

          <View style={styles.birthRow}>
            <PickerButton active={activePicker === 'day'} label="Gün" onPress={() => setActivePicker('day')} value={selectedDay ? String(selectedDay) : ''} />
            <PickerButton
              active={activePicker === 'month'}
              label="Ay"
              onPress={() => setActivePicker('month')}
              value={selectedMonth ? monthOptions[selectedMonth - 1] : ''}
            />
            <PickerButton active={activePicker === 'year'} label="Yıl" onPress={() => setActivePicker('year')} value={selectedYear ? String(selectedYear) : ''} />
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.label}>Medeni durum</Text>
          <View style={styles.row}>
            {relationshipOptions.map((status) => (
              <ChoiceChip key={status} label={status} onPress={() => setRelationshipStatus(status)} selected={relationshipStatus === status} />
            ))}
          </View>
        </View>

        <GradientButton disabled={isContinuing} onPress={handleContinue} title={isContinuing ? 'Devam ediliyor...' : 'Devam Et'} />
      </GlassCard>

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
                  <Pressable key={`${activePicker}-${option.value}`} onPress={() => handlePickerValue(option.value)} style={styles.modalOption}>
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
    flexGrow: 1,
    paddingBottom: spacing.lg,
  },
  card: {
    gap: spacing.lg,
  },
  block: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
  },
  birthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ageText: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  birthRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickerButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'space-between',
  },
  pickerButtonActive: {
    borderColor: 'rgba(123, 228, 255, 0.8)',
    backgroundColor: 'rgba(81, 52, 181, 0.32)',
    shadowColor: colors.cyan,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  pickerLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  pickerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  pickerValue: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  pickerPlaceholder: {
    color: colors.dim,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 5, 16, 0.72)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    maxHeight: '70%',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(10, 12, 31, 0.98)',
    padding: spacing.md,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  modalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modalOption: {
    minWidth: '30%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
