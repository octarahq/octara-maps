import { cssInterop } from "nativewind";
import Svg, { Path, Rect, Circle, G, Polygon, Polyline, Line } from "react-native-svg";

cssInterop(Svg, {
  className: {
    target: "style",
    nativeStyleToProp: {
      width: true,
      height: true,
    },
  },
});

cssInterop(Path, { className: "style", nativeStyleToProp: { fill: true, stroke: true } });
cssInterop(Rect, { className: "style", nativeStyleToProp: { fill: true, stroke: true } });
cssInterop(Circle, { className: "style", nativeStyleToProp: { fill: true, stroke: true } });
cssInterop(G, { className: "style" });
cssInterop(Polygon, { className: "style" });
cssInterop(Polyline, { className: "style" });
cssInterop(Line, { className: "style" });
