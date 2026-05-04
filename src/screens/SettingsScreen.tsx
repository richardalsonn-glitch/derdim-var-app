import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '../components/GlassCard';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, radius, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import { deleteCurrentAccount, freezeCurrentAccount } from '../services/accountService';
import { submitSupportReport } from '../services/supportService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

type InfoItem = {
  title: string;
  body: string;
  danger?: boolean;
};

const legalItems: InfoItem[] = [
  {
    title: 'Gizlilik Politikası',
    body: 'DerdimVar terapi hizmeti sunmaz. Uygulama anonim sosyal destek ve sesli görüşme alanıdır. Kullanıcı hesabı, profil bilgileri, mesajlar, arkadaşlık verileri, hediye kayıtları ve teknik loglar işlenebilir. Mikrofon sadece sesli görüşme için kullanılır. Kullanıcı hesabını silebilir.',
  },
  {
    title: 'Kullanım Şartları',
    body: 'Taciz, tehdit, nefret söylemi, cinsel içerik, dolandırıcılık ve yasa dışı kullanım yasaktır. DerdimVar profesyonel terapi, tıbbi destek veya acil yardım hizmeti değildir. Acil durumda 112 veya profesyonel destek alınmalıdır.',
  },
  {
    title: 'Topluluk Kuralları',
    body: 'Anonimlik kötüye kullanım hakkı vermez. Karşı tarafı rahatsız etmek yasaktır. Şikayet ve engelleme mekanizması kullanılabilir.',
  },
  {
    title: 'Veri Silme Politikası',
    body: 'Hesabını silen kullanıcının profil, arkadaşlık, mesaj ve uygulama içi verileri silinir veya anonimleştirilir. Güvenlik gerekçesiyle tutulması gereken kayıtlar sınırlı süre saklanabilir.',
  },
  {
    title: 'Acil Durum Uyarısı',
    body: 'Bu uygulama terapi hizmeti değildir. Kendine veya başkasına zarar verme riski varsa 112 aranmalıdır. Profesyonel destek alınmalıdır.',
    danger: true,
  },
];

const supportTypes = [
  { label: 'Şikayet', value: 'report' },
  { label: 'Güvenlik', value: 'safety' },
  { label: 'Taciz', value: 'report' },
  { label: 'Teknik Sorun', value: 'support' },
  { label: 'Hesap Sorunu', value: 'support' },
  { label: 'Diğer', value: 'support' },
] as const;

export function SettingsScreen({ navigation }: AppScreenProps<'Settings'>) {
  const { updateProfile } = useAppState();
  const [selectedItem, setSelectedItem] = useState<InfoItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<'freeze' | 'delete' | null>(null);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [supportVisible, setSupportVisible] = useState(false);
  const [supportTypeIndex, setSupportTypeIndex] = useState(0);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleFreeze() {
    setPending(true);
    const result = await freezeCurrentAccount();
    setPending(false);

    if (result.error) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Hesap dondurulamadı. Lütfen tekrar deneyin.'));
      return;
    }

    updateProfile({ isFrozen: true });
    navigation.reset({ index: 0, routes: [{ name: 'FrozenAccount' }] });
  }

  async function handleDelete() {
    setPending(true);
    const result = await deleteCurrentAccount();
    setPending(false);

    if (result.error) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Hesap silinemedi. Lütfen tekrar deneyin.'));
      return;
    }

    navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  }

  async function handleSupportSubmit() {
    const selectedType = supportTypes[supportTypeIndex];
    setPending(true);
    const result = await submitSupportReport({
      type: selectedType.value,
      subject: `${selectedType.label}: ${supportSubject}`,
      message: supportMessage,
    });
    setPending(false);

    if (result.error) {
      setErrorMessage(getFriendlyErrorMessage(result.error, 'Talep gönderilemedi. Lütfen tekrar deneyin.'));
      return;
    }

    setSupportVisible(false);
    setSupportSubject('');
    setSupportMessage('');
    setSuccessMessage('Talebin alındı. En kısa sürede incelenecek.');
  }

  function openSupportForm() {
    setErrorMessage('');
    setSupportVisible(true);
  }

  function renderItem(item: InfoItem) {
    return (
      <Pressable key={item.title} onPress={() => setSelectedItem(item)} style={styles.row}>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowTitle, item.danger && styles.danger]}>{item.title}</Text>
          <Text numberOfLines={1} style={styles.rowText}>{item.body}</Text>
        </View>
        <Ionicons color={colors.muted} name="chevron-forward" size={18} />
      </Pressable>
    );
  }

  return (
    <PremiumScreen contentStyle={styles.content}>
      <ScreenHeader onBack={() => navigation.goBack()} subtitle="Yasal, güvenlik ve hesap işlemleri" title="Ayarlar" />

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {pending ? <ActivityIndicator color={colors.cyan} /> : null}

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Yasal ve Güvenlik</Text>
        {legalItems.map(renderItem)}
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Hesap İşlemleri</Text>
        <Pressable onPress={() => setConfirmAction('freeze')} style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Hesabımı Dondur</Text>
            <Text numberOfLines={1} style={styles.rowText}>Eşleşme ve online görünürlük geçici olarak durur.</Text>
          </View>
          <Ionicons color={colors.muted} name="pause-circle" size={18} />
        </Pressable>
        <Pressable onPress={() => setConfirmAction('delete')} style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, styles.danger]}>Hesabımı Sil</Text>
            <Text numberOfLines={1} style={styles.rowText}>Profil, mesajlar ve uygulama verileri kalıcı olarak silinir.</Text>
          </View>
          <Ionicons color={colors.danger} name="trash" size={18} />
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Destek</Text>
        <Pressable onPress={openSupportForm} style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Şikayet Et / Bize Ulaş</Text>
            <Text numberOfLines={1} style={styles.rowText}>Şikayet, güvenlik, taciz, teknik sorun veya hesap talebi oluştur.</Text>
          </View>
          <Ionicons color={colors.cyan} name="send" size={18} />
        </Pressable>
        <Pressable onPress={() => setSelectedItem({ title: 'Güvenlik Notu', body: 'Kişisel bilgi, adres, finansal bilgi veya şifre paylaşma. Acil risklerde 112 ve profesyonel destek kanallarını kullan.' })} style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Güvenlik Notu</Text>
            <Text numberOfLines={1} style={styles.rowText}>Kişisel bilgi paylaşma; acil durumda 112’yi ara.</Text>
          </View>
          <Ionicons color={colors.gold} name="shield-checkmark" size={18} />
        </Pressable>
      </GlassCard>

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setSuccessMessage(''), variant: 'secondary' }]}
        message={successMessage}
        title="Talep alındı"
        visible={Boolean(successMessage)}
      />

      <NoticeModal
        actions={[
          { label: 'Vazgeç', onPress: () => setSupportVisible(false), variant: 'ghost' },
          { label: 'Gönder', onPress: () => void handleSupportSubmit(), variant: 'secondary' },
        ]}
        message=""
        title="Şikayet Et / Bize Ulaş"
        visible={supportVisible}
      >
        <View style={styles.typeGrid}>
          {supportTypes.map((type, index) => (
            <Pressable
              key={type.label}
              onPress={() => setSupportTypeIndex(index)}
              style={[styles.typeChip, supportTypeIndex === index && styles.typeChipActive]}
            >
              <Text style={[styles.typeText, supportTypeIndex === index && styles.typeTextActive]}>{type.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          onChangeText={setSupportSubject}
          placeholder="Konu / başlık"
          placeholderTextColor={colors.dim}
          style={styles.input}
          value={supportSubject}
        />
        <TextInput
          multiline
          onChangeText={setSupportMessage}
          placeholder="Açıklama / mesaj"
          placeholderTextColor={colors.dim}
          style={styles.supportInput}
          value={supportMessage}
        />
      </NoticeModal>

      <NoticeModal
        actions={[{ label: 'Tamam', onPress: () => setSelectedItem(null), variant: 'secondary' }]}
        message={selectedItem?.body ?? ''}
        title={selectedItem?.title ?? ''}
        visible={selectedItem !== null}
      />

      <NoticeModal
        actions={[
          { label: 'Vazgeç', onPress: () => setConfirmAction(null), variant: 'ghost' },
          {
            label: confirmAction === 'delete' ? 'Kalıcı Olarak Sil' : 'Dondur',
            onPress: () => {
              const action = confirmAction;
              setConfirmAction(null);
              if (action === 'delete') {
                void handleDelete();
              } else if (action === 'freeze') {
                void handleFreeze();
              }
            },
            variant: 'secondary',
          },
        ]}
        message={
          confirmAction === 'delete'
            ? 'Hesabını silersen profilin, arkadaşlıkların, mesajların ve uygulama verilerin silinir. Bu işlem geri alınamaz.'
            : 'Hesabın dondurulunca eşleşmeye giremez ve online görünmezsin. İstediğinde tekrar aktifleştirebilirsin.'
        }
        title={confirmAction === 'delete' ? 'Hesabımı Sil' : 'Hesabımı Dondur'}
        visible={confirmAction !== null}
      />
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: 96,
  },
  card: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  rowText: {
    color: colors.muted,
    marginTop: 3,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  typeChipActive: {
    borderColor: colors.cyan,
    backgroundColor: 'rgba(69,224,255,0.12)',
  },
  typeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  typeTextActive: {
    color: colors.text,
  },
  input: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    paddingHorizontal: spacing.md,
  },
  supportInput: {
    minHeight: 118,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    color: colors.text,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  danger: {
    color: colors.danger,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
