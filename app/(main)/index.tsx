import { CoffeeIcon, FoodIcon, GasIcon, ParkingIcon } from "@/assets/icons";
import { Sidebar } from "@/components/layout/Sidebar";
import MapProvider from "@/components/map";
import { usePosition } from "@/contexts/PositionContext";
import { createTranslator } from "@/i18n";
import { showCommingSoonToast } from "@/utils/commingSoonToast";
import { snapPointsPercent } from "@/utils/snapPoints";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import React from "react";
import {
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

  React.useEffect(() => {
    /* telemetry removed */;
  }, []);

  return (
    <MapProvider style={{ flex: 1 }}>
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
              <TouchableOpacity
                className="items-center w-[22%]"
                onPress={() => {
                  /* telemetry removed */;
                  showCommingSoonToast();
                }}
              >
                <View className="w-14 h-14 rounded-[16px] bg-white/[0.04] border border-white/[0.08] items-center justify-center">
                  <GasIcon />
                </View>

                <Text className="text-white/60 text-[12px] mt-1.5">
                  {t("items.gas")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="items-center w-[22%]"
                onPress={() => {
                  /* telemetry removed */;
                  showCommingSoonToast();
                }}
              >
                <View className="w-14 h-14 rounded-[16px] bg-white/[0.04] border border-white/[0.08] items-center justify-center">
                  <FoodIcon />
                </View>

                <Text className="text-white/60 text-[12px] mt-1.5">
                  {t("items.food")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="items-center w-[22%]"
                onPress={() => {
                  /* telemetry removed */;
                  showCommingSoonToast();
                }}
              >
                <View className="w-14 h-14 rounded-[16px] bg-white/[0.04] border border-white/[0.08] items-center justify-center">
                  <CoffeeIcon />
                </View>

                <Text className="text-white/60 text-[12px] mt-1.5">
                  {t("items.coffee")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="items-center w-[22%]"
                onPress={() => {
                  /* telemetry removed */;
                  showCommingSoonToast();
                }}
              >
                <View className="w-14 h-14 rounded-[16px] bg-white/[0.04] border border-white/[0.08] items-center justify-center">
                  <ParkingIcon />
                </View>

                <Text className="text-white/60 text-[12px] mt-1.5">
                  {t("items.parking")}
                </Text>
              </TouchableOpacity>
            </View>
          </BottomSheetView>
        </BottomSheet>
      </View>
    </MapProvider>
  );
}
