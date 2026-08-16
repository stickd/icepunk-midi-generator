package icepunk_backend.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "generated_pack_items")
public class GeneratedPackItem {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pack_id", nullable = false)
    private GeneratedPack pack;

    @Column(nullable = false)
    private Integer itemIndex;

    @Column(nullable = false, length = 255)
    private String fileName;

    @Column(nullable = false, unique = true, length = 1024)
    private String midiObjectKey;

    private Double durationSeconds;
    private Integer noteCount;
    private Integer trackCount;
    private Integer minPitch;
    private Integer maxPitch;
    private Double avgPitch;
    private Integer bpm;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> metadata = new LinkedHashMap<>();

    @Column(nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public GeneratedPack getPack() {
        return pack;
    }

    public void setPack(GeneratedPack pack) {
        this.pack = pack;
    }

    public Integer getItemIndex() {
        return itemIndex;
    }

    public void setItemIndex(Integer itemIndex) {
        this.itemIndex = itemIndex;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getMidiObjectKey() {
        return midiObjectKey;
    }

    public void setMidiObjectKey(String midiObjectKey) {
        this.midiObjectKey = midiObjectKey;
    }

    public Double getDurationSeconds() {
        return durationSeconds;
    }

    public void setDurationSeconds(Double durationSeconds) {
        this.durationSeconds = durationSeconds;
    }

    public Integer getNoteCount() {
        return noteCount;
    }

    public void setNoteCount(Integer noteCount) {
        this.noteCount = noteCount;
    }

    public Integer getTrackCount() {
        return trackCount;
    }

    public void setTrackCount(Integer trackCount) {
        this.trackCount = trackCount;
    }

    public Integer getMinPitch() {
        return minPitch;
    }

    public void setMinPitch(Integer minPitch) {
        this.minPitch = minPitch;
    }

    public Integer getMaxPitch() {
        return maxPitch;
    }

    public void setMaxPitch(Integer maxPitch) {
        this.maxPitch = maxPitch;
    }

    public Double getAvgPitch() {
        return avgPitch;
    }

    public void setAvgPitch(Double avgPitch) {
        this.avgPitch = avgPitch;
    }

    public Integer getBpm() {
        return bpm;
    }

    public void setBpm(Integer bpm) {
        this.bpm = bpm;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
