//
//  Use this file to import your target's public headers that you would like to expose to Swift.
//

#import "React/RCTEventEmitter.h"
// SceneDelegate forwards warm deep links to RN's linking module.
#import "React/RCTLinkingManager.h"
// react-native-orientation-locker: lets AppDelegate report the current lock.
#if __has_include(<react_native_orientation_locker/Orientation.h>)
#import <react_native_orientation_locker/Orientation.h>
#elif __has_include("Orientation.h")
#import "Orientation.h"
#endif
