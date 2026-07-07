package icepunk_backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
        name = "dataset_presets",
        uniqueConstraints = @UniqueConstraint(columnNames = {"owner_id", "name"})
)
public class DatasetPreset {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 1024)
    private String analysisObjectKey;

    @Column(nullable = false)
    private Integer sourceMidiCount;

    @Column(nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public User getOwner() {
        return owner;
    }

    public void setOwner(User owner) {
        this.owner = owner;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAnalysisObjectKey() {
        return analysisObjectKey;
    }

    public void setAnalysisObjectKey(String analysisObjectKey) {
        this.analysisObjectKey = analysisObjectKey;
    }

    public Integer getSourceMidiCount() {
        return sourceMidiCount;
    }

    public void setSourceMidiCount(Integer sourceMidiCount) {
        this.sourceMidiCount = sourceMidiCount;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
