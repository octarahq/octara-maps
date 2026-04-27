import { WarningMessage } from "@/components/WarningMessage";
import { useUser } from "@/contexts/UserContext";
import { createTranslator } from "@/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Slot, usePathname, useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { usePermissions } from "../../contexts/PermissionsContext";
import OnboardingButton from "./_components/button";
import PageIndicators from "./_components/page-indicators";

const ROUTES = ["step1", "step2", "step3", "step4", "step5"] as const;
const STORAGE_KEY = "hasOnboarded";

function InnerLayout() {
  const router = useRouter();
  const pathname = usePathname();

  const currentIndex = ROUTES.findIndex((route) => pathname.includes(route));
  const validIndex = currentIndex === -1 ? 0 : currentIndex;

  const { permissions, warning, showWarning, hideWarning, locationAccuracy } =
    usePermissions();
  const { name, setHasFinishedOnboarding } = useUser();
  const [lastWarning, setLastWarning] = React.useState(warning);
  const { t } = createTranslator("onboarding");

  React.useEffect(() => {
    if (warning) {
      setLastWarning(warning);
    }
  }, [warning]);

  const goNext = async () => {
    if (validIndex === 2) {
      if (!name) {
        showWarning({
          iconName: "warning",
          title: t("step3_required_title"),
          description: t("step3_required"),
          buttons: [
            {
              label: t("dismiss"),
              action: hideWarning,
            },
          ],
        });
        return;
      }
    }

    if (validIndex === 3) {
      if (permissions.location && locationAccuracy === "low") {
        showWarning({
          iconName: "warning",
          title: t("step4.warning_accuracy_title"),
          description: t("step4.warning_accuracy_description"),
          buttons: [
            {
              label: t("dismiss"),
              action: hideWarning,
            },
            {
              label: t("continue"),
              action: () => {
                hideWarning();
                router.push(`/(onboarding)/${ROUTES[validIndex + 1]}`);
              },
            },
          ],
        });
        return;
      }
    }

    if (validIndex === ROUTES.length - 1) {
      if (!permissions.location) {
        showWarning({
          iconName: "warning",
          title: t("step4.warning_missing_title"),
          description: t("step4.warning_missing"),
          buttons: [
            {
              label: t("dismiss"),
              action: hideWarning,
            },
            {
              label: t("next"),
              action: async () => {
                hideWarning();
                try {
                  await AsyncStorage.setItem(STORAGE_KEY, "true");
                } catch {}
                router.replace("/");
              },
            },
          ],
        });
        return;
      }
      const all = Object.values(permissions).every(Boolean);
      if (!all) {
        showWarning({
          iconName: "warning",
          title: t("step4.warning_partial_title"),
          description: t("step4.warning_partial"),
          buttons: [
            {
              label: t("dismiss"),
              action: hideWarning,
            },
            {
              label: t("next"),
              action: async () => {
                hideWarning();
                try {
                  await AsyncStorage.setItem(STORAGE_KEY, "true");
                } catch {}
                router.replace("/");
              },
            },
          ],
        });
        return;
      }
    }

    if (validIndex < ROUTES.length - 1) {
      router.push(`/(onboarding)/${ROUTES[validIndex + 1]}`);
    } else {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, "true");
        setHasFinishedOnboarding(true);
      } catch {}
      router.replace("/");
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-[#101922]">
        <Slot />
        <View className="absolute bottom-0 left-0 right-0 w-full px-6 pb-4 bg-transparent z-10">
          <PageIndicators total={ROUTES.length} current={validIndex} />
          <OnboardingButton
            title={
              validIndex === ROUTES.length - 1 ? t("get_started") : t("next")
            }
            onPress={goNext}
            disabled={validIndex === 2 && !name}
          />
        </View>

        {lastWarning && (
          <WarningMessage
            visible={!!warning}
            iconName={lastWarning.iconName}
            title={lastWarning.title}
            description={lastWarning.description}
            buttons={lastWarning.buttons}
            onDismiss={hideWarning}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

export default function OnboardingLayout() {
  return <InnerLayout />;
}
