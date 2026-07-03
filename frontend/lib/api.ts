const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";
const REQUEST_TIMEOUT_MS = 15000;

export const TOKEN_KEY = "icepunk_token";

function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

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
    signal: withTimeout(),
  });
}

export async function registerUser(body: RegisterBody) {
  return fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: withTimeout(),
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

export type GenerateMidiResponse = {
  downloadUrl: string;
  totalGenerations: number;
};

export type UploadVisibility = "PRIVATE" | "UNLISTED" | "PUBLIC";

export type UploadProjectInput = {
  title: string;
  visibility: UploadVisibility;
  midiFile: File;
  sampleFile: File;
  token: string;
  onProgress?: (progress: number) => void;
};

export type UploadProjectResponse = {
  id: number;
  ownerId: number;
  title: string;
  midiObjectKey: string;
  midiUrl: string;
  sampleObjectKey: string;
  sampleUrl: string;
  uploadedAt: string;
  visibility: UploadVisibility;
  metadata: Record<string, unknown>;
};

export async function getGenerationStats(
  signal?: AbortSignal,
): Promise<GenerationStatsResponse> {
  const response = await fetch(`${API_URL}/generation-stats`, {
    method: "GET",
    signal: withTimeout(signal),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  return response.json();
}

export async function generateMidiPack(
  token?: string | null,
  signal?: AbortSignal,
): Promise<GenerateMidiResponse> {
  const response = await fetch(`${API_URL}/generate`, {
    method: "POST",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
    signal: withTimeout(signal),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  return response.json();
}

export function uploadMidiProject({
  title,
  visibility,
  midiFile,
  sampleFile,
  token,
  onProgress,
}: UploadProjectInput): Promise<UploadProjectResponse> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("visibility", visibility);
  formData.append("midi", midiFile);
  formData.append("sample", sampleFile);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", `${API_URL}/uploads/projects`);
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.timeout = REQUEST_TIMEOUT_MS;

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;

      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve(JSON.parse(request.responseText) as UploadProjectResponse);
        return;
      }

      reject(new Error(`HTTP_${request.status}: ${request.responseText || request.statusText}`));
    };

    request.onerror = () => {
      reject(new Error("Upload failed. Check your connection and try again."));
    };

    request.ontimeout = () => {
      reject(new Error("Upload timed out. Please try again."));
    };

    request.send(formData);
  });
}
