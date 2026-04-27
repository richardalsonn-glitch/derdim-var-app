import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../constants/theme';
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
};

export function NoticeModal({ visible, title, message, actions, onClose }: NoticeModalProps) {
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <GlassCard style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(4, 6, 20, 0.76)',
  },
  card: {
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 24,
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
