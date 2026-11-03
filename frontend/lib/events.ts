export const FEED_REFRESH_EVENT = "icepunk-feed-refresh";

export function notifyFeedRefresh() {
  window.dispatchEvent(new Event(FEED_REFRESH_EVENT));
}
