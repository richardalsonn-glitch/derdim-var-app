import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../constants/theme';

type FormInputProps = {
  label: string;
  placeholder: string;
  value?: string;
  secureTextEntry?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  editable?: boolean;
  onChangeText?: (value: string) => void;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
};

export function FormInput({
  label,
  placeholder,
  value,
  secureTextEntry,
  icon,
  editable = true,
  onChangeText,
  autoCapitalize = 'none',
  keyboardType = 'default',
}: FormInputProps) {
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));

  useEffect(() => {
    setHidden(Boolean(secureTextEntry));
  }, [secureTextEntry]);

  const trailingIcon = secureTextEntry ? (hidden ? 'eye-off-outline' : 'eye-outline') : icon;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, !editable && styles.readOnlyWrap]}>
        <TextInput
          autoCapitalize={autoCapitalize}
          editable={editable}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.dim}
          secureTextEntry={hidden}
          style={styles.input}
          value={value}
        />
        {trailingIcon ? (
          secureTextEntry ? (
            <Pressable hitSlop={10} onPress={() => setHidden((current) => !current)} style={styles.iconButton}>
              <Ionicons color={hidden ? colors.dim : colors.pink} name={trailingIcon} size={18} />
            </Pressable>
          ) : (
            <Ionicons color={colors.dim} name={trailingIcon} size={18} />
          )
        ) : null}
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
  readOnlyWrap: {
    opacity: 0.9,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
