export const SCREEN_NAMES = {
  // Existing (preserve)
  Join: "Join_Screen",
  Meeting: "Meeting_Screen",

  // Auth
  Welcome: "Welcome_Screen",
  Signup: "Signup_Screen",
  Login: "Login_Screen",
  ForgotPassword: "ForgotPassword_Screen",
  ResetPassword: "ResetPassword_Screen",

  /** Root stack — main tabs (must match RootNavigator screen name) */
  RootUnifiedTabs: "UnifiedTabs",
  // Unified bottom tabs
  UnifiedHome: "UnifiedHome_Screen",
  LearnerSection: "LearnerSection_Screen",
  UploadTab: "UploadTab_Screen",
  MentorSection: "MentorSection_Screen",
  UnifiedSettings: "UnifiedSettings_Screen",

  // Mentor top tabs
  MentorDashboard: "MentorDashboard_Tab",
  MentorCalls: "MentorCalls_Tab",
  MentorEarnings: "MentorEarnings_Tab",
  MentorAvailabilityTab: "MentorAvailability_Tab",

  // Learner top tabs
  LearnerSearch: "LearnerSearch_Tab",
  LearnerVideos: "LearnerVideos_Tab",
  LearnerBookings: "LearnerBookings_Tab",

  // Modal overlays (shared)
  EditProfile: "EditProfile_Screen",
  MentorProfile: "MentorProfile_Screen",
  Booking: "Booking_Screen",
  VideoCall: "VideoCall_Screen",
  RecordingPlayer: "RecordingPlayer_Screen",
  MentorAvailability: "MentorAvailability_Screen",
  RecordedLectures: "RecordedLectures_Screen",
  TransactionHistory: "TransactionHistory_Screen",
  Wallet: "Wallet_Screen",
  Review: "Review_Screen",
  MentorReviews: "MentorReviews_Screen",
  CategoryMentors: "CategoryMentors_Screen",

  // Mentor video library
  MentorVideos: "MentorVideos_Screen",


  // Payout / KYC setup
  PayoutSetup: "PayoutSetup_Screen",

  /** Network / connectivity (UI shell; wire NetInfo later) */
  Connectivity: "Connectivity_Screen",

  /** In-app notification center */
  Notifications: "Notifications_Screen",

  // Learner video player
  VideoPlayer: "VideoPlayer_Screen",

  // Standalone video feed (pushed from mentor profile — back returns to profile)
  MentorVideoFeed: "MentorVideoFeed_Screen",
};
