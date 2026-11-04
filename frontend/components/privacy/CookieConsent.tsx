"use client";

import { useEffect, useState } from "react";
import { useConsent } from "./ConsentProvider";

export function CookieSettingsButton() {
  const { openSettings } = useConsent();
  return <button className="ice-cookie-link" type="button" onClick={openSettings}>Cookie settings</button>;
}

export default function CookieConsent() {
  const { analytics, settingsOpen, acceptAnalytics, rejectOptional, closeSettings, openSettings } = useConsent();
  const [analyticsSelected, setAnalyticsSelected] = useState(false);

  useEffect(() => {
    if (settingsOpen) setAnalyticsSelected(analytics === "granted");
  }, [analytics, settingsOpen]);

  const needsDecision = analytics === "unknown";

  if (!needsDecision && !settingsOpen) return null;

  return (
    <div className="ice-consent-backdrop">
      <section aria-describedby="privacy-preferences-description" aria-labelledby="privacy-preferences-title" aria-modal="true" className="ice-consent-dialog" role="dialog">
        <p className="ice-consent-eyebrow">YOUR CHOICE</p>
        <h2 id="privacy-preferences-title">Privacy preferences</h2>
        <p id="privacy-preferences-description">We use optional analytics to understand how producers use iCEPUNK and improve the MIDI generator.</p>
        {settingsOpen ? (
          <label className="ice-consent-choice">
            <input checked={analyticsSelected} onChange={(event) => setAnalyticsSelected(event.target.checked)} type="checkbox" />
            <span><strong>Analytics</strong><small>Anonymous aggregate usage measurement with Google Analytics.</small></span>
          </label>
        ) : null}
        <div className="ice-consent-actions">
          <button className="ice-consent-secondary" onClick={rejectOptional} type="button">Reject optional</button>
          {settingsOpen ? (
            <button className="ice-consent-primary" onClick={() => analyticsSelected ? acceptAnalytics() : rejectOptional()} type="button">Save preferences</button>
          ) : (
            <button className="ice-consent-primary" onClick={acceptAnalytics} type="button">Accept analytics</button>
          )}
        </div>
        {!settingsOpen ? <button className="ice-consent-customize-visible" onClick={openSettings} type="button">Customize</button> : <button className="ice-consent-customize-visible" onClick={closeSettings} type="button">Cancel</button>}
      </section>
    </div>
  );
}
