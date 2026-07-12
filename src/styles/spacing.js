import { useMemo } from "react";
import { PixelRatio, Dimensions, Platform } from "react-native";
import { RFValue } from "react-native-responsive-fontsize";
import { IOS_UI_SCALE } from "../utils/iosUiScale";

let screenWidth = Dimensions.get("screen").width;
let screenHeight = Dimensions.get("screen").height;

export const STANDERD_DESIGN_HEIGHT_WIDTH = { HEIGHT: 640, WIDTH: 360 };

export const useStandardHeight = (height) => {
  let heightOfSceen = screenHeight;
  const elemHeight = typeof height === "number" ? height : parseFloat(height);

  return useMemo(
    () =>
      PixelRatio.roundToNearestPixel(
        (heightOfSceen * elemHeight) / STANDERD_DESIGN_HEIGHT_WIDTH.HEIGHT
      ),
    []
  );
};

export const useStandardWidth = (width) => {
  let widthOfSceen = screenWidth;
  const elemWidth = typeof width === "number" ? width : parseFloat(width);
  return useMemo(
    () =>
      PixelRatio.roundToNearestPixel(
        (widthOfSceen * elemWidth) / STANDERD_DESIGN_HEIGHT_WIDTH.WIDTH
      ),
    []
  );
};

export const convertRFValue = (fontSize) => {
  const scaled = RFValue(fontSize, STANDERD_DESIGN_HEIGHT_WIDTH.HEIGHT);
  if (Platform.OS === 'ios') {
    return PixelRatio.roundToNearestPixel(scaled * IOS_UI_SCALE);
  }
  return scaled;
};
