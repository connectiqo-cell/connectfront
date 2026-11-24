import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UserNotifications
#if canImport(FirebaseCore)
import FirebaseCore
#endif
#if canImport(FirebaseMessaging)
import FirebaseMessaging
#endif

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  // SceneDelegate creates the window and assigns it here — the iOS 27 SDK refuses
  // to launch an app that creates its own window in the app delegate, but
  // RNFBMessaging still reads `delegate.window` on didFinishLaunching and throws
  // an unrecognized-selector exception if the property is missing.
  @objc var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
#if canImport(FirebaseCore)
    // Required for FCM — needs GoogleService-Info.plist in the app bundle.
    // Without the plist, FirebaseApp.configure() terminates the process on launch.
    if FirebaseApp.app() == nil {
      if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
        FirebaseApp.configure()
      } else {
        NSLog("Skipping FirebaseApp.configure — GoogleService-Info.plist not found in bundle. Add ios/GoogleService-Info.plist and include it in the MyApp target.")
      }
    }
#endif

    // Show banners while app is in foreground (WhatsApp/Instagram style + Notifee/JS).
    UNUserNotificationCenter.current().delegate = self
    application.registerForRemoteNotifications()

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // SceneDelegate starts React Native once the scene hands over its window.
    return true
  }

  // UIKit asks here before every rotation. Orientation.getOrientation() returns
  // the mask the JS side has locked to — portrait everywhere except in-call.
  func application(
    _ application: UIApplication,
    supportedInterfaceOrientationsFor window: UIWindow?
  ) -> UIInterfaceOrientationMask {
    return Orientation.getOrientation()
  }

  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
#if canImport(FirebaseMessaging)
    // Only set APNs token after Firebase is configured (needs GoogleService-Info.plist).
    if FirebaseApp.app() != nil {
      Messaging.messaging().apnsToken = deviceToken
    }
#endif
  }

  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    NSLog("APNs registration failed: \(error.localizedDescription)")
  }

  // Foreground presentation — system banner/sound/badge when a remote notification arrives.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .list, .sound, .badge])
    } else {
      completionHandler([.alert, .sound, .badge])
    }
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    completionHandler()
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
