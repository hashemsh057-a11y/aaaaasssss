const DEVICE_ID_KEY = "engiflow_device_id";

export type DeviceIdentity = {
  id: string;
  label: string;
};

function createDeviceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function detectDeviceLabel() {
  if (typeof navigator === "undefined") return "Unknown browser";
  const userAgent = navigator.userAgent;
  const browser =
    userAgent.includes("Edg/") ? "Edge" :
    userAgent.includes("Chrome/") ? "Chrome" :
    userAgent.includes("Firefox/") ? "Firefox" :
    userAgent.includes("Safari/") ? "Safari" :
    "Browser";
  const platform =
    userAgent.includes("Windows") ? "Windows" :
    userAgent.includes("Android") ? "Android" :
    /iPhone|iPad|iPod/.test(userAgent) ? "iOS" :
    userAgent.includes("Mac OS") ? "macOS" :
    userAgent.includes("Linux") ? "Linux" :
    "device";
  return `${browser} on ${platform}`;
}

export function getOrCreateDeviceIdentity(): DeviceIdentity {
  if (typeof window === "undefined") {
    return { id: "", label: "Server render" };
  }

  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = createDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return { id, label: detectDeviceLabel() };
}
