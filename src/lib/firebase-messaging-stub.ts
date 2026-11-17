/**
 * Stand-in for the Firebase JS SDK's `firebase/messaging`.
 *
 * `@capacitor-firebase/messaging` ships a web implementation that imports the
 * Firebase JS SDK (an optional peer we don't install). We only ever use the
 * plugin's native iOS/Android implementation (via loadNative), so next.config
 * aliases `firebase/messaging` here to keep the bundler happy. Web push stays on
 * VAPID (src/lib/notifications.ts).
 */
const unavailable = (): never => {
  throw new Error("firebase/messaging is not bundled; web push uses VAPID");
};

export const deleteToken = unavailable;
export const getMessaging = unavailable;
export const getToken = unavailable;
export const onMessage = unavailable;
export const isSupported = async (): Promise<boolean> => false;
