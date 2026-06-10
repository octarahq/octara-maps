import { createTranslator } from "@/i18n";
import * as Application from "expo-application";
import Constants from "expo-constants";
import {
  cacheDirectory,
  createDownloadResumable,
  documentDirectory,
  getContentUriAsync,
} from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform, ToastAndroid } from "react-native";

const GITHUB_API_URL =
  "https://api.github.com/repos/octarahq/octara-maps/releases/latest";

const FLAG_ACTIVITY_NEW_TASK = 0x10000000;
const FLAG_GRANT_READ_URI_PERMISSION = 0x00000001;
const { t } = createTranslator("navigate");

const openUnknownAppSourcesSettings = async (packageName: string) => {
  await IntentLauncher.startActivityAsync(
    "android.settings.MANAGE_UNKNOWN_APP_SOURCES",
    {
      data: `package:${packageName}`,
      flags: FLAG_ACTIVITY_NEW_TASK,
    },
  );
};

export interface ReleaseInfo {
  tag_name: string;
  name: string;
  body: string;
  prerelease: boolean;
  assets: {
    name: string;
    browser_download_url: string;
    content_type: string;
  }[];
}

export interface UpdateInfo {
  isUpdateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseInfo?: ReleaseInfo;
}

const getCurrentVersion = (): string => {
  try {
    return Constants.expoConfig?.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
};

const parseVersion = (version: string): number[] => {
  return version
    .split(".")
    .map((v) => {
      const match = v.match(/^\d+/);
      return match ? parseInt(match[0], 10) : 0;
    })
    .slice(0, 3);
};

export const compareVersions = (
  current: string,
  latest: string,
): "update" | "same" | "downgrade" => {
  const curr = parseVersion(current);
  const lat = parseVersion(latest);

  for (let i = 0; i < Math.max(curr.length, lat.length); i++) {
    const c = curr[i] || 0;
    const l = lat[i] || 0;

    if (l > c) return "update";
    if (l < c) return "downgrade";
  }

  return "same";
};

export const checkForUpdates = async (joinBetaProgram?: boolean): Promise<UpdateInfo> => {
  const currentVersion = getCurrentVersion();

  try {
    const url = joinBetaProgram
      ? "https://api.github.com/repos/octarahq/octara-maps/releases"
      : GITHUB_API_URL;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      return {
        isUpdateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
      };
    }

    const data = await response.json();
    const releaseInfo: ReleaseInfo = joinBetaProgram ? data[0] : data;

    if (!releaseInfo) {
      return {
        isUpdateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
      };
    }

    const latestVersion = releaseInfo.tag_name.replace(/^beta-|^v/i, "");

    const comparison = compareVersions(currentVersion, latestVersion);
    const isUpdateAvailable = comparison === "update";

    return {
      isUpdateAvailable,
      currentVersion,
      latestVersion,
      releaseInfo: isUpdateAvailable ? releaseInfo : undefined,
    };
  } catch {
    return {
      isUpdateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
    };
  }
};

export const downloadAndInstallAPK = async (
  downloadUrl: string,
  onProgress?: (progress: number) => void,
): Promise<void> => {
  const runtimePackageName =
    Application.applicationId || Constants.expoConfig?.android?.package || "";
  const isExpoGoRuntime = runtimePackageName === "host.exp.exponent";

  if (Platform.OS !== "android") {
    throw new Error("APK installation is only supported on Android");
  }

  try {
    const filenameFromUrl = downloadUrl.split("/").pop() || "app.apk";
    const filenameWithoutQuery = filenameFromUrl.split("?")[0] || "app.apk";
    const filename = filenameWithoutQuery.toLowerCase().endsWith(".apk")
      ? filenameWithoutQuery
      : `${filenameWithoutQuery}.apk`;

    let cacheDir = cacheDirectory || documentDirectory || "";

    if (!cacheDir || cacheDir === "undefined" || cacheDir === "null") {
      cacheDir = documentDirectory || "";
    }

    const basePath = cacheDir.endsWith("/") ? cacheDir : cacheDir + "/";
    const downloadPath = `${basePath}${filename}`;

    const downloadResumable = createDownloadResumable(
      downloadUrl,
      downloadPath,
      {},
      (downloadProgress) => {
        if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
          const prog =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          onProgress(prog);
        }
      },
    );

    const downloadResult = await downloadResumable.downloadAsync();

    if (!downloadResult) {
      throw new Error("Download failed: no result returned");
    }

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }

    const fileUri = downloadResult.uri || downloadPath;
    onProgress?.(1);

    const contentUri = await getContentUriAsync(fileUri);

    const installFlags =
      FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION;

    if (isExpoGoRuntime) {
      ToastAndroid.show(
        t("update.installUnknownAppsPermission"),
        ToastAndroid.LONG,
      );
      await openUnknownAppSourcesSettings(runtimePackageName);
      throw new Error(
        "Enable Install unknown apps, then retry update install.",
      );
    }

    try {
      await IntentLauncher.startActivityAsync(
        "android.intent.action.INSTALL_PACKAGE",
        {
          data: contentUri,
          flags: installFlags,
          type: "application/vnd.android.package-archive",
        },
      );

      return;
    } catch {
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: installFlags,
        type: "application/vnd.android.package-archive",
      });

      if (runtimePackageName) {
        await openUnknownAppSourcesSettings(runtimePackageName);
      }
    }
  } catch (error) {
    throw error;
  }
};
