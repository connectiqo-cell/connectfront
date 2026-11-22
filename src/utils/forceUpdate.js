import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Bump these with android/app/build.gradle `versionCode` and iOS `CURRENT_PROJECT_VERSION`
// on every release. The store's min_*_version row in app_config is compared against them.
export const APP_BUILD = Platform.select({ android: 22, ios: 19, default: 0 });

const STORE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=com.connectiqo.app',
  ios:     'https://apps.apple.com/app/connectiqo/6781374570',
};

export function needsUpdate(currentBuild, minValue) {
  const min = parseInt(minValue, 10);
  return Number.isFinite(min) && currentBuild < min;
}

export async function checkForceUpdate(currentBuild = APP_BUILD) {
  try {
    const key = Platform.OS === 'ios' ? 'min_ios_version' : 'min_android_version';
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [key, 'update_message']);

    if (error || !data) return { required: false };

    const row = k => data.find(r => r.key === k)?.value;

    const min = parseInt(row(key), 10);

    return {
      required: needsUpdate(currentBuild, row(key)),
      message:  row('update_message') || 'A newer version is required to continue.',
      storeUrl: STORE_URLS[Platform.OS],
      currentBuild,
      minBuild: Number.isFinite(min) ? min : null,
    };
  } catch {
    return { required: false };
  }
}

/**
 * Stamps the signed-in profile with the build it is running, so the admin panel
 * can see the version spread before raising min_*_version. Best-effort.
 */
export async function recordAppBuild(userId) {
  if (!userId) return;
  try {
    await supabase
      .from('profiles')
      .update({ app_build: APP_BUILD, app_platform: Platform.OS })
      .eq('id', userId);
  } catch {
    // never block sign-in on telemetry
  }
}
