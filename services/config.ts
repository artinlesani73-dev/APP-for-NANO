import metadata from '../metadata.json';

const USER_STORAGE_KEY = 'nano_user_display_name';
const SHARED_API_KEY_STORAGE_KEY = 'shared_api_key';
const ADMIN_PASSPHRASE_KEY = 'nano_admin_passphrase';

const readLogEndpoint = () => {
  const envEndpoint = (import.meta as any).env?.VITE_LOG_ENDPOINT;
  // @ts-ignore Optional process env for non-Vite runtimes
  const processEndpoint = typeof process !== 'undefined' ? process.env?.VITE_LOG_ENDPOINT : undefined;
  const metadataEndpoint = (metadata as any).logEndpoint as string | undefined;
  return envEndpoint || processEndpoint || metadataEndpoint || undefined;
};

const readAdminPassphrase = () => {
  const envPassphrase = (import.meta as any).env?.VITE_ADMIN_PASSPHRASE;
  // @ts-ignore Optional process env for non-Vite runtimes
  const processPassphrase = typeof process !== 'undefined' ? process.env?.VITE_ADMIN_PASSPHRASE : undefined;
  const metadataPassphrase = (metadata as any).adminPassphrase as string | undefined;
  return envPassphrase || processPassphrase || metadataPassphrase || undefined;
};

const readEnvKey = () => {
  const envApiKey = (import.meta as any).env?.VITE_SHARED_API_KEY || (import.meta as any).env?.API_KEY;
  // @ts-ignore Optional process env for non-Vite runtimes
  const processApiKey = typeof process !== 'undefined' ? (process.env?.VITE_SHARED_API_KEY || process.env?.API_KEY) : undefined;
  return envApiKey || processApiKey;
};

export const AppConfig = {
  userStorageKey: USER_STORAGE_KEY,
  sharedApiKeyStorageKey: SHARED_API_KEY_STORAGE_KEY,
  getSharedApiKey: (): string | undefined => {
    const envKey = readEnvKey();
    const metadataKey = (metadata as any).sharedApiKey as string | undefined;
    const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem(SHARED_API_KEY_STORAGE_KEY) : null;

    const key = envKey || storedKey || metadataKey;
    if (key && key.trim()) {
      return key.trim();
    }
    return undefined;
  },
  getLogEndpoint: (): string | undefined => {
    const endpoint = readLogEndpoint();
    return endpoint && endpoint.trim() ? endpoint.trim() : undefined;
  },
  getAdminPassphrase: (): string | undefined => {
    const storedPassphrase = typeof localStorage !== 'undefined' ? localStorage.getItem(ADMIN_PASSPHRASE_KEY) : null;
    const passphrase = readAdminPassphrase() || storedPassphrase || '';
    return passphrase.trim() || undefined;
  }
};
