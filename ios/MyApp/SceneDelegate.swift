import UIKit
import React
import React_RCTAppDelegate

/// Owns the window and starts React Native.
///
/// The iOS 27 SDK removed the UIApplicationDelegate single-window fallback, so an
/// app that creates its own UIWindow in the app delegate is refused at launch with
/// "UIScene life cycle is required for apps built with this SDK". The window now
/// belongs to the scene; the app delegate keeps Firebase and APNs setup.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    factory.startReactNative(
      withModuleName: "MyApp",
      in: window,
      launchOptions: Self.launchOptions(from: connectionOptions)
    )
  }

  /// A cold-start deep link arrives in `connectionOptions`, but RCTLinkingManager's
  /// `getInitialURL` only reads the bridge's launchOptions. Rebuild the two keys it
  /// looks for so `Linking.getInitialURL()` still resolves on a cold launch.
  private static func launchOptions(
    from connectionOptions: UIScene.ConnectionOptions
  ) -> [UIApplication.LaunchOptionsKey: Any] {
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]

    if let url = connectionOptions.urlContexts.first?.url {
      // connectiqo:// scheme
      launchOptions[.url] = url
    } else if let activity = connectionOptions.userActivities.first,
              activity.activityType == NSUserActivityTypeBrowsingWeb {
      // Universal link (app.connectiqo.com)
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: NSUserActivityTypeBrowsingWeb,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ] as [AnyHashable: Any]
    }

    return launchOptions
  }

  // Deep link while the app is already running — scenes no longer route these
  // through the app delegate's openURL / continueUserActivity.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
