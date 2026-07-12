import React, { useEffect } from "react";
import { View, TouchableOpacity, Platform } from "react-native";
import { WifiIcon } from "../../../../assets/icons";
import colors from "../../../../styles/colors";
import useParticipantStat from "../../Hooks/useParticipantStat";
import LargeVideoRTCView from "./LargeVideoRTCView";

const buttonStyle = {
  alignItems: "center",
  position: "absolute",
  top: 10,
  left: 10,
  padding: 4,
  height: 18,
  aspectRatio: 1,
  borderRadius: 8,
  justifyContent: "center",
};
export default LargeViewContainer = ({
  participantId,
  openStatsBottomSheet,
}) => {
  const {
    score,
    screenShareOn,
    screenShareStream,
    webcamOn,
    webcamStream,
    displayName,
    setQuality,
    isLocal,
    micOn,
  } = useParticipantStat({ participantId });

  useEffect(() => {
    setQuality?.(Platform.OS === 'ios' ? 'medium' : 'high');
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.primary[800],
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {screenShareOn ? (
        <LargeVideoRTCView
          stream={screenShareStream}
          isOn={screenShareOn}
          displayName={displayName}
          objectFit={"contain"}
          isLocal={isLocal}
        />
      ) : (
        <>
          <LargeVideoRTCView
            isOn={webcamOn}
            stream={webcamStream}
            displayName={displayName}
            objectFit={"cover"}
            isLocal={isLocal}
          />
          {(micOn || webcamOn) && score && score <= 7 ? (
            <TouchableOpacity
              style={{
                ...buttonStyle,
                backgroundColor: score > 4 ? "#faa713" : "#FF5D5D",
              }}
              onPress={() => {
                openStatsBottomSheet({ pId: participantId });
              }}
            >
              <WifiIcon fill={"#fff"} width={10} height={10} />
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
};
