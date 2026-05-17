import { PropsWithChildren } from 'react';
import { ImageBackground, ImageSourcePropType, ScrollView, StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gradients } from '../constants/theme';
import { ScreenInsetMode, getScreenLayout } from '../utils/responsive';

type PremiumScreenProps = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  topInsetMode?: ScreenInsetMode;
  bottomInsetMode?: ScreenInsetMode;
  backgroundImage?: ImageSourcePropType;
}>;

export function PremiumScreen({
  children,
  scroll = true,
  contentStyle,
  topInsetMode = 'default',
  bottomInsetMode = 'default',
  backgroundImage,
}: PremiumScreenProps) {
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

  const screenContent = (
    <>
      <View pointerEvents="none" style={[styles.orb, styles.orbTop]} />
      <View pointerEvents="none" style={[styles.orb, styles.orbBottom]} />
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <View style={[styles.centerColumn, { maxWidth: screenLayout.contentMaxWidth }]}>{content}</View>
      </SafeAreaView>
    </>
  );

  if (backgroundImage) {
    return (
      <ImageBackground resizeMode="cover" source={backgroundImage} style={styles.container}>
        <View pointerEvents="none" style={styles.imageOverlay} />
        {screenContent}
      </ImageBackground>
    );
  }

  return (
    <LinearGradient colors={[...gradients.background]} style={styles.container}>
      {screenContent}
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
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 6, 20, 0.38)',
  },
  scrollContent: {
    flexGrow: 1,
  },
  staticContent: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 999,
  },
  orbTop: {
    top: -60,
    right: -60,
    backgroundColor: 'rgba(255, 79, 185, 0.12)',
  },
  orbBottom: {
    left: -70,
    top: 280,
    backgroundColor: 'rgba(61, 123, 255, 0.14)',
  },
});
