import { Dropbox, DropboxAuth } from "dropbox";
import { DEFAULT_DROPBOX_APP_KEY } from "../config.ts";
import { ConflictError } from "./remote.ts";
import type { Remote, RemoteEntry, RemoteFile } from "./remote.ts";

/* Dropbox adapter: OAuth PKCE (no secret anywhere), refresh-token based, scoped
   by the Dropbox app itself to Apps/GymTracker/ ("App folder" access). */

const K = {
  appKey: "gym-dbx-appkey",
  tokens: "gym-dbx-tokens",
  verifier: "gym-dbx-verifier",
};

const get = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const put = (k: string, v: string | null) => {
  try {
    if (v === null) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, v);
  } catch {
    /* private mode etc.: connection just won't persist */
  }
};

export const getAppKey = () => (get(K.appKey) || DEFAULT_DROPBOX_APP_KEY).trim();
export const setAppKey = (k: string) => put(K.appKey, k.trim() || null);

/** Must match a redirect URI registered in the Dropbox app console exactly. */
export const redirectUri = () => `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}`;

interface Tokens {
  refresh: string;
}
const tokens = (): Tokens | null => {
  const raw = get(K.tokens);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Tokens;
    return t.refresh ? t : null;
  } catch {
    return null;
  }
};

export const isConnected = () => !!tokens() && !!getAppKey();
export const getRefreshToken = () => tokens()?.refresh ?? "";
export const disconnect = () => put(K.tokens, null);

/** Step 1: send the user to Dropbox. `manual` uses the copy-the-code flow (no redirect). */
export async function startAuth(manual = false): Promise<string> {
  const auth = new DropboxAuth({ clientId: getAppKey() });
  const url = await auth.getAuthenticationUrl(manual ? "" : redirectUri(), manual ? undefined : "gym", "code", "offline", undefined, "none", true);
  // localStorage, not sessionStorage: iOS may hand the redirect back to a fresh webview.
  put(K.verifier, auth.getCodeVerifier());
  return String(url);
}

async function exchange(code: string, withRedirect: boolean): Promise<void> {
  const auth = new DropboxAuth({ clientId: getAppKey() });
  auth.setCodeVerifier(get(K.verifier) ?? "");
  const res = await auth.getAccessTokenFromCode(withRedirect ? redirectUri() : "", code.trim());
  const refresh = (res.result as { refresh_token?: string }).refresh_token;
  if (!refresh) throw new Error("Dropbox didn't return a refresh token. Check the app is set to 'offline' access.");
  put(K.tokens, JSON.stringify({ refresh } satisfies Tokens));
  put(K.verifier, null);
}

/** Step 2a: on page load, finish a redirect flow if the URL carries ?code=. */
export async function finishAuthFromUrl(): Promise<"none" | "connected"> {
  const p = new URLSearchParams(window.location.search);
  const code = p.get("code");
  if (!code || p.get("state") !== "gym") return "none";
  window.history.replaceState({}, "", redirectUri());
  await exchange(code, true);
  return "connected";
}

/** Step 2b: paste-the-code fallback. */
export async function finishAuthWithCode(code: string): Promise<void> {
  await exchange(code, false);
}

function client(): Dropbox {
  const t = tokens();
  if (!t) throw new Error("Not connected to Dropbox.");
  const auth = new DropboxAuth({ clientId: getAppKey(), refreshToken: t.refresh });
  return new Dropbox({ auth });
}

interface DbxError {
  status?: number;
  error?: { error_summary?: string; error?: { ".tag"?: string; path?: { ".tag"?: string } } };
}
const summary = (e: unknown) => (e as DbxError)?.error?.error_summary ?? "";
const isNotFound = (e: unknown) => (e as DbxError)?.status === 409 && summary(e).includes("not_found");
const isConflict = (e: unknown) => (e as DbxError)?.status === 409 && summary(e).includes("conflict");

export function dropboxRemote(): Remote {
  const dbx = client();
  return {
    async read(path): Promise<RemoteFile | null> {
      try {
        const res = await dbx.filesDownload({ path });
        const blob = (res.result as unknown as { fileBlob: Blob }).fileBlob;
        return { text: await blob.text(), rev: res.result.rev };
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },
    async write(path, text, rev) {
      try {
        const res = await dbx.filesUpload({
          path,
          contents: new Blob([text], { type: "application/json" }),
          mode: rev === null ? { ".tag": "add" } : { ".tag": "update", update: rev },
          autorename: false,
          mute: true,
        });
        return { rev: res.result.rev };
      } catch (e) {
        if (isConflict(e)) throw new ConflictError();
        throw e;
      }
    },
    async list(dir): Promise<RemoteEntry[]> {
      try {
        let res = await dbx.filesListFolder({ path: dir });
        const out: RemoteEntry[] = [];
        for (;;) {
          for (const e of res.result.entries) {
            if (e[".tag"] === "file") out.push({ path: e.path_lower ?? `${dir}/${e.name}`, modified: e.server_modified, size: e.size });
          }
          if (!res.result.has_more) break;
          res = await dbx.filesListFolderContinue({ cursor: res.result.cursor });
        }
        return out;
      } catch (e) {
        if (isNotFound(e)) return [];
        throw e;
      }
    },
    async remove(path) {
      await dbx.filesDeleteV2({ path });
    },
  };
}
