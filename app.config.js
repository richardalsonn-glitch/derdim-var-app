const staticConfig = require('./app.json');

const profile = process.env.EAS_BUILD_PROFILE ?? '';
const isDevelopmentBuild = profile === 'development';
const livekitFlag = process.env.EXPO_PUBLIC_ENABLE_LIVEKIT ?? '';
const isLiveKitEnabled = livekitFlag.trim().toLowerCase() === 'true';

const baseExpoConfig = staticConfig.expo;
const baseAndroidPermissions = baseExpoConfig.android?.permissions ?? [];
const basePlugins = baseExpoConfig.plugins ?? [];

const androidPermissions = isDevelopmentBuild
  ? Array.from(new Set([...baseAndroidPermissions, 'android.permission.SYSTEM_ALERT_WINDOW']))
  : baseAndroidPermissions;

const plugins = isDevelopmentBuild
  ? [...basePlugins, 'expo-dev-client']
  : basePlugins;
const filteredPlugins = plugins.filter((plugin) => {
  const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;

  if (isLiveKitEnabled) {
    return true;
  }

  return pluginName !== '@livekit/react-native-expo-plugin' && pluginName !== '@config-plugins/react-native-webrtc';
});

module.exports = {
  expo: {
    ...baseExpoConfig,
    android: {
      ...baseExpoConfig.android,
      permissions: androidPermissions,
    },
    plugins: filteredPlugins,
  },
};
