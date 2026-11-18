import { LocalStorageService } from "./local-storage.service";
import { SupabaseStorageService } from "./supabase-storage.service";
import { StorageService } from "./storage.interface";
import { LocalPrivatePdfStorage, SupabasePrivatePdfStorage, RoutedStorageService, PrivatePdfStore } from './private-pdf-storage';

const isProduction = process.env.NODE_ENV === "production";

export const privatePdfStorage: PrivatePdfStore = isProduction
  ? new SupabasePrivatePdfStorage()
  : new LocalPrivatePdfStorage();

const publicStorage: StorageService = isProduction
  ? new SupabaseStorageService()
  : new LocalStorageService();
export const storageService: StorageService = new RoutedStorageService(publicStorage, privatePdfStorage);
