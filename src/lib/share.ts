import { isNative, loadNative } from "@/lib/native";

export interface ShareContent {
  title: string;
  text: string;
  url: string;
}

/**
 * Whether this device can show a share sheet: always in the native app
 * (@capacitor/share), otherwise only where the browser has navigator.share.
 */
export function canShare(): boolean {
  if (isNative()) return true;
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * Open the system share sheet. Resolves false if sharing isn't available or
 * failed; a user cancel is not an error.
 */
export async function share(content: ShareContent): Promise<boolean> {
  const mod = await loadNative(() => import("@capacitor/share"));
  try {
    if (mod) {
      await mod.Share.share({ ...content, dialogTitle: content.title });
      return true;
    }
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share(content);
      return true;
    }
  } catch {
    // Cancelled, or the share target failed; nothing to recover.
  }
  return false;
}
