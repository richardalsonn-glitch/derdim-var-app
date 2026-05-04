const staticConfig = require('./app.json');

const profile = process.env.EAS_BUILD_PROFILE ?? '';
const isDevelopmentBuild = profile === 'development';

const baseExpoConfig = staticConfig.expo;
const baseAndroidPermissions = baseExpoConfig.android?.permissions ?? [];
const basePlugins = baseExpoConfig.plugins ?? [];

const androidPermissions = isDevelopmentBuild
  ? Array.from(new Set([...baseAndroidPermissions, 'android.permission.SYSTEM_ALERT_WINDOW']))
  : baseAndroidPermissions;

const plugins = isDevelopmentBuild
  ? [...basePlugins, 'expo-dev-client']
  : basePlugins;

module.exports = {
  expo: {
    ...baseExpoConfig,
    android: {
      ...baseExpoConfig.android,
      permissions: androidPermissions,
    },
    plugins,
  },
};
