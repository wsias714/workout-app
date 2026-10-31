export interface FeedbackItem {
  id: string;
  app: string;
  kind: "bug" | "idea" | "other";
  text: string;
  ts: string;
  version: string;
  device: { kind: string; ua: string; screen: string; standalone: string };
}
export interface FeedbackOptions {
  /** Key in ai-housekeeping/config/feedback-apps.json. */
  app: string;
  version?: string;
  /** Store the item where the collector reads it. Throw to keep it queued on the device. */
  upload?: (item: FeedbackItem) => Promise<unknown>;
  /** Same-origin route that accepts the item as a JSON POST (desktop apps). */
  endpoint?: string;
  /** Press-and-hold time in ms before the panel opens (kids' games). Default 0 = tap. */
  hold?: number;
  /** Pixels above the bottom safe area. Default 14: raise it to clear a tab bar. */
  bottom?: number;
  side?: "left" | "right";
  email?: string;
  label?: string;
}
export function initFeedback(opts: FeedbackOptions): { flush: () => Promise<number | void> };
