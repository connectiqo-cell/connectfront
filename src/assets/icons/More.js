import * as React from "react";
import Svg, { G, Circle } from "react-native-svg";

function More({ fill = "#FFF", ...props }) {
  return (
    <Svg width={20} height={6} viewBox="0 0 16 4" {...props}>
      <G fill={fill}>
        <Circle cx={2} cy={2} r={2} />
        <Circle cx={8} cy={2} r={2} />
        <Circle cx={14} cy={2} r={2} />
      </G>
    </Svg>
  );
}

export default More;
