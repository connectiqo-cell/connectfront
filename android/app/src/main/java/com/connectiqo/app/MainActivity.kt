package com.connectiqo.app

import android.content.Intent
import android.content.res.Configuration
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
   * react-native-orientation-locker listens for this broadcast to emit
   * orientation change events to JS. The activity handles orientation itself
   * (android:configChanges in the manifest), so it never restarts on rotation.
   */
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    val intent = Intent("onConfigurationChanged")
    intent.putExtra("newConfig", newConfig)
    applicationContext.sendBroadcast(intent)
  }

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
