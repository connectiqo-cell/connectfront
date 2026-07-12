import { CommonActions } from '@react-navigation/native';
import { SCREEN_NAMES } from './screenNames';

/**
 * Open Search → Videos tab (inside bottom tabs), optionally filtered/scrolled to a mentor video.
 * Pops mentor-profile and other root-stack overlays back to the main tab navigator first.
 */
export function navigateToLearnerVideosTab(navigation, { mentorId, videoId } = {}) {
  const videoTabParams = {
    ...(mentorId ? { filterMentorId: mentorId } : {}),
    ...(videoId ? { startVideoId: videoId } : {}),
  };

  const tabsParams = {
    screen: SCREEN_NAMES.LearnerSection,
    params: {
      screen: SCREEN_NAMES.LearnerVideos,
      params: videoTabParams,
    },
  };

  navigation.dispatch((state) => {
    const routes = state?.routes;
    if (!Array.isArray(routes) || routes.length === 0) {
      return CommonActions.navigate({
        name: SCREEN_NAMES.RootUnifiedTabs,
        params: tabsParams,
      });
    }

    const tabsIndex = routes.findIndex((r) => r.name === SCREEN_NAMES.RootUnifiedTabs);
    if (tabsIndex !== -1) {
      const trimmedRoutes = routes.slice(0, tabsIndex + 1).map((route, index) => {
        if (index !== tabsIndex) return route;
        return {
          ...route,
          params: tabsParams,
        };
      });

      return CommonActions.reset({
        ...state,
        routes: trimmedRoutes,
        index: tabsIndex,
      });
    }

    // Already inside the bottom tab navigator (e.g. Home tab).
    return CommonActions.navigate({
      name: SCREEN_NAMES.LearnerSection,
      params: {
        screen: SCREEN_NAMES.LearnerVideos,
        params: videoTabParams,
      },
    });
  });
}
