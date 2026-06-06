import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React from "react";
import {
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Item<T = string> = {
  key: string;
  label: string;
  value: T;
};

type Mode = "single" | "multiple";

export type BottomSelectHandle = {
  open: () => void;
  close: () => void;
};

type Props<T = string> = {
  title?: string;
  items: Item<T>[];
  mode?: Mode;
  initialSelected?: T[] | T | null;
  onChange?: (selected: T[] | T | null) => void;
  backgroundColor?: string;
};

function BottomSelectInner<T = string>(
  {
    title,
    items,
    mode = "single",
    initialSelected = null,
    onChange,
    backgroundColor = "rgba(16,25,34,0.96)",
  }: Props<T>,
  ref: React.ForwardedRef<BottomSelectHandle>,
) {
  const sheetRef = React.useRef<BottomSheet>(null);
  const snapPoints = React.useMemo(() => [240], []);

  const normalizeInitial = React.useMemo(() => {
    if (mode === "multiple") {
      return Array.isArray(initialSelected)
        ? (initialSelected as T[])
        : initialSelected === null
          ? ([] as T[])
          : ([initialSelected as T] as T[]);
    }
    return Array.isArray(initialSelected)
      ? (initialSelected[0] as T | null)
      : (initialSelected as T | null);
  }, [initialSelected, mode]);

  const [selected, setSelected] = React.useState<T[] | T | null>(
    normalizeInitial,
  );

  React.useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.expand(),
    close: () => sheetRef.current?.close(),
  }));

  React.useEffect(() => {
    setSelected(normalizeInitial);
  }, [normalizeInitial]);

  const toggleMultiple = (value: T) => {
    if (!Array.isArray(selected)) return;
    const exists = selected.includes(value);
    const next = exists
      ? selected.filter((v: T) => v !== value)
      : [...selected, value];
    setSelected(next);
    onChange?.(next);
  };

  const selectSingle = (value: T) => {
    const next = value === selected ? null : value;
    setSelected(next);
    onChange?.(next);
  };

  const renderBackdrop = React.useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.7}
      />
    ),
    [],
  );

  const renderItem = ({ item }: { item: Item<T> }) => {
    const isSelected =
      mode === "multiple"
        ? Array.isArray(selected) && selected.includes(item.value)
        : selected === item.value;

    return (
      <TouchableOpacity
        className="flex-row items-center justify-between py-3"
        onPress={() => {
          if (mode === "multiple") toggleMultiple(item.value);
          else selectSingle(item.value);
        }}
      >
        <View className="flex-1">
          <Text className="text-white/90 text-[15px]">{item.label}</Text>
        </View>

        <View className="w-9 items-center justify-center">
          {mode === "multiple" ? (
            <View className={`w-[18px] h-[18px] rounded border ${isSelected ? "bg-[#1EA7FF] border-[#1EA7FF]" : "bg-transparent border-white/30"}`} />
          ) : (
            <View className={`w-[18px] h-[18px] rounded-full border items-center justify-center ${isSelected ? "border-[#1EA7FF]" : "border-white/30"}`} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.3)" }}
    >
      <BottomSheetView className="p-4">
        {title ? <Text className="text-white text-base font-bold mb-3">{title}</Text> : null}

        <FlatList
          data={items}
          keyExtractor={(i) => i.key}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View className="h-[1px] bg-white/[0.03]" />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </BottomSheetView>
    </BottomSheet>
  );
}

const BottomSelect = React.forwardRef(BottomSelectInner);
BottomSelect.displayName = "BottomSelect";


export default BottomSelect;
