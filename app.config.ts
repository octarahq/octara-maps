import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const isPreview =
    process.env.APP_VARIANT === "preview" ||
    process.env.EAS_BUILD_PROFILE === "preview";

  return {
    ...config,
    name: isPreview ? "Octara Maps" : "Octara Maps Test",
    ios: {
      ...config.ios,
      bundleIdentifier: isPreview
        ? "com.octarahq.octaramaps"
        : "com.octarahq.octaramapstest",
    },
    android: {
      ...config.android,
      package: isPreview
        ? "com.octarahq.octaramaps"
        : "com.octarahq.octaramapstest",
    },
  } as ExpoConfig;
};
