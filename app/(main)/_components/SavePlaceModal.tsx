import {
  HeartIcon,
  HomeIcon,
  SchoolIcon,
  StarIcon,
  TrashIcon,
  WorkIcon,
} from "@/assets/icons";
import { Colors } from "@/constants/theme";
import { usePosition } from "@/contexts/PositionContext";
import { useUser } from "@/contexts/UserContext";
import { createTranslator } from "@/i18n";
import {
  PhotonFeature,
  SearchEngineService,
} from "@/services/SearchEngineService";
import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";

const PlaceIcons = [
  { id: "work", icon: WorkIcon },
  { id: "home", icon: HomeIcon },
  { id: "heart", icon: HeartIcon },
  { id: "star", icon: StarIcon },
  { id: "school", icon: SchoolIcon },
];

export interface SavePlaceModalProps {
  visible: boolean;
  onClose: () => void;
  slot?: "home" | "work" | "other";
  editingIndex?: number | null;
  initialName?: string;
  initialAddress?: string;
  initialLat?: string;
  initialLng?: string;
}

export const SavePlaceModal: React.FC<SavePlaceModalProps> = ({
  visible,
  onClose,
  slot = "other",
  editingIndex = null,
  initialName = "",
  initialAddress = "",
  initialLat = "",
  initialLng = "",
}) => {
  const { t } = createTranslator("search");
  const { position } = usePosition();
  const { saved, setSavedPlace, addOtherPlace, removeOtherPlace } = useUser();
  const lastQueryRef = React.useRef<string | null>(null);

  const [modalPlaceName, setModalPlaceName] = React.useState(initialName);
  const [modalSelectedIcon, setModalSelectedIcon] = React.useState("heart");
  const [addrText, setAddrText] = React.useState(initialAddress);
  const [addrLat, setAddrLat] = React.useState(initialLat);
  const [addrLng, setAddrLng] = React.useState(initialLng);
  const [addrResults, setAddrResults] = React.useState<PhotonFeature[]>([]);

  React.useEffect(() => {
    if (visible) {
      setModalPlaceName(initialName);
      setAddrText(initialAddress);
      setAddrLat(initialLat);
      setAddrLng(initialLng);
      setAddrResults([]);
      lastQueryRef.current = null;
    }
  }, [visible, initialName, initialAddress, initialLat, initialLng]);

  React.useEffect(() => {
    const q = addrText.trim();
    if (!visible || !q || (addrLat && addrLng)) {
      setAddrResults([]);
      return;
    }
    if (lastQueryRef.current === q) return;

    const timer = setTimeout(async () => {
      try {
        const results = await SearchEngineService.photonSearch(q, {
          limit: 5,
          lat: position?.latitude,
          lon: position?.longitude,
        });
        lastQueryRef.current = q;
        setAddrResults(results);
      } catch {
        setAddrResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [addrText, visible, addrLat, addrLng, position]);

  const isEditing =
    visible &&
    ((slot === "home" && !!saved.home) ||
      (slot === "work" && !!saved.work) ||
      (slot === "other" && editingIndex !== null));

  const handleSave = () => {
    if (!addrText || !addrLat || !addrLng) return;
    const place = {
      address: addrText,
      lat: parseFloat(addrLat),
      lng: parseFloat(addrLng),
      name:
        slot === "other"
          ? modalPlaceName
          : slot === "home"
            ? t("card_home")
            : t("card_work"),
      icon: slot === "other" ? modalSelectedIcon : slot,
    };

    if (slot === "home" || slot === "work") {
      setSavedPlace(slot, place);
    } else {
      if (editingIndex !== null) {
        removeOtherPlace(editingIndex);
      }
      addOtherPlace(place);
    }
    onClose();
  };

  const handleDelete = () => {
    if (slot === "home" || slot === "work") {
      setSavedPlace(slot, null);
    } else if (slot === "other" && editingIndex !== null) {
      removeOtherPlace(editingIndex);
    }
    onClose();
  };

  const modalTitle =
    slot === "home"
      ? t("modal_set_home")
      : slot === "work"
        ? t("modal_set_work")
        : t("modal_add_place");

  const canSave = !!(addrText && addrLat && addrLng);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/70 justify-end">
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 80}
              className="bg-[#101922] rounded-t-3xl p-6"
            >
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-white text-xl font-bold">
                  {modalTitle}
                </Text>
                {isEditing && (
                  <TouchableOpacity onPress={handleDelete}>
                    <TrashIcon />
                  </TouchableOpacity>
                )}
              </View>

              <View className="flex-row items-center gap-3">
                {slot === "other" && (
                  <View className="w-12 h-12 rounded-full bg-[#0d7ff2] items-center justify-center">
                    {(() => {
                      const IconComponent =
                        PlaceIcons.find((i) => i.id === modalSelectedIcon)
                          ?.icon || StarIcon;
                      return React.createElement(
                        IconComponent as React.ComponentType<any>,
                        { color: Colors.dark.primary },
                      );
                    })()}
                  </View>
                )}
                <TextInput
                  placeholder={t("modal_name_placeholder")}
                  placeholderTextColor="#90adcb"
                  className="flex-1 text-white text-[16px] bg-[#12202a] h-12 rounded-lg px-4"
                  value={modalPlaceName}
                  onChangeText={setModalPlaceName}
                />
              </View>

              {slot === "other" && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mt-4 px-1"
                  contentContainerClassName="px-[10px]"
                >
                  {PlaceIcons.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setModalSelectedIcon(item.id)}
                      className="w-12 h-12 rounded-full bg-[#0d7ff2] items-center justify-center mr-3"
                    >
                      <item.icon
                        color={
                          modalSelectedIcon === item.id ? "#fff" : "#90adcb"
                        }
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View className="bg-[#12202a] rounded-lg mt-6 h-14">
                <TextInput
                  placeholder={t("modal_addr_placeholder")}
                  placeholderTextColor="#90adcb"
                  className="flex-1 text-white text-[16px] px-4"
                  value={addrText}
                  onChangeText={(txt) => {
                    setAddrText(txt);
                    setAddrLat("");
                    setAddrLng("");
                  }}
                />
              </View>

              <ScrollView className="max-h-[200px]">
                {addrResults.map((r, idx) => {
                  const label =
                    r.properties.name ||
                    [r.properties.housenumber, r.properties.street]
                      .filter(Boolean)
                      .join(" ") ||
                    r.properties.city ||
                    "";
                  return (
                    <TouchableOpacity
                      key={idx}
                      className="px-4 py-3 border-b border-[#2e3a4c]"
                      onPress={() => {
                        setAddrText(label);
                        setAddrLat(r.geometry.coordinates[1].toString());
                        setAddrLng(r.geometry.coordinates[0].toString());
                        setAddrResults([]);
                      }}
                    >
                      <Text className="text-white font-bold">{label}</Text>
                      <Text className="text-[#90adcb] text-[12px]">
                        {r.properties.city}, {r.properties.country}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                className={`bg-${canSave ? "primary" : "gray-600"} h-14 rounded-full items-center justify-center mt-6`}
                onPress={handleSave}
                disabled={!canSave}
              >
                <Text className="text-white text-[18px] font-bold">
                  {t("modal_save")}
                </Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
export default SavePlaceModal;
