import metadata from '../metadata.json';

const USER_STORAGE_KEY = 'nano_user_display_name';
const USER_ID_STORAGE_KEY = 'nano_user_id';
const SHARED_API_KEY_STORAGE_KEY = 'shared_api_key';

const getBridgeEnv = () => {
  if (typeof window === 'undefined') return undefined;
  return (window as any).env as
    | {
        sharedApiKey?: string;
        logEndpoint?: string;
      }
    | undefined;
};

const readLogEndpoint = () => {
  const bridged = getBridgeEnv()?.logEndpoint;
  const envEndpoint = (import.meta as any).env?.VITE_LOG_ENDPOINT;
  // @ts-ignore Optional process env for non-Vite runtimes
  const processEndpoint = typeof process !== 'undefined' ? process.env?.VITE_LOG_ENDPOINT : undefined;
  const metadataEndpoint = (metadata as any).logEndpoint as string | undefined;
  return bridged || envEndpoint || processEndpoint || metadataEndpoint || undefined;
};

const readEnvKey = () => {
  const bridged = getBridgeEnv()?.sharedApiKey;
  const envApiKey = (import.meta as any).env?.VITE_SHARED_API_KEY || (import.meta as any).env?.API_KEY;
  // @ts-ignore Optional process env for non-Vite runtimes
  const processApiKey = typeof process !== 'undefined' ? (process.env?.VITE_SHARED_API_KEY || process.env?.API_KEY) : undefined;
  return bridged || envApiKey || processApiKey;
};

export const AppConfig = {
  userStorageKey: USER_STORAGE_KEY,
  userIdStorageKey: USER_ID_STORAGE_KEY,
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
  }
};
