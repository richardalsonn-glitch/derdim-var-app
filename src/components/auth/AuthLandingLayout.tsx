import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ReactNode } from 'react';

import { colors } from '../../constants/theme';

const backgroundImage = require('../../../assets/images/anasayfayeni12.png');

const BACKGROUND_WIDTH = 842;
const BACKGROUND_HEIGHT = 1867;
const BACKGROUND_RATIO = BACKGROUND_HEIGHT / BACKGROUND_WIDTH;
const FORM_WIDTH_RATIO = 0.888;
const FORM_TOP_RATIO = 0.593;
const FORM_RAISE_OFFSET = 88;
const FORM_SCALE = 0.66;
const FORM_HORIZONTAL_SCALE = 1.54;

type AuthLandingLayoutProps = {
  canGoBack?: boolean;
  emailValue: string;
  isSubmitting: boolean;
  onBack?: () => void;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onRegister: () => void;
  onSubmit: () => void;
  passwordValue: string;
  socialSection?: ReactNode;
};

export function AuthLandingLayout({
  canGoBack = false,
  emailValue,
  isSubmitting,
  onBack,
  onChangeEmail,
  onChangePassword,
  onRegister,
  onSubmit,
  passwordValue,
  socialSection,
}: AuthLandingLayoutProps) {
  const { height, width } = useWindowDimensions();
  const scale = Math.max(Math.min(width / 390, 1.08), 0.9);
  const s = (n: number) => Math.round(n * scale);
  const fs = (n: number) => Math.round(n * scale * FORM_SCALE);
  const frameHeight = height;
  const displayedImageHeight = frameHeight;
  const displayedImageWidth = Math.round(displayedImageHeight / BACKGROUND_RATIO);
  const imageLeft = Math.round((width - displayedImageWidth) / 2);
  const formWidth = Math.round(displayedImageWidth * FORM_WIDTH_RATIO * FORM_SCALE * FORM_HORIZONTAL_SCALE);
  const formLeft = Math.round(imageLeft + (displayedImageWidth - formWidth) / 2);
  const formTop = Math.max(fs(24), Math.round(displayedImageHeight * FORM_TOP_RATIO) - fs(FORM_RAISE_OFFSET));

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
          <View style={[styles.heroFrame, { height: frameHeight }]}>
            <Image
              source={backgroundImage}
              style={[
                styles.backgroundImage,
                {
                  height: displayedImageHeight,
                  left: imageLeft,
                  width: displayedImageWidth,
                },
              ]}
            />

            {canGoBack && onBack ? (
              <Pressable
                onPress={onBack}
                style={[styles.backButton, { borderRadius: s(22), height: s(44), left: s(16), top: s(18), width: s(44) }]}
              >
                <Ionicons color={colors.text} name="chevron-back" size={s(22)} />
              </Pressable>
            ) : null}

            <View
              style={[
                styles.formCard,
                {
                  borderRadius: fs(24),
                  left: formLeft,
                  paddingBottom: fs(20),
                  paddingHorizontal: fs(17),
                  paddingTop: fs(17),
                  top: formTop,
                  width: formWidth,
                },
              ]}
            >
              <View style={[styles.inputShell, { borderRadius: fs(15), height: fs(54), marginBottom: fs(12), paddingHorizontal: fs(14) }]}>
                <Ionicons color="#AFA0D8" name="mail" size={fs(25)} />
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={onChangeEmail}
                  placeholder="E-posta / Telefon"
                  placeholderTextColor="#938CB5"
                  style={[styles.input, { fontSize: fs(19), marginLeft: fs(12) }]}
                  value={emailValue}
                />
              </View>

              <View style={[styles.inputShell, { borderRadius: fs(15), height: fs(54), marginBottom: fs(14), paddingHorizontal: fs(14) }]}>
                <Ionicons color="#AFA0D8" name="lock-closed" size={fs(25)} />
                <TextInput
                  autoCapitalize="none"
                  onChangeText={onChangePassword}
                  placeholder="Şifre"
                  placeholderTextColor="#938CB5"
                  secureTextEntry
                  style={[styles.input, { fontSize: fs(19), marginLeft: fs(12) }]}
                  value={passwordValue}
                />
              </View>

              <Pressable disabled={isSubmitting} onPress={onSubmit}>
                <LinearGradient
                  colors={['#FF4FB9', '#9A46FF', '#5A6BFF']}
                  end={{ x: 1, y: 0.5 }}
                  start={{ x: 0, y: 0.5 }}
                  style={[styles.primaryButton, { borderRadius: fs(15), height: fs(54) }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.text} size="small" />
                  ) : (
                    <>
                      <Text style={[styles.primaryButtonText, { fontSize: fs(22) }]}>Giriş Yap</Text>
                      <Ionicons
                        color="#FFFFFF"
                        name="arrow-forward"
                        size={fs(25)}
                        style={[styles.arrowIcon, { right: fs(16) }]}
                      />
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={[styles.dividerRow, { marginTop: fs(15) }]}>
                <View style={styles.dividerLine} />
                <Text style={[styles.dividerText, { fontSize: fs(16), marginHorizontal: fs(14) }]}>veya</Text>
                <View style={styles.dividerLine} />
              </View>

              {socialSection ? <View style={[styles.socialWrap, { marginTop: fs(12) }]}>{socialSection}</View> : null}

              <View style={[styles.registerRow, { marginTop: fs(socialSection ? 12 : 13) }]}>
                <Text style={[styles.registerText, { fontSize: fs(18) }]}>Hesabın yok mu? </Text>
                <Pressable onPress={onRegister}>
                  <Text style={[styles.registerLink, { fontSize: fs(20) }]}>Kayıt Ol</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#05071A',
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  heroFrame: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  backgroundImage: {
    position: 'absolute',
    resizeMode: 'contain',
    top: 0,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(7,10,28,0.42)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 2,
  },
  formCard: {
    backgroundColor: 'rgba(11, 12, 33, 0.78)',
    borderColor: 'rgba(166, 129, 255, 0.85)',
    borderWidth: 1,
    position: 'absolute',
    shadowColor: '#AC63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(19, 21, 49, 0.9)',
    borderColor: 'rgba(182, 141, 255, 0.45)',
    borderWidth: 1,
    flexDirection: 'row',
  },
  input: {
    color: '#F7EEFF',
    flex: 1,
    fontWeight: '500',
    paddingVertical: 0,
  },
  primaryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#FF4FB9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  arrowIcon: {
    position: 'absolute',
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  dividerLine: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: '#C7BEE3',
    fontWeight: '500',
  },
  registerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialWrap: {
    gap: 8,
  },
  registerText: {
    color: '#D9D1F2',
  },
  registerLink: {
    color: '#FF63BB',
    fontWeight: '700',
  },
});
