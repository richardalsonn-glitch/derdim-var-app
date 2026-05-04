import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GlassCard } from '../components/GlassCard';
import { NoticeModal } from '../components/NoticeModal';
import { PremiumScreen } from '../components/PremiumScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, spacing } from '../constants/theme';
import { useAppState } from '../data/AppContext';
import { AppScreenProps } from '../navigation/types';
import { deleteCurrentAccount, freezeCurrentAccount } from '../services/accountService';
import { getFriendlyErrorMessage } from '../utils/errorMessages';

type InfoItem = {
  title: string;
  body: string;
  danger?: boolean;
};

const legalItems: InfoItem[] = [
  {
    title: 'Gizlilik Politikası',
    body: 'DerdimVar terapi hizmeti sunmaz. Uygulama anonim sosyal destek ve sesli görüşme alanıdır. Kullanıcı hesabı, profil bilgileri, mesajlar, arkadaşlık verileri, hediye kayıtları ve teknik loglar işlenebilir. Mikrofon sadece sesli görüşme için kullanılır. Veriler hizmeti sunmak, güvenliği sağlamak ve kötüye kullanımı önlemek için işlenir. Kullanıcı hesabını silebilir.',
  },
  {
    title: 'Kullanım Şartları',
    body: 'Kullanıcılar saygılı davranmalıdır. Taciz, tehdit, nefret söylemi, cinsel içerik, dolandırıcılık ve yasa dışı kullanım yasaktır. DerdimVar profesyonel terapi, tıbbi destek veya acil yardım hizmeti değildir. Acil durumda 112 veya profesyonel destek alınmalıdır.',
  },
  {
    title: 'Topluluk Kuralları',
    body: 'Anonimlik kötüye kullanım hakkı vermez. Karşı tarafı rahatsız etmek yasaktır. Şikayet ve engelleme mekanizması kullanılabilir. Güvenli konuşma ortamı korunmalıdır.',
  },
  {
    title: 'Veri Silme Politikası',
    body: 'Hesabını silen kullanıcının profil, oturum, arkadaşlık, mesaj ve uygulama içi verileri silinir veya anonimleştirilir. Yasal/güvenlik gerekçesiyle tutulması gereken kayıtlar sınırlı süre saklanabilir. Hesabı dondurma, hesap silme yerine geçmez.',
  },
  {
    title: 'Acil Durum Uyarısı',
    body: 'Bu uygulama terapi hizmeti değildir. Kendine veya başkasına zarar verme riski varsa 112 aranmalıdır. Profesyonel destek alınmalıdır.',
    danger: true,
  },
];

const supportItems: InfoItem[] = [
  {
    title: 'Şikayet Et / Bize Ulaş',
    body: 'Kötüye kullanım, taciz, tehdit veya güvenlik riski görürsen bu kayıt moderasyon kuyruğuna alınır. Şu anda destek akışı güvenli stub olarak çalışır.',
  },
  {
    title: 'Güvenlik Notu',
    body: 'Kişisel bilgi, adres, finansal bilgi veya şifre paylaşma. Acil risklerde uygulama yerine 112 ve profesyonel destek kanallarını kullan.',
  },
];

export function SettingsScreen({ navigation }: AppScreenProps<'Settings'>) {
  const { updateProfile } = useAppState();
  const [selectedItem, setSelectedItem] = useState<InfoItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<'freeze' | 'delete' | null>(null);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
            <Text numberOfLines={1} style={styles.rowText}>Hesabını geçici olarak kapatır. Eşleşme ve online görünürlük durur.</Text>
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
        {supportItems.map(renderItem)}
      </GlassCard>

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
    gap: spacing.lg,
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
  danger: {
    color: colors.danger,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
