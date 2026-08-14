import { CoffeeIcon, FoodIcon, GasIcon, ParkingIcon } from "@/assets/icons";
import { Sidebar } from "@/components/layout/Sidebar";
import MapProvider from "@/components/map";
import { usePosition } from "@/contexts/PositionContext";
import { createTranslator } from "@/i18n";
import {
  calculateDistance,
  clearActiveNavigation,
  getActiveNavigation,
  type ActiveNavigationParams,
} from "@/utils/activeNavigation";
import { snapPointsPercent } from "@/utils/snapPoints";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import React from "react";
import {
  Modal,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import MapOverlay from "./_components/MapOverlay";

export default function MainScreen() {
  const { t } = createTranslator("main");
  const { height: screenHeight } = useWindowDimensions();
  const sheetRef = React.useRef<BottomSheet>(null);
  const snapPoints = React.useMemo(
    () => snapPointsPercent([180], screenHeight),
    [screenHeight],
  );
  const [blockMap, setBlockMap] = React.useState(false);
  const [isSidebarVisible, setSidebarVisible] = React.useState(false);
  const pos = usePosition();
  const hasCheckedNavigationRef = React.useRef(false);
  const [resumeNavData, setResumeNavData] =
    React.useState<ActiveNavigationParams | null>(null);

  React.useEffect(() => {
    async function checkActiveNavigation() {
      if (!pos?.position || hasCheckedNavigationRef.current) return;
      hasCheckedNavigationRef.current = true;
      const activeNav = await getActiveNavigation();
      if (activeNav) {
        const destLat = parseFloat(activeNav.lat);
        const destLng = parseFloat(activeNav.lng);
        const distance = calculateDistance(
          pos.position.latitude,
          pos.position.longitude,
          destLat,
          destLng,
        );

        if (distance > 1000) {
          setResumeNavData(activeNav);
        } else {
          await clearActiveNavigation();
        }
      }
    }
    checkActiveNavigation();
  }, [pos?.position]);

  const handleResumeNav = (accept: boolean) => {
    if (accept && resumeNavData) {
      const data = resumeNavData;
      setResumeNavData(null);
      setTimeout(() => {
        router.push({
          pathname: "/navigate/standard",
          params: {
            lat: data.lat,
            lng: data.lng,
            mode: data.mode,
            name: data.name,
            multi: data.multi,
          },
        });
      }, 100);
    } else {
      setResumeNavData(null);
      clearActiveNavigation();
    }
  };

  return (
    <MapProvider
      style={{ flex: 1 }}
      allowedLayers="all"
      options={{ enableLongPress: true }}
    >
      <View className="flex-1 bg-transparent" pointerEvents="box-none">
        <StatusBar
          hidden
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />
        <MapOverlay
          blockMap={blockMap}
          onAvatarPress={() => setSidebarVisible(true)}
        />
        <Sidebar
          isVisible={isSidebarVisible}
          onClose={() => setSidebarVisible(false)}
        />
        <BottomSheet
          ref={sheetRef}
          snapPoints={snapPoints}
          index={0}
          enablePanDownToClose={false}
          backgroundStyle={{ backgroundColor: "rgba(16,25,34,0.96)" }}
          handleIndicatorStyle={{
            backgroundColor: "rgba(255,255,255,0.3)",
          }}
          onChange={(index) => {
            setBlockMap(index > 0);
          }}
        >
          <BottomSheetView className="p-4 items-start">
            <Text className="text-white text-[18px] font-bold mb-5">
              {pos?.position?.city
                ? t("sheet.exploreCity", { city: pos.position.city })
                : t("sheet.exploreArea")}
            </Text>
            <View className="flex-row w-full justify-between">
              {[
                { icon: <GasIcon />, label: t("items.gas"), amenity: "fuel" },
                {
                  icon: <FoodIcon />,
                  label: t("items.food"),
                  amenity: "restaurant|fast_food|cafe",
                },
                {
                  icon: <CoffeeIcon />,
                  label: t("items.coffee"),
                  amenity: "cafe",
                },
                {
                  icon: <ParkingIcon />,
                  label: t("items.parking"),
                  amenity: "parking",
                },
              ].map((c) => (
                <TouchableOpacity
                  key={c.label}
                  className="items-center w-[22%]"
                  onPress={() => {
                    router.push({
                      pathname: "/(main)/poiresult",
                      params: { amenity: c.amenity, title: c.label },
                    });
                  }}
                >
                  <View className="w-14 h-14 rounded-[16px] bg-white/[0.04] border border-white/[0.08] items-center justify-center">
                    {c.icon}
                  </View>
                  <Text
                    className="text-white/60 text-[12px] mt-1.5"
                    numberOfLines={1}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </BottomSheetView>
        </BottomSheet>

        <Modal
          visible={resumeNavData !== null}
          transparent
          animationType="fade"
          onRequestClose={() => handleResumeNav(false)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center p-6">
            <View className="bg-[#101922] w-full rounded-2xl border border-white/10 p-5 shadow-lg">
              <Text className="text-white text-lg font-bold mb-2">
                {t("resumeNavigation.title", {
                  defaultValue: "Reprendre la navigation ?",
                })}
              </Text>
              <Text className="text-[#90adcb] text-base mb-6">
                {t("resumeNavigation.message", {
                  defaultValue: `Voulez-vous reprendre la navigation vers ${resumeNavData?.name} ?`,
                })}
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 py-3 items-center justify-center rounded-xl bg-white/10"
                  onPress={() => handleResumeNav(false)}
                >
                  <Text className="text-white font-semibold">
                    {t("resumeNavigation.cancel", { defaultValue: "Non" })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 py-3 items-center justify-center rounded-xl bg-primary"
                  onPress={() => handleResumeNav(true)}
                >
                  <Text className="text-white font-semibold">
                    {t("resumeNavigation.confirm", { defaultValue: "Oui" })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </MapProvider>
  );
}
