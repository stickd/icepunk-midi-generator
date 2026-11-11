import createClient from "openapi-fetch";
import type { components, paths } from "@/lib/api-schema";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

export const TOKEN_KEY = "icepunk_token";

// Types are generated from openapi/openapi.yaml by `npm run generate:api`.
type Schemas = components["schemas"];

export type LoginBody = Schemas["LoginRequest"];
export type RegisterBody = Schemas["RegisterRequest"];
export type AuthResponse = Schemas["AuthResponse"];
export type GenerationStatsResponse = Schemas["GenerationStatsResponse"];
export type GenerateMidiResponse = Schemas["GenerateResponse"];

type AuthMode = "login" | "register";

const client = createClient<paths>({ baseUrl: API_URL });

function httpError(response: Response, error?: { error: string }) {
  return new Error(
    `HTTP_${response.status}: ${error?.error || response.statusText}`,
  );
}

export async function loginUser(body: LoginBody) {
  return client.POST("/auth/login", { body });
}

export async function registerUser(body: RegisterBody) {
  return client.POST("/auth/register", { body });
}

export async function authUser(
  mode: AuthMode,
  body: LoginBody | RegisterBody,
): Promise<{ data?: AuthResponse; response: Response }> {
  if (mode === "login") {
    return loginUser(body as LoginBody);
  }

  return registerUser(body as RegisterBody);
}

export async function getGenerationStats(
  signal?: AbortSignal,
): Promise<GenerationStatsResponse> {
  const { data, error, response } = await client.GET("/generation-stats", {
    signal,
  });

  if (!data) {
    throw httpError(response, error);
  }

  return data;
}

export async function generateMidiPack(
  token?: string | null,
): Promise<GenerateMidiResponse> {
  const { data, error, response } = await client.POST("/generate", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!data) {
    throw httpError(response, error);
  }

  return data;
}
