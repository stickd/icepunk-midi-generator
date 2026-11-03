package icepunk_backend.dto;

import icepunk_backend.model.UploadVisibility;

import java.time.OffsetDateTime;
import java.util.Map;

public class PublicUploadFeedItem {

    private final Long id;
    private final Long ownerId;
    private final String ownerUsername;
    private final String title;
    private final String midiUrl;
    private final String sampleUrl;
    private final OffsetDateTime uploadedAt;
    private final UploadVisibility visibility;
    private final Map<String, Object> metadata;

    public PublicUploadFeedItem(
            Long id,
            Long ownerId,
            String ownerUsername,
            String title,
            String midiUrl,
            String sampleUrl,
            OffsetDateTime uploadedAt,
            UploadVisibility visibility,
            Map<String, Object> metadata
    ) {
        this.id = id;
        this.ownerId = ownerId;
        this.ownerUsername = ownerUsername;
        this.title = title;
        this.midiUrl = midiUrl;
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

    public String getOwnerUsername() {
        return ownerUsername;
    }

    public String getTitle() {
        return title;
    }

    public String getMidiUrl() {
        return midiUrl;
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
