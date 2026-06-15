/**
 * Deep linking configuration for Connectiqo.
 *
 * URL scheme:  connectiqo://
 *
 * Supported links:
 *   connectiqo://mentor/:mentorId       → Mentor profile modal
 *   connectiqo://booking/:mentorId      → Book a session with a mentor
 *   connectiqo://call/:roomId           → Join a live video call
 *   connectiqo://review/:bookingId      → Leave a review
 *   connectiqo://wallet                 → Wallet screen
 *   connectiqo://transactions           → Transaction history
 *   connectiqo://discover               → Learner discover tab
 *   connectiqo://bookings               → Learner bookings tab
 *   connectiqo://sessions               → Mentor sessions tab
 *   connectiqo://earnings               → Mentor earnings tab
 */

import { SCREEN_NAMES } from './screenNames';

export const linking = {
  prefixes: ['connectiqo://'],

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

          [SCREEN_NAMES.UnifiedSettings]: 'settings',
        },
      },

      // ── Modal overlays (root stack) ──
      [SCREEN_NAMES.MentorProfile]:      'mentor/:mentorId',
      [SCREEN_NAMES.Booking]:            'booking/:mentorId',
      [SCREEN_NAMES.VideoCall]:          'call/:roomId',
      [SCREEN_NAMES.Review]:             'review/:bookingId',
      [SCREEN_NAMES.MentorReviews]:        'mentor/:mentorId/reviews',
      [SCREEN_NAMES.Wallet]:             'wallet',
      [SCREEN_NAMES.TransactionHistory]: 'transactions',
      [SCREEN_NAMES.CategoryMentors]:    'category/:category',
    },
  },
};
