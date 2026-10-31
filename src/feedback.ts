import { initFeedback } from "./lib/feedback.js";
import { dropboxRemote, isConnected } from "./sync/dropbox.ts";
import { ConflictError } from "./sync/remote.ts";

/** In-app Feedback button (shared module, see ~/Projects/_shared/feedback). Items go to Dropbox
    Apps/WadeGymTracker/feedback/ using the same sign-in as sync; offline or signed out, they wait on the device. */
export function startFeedback() {
  initFeedback({
    app: "workout",
    bottom: 76,
    upload: async (item) => {
      if (!isConnected()) throw new Error("not connected to Dropbox");
      try {
        await dropboxRemote().write(`/feedback/${item.id}.json`, JSON.stringify(item), null);
      } catch (e) {
        if (!(e instanceof ConflictError)) throw e; // already stored by an earlier attempt
      }
    },
  });
}
