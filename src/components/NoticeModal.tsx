import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../constants/theme';
import { getContentMaxWidth, getHorizontalPadding, responsiveFont, responsiveSpacing } from '../utils/responsive';
import { GlassCard } from './GlassCard';
import { GradientButton } from './GradientButton';

type NoticeAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold';
};

type NoticeModalProps = {
  visible: boolean;
  title: string;
  message: string;
  actions: NoticeAction[];
  onClose?: () => void;
  children?: ReactNode;
};

export function NoticeModal({ visible, title, message, actions, onClose, children }: NoticeModalProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const horizontalPadding = getHorizontalPadding(width);
  const maxWidth = getContentMaxWidth(width);

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.backdrop,
          {
            paddingBottom: insets.bottom + responsiveSpacing(spacing.lg, width),
            paddingHorizontal: horizontalPadding,
            paddingTop: insets.top + responsiveSpacing(spacing.lg, width),
          },
        ]}
      >
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GlassCard style={[styles.card, { maxWidth }]}>
            <Text style={[styles.title, { fontSize: responsiveFont(24, width) }]}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {children}
            <View style={styles.actions}>
              {actions.map((action) => (
                <GradientButton
                  key={action.label}
                  onPress={action.onPress}
                  title={action.label}
                  variant={action.variant ?? 'primary'}
                />
              ))}
            </View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 6, 20, 0.76)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontWeight: '800',
  },
  message: {
    color: colors.muted,
    lineHeight: 21,
  },
  actions: {
    gap: spacing.sm,
  },
});
