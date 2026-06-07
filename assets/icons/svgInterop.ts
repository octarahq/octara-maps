import { cssInterop } from "nativewind";
import Svg, { Path, Rect, Circle, G, Polygon, Polyline, Line } from "react-native-svg";

cssInterop(Svg, { className: "style" });
cssInterop(Path, { className: "style" });
cssInterop(Rect, { className: "style" });
cssInterop(Circle, { className: "style" });
cssInterop(G, { className: "style" });
cssInterop(Polygon, { className: "style" });
cssInterop(Polyline, { className: "style" });
cssInterop(Line, { className: "style" });
