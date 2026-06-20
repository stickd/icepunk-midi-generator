const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

export const TOKEN_KEY = "icepunk_token";

type AuthMode = "login" | "register";

type LoginBody = {
  email: string;
  password: string;
};

type RegisterBody = {
  username: string;
  email: string;
  password: string;
};

export async function loginUser(body: LoginBody) {
  return fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function registerUser(body: RegisterBody) {
  return fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function authUser(
  mode: AuthMode,
  body: LoginBody | RegisterBody,
): Promise<Response> {
  if (mode === "login") {
    return loginUser(body as LoginBody);
  }

  return registerUser(body as RegisterBody);
}

export type GenerationStatsResponse = {
  totalGenerations: number;
};

type GenerateMidiResponse = {
  downloadUrl: string;
  totalGenerations: number;
};

export async function getGenerationStats(
  signal?: AbortSignal,
): Promise<GenerationStatsResponse> {
  const response = await fetch(`${API_URL}/generation-stats`, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  return response.json();
}

export async function generateMidiPack(
  token?: string | null,
): Promise<GenerateMidiResponse> {
  const response = await fetch(`${API_URL}/generate`, {
    method: "POST",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  return response.json();
}
