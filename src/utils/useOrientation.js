import { useEffect, useLayoutEffect, useState } from "react";
import { Dimensions } from "react-native";
import Orientation from "react-native-orientation-locker";

/**
 * Returns true if the screen is in portrait mode
 */
const isPortrait = () => {
  const dim = Dimensions.get("screen");
  return dim.height >= dim.width;
};

/**
 * A React Hook which updates when the orientation changes
 * @returns whether the user is in 'PORTRAIT' or 'LANDSCAPE'
 */
export function useOrientation() {
  // State to hold the connection status
  const [orientation, setOrientation] = useState(
    isPortrait() ? "PORTRAIT" : "LANDSCAPE"
  );

  useLayoutEffect(() => {
    const callback = () =>
      setOrientation(isPortrait() ? "PORTRAIT" : "LANDSCAPE");

    const subscription = Dimensions.addEventListener("change", callback);

    return () => {
      subscription.remove();
    };
  }, []);

  return orientation;
}

/**
 * Allows the device to rotate while this screen is mounted, and restores the
 * app-wide portrait lock on unmount. Only the in-call screens have landscape
 * layouts; every other screen is portrait-designed, so rotating them produces
 * the stretched, crowded UI Apple rejects under Guideline 4.
 */
export function useAllowRotation() {
  useEffect(() => {
    Orientation.unlockAllOrientations();
    return () => Orientation.lockToPortrait();
  }, []);
}
