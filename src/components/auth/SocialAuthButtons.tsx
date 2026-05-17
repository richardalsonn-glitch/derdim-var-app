import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../../constants/theme';

type SocialAuthButtonsProps = {
  appleDisabled?: boolean;
  googleDisabled?: boolean;
  isAppleLoading?: boolean;
  isGoogleLoading?: boolean;
  onApplePress?: () => void;
  onGooglePress: () => void;
};

export function SocialAuthButtons({
  appleDisabled = false,
  googleDisabled = false,
  isAppleLoading = false,
  isGoogleLoading = false,
  onApplePress,
  onGooglePress,
}: SocialAuthButtonsProps) {
  return (
    <View style={styles.stack}>
      {Platform.OS === 'ios' && onApplePress ? (
        <View style={[styles.appleWrap, appleDisabled && styles.disabledWrap]}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            cornerRadius={radius.md}
            onPress={onApplePress}
            style={styles.appleButton}
          />
          {(appleDisabled || isAppleLoading) ? (
            <Pressable disabled style={styles.disabledOverlay}>
              {isAppleLoading ? (
                <ActivityIndicator color="#111111" size="small" />
              ) : null}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Pressable
        disabled={googleDisabled || isGoogleLoading}
        onPress={onGooglePress}
        style={[styles.googleButton, (googleDisabled || isGoogleLoading) && styles.disabledWrap]}
      >
        {isGoogleLoading ? (
          <ActivityIndicator color="#1F1F1F" size="small" />
        ) : (
          <>
            <View style={styles.googleIconWrap}>
              <Ionicons color="#4285F4" name="logo-google" size={18} />
            </View>
            <Text style={styles.googleText}>Google ile devam et</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm,
  },
  appleWrap: {
    height: 46,
    overflow: 'hidden',
    position: 'relative',
  },
  appleButton: {
    height: 46,
    width: '100%',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  googleIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleText: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledWrap: {
    opacity: 0.56,
  },
  disabledOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.62)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
