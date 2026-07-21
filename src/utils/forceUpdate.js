import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

const STORE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=com.connectiqo.app',
  ios:     'https://apps.apple.com/app/connectiqo/id000000000',
};

export async function checkForceUpdate(currentVersionCode) {
  try {
    const key = Platform.OS === 'ios' ? 'min_ios_version' : 'min_android_version';
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .in('key', [key, 'update_message']);

    if (error || !data) return { required: false };

    const row = obj => data.find(r => r.key === obj)?.value;
    const minVersion = parseInt(row(key) || '0', 10);
    const message    = row('update_message') || 'Please update the app to continue.';

    return {
      required:   currentVersionCode < minVersion,
      message,
      storeUrl:   STORE_URLS[Platform.OS],
    };
  } catch {
    return { required: false };
  }
}
