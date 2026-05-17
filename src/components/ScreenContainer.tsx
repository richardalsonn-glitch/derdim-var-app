import { PropsWithChildren } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gradients } from '../constants/theme';
import { ScreenInsetMode, getScreenLayout } from '../utils/responsive';

type ScreenContainerProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  topInsetMode?: ScreenInsetMode;
  bottomInsetMode?: ScreenInsetMode;
}>;

export function ScreenContainer({
  children,
  scroll = true,
  contentStyle,
  topInsetMode = 'default',
  bottomInsetMode = 'default',
}: ScreenContainerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const screenLayout = getScreenLayout({ width, height }, insets, { topInsetMode, bottomInsetMode });

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        {
          gap: screenLayout.pageGap,
          paddingBottom: screenLayout.contentBottomPadding,
          paddingHorizontal: screenLayout.horizontalPadding,
          paddingTop: screenLayout.contentTopPadding,
        },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.staticContent,
        {
          paddingBottom: screenLayout.contentBottomPadding,
          paddingHorizontal: screenLayout.horizontalPadding,
          paddingTop: screenLayout.contentTopPadding,
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <LinearGradient colors={[...gradients.background]} style={styles.container}>
      <View style={[styles.orb, styles.orbLeft]} />
      <View style={[styles.orb, styles.orbRight]} />
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <View style={[styles.centerColumn, { maxWidth: screenLayout.contentMaxWidth }]}>{content}</View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  centerColumn: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  staticContent: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: 'rgba(153, 70, 255, 0.18)',
  },
  orbLeft: {
    top: -40,
    left: -40,
  },
  orbRight: {
    right: -50,
    top: 220,
    backgroundColor: 'rgba(70, 165, 255, 0.12)',
  },
});
