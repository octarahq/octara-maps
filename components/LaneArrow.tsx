import React from "react";
import Svg, { Path } from "react-native-svg";

interface LaneArrowProps {
  indications: string[];
  valid: boolean;
  color?: string;
  invalidColor?: string;
}

export default function LaneArrow({
  indications,
  valid,
  color = "#ffffff",
  invalidColor = "#555555",
}: LaneArrowProps) {
  const fillColor = valid ? color : invalidColor;

  const hasStraight =
    indications.includes("straight") || indications.includes("none");
  const hasLeft =
    indications.includes("left") ||
    indications.includes("slight left") ||
    indications.includes("sharp left");
  const hasRight =
    indications.includes("right") ||
    indications.includes("slight right") ||
    indications.includes("sharp right");
  const hasUturn = indications.includes("uturn");

  const paths: React.ReactNode[] = [];

  paths.push(
    <Path key="shaft" d="M10 22 L 10 14 L 14 14 L 14 22 Z" fill={fillColor} />,
  );

  if (hasStraight) {
    paths.push(
      <Path
        key="straight"
        d="M12 2 L 6 9 L 10 9 L 10 14 L 14 14 L 14 9 L 18 9 Z"
        fill={fillColor}
      />,
    );
  }

  if (hasLeft) {
    paths.push(
      <Path
        key="left"
        d="M14 14 L 10 14 C 10 10, 8 8, 4 8 L 4 12 L 0 6 L 4 0 L 4 4 C 10 4, 14 8, 14 14 Z"
        fill={fillColor}
      />,
    );
  }

  if (hasRight) {
    paths.push(
      <Path
        key="right"
        d="M10 14 L 14 14 C 14 10, 16 8, 20 8 L 20 12 L 24 6 L 20 0 L 20 4 C 14 4, 10 8, 10 14 Z"
        fill={fillColor}
      />,
    );
  }

  if (hasUturn) {
    paths.push(
      <Path
        key="uturn"
        d="M14 14 L 10 14 C 10 8, 4 8, 4 14 L 8 14 L 2 22 L -4 14 L 0 14 C 0 4, 14 4, 14 14 Z"
        fill={fillColor}
      />,
    );
  }

  return (
    <Svg width="24" height="24" viewBox="-2 -2 28 28">
      {paths}
    </Svg>
  );
}
