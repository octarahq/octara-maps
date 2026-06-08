import { cssInterop } from "nativewind";
import Svg, { Path, Rect, Circle, G, Polygon, Polyline, Line } from "react-native-svg";

cssInterop(Svg, { className: "style" });
cssInterop(Path as any, { className: "style" } as any);
cssInterop(Rect as any, { className: "style" } as any);
cssInterop(Circle as any, { className: "style" } as any);
cssInterop(G as any, { className: "style" } as any);
cssInterop(Polygon as any, { className: "style" } as any);
cssInterop(Polyline as any, { className: "style" } as any);
cssInterop(Line as any, { className: "style" } as any);
