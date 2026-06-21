# Connectiqo — App Store Readiness Report

**Project:** Connectiqo (connectfront)  
**Platform:** iOS / React Native  
**Bundle ID:** com.connectiqo.app  
**Report Date:** June 21, 2026  
**Prepared for:** Apple Developer / App Store Connect submission review

---

## Executive Summary

| Question | Answer |
|----------|--------|
| Can you upload the binary to App Store Connect? | **Yes** — if the iOS project builds on a Mac with valid certificates and `GoogleService-Info.plist` |
| Will Apple approve the app as-is? | **Unlikely** — several common rejection risks exist |
| Live mentoring payments via Razorpay | **Possibly acceptable** under Guideline 3.1.3(d) (person-to-person real-time services) |
| Video library subscription via Razorpay | **Very likely rejection** — requires Apple In-App Purchase on iOS |

**Overall verdict:** You can likely build and upload to App Store Connect, but **App Review approval is at risk today**. Address the critical items below before submitting for review.

---

## Critical Blockers (Fix Before Submission)

### 1. Account Deletion Missing — Guideline 5.1.1(v)

**Severity:** Critical  
**Guideline:** [5.1.1(v) — Account Sign-In](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage)

Apple requires that apps allowing account creation must also offer **in-app account deletion**.

**Current state:**
- Signup and login exist (`SignupScreen.js`, `LoginScreen.js`, Supabase auth)
- **No delete-account flow** exists anywhere in the codebase
- Users can only sign out, not delete their account

**Required fix:**
- Add a "Delete account" option in Settings (`UnifiedSettingsScreen.js`)
- Include a confirmation step explaining data removal
- Delete or anonymize user data in Supabase (profile, tokens, bookings, etc.)
- Complete deletion within Apple's expected timeframe

---

### 2. Razorpay for Digital Content — Guideline 3.1.1 (In-App Purchase)

**Severity:** Critical  
**Guideline:** [3.1.1 — In-App Purchase](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)

The app uses `react-native-razorpay` in multiple screens:

| File | Payment Purpose |
|------|-----------------|
| `src/scenes/shared/BookingScreen.js` | Live session booking |
| `src/scenes/shared/MentorProfileScreen.js` | Video library subscription |
| `src/scenes/learner/VideosScreen.js` | Video library unlock |

**Apple payment rules:**

| Payment Type | Apple Rule | Your App | Risk |
|--------------|------------|----------|------|
| Live 1-on-1 mentoring sessions | May qualify under **3.1.3(d)** — real-time person-to-person services (tutoring, consultations) | Razorpay | Medium — may be acceptable |
| Video library subscription | Digital content consumed inside the app | Razorpay | **High — likely rejection** |

The video unlock flow ("Subscribe to mentor's video library" via Razorpay) is the **highest payment-policy risk**.

**Required fix (choose one):**
1. Implement **Apple In-App Purchase (StoreKit)** for video subscriptions on iOS, OR
2. **Disable paid video unlock on iOS** (web/Android only), OR
3. Remove paid video library from the iOS build until IAP is implemented

For live mentoring, if keeping Razorpay, cite **Guideline 3.1.3(d)** in App Review notes.

---

### 3. Privacy Policy & Terms URLs Not Working

**Severity:** Critical  
**Guideline:** [5.1.1(i) — Privacy](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage)

**Configured URLs (in `UnifiedSettingsScreen.js`):**
- Privacy: `https://connectiqo.app/privacy`
- Terms: `https://connectiqo.app/terms`

**Test results at time of report:**
- `https://connectiqo.app/privacy` → **503 Service Unavailable**
- `https://connectiqo.app/terms` → **Request timed out**

**Apple requires:**
1. A working Privacy Policy URL in App Store Connect
2. The same policy accessible from inside the app

**Current in-app implementation:**
- Settings links exist with Alert dialogs and "Read full policy" buttons
- Hosted pages must be live and comprehensive

**Policy must cover data collected:**
- Name, email, profile photo
- Payment and transaction information
- Session recordings
- Video call data
- Push notification tokens
- Mentor–learner communications

---

## High-Risk Issues

### 4. User-Generated Content (UGC) — Guideline 1.2

**Severity:** High  
**Guideline:** [1.2 — User-Generated Content](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)

**UGC surfaces in the app:**

| Feature | Location |
|---------|----------|
| Live meeting chat | `src/scenes/meeting/Components/ChatViewer/` |
| Mentor-uploaded videos | `MentorVideosScreen.js` |
| User reviews | `ReviewScreen.js`, `MentorReviewsScreen.js` |
| User profiles | `EditProfileScreen.js`, `MentorProfileScreen.js` |

**Apple expects:**
- Method to **report** objectionable content or users
- Ability to **block** abusive users
- **Content moderation** mechanism (admin freeze exists in `AuthContext.js`, but no user-facing tools)
- Published **contact information** for concerns (`support@connectiqo.app` is present)

**Required fix:**
- Add Report / Block actions on profiles, in meetings, and on video content
- Document moderation process in Terms of Service and Privacy Policy

---

### 5. App Privacy Labels Must Match Reality

**Severity:** High  
**File:** `ios/MyApp/PrivacyInfo.xcprivacy`

**Current declaration:**
- `NSPrivacyCollectedDataTypes` → **empty array**
- `NSPrivacyTracking` → false

**Actual data collected by the app:**

| Data Type | Source |
|-----------|--------|
| Email, name | Supabase auth, profiles |
| Profile photos | Image picker, uploads |
| Payment data | Razorpay transactions |
| Session recordings | VideoSDK cloud recording |
| Device/push tokens | Firebase Cloud Messaging |
| Usage data | Various SDKs |

**Required fix:**
- Accurately complete **App Store Connect → App Privacy** questionnaire
- Update `PrivacyInfo.xcprivacy` if your app directly collects data
- Ensure third-party SDK privacy manifests are included in the build

---

### 6. Firebase Push Notifications — iOS Incomplete

**Severity:** High (functional) / Medium (review)

**Issues identified:**

| Item | Status |
|------|--------|
| `GoogleService-Info.plist` | Gitignored — must be added locally before iOS build |
| `MyApp.entitlements` | Missing `aps-environment` push entitlement |
| `Info.plist` UIBackgroundModes | Only `audio` — missing `remote-notification` for FCM |

Push notifications may not work on iOS. This typically does not block submission, but must be declared correctly if the app requests notification permission.

---

## Medium Issues

### 7. Info.plist Cleanup

**File:** `ios/MyApp/Info.plist`

| Issue | Details | Fix |
|-------|---------|-----|
| Empty location permission | `NSLocationWhenInUseUsageDescription` is present but empty | Remove key if GPS is not used |
| Empty app category | `LSApplicationCategoryType` is empty | Set category in App Store Connect (e.g. Education) |
| Export compliance | `ITSAppUsesNonExemptEncryption` not set | Add `false` if only standard HTTPS/TLS is used |

**Permissions correctly configured:**
- `NSCameraUsageDescription` — video mentoring sessions
- `NSMicrophoneUsageDescription` — video mentoring sessions
- `NSPhotoLibraryUsageDescription` — save session recordings
- `NSPhotoLibraryAddUsageDescription` — save session recordings

**Security:**
- `NSAppTransportSecurity` → `NSAllowsArbitraryLoads` = false (good)
- `NSAllowsLocalNetworking` = true

---

### 8. Version Number Mismatch

| Location | Version |
|----------|---------|
| Xcode `MARKETING_VERSION` | 1.0 |
| `UnifiedSettingsScreen.js` `APP_VERSION` | 0.0.1 |
| `package.json` | 0.0.1 |

Align version numbers across Xcode, in-app display, and `package.json` before release.

---

### 9. Age Rating & Safety

Live video calls between mentors and learners require careful age rating. Expect **12+** or **17+** depending on content moderation and chat features.

Answer Apple's age rating questionnaire honestly regarding:
- Unmoderated user chat
- User-uploaded video content
- One-on-one live video between users

---

## What Looks Good Already

| Area | Status | Notes |
|------|--------|-------|
| Bundle ID | ✅ | `com.connectiqo.app` |
| Apple Developer Team | ✅ | Configured in Xcode (`DEVELOPMENT_TEAM = 8GZ776NSU2`) |
| App icons | ✅ | Present in `Images.xcassets` |
| Camera / mic / photo permissions | ✅ | Usage descriptions present |
| Privacy manifest file | ✅ | `PrivacyInfo.xcprivacy` included in build |
| App Transport Security | ✅ | Arbitrary loads disabled |
| Screen share extension | ✅ | `ScreenBroadcast` + app groups configured |
| Recording consent | ✅ | Consent flow before starting recording |
| Sign in with Apple | ✅ N/A | Email/password only — third-party login not used |
| App display name | ✅ | "Connectiqo" in `CFBundleDisplayName` |
| iOS deployment target | ✅ | 15.1 |
| Background audio | ✅ | For video calls (`UIBackgroundModes: audio`) |

---

## Non-Code Requirements (Apple Developer / App Store Connect)

Before submitting for review, ensure the following are complete:

1. **Paid Apple Developer Program** membership ($99/year)
2. **App Store listing metadata:** description, subtitle, keywords, promotional text
3. **Screenshots** for required device sizes (6.7", 6.5", 5.5" iPhone; iPad if supported)
4. **Support URL** — must be a working webpage
5. **Privacy Policy URL** — must be live and match in-app link
6. **Export compliance** questionnaire (HTTPS-only apps are typically exempt)
7. **Demo accounts** for App Review (mentor + learner test credentials)
8. **Review notes** explaining business model, marketplace nature, and payment approach
9. **Content rights** documentation for mentor-uploaded videos
10. **Age rating** questionnaire completed accurately

---

## Payment Policy Reference

### Guideline 3.1.1 — In-App Purchase
Apps offering digital goods or services consumed in the app must use Apple's In-App Purchase system.

### Guideline 3.1.3(d) — Person-to-Person Services Exception
Apps enabling purchase of **real-time person-to-person services** between two individuals (e.g. tutoring, medical consultations, fitness training) may use payment methods other than IAP.

**Connectiqo live mentoring** may fit this exception.  
**Connectiqo video library subscriptions** do **not** fit this exception.

---

## Recommended Priority Order

| Priority | Action |
|----------|--------|
| 1 | Host working Privacy Policy and Terms of Service pages |
| 2 | Implement in-app account deletion |
| 3 | Fix iOS payments — IAP for video subscriptions OR disable paid unlock on iOS |
| 4 | Add report/block functionality for UGC |
| 5 | Complete App Privacy questionnaire in App Store Connect |
| 6 | Clean up `Info.plist` (remove empty location key, add encryption flag) |
| 7 | Complete Firebase/APNs setup for iOS push notifications |
| 8 | Align version numbers across project |
| 9 | Prepare App Review demo accounts and review notes |

---

## Files Referenced in This Report

| File | Relevance |
|------|-----------|
| `ios/MyApp/Info.plist` | Permissions, background modes, app metadata |
| `ios/MyApp/PrivacyInfo.xcprivacy` | Privacy manifest |
| `ios/MyApp/MyApp.entitlements` | App capabilities |
| `ios/MyApp.xcodeproj/project.pbxproj` | Bundle ID, team, version |
| `src/scenes/settings/UnifiedSettingsScreen.js` | Privacy/Terms links, app version |
| `src/scenes/shared/BookingScreen.js` | Razorpay session payments |
| `src/scenes/shared/MentorProfileScreen.js` | Razorpay video subscription |
| `src/scenes/learner/VideosScreen.js` | Razorpay video unlock |
| `package.json` | Dependencies including `react-native-razorpay` |

---

## Disclaimer

This report is based on a static review of the codebase and iOS configuration as of June 21, 2026. It does not guarantee App Store approval. Apple's review guidelines change over time, and final decisions are made by Apple's App Review team. Consult [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) for the latest requirements.

---

*End of Report*
