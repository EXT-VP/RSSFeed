import { cookies } from "next/headers";

// Last author used from this browser, so the editor prefills "your" name
// rather than whoever posted last site-wide. Value is URI-encoded because
// authors may contain Hebrew and cookie values must stay ASCII-safe.
const COOKIE = "wire_author";
const MAX_AGE = 60 * 60 * 24 * 365;

export async function rememberAuthor(author: string): Promise<void> {
  const store = await cookies();
  if (author) {
    store.set(COOKIE, encodeURIComponent(author), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
  } else {
    store.delete(COOKIE);
  }
}

export async function recallAuthor(): Promise<string> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}
