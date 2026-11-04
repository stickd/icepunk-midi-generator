"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import CookieConsent from "./CookieConsent";
import { useConsent } from "./ConsentProvider";

function googleMeasurementId() {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
}

function eraseAnalyticsCookies() {
  if (typeof document === "undefined") return;
  const names = document.cookie.split(";").map((part) => part.trim().split("=")[0]).filter((name) => name === "_ga" || name.startsWith("_ga_"));
  const host = window.location.hostname;
  const domains = [undefined, host, host.startsWith("www.") ? host.slice(4) : `.${host}`];
  names.forEach((name) => domains.forEach((domain) => {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${domain ? `; domain=${domain}` : ""}`;
  }));
}

export function GoogleAnalytics() {
  const { analytics } = useConsent();
  const pathname = usePathname();
  const search = useSearchParams();
  const [ready, setReady] = useState(false);
  const lastPage = useRef<string | null>(null);
  const measurementId = googleMeasurementId();

  useEffect(() => {
    if (!measurementId) return;
    if (analytics !== "granted") {
      if (analytics === "denied" && window.gtag) {
        window.gtag("consent", "update", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      }
      (window as Window & Record<string, boolean>)[`ga-disable-${measurementId}`] = true;
      eraseAnalyticsCookies();
      setReady(false);
    }
  }, [analytics]);

  useEffect(() => {
    if (!ready || analytics !== "granted" || !measurementId) return;
    const page = `${pathname}${search.size ? `?${search.toString()}` : ""}`;
    if (page === lastPage.current) return;
    lastPage.current = page;
    window.gtag?.("event", "page_view", { page_path: page });
  }, [analytics, pathname, ready, search]);

  if (!measurementId || analytics !== "granted") return null;
  return <Script id="icepunk-ga" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`} strategy="afterInteractive" onLoad={() => {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) { window.dataLayer?.push(args); };
    (window as Window & Record<string, boolean>)[`ga-disable-${measurementId}`] = false;
    window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { send_page_view: false });
    setReady(true);
  }} />;
}

export default function PrivacyClient() {
  return <><GoogleAnalytics /><CookieConsent /></>;
}

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}
