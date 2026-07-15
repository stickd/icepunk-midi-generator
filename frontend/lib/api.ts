const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";
const REQUEST_TIMEOUT_MS = 15000;

export const TOKEN_KEY = "icepunk_token";

export function normalizeAuthToken(value?: string | null) {
  const token = value?.trim();
  return token && token !== "undefined" && token !== "null" ? token : null;
}

function apiUrl(pathOrUrl?: string) {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function normalizeGeneratedMidiResponse(response: GenerateMidiResponse): GenerateMidiResponse {
  const result: GenerateMidiResponse = { ...response };
  if (response.downloadUrl) result.downloadUrl = apiUrl(response.downloadUrl);
  if (response.packDownloadUrl) result.packDownloadUrl = apiUrl(response.packDownloadUrl);
  if (Array.isArray(response.items)) {
    result.items = response.items.map((item) => ({
      ...item,
      downloadUrl: apiUrl(item.downloadUrl),
    }));
  }
  return result;
}

function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

type AuthMode = "login" | "register";

type LoginBody = {
  identifier: string;
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

export type GenerationUsageResponse = {
  used: number;
  limit: number;
};

export type MidiPreviewNote = {
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
};

export type MidiPreview = {
  notes: MidiPreviewNote[];
  truncated: boolean;
};

export type GeneratedMidiItem = {
  id: string;
  index: number;
  fileName: string;
  downloadUrl: string;
  durationSeconds: number | null;
  noteCount: number | null;
  trackCount: number | null;
  minPitch: number | null;
  maxPitch: number | null;
  avgPitch: number | null;
  bpm: number | null;
  preview: MidiPreview;
};

export type GenerateMidiResponse = {
  packId: string;
  name: string;
  source: GenerationSource;
  type: GenerationType;
  bpm: number | null;
  pitch: number | null;
  octaves: number | null;
  amount: number;
  createdAt: string;
  packDownloadUrl: string;
  downloadUrl: string;
  totalGenerations: number;
  items: GeneratedMidiItem[];
};

export type GeneratedPackVisibility = "PUBLIC" | "PRIVATE";

export type PublicGeneratedPackFeedItem = {
  packId: string;
  name: string;
  ownerId: number | null;
  ownerUsername: string;
  source: GenerationSource;
  type: GenerationType;
  bpm: number | null;
  pitch: number | null;
  octaves: number | null;
  amount: number;
  createdAt: string;
  visibility: GeneratedPackVisibility;
  packDownloadUrl: string;
  items: GeneratedMidiItem[];
};

export type PublicGeneratedPackFeedResponse = {
  items: PublicGeneratedPackFeedItem[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
};

export type GenerationSource = "FACTORY" | "CUSTOM_UPLOAD";
export type GenerationType = "MELODY" | "DRUMS";
export type PublishMode = "PUBLIC" | "PRIVATE";

export type GenerateMidiRequest = {
  source: GenerationSource;
  amount: number;
  packName: string;
  type: GenerationType;
  bpm: number;
  pitch: number;
  octaves: number;
  tempAnalysisId?: string;
  datasetIds?: string[];
  includeFactoryPool?: boolean;
  publishMode?: PublishMode;
};

export type TempAnalysisResponse = {
  tempAnalysisId: string;
  fileCount: number;
  metadata: Record<string, unknown>;
};

export type DatasetPreset = {
  id: string;
  name: string;
  sourceMidiCount: number;
  createdAt: string;
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
  sampleUrl: string | null;
  uploadedAt: string;
  visibility: UploadVisibility;
  metadata: Record<string, unknown>;
};

export type PublicUploadFeedItem = {
  id: number;
  ownerId: number;
  ownerUsername: string;
  title: string;
  midiUrl: string;
  sampleUrl: string | null;
  uploadedAt: string;
  visibility: UploadVisibility;
  metadata: Record<string, unknown>;
};

export type PublicUploadFeedResponse = {
  items: PublicUploadFeedItem[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
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

export async function getGenerationUsage(
  token?: string | null,
  signal?: AbortSignal,
): Promise<GenerationUsageResponse> {
  const response = await fetch(`${API_URL}/generation-usage`, {
    method: "GET",
    headers: authHeaders(token),
    signal: withTimeout(signal),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  return response.json();
}

export async function generateMidiPack(
  request: GenerateMidiRequest,
  token?: string | null,
  signal?: AbortSignal,
): Promise<GenerateMidiResponse> {
  const normalizedToken = normalizeAuthToken(token);
  const response = await fetch(`${API_URL}/generate`, {
    method: "POST",
    headers: normalizedToken
      ? {
          "Content-Type": "application/json",
          Authorization: `Bearer ${normalizedToken}`,
        }
      : {
          "Content-Type": "application/json",
        },
    body: JSON.stringify(request),
    signal: withTimeout(signal),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  return normalizeGeneratedMidiResponse((await response.json()) as GenerateMidiResponse);
}

export async function analyzeTempMidiFiles(
  files: File[],
  signal?: AbortSignal,
): Promise<TempAnalysisResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_URL}/datasets/analyze-temp`, {
    method: "POST",
    body: formData,
    signal: withTimeout(signal),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  return response.json();
}

export async function saveDatasetPreset(
  token: string,
  name: string,
  tempAnalysisId: string,
  signal?: AbortSignal,
): Promise<DatasetPreset> {
  return fetchJson("/datasets", {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name, tempAnalysisId }),
    signal,
  });
}

export async function getDatasetPresets(
  token: string,
  signal?: AbortSignal,
): Promise<DatasetPreset[]> {
  return fetchJson("/datasets", { headers: authHeaders(token), signal });
}

export async function deleteDatasetPreset(
  token: string,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_URL}/datasets/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
    signal: withTimeout(signal),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }
}

export async function getPublicUploadFeed(
  page = 0,
  size = 10,
  signal?: AbortSignal,
): Promise<PublicUploadFeedResponse> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });

  const response = await fetch(`${API_URL}/uploads/feed?${params.toString()}`, {
    method: "GET",
    signal: withTimeout(signal),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  const feed = (await response.json()) as PublicUploadFeedResponse;

  return {
    ...feed,
    items: feed.items.map((item) => ({
      ...item,
      midiUrl: apiUrl(item.midiUrl),
      sampleUrl: item.sampleUrl ? apiUrl(item.sampleUrl) : null,
    })),
  };
}

export async function getPublicGeneratedPackFeed(
  page = 0,
  size = 10,
  signal?: AbortSignal,
): Promise<PublicGeneratedPackFeedResponse> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });

  const response = await fetch(`${API_URL}/generated-packs/feed?${params.toString()}`, {
    method: "GET",
    signal: withTimeout(signal),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  const feed = (await response.json()) as PublicGeneratedPackFeedResponse;

  return {
    ...feed,
    items: feed.items.map((item) => ({
      ...item,
      packDownloadUrl: apiUrl(item.packDownloadUrl),
      items: item.items.map((midiItem) => ({
        ...midiItem,
        downloadUrl: apiUrl(midiItem.downloadUrl),
      })),
    })),
  };
}

export async function getUserGeneratedPacksFeed(
  username: string,
  page = 0,
  size = 10,
  signal?: AbortSignal,
): Promise<PublicGeneratedPackFeedResponse> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });

  const response = await fetch(
    `${API_URL}/users/${encodeURIComponent(username)}/generated-packs?${params.toString()}`,
    {
      method: "GET",
      signal: withTimeout(signal),
    },
  );

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  const feed = (await response.json()) as PublicGeneratedPackFeedResponse;

  return {
    ...feed,
    items: feed.items.map((item) => ({
      ...item,
      packDownloadUrl: apiUrl(item.packDownloadUrl),
      items: item.items.map((midiItem) => ({
        ...midiItem,
        downloadUrl: apiUrl(midiItem.downloadUrl),
      })),
    })),
  };
}

export function getPublicUploadMidiPreviewUrl(projectId: number) {
  return `${API_URL}/uploads/projects/${projectId}/midi`;
}

export type UserProfileResponse = {
  id: number;
  username: string;
  bio: string | null;
  profilePictureUrl: string | null;
  verified: boolean;
  joinedAt: string;
  packCount: number;
  totalDownloads: number;
  totalLikes: number;
};

export type UserPackItem = {
  id: number;
  ownerId: number;
  ownerUsername: string;
  title: string;
  midiUrl: string;
  sampleUrl: string | null;
  uploadedAt: string;
  metadata: Record<string, unknown>;
  downloadCount: number;
  likeCount: number;
  likedByViewer: boolean;
};

export type UserPackListResponse = {
  items: UserPackItem[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
};

export type MeResponse = {
  id: number;
  username: string;
  email: string;
  bio: string | null;
  profilePictureUrl: string | null;
  credits: number;
  verified: boolean;
  joinedAt: string;
};

export type LikeResponse = {
  projectId: number;
  liked: boolean;
  likeCount: number;
};

function authHeaders(token?: string | null): Record<string, string> {
  const normalizedToken = normalizeAuthToken(token);
  return normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {};
}

async function fetchJson<T>(
  path: string,
  init: RequestInit & { signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    signal: withTimeout(init.signal ?? undefined),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  return response.json();
}

export async function getUserProfile(
  username: string,
  signal?: AbortSignal,
): Promise<UserProfileResponse> {
  const profile = await fetchJson<UserProfileResponse>(`/users/${encodeURIComponent(username)}/profile`, { signal });
  return {
    ...profile,
    profilePictureUrl: profile.profilePictureUrl ? apiUrl(profile.profilePictureUrl) : null,
  };
}

export async function getUserPacks(
  username: string,
  page = 0,
  size = 12,
  token?: string | null,
  signal?: AbortSignal,
): Promise<UserPackListResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });

  const packs = await fetchJson<UserPackListResponse>(`/users/${encodeURIComponent(username)}/packs?${params.toString()}`, {
    headers: authHeaders(token),
    signal,
  });

  return {
    ...packs,
    items: packs.items.map((item) => ({
      ...item,
      midiUrl: apiUrl(item.midiUrl),
      sampleUrl: item.sampleUrl ? apiUrl(item.sampleUrl) : null,
    })),
  };
}

export async function getMe(
  token: string,
  signal?: AbortSignal,
): Promise<MeResponse> {
  const me = await fetchJson<MeResponse>("/users/me", { headers: authHeaders(token), signal });
  return {
    ...me,
    profilePictureUrl: me.profilePictureUrl ? apiUrl(me.profilePictureUrl) : null,
  };
}

export async function uploadAvatar(
  token: string,
  file: File,
  signal?: AbortSignal,
): Promise<MeResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/users/me/avatar`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
    signal: withTimeout(signal),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(`HTTP_${response.status}: ${message || response.statusText}`);
  }

  const me = (await response.json()) as MeResponse;
  return {
    ...me,
    profilePictureUrl: me.profilePictureUrl ? apiUrl(me.profilePictureUrl) : null,
  };
}

export async function updateProfilePictureUrl(
  token: string,
  profilePictureUrl: string,
  signal?: AbortSignal,
): Promise<MeResponse> {
  const me = await fetchJson<MeResponse>("/users/me/profile", {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ profilePictureUrl }),
    signal,
  });
  return {
    ...me,
    profilePictureUrl: me.profilePictureUrl ? apiUrl(me.profilePictureUrl) : null,
  };
}

export async function getFavorites(
  token: string,
  page = 0,
  size = 12,
  signal?: AbortSignal,
): Promise<UserPackListResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });

  const packs = await fetchJson<UserPackListResponse>(`/users/me/favorites?${params.toString()}`, {
    headers: authHeaders(token),
    signal,
  });

  return {
    ...packs,
    items: packs.items.map((item) => ({
      ...item,
      midiUrl: apiUrl(item.midiUrl),
      sampleUrl: item.sampleUrl ? apiUrl(item.sampleUrl) : null,
    })),
  };
}

export async function setProjectLiked(
  projectId: number,
  liked: boolean,
  token: string,
  signal?: AbortSignal,
): Promise<LikeResponse> {
  return fetchJson(`/uploads/projects/${projectId}/like`, {
    method: liked ? "POST" : "DELETE",
    headers: authHeaders(token),
    signal,
  });
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
        const response = JSON.parse(request.responseText) as UploadProjectResponse;
        resolve({
          ...response,
          midiUrl: apiUrl(response.midiUrl),
          sampleUrl: response.sampleUrl ? apiUrl(response.sampleUrl) : null,
        });
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
