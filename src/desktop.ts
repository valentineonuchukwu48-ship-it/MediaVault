/**
 * Typed wrapper around the Electron preload bridge (window.desktop).
 *
 * The same React bundle also runs in a plain browser (npm run dev), where the
 * bridge is absent — every helper degrades to a no-op so components never crash.
 */

export interface DesktopSettings {
  cookiesFromBrowser?: string;
  cookiesFile?: string;
  geminiApiKey?: string;
}

export interface CookiesPickResult {
  ok: boolean;
  canceled?: boolean;
  path?: string;
  name?: string;
  error?: string;
}

export interface EngineInfo {
  port: number;
  dataDir: string;
  packaged: boolean;
}

export interface UpdateStatus {
  state: 'available' | 'downloaded' | 'error';
  version?: string;
}

export interface PhoneConnectResult {
  ok: boolean;
  enabled: boolean;
  port?: number;
  error?: string;
}

export interface DesktopBridge {
  isDesktop: true;
  platform: string;
  getVersion(): Promise<string>;
  getEngineInfo(): Promise<EngineInfo>;
  getSettings(): Promise<DesktopSettings>;
  setSettings(patch: DesktopSettings): Promise<DesktopSettings>;
  openDataFolder(): Promise<string>;
  openOutputFolder(): Promise<string>;
  openExternal(url: string): Promise<boolean | void>;
  checkForUpdates(): Promise<void>;
  pickCookiesFile(): Promise<CookiesPickResult>;
  clearCookies(): Promise<{ ok: boolean }>;
  onUpdate(cb: (status: UpdateStatus) => void): () => void;
  setPhoneConnect(enable: boolean): Promise<PhoneConnectResult>;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export function getDesktop(): DesktopBridge | null {
  return typeof window !== 'undefined' && window.desktop ? window.desktop : null;
}

export function isDesktop(): boolean {
  return getDesktop() !== null;
}

/** Browsers yt-dlp can read a Facebook session from. */
export const COOKIE_BROWSERS: { value: string; label: string }[] = [
  { value: '', label: "Don't use browser cookies" },
  { value: 'chrome', label: 'Chrome' },
  { value: 'edge', label: 'Microsoft Edge' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'brave', label: 'Brave' },
  { value: 'chromium', label: 'Chromium' },
];
