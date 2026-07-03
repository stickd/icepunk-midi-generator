import { Card } from "@/components/ui";
import BrowserPianoRoll from "./BrowserPianoRoll";
import { FeedGeneration } from "./feedTypes";

type GenerationFeedCardProps = {
  generation: FeedGeneration;
  onStubStatus: (message: string) => void;
};

export default function GenerationFeedCard({
  generation,
  onStubStatus,
}: GenerationFeedCardProps) {
  return (
    <Card className="grid gap-4 p-5 sm:grid-cols-[minmax(280px,520px)_minmax(180px,1fr)]">
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 place-items-center rounded-full bg-[color:var(--ice-accent-soft)] text-[10px] font-semibold text-[color:var(--ice-accent-text)] ring-1 ring-[color:var(--ice-accent-border)]"
          >
            {generation.username.slice(0, 1).toUpperCase()}
          </span>
          <span className="text-sm font-medium text-ice-primary">{generation.username}</span>
          <span className="text-xs text-ice-muted">{generation.timeAgo}</span>
        </div>

        <h3 className="truncate text-base font-semibold text-ice-primary">{generation.title}</h3>

        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/10 p-2">
          <div className="flex-1">
            <BrowserPianoRoll
              isPlaying={false}
              midiFile={null}
              midiUrl={generation.midiPreviewUrl ?? generation.midiUrl ?? null}
              playbackPositionSeconds={0}
              size="compact"
            />
          </div>
          <button
            aria-label={`Play ${generation.title}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.09] bg-white/[0.04] text-ice-secondary transition-colors duration-150 ease-out hover:bg-white/[0.08] hover:text-ice-primary disabled:opacity-40"
            disabled
            onClick={() => onStubStatus("Feed playback is coming soon.")}
            title="Feed playback is coming soon."
            type="button"
          >
            ▶
          </button>
          <div className="flex shrink-0 gap-1.5">
            <button
              aria-label={`Favorite ${generation.title}`}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.09] bg-white/[0.04] text-ice-secondary transition-colors duration-150 ease-out hover:bg-white/[0.08] hover:text-ice-primary disabled:opacity-40"
              disabled
              onClick={() => onStubStatus("Favorites are coming soon.")}
              title="Favorites are coming soon."
              type="button"
            >
              ♡
            </button>
            <button
              aria-label={`Download ${generation.title}`}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.09] bg-white/[0.04] text-ice-secondary transition-colors duration-150 ease-out hover:bg-white/[0.08] hover:text-ice-primary disabled:opacity-40"
              disabled={!generation.midiUrl}
              onClick={() => {
                if (generation.midiUrl) {
                  window.open(generation.midiUrl, "_blank", "noreferrer");
                  onStubStatus(`Opening ${generation.title} MIDI download.`);
                }
              }}
              type="button"
            >
              ↓
            </button>
          </div>
        </div>
      </div>

      <div className="grid content-start gap-1.5 text-sm text-ice-secondary">
        <strong className="font-semibold text-ice-primary">
          About this pack: {generation.midiCount} midis · {generation.downloads} downloads
        </strong>
        <span>Preview sound: {generation.sound}</span>
        <span>Visibility: public</span>
        <span>
          Uploaded:{" "}
          {generation.uploadedAt ? new Date(generation.uploadedAt).toLocaleString() : "new"}
        </span>
        <span className="italic text-ice-muted">Exclusive pack: coming soon</span>
        <a
          className="text-[color:var(--ice-accent-text)] underline underline-offset-2"
          href={generation.midiUrl ?? "#download"}
          onClick={(event) => {
            if (!generation.midiUrl) event.preventDefault();
          }}
        >
          Download MIDI
        </a>
        <span className="italic text-ice-muted">Request dataset: coming soon</span>
      </div>
    </Card>
  );
}
