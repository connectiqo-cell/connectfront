import {
  initConnection,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'react-native-iap';

// Product ID for the video-library 30-day unlock, configured as a one-time
// (managed) product in Play Console. UPDATE THIS to match the exact product
// ID entered there.
export const PLAY_VIDEO_UNLOCK_PRODUCT_ID = 'video_subscription_unlock';

let connected = false;

async function ensureConnected() {
  if (connected) return;
  await initConnection();
  connected = true;
}

/**
 * Opens the Play Billing purchase sheet for a one-time product and resolves
 * with the resulting Purchase once Google reports success.
 * Mirrors openRazorpayCheckout's promise-based contract.
 */
export async function purchaseAndroidProduct(productId) {
  await ensureConnected();

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
      const code = error?.code;
      const message = error?.message || 'Purchase failed';
      const err = new Error(message);
      err.code = code === 'user-cancelled' ? 'PAYMENT_CANCELLED' : code;
      reject(err);
    });

    requestPurchase({
      request: { google: { skus: [productId] } },
      type: 'in-app',
    }).catch(err => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/**
 * Marks the purchase consumed on Google's side — required for a one-time
 * product to become purchasable again (our 30-day unlock is re-bought every
 * cycle, not auto-renewing). Call ONLY after the server has confirmed and
 * credited the purchase — if this runs before that and the app dies, the
 * purchase would be consumed with nothing granted.
 */
export async function finishAndroidPurchase(purchase) {
  await finishTransaction({ purchase, isConsumable: true });
}
