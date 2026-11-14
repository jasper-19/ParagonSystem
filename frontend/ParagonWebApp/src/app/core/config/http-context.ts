import { HttpContextToken } from '@angular/common/http';

/** Local UI hint, never sent as a CORS request header. */
export const SKIP_ADMIN_LOADER = new HttpContextToken<boolean>(() => false);
