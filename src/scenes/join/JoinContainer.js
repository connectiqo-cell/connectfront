import {
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraSwitch, Speaker } from "../../assets/icons";
import Button from "../../components/Button";
import { UNIFIED_THEME } from "../../unifiedTheme";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { useJoinMeeting } from "./hooks/useJoinMeeting";
import { VideoPreview } from "./components/VideoPreview";
import { DeviceSelector } from "./components/DeviceSelector";
import { CreateMeetingForm } from "./components/CreateMeetingForm";
import { JoinMeetingForm } from "./components/JoinMeetingForm";

export default function JoinContainer({ navigation }) {
  const {
    // Video & Audio State
    tracks,
    videoOn,
    setVideoOn,
    micOn,
    setMicOn,
    toggleCameraFacing,

    // Form State
    name,
    setName,
    meetingId,
    setMeetingId,

    // UI State
    isAudioListVisible,
    audioList,
    selectedDeviceId,
    isVisibleCreateMeeting,
    setIsVisibleCreateMeeting,
    isVisibleJoinMeeting,
    setIsVisibleJoinMeeting,
    isMainScreen,
    isLoading,
    loadingMessage,

    // Methods
    handleAudioButtonPress,
    handleDeviceSelect,
    toggleAudioList,
    createNewMeeting,
    joinExistingMeeting,
  } = useJoinMeeting(navigation);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      {/* Loading Overlay */}
      <LoadingOverlay
        visible={isLoading}
        message={loadingMessage}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView
          edges={["top", "bottom"]}
          style={styles.safeArea}
        >
          {/* Top Toolbar */}
          <View style={styles.toolbar}>
            <TouchableOpacity
              onPress={handleAudioButtonPress}
              style={styles.toolbarButton}
            >
              <Speaker
                width={25}
                height={25}
                fill={UNIFIED_THEME.colors.accent.secondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleCameraFacing}
              style={styles.toolbarButton}
            >
              <CameraSwitch
                width={25}
                height={25}
                fill={UNIFIED_THEME.colors.accent.secondary}
              />
            </TouchableOpacity>
          </View>

          {/* Video Preview */}
          <VideoPreview
            tracks={tracks}
            videoOn={videoOn}
            onToggleVideo={() => setVideoOn(!videoOn)}
            micOn={micOn}
            onToggleMic={() => setMicOn(!micOn)}
          />

          {/* Audio Device Selector Modal */}
          <DeviceSelector
            isVisible={isAudioListVisible}
            audioList={audioList}
            selectedDeviceId={selectedDeviceId}
            onDeviceSelect={handleDeviceSelect}
            onClose={toggleAudioList}
          />

          {/* Bottom Action Section */}
          <View style={styles.bottomSection}>
            {isMainScreen() && (
              <>
                <Button
                  text="Create a meeting"
                  variant="premium"
                  onPress={() => setIsVisibleCreateMeeting(true)}
                />
                <Button
                  text="Join a meeting"
                  variant="secondary"
                  onPress={() => setIsVisibleJoinMeeting(true)}
                />
              </>
            )}

            {isVisibleCreateMeeting && (
              <CreateMeetingForm
                name={name}
                onNameChange={setName}
                onCreateMeeting={createNewMeeting}
                isLoading={isLoading}
              />
            )}

            {isVisibleJoinMeeting && (
              <JoinMeetingForm
                name={name}
                onNameChange={setName}
                meetingId={meetingId}
                onMeetingIdChange={setMeetingId}
                onJoinMeeting={joinExistingMeeting}
                isLoading={isLoading}
              />
            )}
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UNIFIED_THEME.colors.primary.light,
  },
  safeArea: {
    flex: 1,
    backgroundColor: UNIFIED_THEME.colors.primary.light,
    justifyContent: "space-between",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: UNIFIED_THEME.spacing.lg,
    gap: UNIFIED_THEME.spacing.md,
  },
  toolbarButton: {
    height: 40,
    width: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: UNIFIED_THEME.borderRadius.md,
    backgroundColor: UNIFIED_THEME.colors.component.card,
    ...UNIFIED_THEME.shadows.small,
  },
  bottomSection: {
    marginHorizontal: UNIFIED_THEME.spacing.xxxl,
    marginBottom: UNIFIED_THEME.spacing.md,
  },
});
