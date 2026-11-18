import { AuthTokenPayload, verifyAuthToken } from "./auth-token";
import { validateAndTouchSession } from "../modules/auth/session.repository";

// Long-lived connections must recheck expiry, revocation and current account
// permissions before private delivery. Passive listeners do not refresh idle time.
export async function authorizeLiveAdmin(token: string): Promise<boolean> {
  try {
    const payload: AuthTokenPayload = verifyAuthToken(token);
    if (payload.role !== "admin") return false;
    return payload.sub === "env-admin" || await validateAndTouchSession(
      payload.sub, payload.sid!, payload, false
    );
  } catch {
    return false;
  }
}
