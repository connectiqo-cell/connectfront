import { RTCView } from "@videosdk.live/react-native-sdk";
import React from "react";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRtcStreamUrl } from "../../../../hooks/useRtcStreamUrl";
import { NetworkIcon } from "../../../../assets/icons";
import Avatar from "../../../../components/Avatar";
import colors from "../../../../styles/colors";

export default function MiniVideoRTCView({
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
  bottomInset = 0,
}) {
  const streamURL = useRtcStreamUrl(stream);
  const bottom = (Platform.OS === "ios" ? 14 : 10) + bottomInset;

  const content = (
    <>
      {isOn && streamURL ? (
        <RTCView
          objectFit="cover"
          zOrder={0}
          mirror={isLocal}
          pointerEvents="none"
          style={styles.rtc}
          streamURL={streamURL}
        />
      ) : (
        <View style={styles.avatarWrap}>
          <Avatar
            fullName={displayName}
            containerBackgroundColor={colors.primary[600]}
            fontSize={22}
            style={styles.avatar}
          />
        </View>
      )}
      {micOn || isOn ? (
        <TouchableOpacity
          style={[
            styles.statsBtn,
            {
              backgroundColor:
                score && score > 7
                  ? "#3BA55D"
                  : score > 4
                  ? "#faa713"
                  : "#FF5D5D",
            },
          ]}
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
      style={[styles.pip, { height, bottom }]}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pip: {
    position: "absolute",
    right: Platform.OS === "ios" ? 14 : 10,
    aspectRatio: 0.72,
    borderRadius: Platform.OS === "ios" ? 14 : 10,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.28)",
    backgroundColor: colors.primary[800],
    zIndex: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  rtc: {
    flex: 1,
    backgroundColor: colors.primary[700],
  },
  avatarWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[800],
  },
  avatar: {
    backgroundColor: colors.primary[500],
    height: 56,
    aspectRatio: 1,
    borderRadius: 28,
  },
  statsBtn: {
    alignItems: "center",
    position: "absolute",
    top: 8,
    left: 8,
    padding: 6,
    height: 24,
    aspectRatio: 1,
    borderRadius: 10,
    justifyContent: "center",
  },
});
