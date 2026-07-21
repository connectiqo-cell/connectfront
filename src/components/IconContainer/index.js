import colors from "../../styles/colors";
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
  children,
  style,
  isDropDown,
}) => {
  return isDropDown ? (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: colors.sheet,
        backgroundColor: backgroundColor,
        ...style,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        hitSlop={HIT_SLOP}
        style={{ ...buttonStyle }}
      >
        {children ?? (Icon ? <Icon width={26} height={26} /> : null)}
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
      {children ?? (Icon ? <Icon /> : null)}
    </TouchableOpacity>
  );
};
export default IconContainer;
