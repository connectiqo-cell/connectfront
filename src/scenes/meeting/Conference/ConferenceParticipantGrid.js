import React, { useRef, useState } from "react";
import { View, Dimensions } from "react-native";
import { CosmicLoader } from "../../../components/LoadingSpinner";
import BottomSheet from "../../../components/BottomSheet";
import colors from "../../../styles/colors";
import { useOrientation } from "../../../utils/useOrientation";
import ParticipantStatsViewer from "../Components/ParticipantStatsViewer";
import ParticipantView from "./ParticipantView";
import PauseInvisibleParticipants from "./PauseInvisibleParticipant";

const MemoizedParticipant = React.memo(
  ParticipantView,
  (
    { participantId, quality, key, openStatsBottomSheet },
    {
      participantId: oldParticipantId,
      quality: oldQuality,
      key: oldkey,
      openStatsBottomSheet: oldopenStatsBottomSheet,
    }
  ) =>
    participantId === oldParticipantId &&
    quality === oldQuality &&
    key === oldkey &&
    openStatsBottomSheet === oldopenStatsBottomSheet
);

function ConferenceParticipantGrid({ participantIds, isPresenting }) {
  const orientation = useOrientation();
  const participantCount = participantIds.length;
  const perRow = isPresenting ? 2 : participantCount >= 3 ? 2 : 1;
  const quality =
    participantCount > 4 ? "low" : participantCount > 2 ? "med" : "high";
  const bottomSheetRef = useRef();
  const [participantId, setParticipantId] = useState("");

  const openStatsBottomSheet = ({ pId }) => {
    setParticipantId(pId);
    bottomSheetRef.current.show();
  };

  return (
    <>
      <PauseInvisibleParticipants visibleParticipantIds={participantIds} />
      {Array.from({ length: Math.ceil(participantCount / perRow) }, (_, i) => {
        return (
          <View
            style={{
              flex: 1,
              flexDirection: orientation == "PORTRAIT" ? "row" : "column",
            }}
          >
            {participantIds
              .slice(i * perRow, (i + 1) * perRow)
              .map((participantId) => {
                return (
                  <MemoizedParticipant
                    key={participantId}
                    participantId={participantId}
                    quality={quality}
                    openStatsBottomSheet={openStatsBottomSheet}
                  />
                );
              })}
            <BottomSheet
              sheetBackgroundColor={colors.sheet}
              draggable={false}
              radius={12}
              hasDraggableIcon
              closeFunction={() => {
                setParticipantId("");
              }}
              ref={bottomSheetRef}
              height={Dimensions.get("window").height * 0.5}
            >
              {participantId ? (
                <ParticipantStatsViewer participantId={participantId} />
              ) : (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <CosmicLoader size={56} />
                </View>
              )}
            </BottomSheet>
          </View>
        );
      })}
    </>
  );
}

export const MemoizedParticipantGrid = React.memo(
  ConferenceParticipantGrid,
  (
    { participantIds, isPresenting },
    { participantIds: oldParticipantIds, isPresenting: oldIsPresenting }
  ) =>
    JSON.stringify(participantIds) === JSON.stringify(oldParticipantIds) &&
    isPresenting === oldIsPresenting
);
