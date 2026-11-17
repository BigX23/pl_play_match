import { loadNative } from "@/lib/native";

/**
 * A light haptic tap for a completed action (M5: sending a message, accepting a
 * match). Native app only; does nothing on the web and never throws.
 */
export async function tapHaptic(): Promise<void> {
  const mod = await loadNative(() => import("@capacitor/haptics"));
  if (!mod) return;
  try {
    await mod.Haptics.impact({ style: mod.ImpactStyle.Light });
  } catch {
    // Haptics are a nicety; ignore devices without a taptic engine.
  }
}
