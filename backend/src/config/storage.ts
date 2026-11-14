import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { createStorageFetch } from "../storage/storage-fetch";

export const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        global: { fetch: createStorageFetch() },
        realtime: {
            transport: WebSocket as any,
        },
    }
);

export const storageBucket = 
process.env.SUPABASE_STORAGE_BUCKET || "paragon-media";
