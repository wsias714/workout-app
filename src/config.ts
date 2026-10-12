/** Dropbox app key (public by design under PKCE: there is no secret). Registered as "WadeGymTracker";
    Settings can override it, or set VITE_DROPBOX_APP_KEY at build time. */
export const DEFAULT_DROPBOX_APP_KEY: string = import.meta.env.VITE_DROPBOX_APP_KEY ?? "g2xf5zqvdss6wi8";
