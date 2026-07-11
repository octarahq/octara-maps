import React from "react";
import Svg, { Path } from "react-native-svg";

const StreetViewIcon = ({ color = "#e3e3e3", size = 24 }) => (
  <Svg height={size} viewBox="0 -960 960 960" width={size} fill={color}>
    <Path
      fill={color}
      d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm-60 360v-200H280v-80h400v80H540v200h-120Z"
    />
  </Svg>
);

export default StreetViewIcon;
