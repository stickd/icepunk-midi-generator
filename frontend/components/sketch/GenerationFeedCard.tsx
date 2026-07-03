import PianoRollPreview from "./PianoRollPreview";
import { MockGeneration } from "./mockData";
import styles from "./sketchTheme.module.css";

type GenerationFeedCardProps = {
  generation: MockGeneration;
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

        <div className={styles.previewRow}>
          <PianoRollPreview label={`${generation.title} MIDI preview`} />
          <button
            className={styles.playButton}
            type="button"
            onClick={() => onStubStatus("Preview playback is a frontend stub.")}
            aria-label={`Play ${generation.title}`}
          >
            ▶
          </button>
          <div>
            <button
              className={styles.smallIconButton}
              type="button"
              onClick={() => onStubStatus("Favorites will connect to user profiles later.")}
              aria-label={`Favorite ${generation.title}`}
            >
              ♡
            </button>
            <button
              className={styles.smallIconButton}
              type="button"
              onClick={() => onStubStatus("Feed item downloads are placeholders for now.")}
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
        <a href="#exclusive" onClick={(event) => event.preventDefault()}>
          Exclusive pack
        </a>
        <a href="#download" onClick={(event) => event.preventDefault()}>
          Download this pack
        </a>
        <a href="#dataset" onClick={(event) => event.preventDefault()}>
          Request dataset
        </a>
      </div>
    </article>
  );
}
