import {
  initConnection,
  getProducts,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
} from 'react-native-iap';
import { Platform } from 'react-native';
import { VIDEO_UNLOCK_PRICE_TIERS } from './playBilling';

// Apple App Store Connect In-App Purchase product IDs — created as Consumable
// (not Non-Renewing Subscription, which App Store Connect's web UI no longer
// exposes). Same repurchase-every-30-days model as Android's Play Billing
// tiers, and the IDs are kept identical to VIDEO_UNLOCK_PRODUCT_IDS in
// playBilling.js purely for symmetry — the two stores' catalogs are
// independent, so this isn't required, just easier to reason about.
export { VIDEO_UNLOCK_PRICE_TIERS };

export const APPLE_UNLOCK_PRODUCT_IDS = {
  199: 'video_unlock_199',
  299: 'video_unlock_299',
  499: 'video_unlock_499',
  799: 'video_unlock_799',
  999: 'video_unlock_999',
};

/** Looks up the App Store Connect product ID for a mentor's current unlock_price. */
export function getAppleProductIdForPrice(price) {
  const productId = APPLE_UNLOCK_PRODUCT_IDS[price];
  if (!productId) {
    throw new Error(`No Apple IAP product configured for price ₹${price}`);
  }
  return productId;
}

let connected = false;

function mapStoreKitError(error) {
  const raw = error?.message || String(error || 'Purchase failed');
  const code = error?.code;
  const lower = raw.toLowerCase();

  if (code === 'E_USER_CANCELLED' || lower.includes('cancelled')) {
    const err = new Error('Purchase cancelled');
    err.code = 'PAYMENT_CANCELLED';
    return err;
  }

  if (
    lower.includes('storekitd') ||
    lower.includes('invalidrequest') ||
    lower.includes("couldn't be completed") ||
    lower.includes('could not be completed')
  ) {
    const err = new Error(
      'Apple StoreKit could not load this product. Check App Store Connect ' +
        '(Paid Apps Agreement, product Ready to Submit, localization), ' +
        'sign in with a Sandbox Apple ID on device, then retry. ' +
        'If it keeps failing, reboot the phone or update iOS.',
    );
    err.code = code || 'STOREKIT_REQUEST_FAILED';
    err.cause = error;
    return err;
  }

  const err = new Error(raw);
  err.code = code;
  err.cause = error;
  return err;
}

async function ensureConnected() {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple IAP is only available on iOS');
  }
  if (connected) return;
  await initConnection();
  connected = true;
}

/**
 * Opens the StoreKit purchase sheet for a consumable product and resolves
 * with the resulting Purchase once Apple reports success.
 * Mirrors purchaseAndroidProduct's promise-based contract.
 */
export async function purchaseIosProduct(productId) {
  await ensureConnected();

  let products = [];
  try {
    products = await getProducts({ skus: [productId] });
  } catch (err) {
    throw mapStoreKitError(err);
  }

  const matched = (products || []).find(
    p => p?.productId === productId || p?.productIdentifier === productId,
  );
  if (!matched) {
    const err = new Error(
      `Apple product "${productId}" is not available on this device. ` +
        'In App Store Connect the product needs Display Name + Description, ' +
        'and your device must use a Sandbox Apple ID. Also confirm Xcode has ' +
        'In-App Purchase capability and `pod install` linked react-native-iap.',
    );
    err.code = 'E_PRODUCT_NOT_AVAILABLE';
    throw err;
  }

  // Recover a purchase StoreKit queued but the app never finished (crash /
  // backgrounding between purchase success and finishIosPurchase). Without
  // this, the unfinished transaction just sits there and can block new
  // purchases of the same product. Returning it here lets the caller re-run
  // verify + finish on it — verify is idempotent, so this is safe even if
  // it was already credited last time.
  const existing = await getAvailablePurchases();
  const stuck = existing.find(p => p.productId === productId);
  if (stuck) return stuck;

  return new Promise((resolve, reject) => {
    let settled = false;
    let updateSub;
    let errorSub;

    const cleanup = () => {
      updateSub?.remove();
      errorSub?.remove();
    };

    updateSub = purchaseUpdatedListener(purchase => {
      if (settled || purchase.productId !== productId) return;
      settled = true;
      cleanup();
      resolve(purchase);
    });

    errorSub = purchaseErrorListener(error => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(mapStoreKitError(error));
    });

    // react-native-iap accepts sku (iOS) and skus (Android). Send both so
    // StoreKit gets a valid request shape across v12/v13 bridges.
    requestPurchase({ sku: productId, skus: [productId] }).catch(err => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(mapStoreKitError(err));
    });
  });
}

/**
 * Marks the purchase consumed on Apple's side — required for a consumable
 * product to become purchasable again (our 30-day unlock is re-bought every
 * cycle). Call ONLY after the server has confirmed and credited the
 * purchase — if this runs before that and the app dies, the purchase would
 * be finished with nothing granted.
 */
export async function finishIosPurchase(purchase) {
  await finishTransaction({ purchase, isConsumable: true });
}

/**
 * Recovers any Apple purchases that were charged but never finished on this
 * device (interrupted before finishIosPurchase ran). Call verifyFn for each
 * with { productId, transactionId } and finish it once verified.
 */
export async function recoverStuckIosPurchases(verifyFn) {
  await ensureConnected();
  const purchases = await getAvailablePurchases();
  const ours = purchases.filter(p => Object.values(APPLE_UNLOCK_PRODUCT_IDS).includes(p.productId));
  for (const purchase of ours) {
    await verifyFn(purchase);
    await finishIosPurchase(purchase);
  }
  return ours.length;
}
