import React, { useEffect } from 'react';
import useParticipantStat from '../../Hooks/useParticipantStat';
import MiniVideoRTCView from './MiniVideoRTCView';
import ParticipantVideoPlaceholder from '../ParticipantVideoPlaceholder';

export default function MiniViewContainer({
  participantId,
  openStatsBottomSheet,
  onSwapPress,
  height,
  bottomInset = 0,
}) {
  if (!participantId) {
    return <ParticipantVideoPlaceholder style={{ height: height || 160 }} />;
  }

  return (
    <MiniViewContainerInner
      participantId={participantId}
      openStatsBottomSheet={openStatsBottomSheet}
      onSwapPress={onSwapPress}
      height={height}
      bottomInset={bottomInset}
    />
  );
}

function MiniViewContainerInner({
  participantId,
  openStatsBottomSheet,
  onSwapPress,
  height,
  bottomInset = 0,
}) {
  const { score, webcamOn, webcamStream, displayName, setQuality, isLocal, micOn } =
    useParticipantStat({ participantId });

  useEffect(() => {
    setQuality?.('high');
  }, [setQuality]);

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
      onSwapPress={onSwapPress}
      height={height}
      bottomInset={bottomInset}
    />
  );
}
