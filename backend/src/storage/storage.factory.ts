import { LocalStorageService } from "./local-storage.service";
import { SupabaseStorageService } from "./supabase-storage.service";
import { StorageService } from "./storage.interface";

const isProduction = process.env.NODE_ENV === "production";

export const storageService: StorageService = isProduction
  ? new SupabaseStorageService()
  : new LocalStorageService();