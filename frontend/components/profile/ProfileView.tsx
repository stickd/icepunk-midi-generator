"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getFavorites,
  getMe,
  getUserPacks,
  getUserProfile,
  MeResponse,
  TOKEN_KEY,
  UserPackItem,
  UserProfileResponse,
} from "@/lib/api";
import { Button, CreditBadge, EmptyState, Panel, Skeleton } from "@/components/ui";
import PackCard from "./PackCard";
import ProfileHeader from "./ProfileHeader";
import ProfileStats from "./ProfileStats";

const TOKEN_CHANGE_EVENT = "icepunk-token-change";

type ProfileViewProps = {
  username: string;
};

type TabId = "packs" | "favorites";

type PackListState = {
  items: UserPackItem[];
  page: number;
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
  const [tab, setTab] = useState<TabId>("packs");
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
  const [authNotice, setAuthNotice] = useState(false);

  const me = token && meFetch?.token === token ? meFetch.me : null;
  const isOwnProfile = me !== null && me.username === username;
  const activeTab: TabId = isOwnProfile ? tab : "packs";

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
        setProfileStatus(message.startsWith("HTTP_404") ? "not-found" : "error");
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

  function fetchFavorites(page: number) {
    if (!token) return;

    setFavorites((state) => ({ ...state, status: "loading" }));
    getFavorites(token, page, 12)
      .then((response) =>
        setFavorites((state) => ({
          items: page === 0 ? response.items : [...state.items, ...response.items],
          page: response.page,
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

  const activeList = activeTab === "packs" ? packs : favorites;
  const loadMore = () =>
    activeTab === "packs" ? fetchMorePacks() : fetchFavorites(favorites.page + 1);

  if (profileStatus === "not-found") {
    return (
      <EmptyState
        className="mx-auto mt-16 max-w-md"
        title="User not found"
        description={`Nobody named "${username}" is registered here.`}
        action={
          <Link href="/">
            <Button variant="primary">Back to generator</Button>
          </Link>
        }
      />
    );
  }

  if (profileStatus === "error") {
    return (
      <EmptyState
        className="mx-auto mt-16 max-w-md"
        title="Profile unavailable"
        description="The backend is not reachable right now. Try again in a moment."
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
          <ProfileHeader profile={profile} />
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
              { id: "packs" as TabId, label: "Packs", visible: true },
              { id: "favorites" as TabId, label: "Favorites", visible: isOwnProfile },
            ] satisfies Array<{ id: TabId; label: string; visible: boolean }>
          )
            .filter((item) => item.visible)
            .map((item) => (
              <button
                key={item.id}
                aria-selected={activeTab === item.id}
                className={`-mb-px border-b-2 pb-3 text-sm font-medium outline-none transition-[color,border-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-[rgba(100,120,255,0.45)] ${
                  activeTab === item.id
                    ? "border-[color:var(--ice-accent)] text-ice-primary"
                    : "border-transparent text-ice-muted hover:text-ice-secondary"
                }`}
                onClick={() => handleTabChange(item.id)}
                role="tab"
                type="button"
              >
                {item.label}
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

        {activeList.status === "error" ? (
          <EmptyState
            title="Could not load packs"
            description="The backend is not reachable right now."
          />
        ) : activeList.status === "ready" && activeList.items.length === 0 ? (
          <EmptyState
            title={activeTab === "packs" ? "No public packs yet" : "No favorites yet"}
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
                onAuthRequired={() => setAuthNotice(true)}
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
      </div>
    </div>
  );
}
