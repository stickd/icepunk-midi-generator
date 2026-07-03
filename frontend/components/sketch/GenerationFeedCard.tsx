import BrowserPianoRoll from "./BrowserPianoRoll";
import { FeedGeneration } from "./feedTypes";
import styles from "./sketchTheme.module.css";

type GenerationFeedCardProps = {
  generation: FeedGeneration;
  onStubStatus: (message: string) => void;
};

export default function GenerationFeedCard({
  generation,
  onStubStatus,
}: GenerationFeedCardProps) {
  return (
    <article className={styles.feedCard}>
      <div>
        <div className={styles.feedUser}>
          <span className={styles.avatarDot} aria-hidden="true" />
          <span>{generation.username}</span>
          <span className={styles.timeText}>{generation.timeAgo}</span>
        </div>
        <h3 className={styles.feedCardTitle}>{generation.title}</h3>

        <div className={styles.previewRow}>
          <BrowserPianoRoll
            isPlaying={false}
            midiFile={null}
            midiUrl={generation.midiPreviewUrl ?? generation.midiUrl ?? null}
            playbackPositionSeconds={0}
            size="compact"
          />
          <button
            className={styles.playButton}
            type="button"
            disabled
            title="Feed playback is coming soon."
            onClick={() => onStubStatus("Feed playback is coming soon.")}
            aria-label={`Play ${generation.title}`}
          >
            ▶
          </button>
          <div>
            <button
              className={styles.smallIconButton}
              type="button"
              disabled
              title="Favorites are coming soon."
              onClick={() => onStubStatus("Favorites are coming soon.")}
              aria-label={`Favorite ${generation.title}`}
            >
              ♡
            </button>
            <button
              className={styles.smallIconButton}
              type="button"
              disabled={!generation.midiUrl}
              onClick={() => {
                if (generation.midiUrl) {
                  window.open(generation.midiUrl, "_blank", "noreferrer");
                  onStubStatus(`Opening ${generation.title} MIDI download.`);
                }
              }}
              aria-label={`Download ${generation.title}`}
            >
              ↓
            </button>
          </div>
        </div>

        <div className={styles.thumbnailRow} aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <span className={styles.thumbnail} key={index} />
          ))}
        </div>
      </div>

      <div className={styles.feedLinks}>
        <strong>
          About this pack: {generation.midiCount} midis · {generation.downloads} downloads
        </strong>
        <span>Preview sound: {generation.sound}</span>
        <span>Visibility: public</span>
        <span>Uploaded: {generation.uploadedAt ? new Date(generation.uploadedAt).toLocaleString() : "new"}</span>
        <span className={styles.comingSoonText}>Exclusive pack: coming soon</span>
        <a
          href={generation.midiUrl ?? "#download"}
          onClick={(event) => {
            if (!generation.midiUrl) event.preventDefault();
          }}
        >
          Download MIDI
        </a>
        <span className={styles.comingSoonText}>Request dataset: coming soon</span>
      </div>
    </article>
  );
}
