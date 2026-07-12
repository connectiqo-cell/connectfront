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
      style={{ flex: 1, backgroundColor: "#424242" }}
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
