/**
 * Deep linking configuration for Connectiqo.
 *
 * Custom scheme: connectiqo://
 * App / Universal Links: https://app.connectiqo.com (and connectiqo.com)
 *
 * Supported paths:
 *   /mentor/:mentorId       → Mentor profile (UUID or username)
 *   /campaign/:campaignId   → Collab campaign detail (shared collab link)
 *   /scan                   → Profile QR share screen
 *   /booking/:mentorId      → Book a session with a mentor
 *   /call/:bookingId        → Join a live video call
 *   /review/:bookingId      → Leave a review
 *   /wallet                 → Wallet screen
 *   /transactions           → Transaction history
 *   /discover               → Learner discover tab
 *   /bookings               → Learner bookings tab
 *   /mentor/sessions        → Mentor sessions tab
 *   /mentor/earnings        → Mentor earnings tab
 */

import { SCREEN_NAMES } from './screenNames';

export const linking = {
  prefixes: [
    'connectiqo://',
    'https://app.connectiqo.com',
    'https://connectiqo.com',
    'https://www.connectiqo.com',
  ],

  config: {
    screens: {
      // ── Auth (unauthenticated users land here) ──
      Auth: {
        screens: {
          [SCREEN_NAMES.Welcome]:  'welcome',
          [SCREEN_NAMES.Login]:    'login',
          [SCREEN_NAMES.Signup]:   'signup',
        },
      },

      // ── Main tab navigator ──
      [SCREEN_NAMES.RootUnifiedTabs]: {
        screens: {
          [SCREEN_NAMES.UnifiedHome]: 'home',

          [SCREEN_NAMES.MentorSection]: {
            screens: {
              [SCREEN_NAMES.MentorDashboard]:      'mentor/profile',
              [SCREEN_NAMES.MentorCalls]:          'mentor/sessions',
              [SCREEN_NAMES.MentorEarnings]:       'mentor/earnings',
              [SCREEN_NAMES.MentorAvailabilityTab]:'mentor/schedule',
            },
          },

          [SCREEN_NAMES.LearnerSection]: {
            screens: {
              [SCREEN_NAMES.LearnerSearch]:   'discover',
              [SCREEN_NAMES.LearnerBookings]: 'bookings',
            },
          },

          [SCREEN_NAMES.CollabHubTab]: 'collabhub',
        },
      },

      // ── Modal overlays (root stack) ──
      [SCREEN_NAMES.UnifiedSettings]:    'settings',
      [SCREEN_NAMES.MentorProfile]:      'mentor/:mentorId',
      [SCREEN_NAMES.ScanMentorQr]:       'scan',
      [SCREEN_NAMES.Booking]:            'booking/:mentorId',
      [SCREEN_NAMES.VideoCall]:          'call/:bookingId',
      [SCREEN_NAMES.Review]:             'review/:bookingId',
      [SCREEN_NAMES.MentorReviews]:        'mentor/:mentorId/reviews',
      [SCREEN_NAMES.Wallet]:             'wallet',
      [SCREEN_NAMES.TransactionHistory]: 'transactions',
      [SCREEN_NAMES.BlockedAccounts]: 'blocked-accounts',
      [SCREEN_NAMES.CategoryMentors]:    'category/:category',
      [SCREEN_NAMES.CampaignDetail]:     'campaign/:campaignId',
    },
  },
};
