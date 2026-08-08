import React from "react";
import { RTCView } from "@videosdk.live/react-native-sdk";
import Avatar from "../../../../components/Avatar";
import colors from "../../../../styles/colors";
import { useRtcStreamUrl } from "../../../../hooks/useRtcStreamUrl";

export default LargeVideoRTCView = ({
  stream,
  displayName,
  isOn,
  objectFit,
  isLocal,
}) => {
  const streamURL = useRtcStreamUrl(stream);

  return isOn && streamURL ? (
    <RTCView
      objectFit={objectFit}
      mirror={isLocal}
      // Native video layer swallows taps on iOS unless disabled —
      // parent Pressable / Touchable must receive the gesture.
      pointerEvents="none"
      style={{ flex: 1, backgroundColor: colors.primary[700] }}
      streamURL={streamURL}
    />
  ) : (
    <Avatar
      containerBackgroundColor={colors.primary[800]}
      fullName={displayName}
      fontSize={26}
      style={{
        backgroundColor: colors.primary[700],
        height: 70,
        aspectRatio: 1,
        borderRadius: 40,
      }}
    />
  );
};
