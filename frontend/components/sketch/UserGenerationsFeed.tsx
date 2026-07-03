import GenerationFeedCard from "./GenerationFeedCard";
import { mockGenerations } from "./mockData";
import styles from "./sketchTheme.module.css";

type UserGenerationsFeedProps = {
  onStubStatus: (message: string) => void;
};

export default function UserGenerationsFeed({ onStubStatus }: UserGenerationsFeedProps) {
  return (
    <section className={styles.feedSection} aria-labelledby="user-generations-feed">
      <div className={styles.feedHeader}>
        <h2 className={styles.feedTitle} id="user-generations-feed">
          User Generations Feed
        </h2>
        <button
          className={styles.sortButton}
          type="button"
          onClick={() => onStubStatus("Feed sorting is static mock data for this experiment.")}
        >
          Newest ☰
        </button>
      </div>
      <div className={styles.feedList}>
        {mockGenerations.map((generation) => (
          <GenerationFeedCard
            generation={generation}
            key={generation.id}
            onStubStatus={onStubStatus}
          />
        ))}
      </div>
    </section>
  );
}
