import React from "react";
import { TouchableOpacity, View } from "react-native";
import { DownArrow } from "../../assets/icons";

const buttonStyle = {
  height: 50,
  aspectRatio: 1,
  justifyContent: "center",
  alignItems: "center",
};
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

const IconContainer = ({
  backgroundColor,
  onPress,
  onDropDownPress,
  Icon,
  style,
  isDropDown,
}) => {
  return isDropDown ? (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: "#2B3034",
        backgroundColor: backgroundColor,
        ...style,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        hitSlop={HIT_SLOP}
        style={{ ...buttonStyle }}
      >
        <Icon width={26} height={26} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDropDownPress}
        hitSlop={HIT_SLOP}
        style={{
          marginLeft: 0,
          marginRight: 10,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <DownArrow />
      </TouchableOpacity>
    </View>
  ) : (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={HIT_SLOP}
      style={{
        backgroundColor: backgroundColor ? backgroundColor : "transparent",
        ...buttonStyle,
        borderRadius: 14,
        ...style,
      }}
    >
      <Icon />
    </TouchableOpacity>
  );
};
export default IconContainer;
