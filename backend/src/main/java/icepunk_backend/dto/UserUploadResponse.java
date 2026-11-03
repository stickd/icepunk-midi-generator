package icepunk_backend.dto;

import icepunk_backend.model.UploadVisibility;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.time.OffsetDateTime;
import java.util.Map;

public class UserUploadResponse {

    private final Long id;
    private final Long ownerId;
    private final String title;
    private final String midiObjectKey;
    private final String midiUrl;
    private final String sampleObjectKey;
    private final String sampleUrl;
    private final OffsetDateTime uploadedAt;
    private final UploadVisibility visibility;
    private final Map<String, Object> metadata;

    public UserUploadResponse(
            Long id,
            Long ownerId,
            String title,
            String midiObjectKey,
            String midiUrl,
            String sampleObjectKey,
            String sampleUrl,
            OffsetDateTime uploadedAt,
            UploadVisibility visibility,
            Map<String, Object> metadata
    ) {
        this.id = id;
        this.ownerId = ownerId;
        this.title = title;
        this.midiObjectKey = midiObjectKey;
        this.midiUrl = midiUrl;
        this.sampleObjectKey = sampleObjectKey;
        this.sampleUrl = sampleUrl;
        this.uploadedAt = uploadedAt;
        this.visibility = visibility;
        this.metadata = metadata;
    }

    public Long getId() {
        return id;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getTitle() {
        return title;
    }

    @JsonIgnore
    public String getMidiObjectKey() {
        return midiObjectKey;
    }

    public String getMidiUrl() {
        return midiUrl;
    }

    @JsonIgnore
    public String getSampleObjectKey() {
        return sampleObjectKey;
    }

    public String getSampleUrl() {
        return sampleUrl;
    }

    public OffsetDateTime getUploadedAt() {
        return uploadedAt;
    }

    public UploadVisibility getVisibility() {
        return visibility;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }
}
