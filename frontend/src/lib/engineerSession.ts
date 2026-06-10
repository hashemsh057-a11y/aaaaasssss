const ENGINEER_SESSION_KEY = "engiflow_public_engineer_session";

export type EngineerManagementSession = {
  id: number;
  token: string;
};

export function loadEngineerManagementSession(): EngineerManagementSession | null {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(ENGINEER_SESSION_KEY);
  if (!stored) return null;

  try {
    const session = JSON.parse(stored) as Partial<EngineerManagementSession>;
    if (
      typeof session.id !== "number" ||
      !Number.isInteger(session.id) ||
      session.id <= 0 ||
      typeof session.token !== "string" ||
      !session.token.trim()
    ) {
      window.localStorage.removeItem(ENGINEER_SESSION_KEY);
      return null;
    }
    return { id: session.id, token: session.token };
  } catch {
    window.localStorage.removeItem(ENGINEER_SESSION_KEY);
    return null;
  }
}

export function saveEngineerManagementSession(session: EngineerManagementSession) {
  window.localStorage.setItem(ENGINEER_SESSION_KEY, JSON.stringify(session));
}

export function clearEngineerManagementSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ENGINEER_SESSION_KEY);
  }
}
