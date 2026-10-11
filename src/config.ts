/** Dropbox app key (public by design under PKCE: there is no secret). Registered as "WadeGymTracker"
    app is registered; Settings can also override it, or set VITE_DROPBOX_APP_KEY at build time. */
export const DEFAULT_DROPBOX_APP_KEY: string = import.meta.env.VITE_DROPBOX_APP_KEY ?? "g2xf5zqvdss6wi8";
