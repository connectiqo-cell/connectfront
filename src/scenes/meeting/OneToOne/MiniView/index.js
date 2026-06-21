import React, { useEffect } from "react";
import MiniVideoRTCView from "./MiniVideoRTCView";
import useParticipantStat from "../../Hooks/useParticipantStat";

export default MiniViewContainer = ({
  participantId,
  openStatsBottomSheet,
}) => {
  const { score, webcamOn, webcamStream, displayName, setQuality, isLocal, micOn } =
    useParticipantStat({ participantId });

  useEffect(() => {
    setQuality?.("high");
  }, []);

  return (
    <MiniVideoRTCView
      isOn={webcamOn}
      stream={webcamStream}
      displayName={displayName}
      isLocal={isLocal}
      micOn={micOn}
      score={score}
      participantId={participantId}
      openStatsBottomSheet={openStatsBottomSheet}
    />
  );
};
