"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  authUser,
  getFavorites,
  getMe,
  getUserGeneratedPacksFeed,
  getUserPacks,
  getUserProfile,
  MeResponse,
  PublicGeneratedPackFeedItem,
  TOKEN_KEY,
  UserPackItem,
  UserProfileResponse,
} from "@/lib/api";
import { Button, CreditBadge, EmptyState, Panel, Skeleton, ToastNotification } from "@/components/ui";
import AuthModal from "@/components/AuthModal";
import GenerationFeedCard from "@/components/sketch/GenerationFeedCard";
import { toFeedGeneration } from "@/components/sketch/feedTypes";
import { SoundEngineSettings } from "@/hooks/useBrowserMidiPlayback";
import PackCard from "./PackCard";
import ProfileHeader from "./ProfileHeader";
import ProfileStats from "./ProfileStats";

const TOKEN_CHANGE_EVENT = "icepunk-token-change";

const DEFAULT_SOUND_ENGINE: SoundEngineSettings = {
  preset: "Soft Piano",
  sampleFile: null,
  volume: 0.8,
};

type ProfileViewProps = {
  username: string;
};

type TabId = "generated" | "packs" | "favorites";

type PackListState = {
  items: UserPackItem[];
  page: number;
  totalItems?: number;
  hasNext: boolean;
  status: "idle" | "loading" | "ready" | "error";
};

type GeneratedPackListState = {
  items: PublicGeneratedPackFeedItem[];
  page: number;
  totalItems?: number;
  hasNext: boolean;
  status: "idle" | "loading" | "ready" | "error";
};

function normalizeToken(value: string | null) {
  return value && value !== "undefined" && value !== "null" ? value : null;
}

function subscribeToTokenChanges(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(TOKEN_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(TOKEN_CHANGE_EVENT, callback);
  };
}

function getTokenSnapshot() {
  return normalizeToken(localStorage.getItem(TOKEN_KEY));
}

function getServerTokenSnapshot() {
  return null;
}

export default function ProfileView({ username }: ProfileViewProps) {
  const token = useSyncExternalStore(
    subscribeToTokenChanges,
    getTokenSnapshot,
    getServerTokenSnapshot,
  );

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [profileStatus, setProfileStatus] = useState<"loading" | "ready" | "not-found" | "error">(
    "loading",
  );
  const [meFetch, setMeFetch] = useState<{ token: string; me: MeResponse } | null>(null);
  const [tab, setTab] = useState<TabId>("generated");
  const [generatedPacks, setGeneratedPacks] = useState<GeneratedPackListState>({
    items: [],
    page: 0,
    hasNext: false,
    status: "loading",
  });
  const [packs, setPacks] = useState<PackListState>({
    items: [],
    page: 0,
    hasNext: false,
    status: "loading",
  });
  const [favorites, setFavorites] = useState<PackListState>({
    items: [],
    page: 0,
    hasNext: false,
    status: "idle",
  });
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [authStatus, setAuthStatus] = useState("");
  const [email, setEmail] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [authNotice, setAuthNotice] = useState(false);

  const me = token && meFetch?.token === token ? meFetch.me : null;
  const isOwnProfile = me !== null && me.username === username;
  const activeTab: TabId = !isOwnProfile && tab === "favorites" ? "generated" : tab;

  function handleRequireLogin() {
    setAuthMode("login");
    setAuthStatus("Sign up or log in to keep creating and downloading free of charge!");
    setToastMessage("Sign up or log in to keep creating and downloading free of charge!");
  }

  function notifyTokenChanged() {
    window.dispatchEvent(new Event(TOKEN_CHANGE_EVENT));
  }

  async function handleAuth() {
    if (!authMode) return;

    try {
      setIsAuthenticating(true);
      setAuthStatus(authMode === "login" ? "Logging in..." : "Creating account...");

      const body =
        authMode === "login"
          ? { email, password }
          : { username: authUsername, email, password };

      const response = await authUser(authMode, body);

      if (!response.ok) {
        if (response.status === 409) {
          setAuthStatus("Username or email is already taken.");
          return;
        }

        if (response.status === 401) {
          setAuthStatus("Invalid credentials.");
          return;
        }

        if (response.status === 400) {
          setAuthStatus("Check your email, username, and password length.");
          return;
        }

        setAuthStatus("Auth failed. Check your data.");
        return;
      }

      const data = await response.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      notifyTokenChanged();
      setToastMessage("You are logged in.");
      setAuthStatus("");
      setAuthMode(null);
      setEmail("");
      setAuthUsername("");
      setPassword("");
    } catch {
      setAuthStatus("Backend is not available right now.");
    } finally {
      setIsAuthenticating(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    getUserProfile(username, controller.signal)
      .then((data) => {
        setProfile(data);
        setProfileStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "";
        const isNotFound = message.includes("404") || message.includes("not found");
        setProfileStatus(isNotFound ? "not-found" : "error");
      });

    return () => controller.abort();
  }, [username]);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    getMe(token, controller.signal)
      .then((data) => setMeFetch({ token, me: data }))
      .catch(() => {});

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();

    getUserPacks(username, 0, 12, getTokenSnapshot(), controller.signal)
      .then((response) =>
        setPacks({
          items: response.items,
          page: response.page,
          totalItems: response.totalItems,
          hasNext: response.hasNext,
          status: "ready",
        }),
      )
      .catch(() => {
        if (controller.signal.aborted) return;
        setPacks((state) => ({ ...state, status: "error" }));
      });

    return () => controller.abort();
  }, [username]);

  useEffect(() => {
    const controller = new AbortController();

    getUserGeneratedPacksFeed(username, 0, 6, controller.signal)
      .then((response) =>
        setGeneratedPacks({
          items: response.items,
          page: response.page,
          totalItems: response.totalItems,
          hasNext: response.hasNext,
          status: "ready",
        }),
      )
      .catch(() => {
        if (controller.signal.aborted) return;
        setGeneratedPacks((state) => ({ ...state, status: "error" }));
      });

    return () => controller.abort();
  }, [username]);

  function fetchMoreGeneratedPacks() {
    setGeneratedPacks((state) => ({ ...state, status: "loading" }));
    getUserGeneratedPacksFeed(username, generatedPacks.page + 1, 6)
      .then((response) =>
        setGeneratedPacks((state) => ({
          items: [...state.items, ...response.items],
          page: response.page,
          totalItems: response.totalItems,
          hasNext: response.hasNext,
          status: "ready",
        })),
      )
      .catch(() => setGeneratedPacks((state) => ({ ...state, status: "error" })));
  }

  function fetchFavorites(page: number) {
    if (!token) return;

    setFavorites((state) => ({ ...state, status: "loading" }));
    getFavorites(token, page, 12)
      .then((response) =>
        setFavorites((state) => ({
          items: page === 0 ? response.items : [...state.items, ...response.items],
          page: response.page,
          totalItems: response.totalItems,
          hasNext: response.hasNext,
          status: "ready",
        })),
      )
      .catch(() => setFavorites((state) => ({ ...state, status: "error" })));
  }

  function fetchMorePacks() {
    setPacks((state) => ({ ...state, status: "loading" }));
    getUserPacks(username, packs.page + 1, 12, token)
      .then((response) =>
        setPacks((state) => ({
          items: [...state.items, ...response.items],
          page: response.page,
          totalItems: response.totalItems,
          hasNext: response.hasNext,
          status: "ready",
        })),
      )
      .catch(() => setPacks((state) => ({ ...state, status: "error" })));
  }

  function handleTabChange(next: TabId) {
    setTab(next);
    if (next === "favorites" && favorites.status === "idle") {
      fetchFavorites(0);
    }
  }

  const activeList = activeTab === "favorites" ? favorites : packs;
  const loadMore = () =>
    activeTab === "favorites" ? fetchFavorites(favorites.page + 1) : fetchMorePacks();

  if (username.toLowerCase() === "guest") {
    return (
      <EmptyState
        action={
          <Link href="/">
            <Button variant="primary">Back to generator</Button>
          </Link>
        }
        className="mx-auto mt-16 max-w-md"
        description="Guest users don't have a public profile page. Create an account or log in to customize your profile!"
        title="Guest Profile"
      />
    );
  }

  if (profileStatus === "not-found") {
    return (
      <EmptyState
        action={
          <Link href="/">
            <Button variant="primary">Back to generator</Button>
          </Link>
        }
        className="mx-auto mt-16 max-w-md"
        description={`Nobody named "${username}" is registered here.`}
        title="User not found"
      />
    );
  }

  if (profileStatus === "error") {
    return (
      <EmptyState
        action={
          <Link href="/">
            <Button variant="primary">Back to generator</Button>
          </Link>
        }
        className="mx-auto mt-16 max-w-md"
        description="The backend is not reachable right now. Try again in a moment."
        title="Profile unavailable"
      />
    );
  }

  return (
    <div className="grid gap-8">
      <nav className="flex items-center justify-between">
        <Link
          className="text-sm font-semibold tracking-[0.02em] text-ice-primary outline-none transition-[color] duration-150 ease-out hover:text-white focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)]"
          href="/"
        >
          iCEPUNK
        </Link>
        {me ? (
          <div className="flex items-center gap-3">
            <CreditBadge credits={me.credits} />
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--ice-accent-soft)] text-sm font-semibold text-[color:var(--ice-accent-text)] ring-1 ring-[color:var(--ice-accent-border)]"
            >
              {me.username.slice(0, 1).toUpperCase()}
            </span>
          </div>
        ) : null}
      </nav>

      {profileStatus === "loading" || !profile ? (
        <div className="grid gap-8">
          <div className="flex items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="grid gap-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-[var(--ice-radius-card)]" />
        </div>
      ) : (
        <>
          <ProfileHeader isOwnProfile={isOwnProfile} profile={profile} token={token} />
          <ProfileStats profile={profile} />
        </>
      )}

      <div className="grid gap-5">
        <div
          className="flex gap-6 border-b border-white/[0.06]"
          role="tablist"
          aria-label="Profile content"
        >
          {(
            [
              {
                id: "generated" as TabId,
                label: "Generated",
                count: generatedPacks.totalItems,
                visible: true,
              },
              {
                id: "packs" as TabId,
                label: "Uploads",
                count: packs.totalItems,
                visible: true,
              },
              {
                id: "favorites" as TabId,
                label: "Favorites",
                count: favorites.totalItems,
                visible: isOwnProfile,
              },
            ] satisfies Array<{ id: TabId; label: string; count?: number; visible: boolean }>
          )
            .filter((item) => item.visible)
            .map((item) => (
              <button
                key={item.id}
                aria-selected={activeTab === item.id}
                className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-medium outline-none transition-[color,border-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)] ${
                  activeTab === item.id
                    ? "border-[color:var(--ice-accent)] text-ice-primary"
                    : "border-transparent text-ice-muted hover:text-ice-secondary"
                }`}
                onClick={() => handleTabChange(item.id)}
                role="tab"
                type="button"
              >
                <span>{item.label}</span>
                {typeof item.count === "number" ? (
                  <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-xs font-semibold text-ice-muted">
                    {item.count}
                  </span>
                ) : null}
              </button>
            ))}
        </div>

        {authNotice ? (
          <Panel className="px-4 py-3 text-sm text-ice-secondary" role="status">
            Log in on the{" "}
            <Link className="text-[color:var(--ice-accent-text)] underline" href="/">
              generator page
            </Link>{" "}
            to like packs.
          </Panel>
        ) : null}

        {activeTab === "generated" ? (
          <>
            {generatedPacks.status === "error" ? (
              <EmptyState
                title="Could not load generated packs"
                description="The backend is not reachable right now."
              />
            ) : generatedPacks.status === "ready" && generatedPacks.items.length === 0 ? (
              <EmptyState
                title="No generated packs yet"
                description="Public MIDI packs created with the generator will show up here."
              />
            ) : (
              <div className="grid gap-4">
                {generatedPacks.items.map((item) => (
                  <GenerationFeedCard
                    generation={toFeedGeneration(item)}
                    isLoggedIn={Boolean(token)}
                    key={item.packId}
                    onRequireLogin={handleRequireLogin}
                    onStubStatus={setToastMessage}
                    soundEngine={DEFAULT_SOUND_ENGINE}
                  />
                ))}
                {generatedPacks.status === "loading"
                  ? Array.from({ length: generatedPacks.items.length === 0 ? 3 : 1 }).map((_, index) => (
                      <Skeleton
                        className="h-60 rounded-[var(--ice-radius-card)]"
                        key={`generated-skeleton-${index}`}
                      />
                    ))
                  : null}
              </div>
            )}

            {generatedPacks.hasNext && generatedPacks.status === "ready" ? (
              <div className="justify-self-center">
                <Button onClick={fetchMoreGeneratedPacks} type="button">
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {activeList.status === "error" ? (
              <EmptyState
                title="Could not load packs"
                description="The backend is not reachable right now."
              />
            ) : activeList.status === "ready" && activeList.items.length === 0 ? (
              <EmptyState
                title={activeTab === "packs" ? "No public uploads yet" : "No favorites yet"}
                description={
                  activeTab === "packs"
                    ? "Public uploads will show up here as playable piano-roll previews."
                    : "Packs you like will be collected here."
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeList.items.map((pack) => (
                  <PackCard
                    key={`${activeTab}-${pack.id}`}
                    onAuthRequired={handleRequireLogin}
                    pack={pack}
                    token={token}
                  />
                ))}
                {activeList.status === "loading"
                  ? Array.from({ length: activeList.items.length === 0 ? 6 : 3 }).map((_, index) => (
                      <Skeleton
                        className="h-60 rounded-[var(--ice-radius-card)]"
                        key={`skeleton-${index}`}
                      />
                    ))
                  : null}
              </div>
            )}

            {activeList.hasNext && activeList.status === "ready" ? (
              <div className="justify-self-center">
                <Button onClick={loadMore} type="button">
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {toastMessage ? (
        <div className="fixed top-6 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 px-4 pointer-events-auto">
          <ToastNotification
            message={toastMessage}
            onClose={() => setToastMessage("")}
            title="Account Required"
            type="info"
          />
        </div>
      ) : null}

      {authMode ? (
        <AuthModal
          authStatus={authStatus}
          email={email}
          isSubmitting={isAuthenticating}
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSubmit={handleAuth}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          setUsername={setAuthUsername}
          username={authUsername}
        />
      ) : null}
    </div>
  );
}
