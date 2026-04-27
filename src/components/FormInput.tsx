import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../constants/theme';

type FormInputProps = {
  label: string;
  placeholder: string;
  value?: string;
  secureTextEntry?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function FormInput({ label, placeholder, value, secureTextEntry, icon }: FormInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          editable={false}
          placeholder={placeholder}
          placeholderTextColor={colors.dim}
          secureTextEntry={secureTextEntry}
          style={styles.input}
          value={value}
        />
        {icon ? <Ionicons color={colors.dim} name={icon} size={18} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
  },
  inputWrap: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
});
