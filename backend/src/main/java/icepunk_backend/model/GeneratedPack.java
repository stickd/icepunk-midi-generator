package icepunk_backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "generated_packs")
public class GeneratedPack {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(length = 255)
    private String guestSessionId;

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private GenerationSourceType sourceType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private GeneratedPackType generationType;

    private Integer bpm;
    private Integer pitch;
    private Integer octaves;

    @Column(nullable = false)
    private Integer amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GeneratedPackVisibility visibility = GeneratedPackVisibility.PUBLIC;

    @Column(nullable = false, unique = true, length = 1024)
    private String zipObjectKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private GeneratedPackStatus status = GeneratedPackStatus.READY;
    private String failureCode;
    private OffsetDateTime finalizedAt;
    @Column(nullable = false)
    private boolean cleanupRequired;
    @Column(nullable = false)
    private int cleanupAttempts;
    private String cleanupLastError;
    private OffsetDateTime lastCleanupAt;

    @Column(nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    private OffsetDateTime updatedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata = new LinkedHashMap<>();

    @OneToMany(mappedBy = "pack", orphanRemoval = true)
    private List<GeneratedPackItem> items = new ArrayList<>();

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

    public String getGuestSessionId() {
        return guestSessionId;
    }

    public void setGuestSessionId(String guestSessionId) {
        this.guestSessionId = guestSessionId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public GenerationSourceType getSourceType() {
        return sourceType;
    }

    public void setSourceType(GenerationSourceType sourceType) {
        this.sourceType = sourceType;
    }

    public GeneratedPackType getGenerationType() {
        return generationType;
    }

    public void setGenerationType(GeneratedPackType generationType) {
        this.generationType = generationType;
    }

    public Integer getBpm() {
        return bpm;
    }

    public void setBpm(Integer bpm) {
        this.bpm = bpm;
    }

    public Integer getPitch() {
        return pitch;
    }

    public void setPitch(Integer pitch) {
        this.pitch = pitch;
    }

    public Integer getOctaves() {
        return octaves;
    }

    public void setOctaves(Integer octaves) {
        this.octaves = octaves;
    }

    public Integer getAmount() {
        return amount;
    }

    public void setAmount(Integer amount) {
        this.amount = amount;
    }

    public GeneratedPackVisibility getVisibility() {
        return visibility;
    }

    public void setVisibility(GeneratedPackVisibility visibility) {
        this.visibility = visibility;
    }

    public String getZipObjectKey() {
        return zipObjectKey;
    }

    public void setZipObjectKey(String zipObjectKey) {
        this.zipObjectKey = zipObjectKey;
    }
    public GeneratedPackStatus getStatus() { return status; }
    public void setStatus(GeneratedPackStatus status) { this.status = status; }
    public void setFailureCode(String failureCode) { this.failureCode = failureCode; }
    public String getFailureCode() { return failureCode; }
    public void setFinalizedAt(OffsetDateTime finalizedAt) { this.finalizedAt = finalizedAt; }
    public OffsetDateTime getFinalizedAt() { return finalizedAt; }
    public boolean isCleanupRequired() { return cleanupRequired; }
    public void setCleanupRequired(boolean cleanupRequired) { this.cleanupRequired = cleanupRequired; }
    public int getCleanupAttempts() { return cleanupAttempts; }
    public void setCleanupAttempts(int cleanupAttempts) { this.cleanupAttempts = cleanupAttempts; }
    public void setCleanupLastError(String cleanupLastError) { this.cleanupLastError = cleanupLastError; }
    public String getCleanupLastError() { return cleanupLastError; }
    public OffsetDateTime getLastCleanupAt() { return lastCleanupAt; }
    public void setLastCleanupAt(OffsetDateTime lastCleanupAt) { this.lastCleanupAt = lastCleanupAt; }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    public List<GeneratedPackItem> getItems() {
        return items;
    }
}
