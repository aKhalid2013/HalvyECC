import Constants from 'expo-constants';

interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiApiKey: string;
}

function requireEnv(key: keyof AppConfig, value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

const extra = Constants.expoConfig?.extra ?? {};

export const config: AppConfig = {
  supabaseUrl: requireEnv('supabaseUrl', extra.supabaseUrl),
  supabaseAnonKey: requireEnv('supabaseAnonKey', extra.supabaseAnonKey),
  geminiApiKey: requireEnv('geminiApiKey', extra.geminiApiKey),
};
