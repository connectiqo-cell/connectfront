package com.connectiqo.app

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import live.videosdk.pipmode.AndroidPipModule

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MyApp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /** Notify JS when the activity enters or exits system Picture-in-Picture. */
  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode)
    AndroidPipModule.pipModeChanged(isInPictureInPictureMode)
  }

  /**
   * Android 12+: system asks whether to enter PiP when the user leaves the app
   * (Home / Recents). Only enters when JS has marked the meeting screen active.
   */
  override fun onPictureInPictureRequested(): Boolean {
    AndroidPipModule.pipModeReq()
    return true
  }

  /**
   * Android 8–11: enter PiP when the user presses Home while on an active call.
   * On Android 12+ this still runs; enterPictureInPictureMode is safe if already entering.
   */
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    AndroidPipModule.pipModeReq()
  }
}
