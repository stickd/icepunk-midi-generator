package icepunk_backend.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "generation_stats")
public class GenerationStats {

    public static final Long GLOBAL_STATS_ID = 1L;

    @Id
    private Long id;

    private Long totalGenerations = 0L;

    public GenerationStats() {
    }

    public GenerationStats(Long id, Long totalGenerations) {
        this.id = id;
        this.totalGenerations = totalGenerations;
    }

    public Long getId() {
        return id;
    }

    public Long getTotalGenerations() {
        return totalGenerations;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setTotalGenerations(Long totalGenerations) {
        this.totalGenerations = totalGenerations;
    }
}
