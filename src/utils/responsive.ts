import type { EdgeInsets } from 'react-native-safe-area-context';

export type SizeClass = 'small' | 'compact' | 'regularPhone' | 'tablet';

export type WindowSize = {
  width: number;
  height: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getSizeClass(width: number): SizeClass {
  if (width < 390) {
    return 'small';
  }

  if (width < 430) {
    return 'compact';
  }

  if (width < 768) {
    return 'regularPhone';
  }

  return 'tablet';
}

export function getScreenMetrics({ width, height }: WindowSize) {
  const sizeClass = getSizeClass(width);
  const shortest = Math.min(width, height);

  return {
    width,
    height,
    shortest,
    sizeClass,
    isSmallPhone: sizeClass === 'small',
    isCompactPhone: sizeClass === 'small' || sizeClass === 'compact',
    isRegularPhone: sizeClass === 'regularPhone',
    isTablet: sizeClass === 'tablet',
    isLandscape: width > height,
  };
}

export function scale(value: number, width: number, baseWidth = 390) {
  return value * (width / baseWidth);
}

export function verticalScale(value: number, height: number, baseHeight = 844) {
  return value * (height / baseHeight);
}

export function moderateScale(value: number, width: number, factor = 0.5, baseWidth = 390) {
  return value + (scale(value, width, baseWidth) - value) * factor;
}

export function responsiveFont(value: number, width: number) {
  const metrics = getScreenMetrics({ width, height: width });
  const factor = metrics.isTablet ? 0.22 : metrics.isSmallPhone ? 0.38 : 0.5;

  return Math.round(clamp(moderateScale(value, width, factor), value * 0.88, value * (metrics.isTablet ? 1.12 : 1.05)));
}

export function responsiveSpacing(value: number, width: number) {
  const metrics = getScreenMetrics({ width, height: width });
  const factor = metrics.isTablet ? 0.2 : metrics.isSmallPhone ? 0.32 : 0.45;

  return Math.round(clamp(moderateScale(value, width, factor), value * 0.78, value * (metrics.isTablet ? 1.18 : 1.08)));
}

export function getContentMaxWidth(width: number) {
  return getSizeClass(width) === 'tablet' ? 720 : 460;
}

export function getHorizontalPadding(width: number) {
  const metrics = getScreenMetrics({ width, height: width });

  if (metrics.isSmallPhone) {
    return 16;
  }

  if (metrics.isCompactPhone) {
    return 18;
  }

  return metrics.isTablet ? 28 : 20;
}

export function getBottomTabHeight(width: number) {
  const metrics = getScreenMetrics({ width, height: width });

  if (metrics.isSmallPhone) {
    return 68;
  }

  if (metrics.isTablet) {
    return 76;
  }

  return 74;
}

export function getBottomSafeOffset(width: number, insets: EdgeInsets) {
  return Math.max(insets.bottom, responsiveSpacing(10, width));
}

export function getBottomTabSpace(width: number, insets: EdgeInsets, extra = responsiveSpacing(12, width)) {
  return getBottomTabHeight(width) + getBottomSafeOffset(width, insets) + extra;
}

export type ScreenInsetMode = 'default' | 'none' | 'bottom-tab';

export function getScreenLayout(
  { width, height }: WindowSize,
  insets: EdgeInsets,
  options: {
    topInsetMode?: ScreenInsetMode;
    bottomInsetMode?: ScreenInsetMode;
  } = {},
) {
  const metrics = getScreenMetrics({ width, height });
  const topInsetMode = options.topInsetMode ?? 'default';
  const bottomInsetMode = options.bottomInsetMode ?? 'default';
  const pageTopGap = responsiveSpacing(metrics.isTablet ? 18 : 12, width);
  const pageBottomGap = responsiveSpacing(metrics.isTablet ? 28 : 22, width);
  const bottomTabGap = responsiveSpacing(12, width);
  const contentTopPadding = topInsetMode === 'none' ? 0 : insets.top + pageTopGap;
  const contentBottomPadding = bottomInsetMode === 'none'
    ? 0
    : bottomInsetMode === 'bottom-tab'
      ? getBottomTabSpace(width, insets, bottomTabGap)
      : insets.bottom + pageBottomGap;

  return {
    ...metrics,
    contentMaxWidth: getContentMaxWidth(width),
    contentTopPadding,
    contentBottomPadding,
    horizontalPadding: getHorizontalPadding(width),
    pageGap: responsiveSpacing(16, width),
    headerGap: responsiveSpacing(10, width),
    bottomTab: getBottomTabLayout(width, insets),
  };
}

export function getBottomTabLayout(width: number, insets: EdgeInsets) {
  const metrics = getScreenMetrics({ width, height: width });
  const barHeight = getBottomTabHeight(width);
  const bottomInset = getBottomSafeOffset(width, insets);
  const sideMargin = metrics.isTablet ? getHorizontalPadding(width) : getHorizontalPadding(width) - 2;
  const maxWidth = metrics.isTablet ? 720 : 460;

  return {
    barHeight,
    containerHeight: barHeight + bottomInset,
    contentPaddingBottom: getBottomTabSpace(width, insets),
    bottomInset,
    sideMargin,
    maxWidth,
  };
}
