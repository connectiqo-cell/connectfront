# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:
-keep class org.webrtc.** { *; }
-keep class live.videosdk.** { *; }
-keep class com.twilio.** { *; }
-keep class io.socket.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn live.videosdk.**
-dontwarn org.webrtc.**
-dontwarn com.jiangdg.usb.DeviceFilter
-dontwarn com.jiangdg.usb.USBMonitor$OnDeviceConnectListener
-dontwarn com.jiangdg.usb.USBMonitor$UsbControlBlock
-dontwarn com.jiangdg.usb.USBMonitor
-dontwarn com.jiangdg.utils.Size
-dontwarn com.jiangdg.utils.XLogWrapper
-dontwarn com.jiangdg.uvc.IFrameCallback
-dontwarn com.jiangdg.uvc.UVCCamera

# react-native-video / Media3 — ExoPlayer resolves renderers and extractors reflectively
-keep class com.brentvatne.** { *; }
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# Google Play Services / Firebase (R8 stack-map warnings on auth libs)
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
