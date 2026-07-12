import { RTCView } from "@videosdk.live/react-native-sdk";
import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useRtcStreamUrl } from "../../../../hooks/useRtcStreamUrl";
import { NetworkIcon } from "../../../../assets/icons";
import Avatar from "../../../../components/Avatar";
import colors from "../../../../styles/colors";

const buttonStyle = {
  alignItems: "center",
  position: "absolute",
  top: 10,
  padding: 8,
  height: 26,
  aspectRatio: 1,
  borderRadius: 12,
  justifyContent: "center",
  left: 10,
};

export default MiniVideoRTCView = ({
  stream,
  isOn,
  displayName,
  isLocal,
  openStatsBottomSheet,
  micOn,
  score,
  participantId,
  onSwapPress,
  height = 160,
}) => {
  const streamURL = useRtcStreamUrl(stream);

  const content = (
    <>
      {isOn && streamURL ? (
        <RTCView
          objectFit="cover"
          zOrder={1}
          mirror={isLocal}
          style={{ flex: 1, backgroundColor: "#424242" }}
          streamURL={streamURL}
        />
      ) : (
        <Avatar
          fullName={displayName}
          containerBackgroundColor={colors.primary[600]}
          fontSize={24}
          style={{
            backgroundColor: colors.primary[500],
            height: 60,
            aspectRatio: 1,
            borderRadius: 40,
          }}
        />
      )}
      {micOn || isOn ? (
        <TouchableOpacity
          style={{
            ...buttonStyle,
            backgroundColor:
              score && score > 7
                ? "#3BA55D"
                : score > 4
                ? "#faa713"
                : "#FF5D5D",
          }}
          onPress={() => {
            openStatsBottomSheet({ pId: participantId });
          }}
        >
          <NetworkIcon fill={"#fff"} />
        </TouchableOpacity>
      ) : null}
    </>
  );

  return (
    <TouchableOpacity
      activeOpacity={onSwapPress ? 0.85 : 1}
      disabled={!onSwapPress}
      onPress={onSwapPress}
      style={{
        position: "absolute",
        bottom: 10,
        right: 10,
        height,
        aspectRatio: 0.7,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {content}
    </TouchableOpacity>
  );
};
