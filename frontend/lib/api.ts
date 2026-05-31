const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

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

export async function authUser(mode: AuthMode, body: LoginBody | RegisterBody) {
  if (mode === "login") {
    return loginUser(body as LoginBody);
  }

  return registerUser(body as RegisterBody);
}

type GenerateMidiResponse = {
  downloadUrl: string;
};

export async function generateMidiPack(
  token?: string | null,
): Promise<GenerateMidiResponse> {
  const response = await fetch(`${API_URL}/generate`, {
    method: "GET",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });

  if (!response.ok) {
    throw new Error("Failed to generate MIDI pack");
  }

  return response.json();
}
