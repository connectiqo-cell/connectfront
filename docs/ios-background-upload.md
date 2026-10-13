# iOS background upload + Live Activity — implementation spec

Written for: an iOS developer with a Mac, implementing the two features Android
already has. Everything here has been researched but **none of it is written or
compiled** — the rest of the app was built on Windows, where Xcode is unavailable.

## What Android has that iOS does not

| Feature | Android mechanism | iOS equivalent |
|---|---|---|
| Upload continues while app is closed | notifee foreground service (`dataSync`) | background `URLSession` |
| Live progress in the notification shade | ongoing notification with `progress` | Live Activity (ActivityKit) |

Current iOS behaviour: the upload **pauses** when the app is backgrounded and
**resumes** when reopened. Nothing is lost — `src/lib/uploadQueue.js` persists every
job to AsyncStorage and retries. This is safe, just not seamless.

---

## Part 1 — Background upload

### Why `tus-js-client` cannot be reused

The JS client uses `XMLHttpRequest`. iOS only continues transfers after the app is
suspended when they run on a `URLSession` created with
`URLSessionConfiguration.background(withIdentifier:)`, which:

- transfers **from a file on disk**, not an in-memory stream
- is scheduled by the system, not the app
- delivers completion through `UIApplicationDelegate`, possibly after a relaunch

So the resumable layer has to be reimplemented natively. There is no JS shortcut.

### Recommended approach: bridge TUSKit

[TUSKit](https://github.com/tus/TUSKit) is the official Swift TUS client and supports
background sessions. Bridging it preserves the resumability that
`src/lib/resumableUpload.js` gives Android — which is the whole reason uploads stopped
failing on weak networks.

**Do not** substitute `react-native-background-upload`. It wraps background
`URLSession` correctly but performs a plain multipart PUT with no TUS support, so a
dropped connection restarts from byte zero. That trades the fix for the symptom.

### Native module contract

The JS side needs these, matching what `uploadResumable()` does today:

```ts
interface TusBackgroundUpload {
  // Resolves when the server has the whole file. Rejects with { code, message }.
  start(opts: {
    fileUri: string;        // local file, already compressed by react-native-compressor
    endpoint: string;       // `${SUPABASE_URL}/storage/v1/upload/resumable`
    headers: Record<string, string>;   // authorization + apikey
    metadata: Record<string, string>;  // bucketName, objectName, contentType, cacheControl
    uploadId: string;       // our queue record id — the resume key across launches
    chunkSize: number;      // 6 * 1024 * 1024, non-negotiable (see below)
  }): Promise<void>;

  cancel(uploadId: string): Promise<void>;

  // Emitted as an RN event: { uploadId, bytesSent, bytesTotal }
  // onProgress
}
```

### Supabase constraints that will bite

- **Chunk size must be 6 MB.** S3 multipart has a 5 MB floor and Supabase maps TUS
  chunks to S3 parts. Smaller chunks are rejected.
- **Do not send `x-upsert`.** It requires UPDATE on `storage.objects`, which the
  `mentor-videos` bucket does not grant. This cost us a day of debugging on Android.
- The endpoint is `/storage/v1/upload/resumable` and needs both `authorization:
  Bearer <jwt>` and `apikey: <anon key>`.

### Xcode / plist work

- `UIBackgroundModes` is **not** needed for background `URLSession` (unlike audio or
  location) — the system handles it.
- Implement `application(_:handleEventsForBackgroundURLSession:completionHandler:)` in
  `AppDelegate` and store the completion handler; call it when the session finishes,
  or iOS will throttle future background work.
- Pick a stable session identifier, e.g. `com.connectiqo.app.upload`.

### Wiring into the existing JS

`src/lib/resumableUpload.js` is the only integration point. Route to the native module
when it exists and fall back to `tus-js-client` otherwise, so the app keeps working
unchanged on devices and builds without it.

The queue (`src/lib/uploadQueue.js`) needs no changes: it already persists jobs, resumes
on launch, backs off on failure, and treats the uploader as a black box that either
resolves or throws.

---

## Part 2 — Live Activity for progress

iOS notifications are discrete alerts; there is no ongoing notification with a
progress bar. The equivalent is a **Live Activity** (iOS 16.1+) on the lock screen and
Dynamic Island.

Needs:

1. A **Widget Extension** target in Xcode
2. SwiftUI layouts for the lock-screen and Dynamic Island presentations
3. An **App Group** so the extension and app share state
4. `ActivityKit` start/update/end calls bridged to JS
5. `NSSupportsLiveActivities` set to `YES` in `Info.plist`

Hook it to the same points `src/scenes/mentor/MentorVideosScreen.js` already uses for
the Android notification: `runQueue`'s throttled `onProgress`, plus `onDone`/`onError`.
Keep the existing 5% throttle — ActivityKit rate-limits updates and will drop them if
pushed too frequently.

Fall back to the current completion-only notification on iOS 16.0 and earlier.

---

## Suggested order

1. **Ship 1.1.4 first** (`pod install`, archive, upload). Versions are already bumped
   to `MARKETING_VERSION 1.1.4` / `CURRENT_PROJECT_VERSION 18`. iOS was on 1.0.2, so
   this release carries far more than background upload would.
2. Background upload — the larger win, and the harder piece.
3. Live Activity — polish, and much less valuable if uploads already survive
   backgrounding.

## Verify against Android

`src/lib/resumableUpload.js`, `src/lib/uploadQueue.js` and
`src/utils/uploadNotification.js` hold the working Android implementations of the same
behaviour, including the failure modes that were found the hard way: dead resume URLs,
stall detection, failure backoff, and progress persistence across restarts. Read them
before writing the Swift — several of those bugs will recur otherwise.
