package icepunk_backend.service;

import icepunk_backend.dto.PresignedUrlResponse;
import icepunk_backend.model.GeneratedPack;
import icepunk_backend.model.GeneratedPackItem;
import icepunk_backend.model.GeneratedPackVisibility;
import icepunk_backend.model.GeneratedPackStatus;
import icepunk_backend.model.User;
import icepunk_backend.repository.GeneratedPackItemRepository;
import icepunk_backend.repository.GeneratedPackRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Central authorization and temporary URL issuance for generated storage objects. */
@Service
public class GeneratedFileAccessService {

    private final GeneratedPackRepository packRepository;
    private final GeneratedPackItemRepository itemRepository;
    private final GeneratedPackStorageService storageService;
    private final Duration previewTtl;
    private final Duration downloadTtl;

    public GeneratedFileAccessService(
            GeneratedPackRepository packRepository,
            GeneratedPackItemRepository itemRepository,
            GeneratedPackStorageService storageService,
            @Value("${storage.presigned.preview-ttl-seconds:600}") long previewTtlSeconds,
            @Value("${storage.presigned.download-ttl-seconds:180}") long downloadTtlSeconds
    ) {
        this.packRepository = packRepository;
        this.itemRepository = itemRepository;
        this.storageService = storageService;
        this.previewTtl = Duration.ofSeconds(previewTtlSeconds);
        this.downloadTtl = Duration.ofSeconds(downloadTtlSeconds);
    }

    @Transactional(readOnly = true)
    public PresignedUrlResponse previewItem(UUID packId, UUID itemId, User requester) {
        GeneratedPackItem item = itemRepository.findByIdAndPackId(itemId, packId)
                .filter(found -> canAccess(found.getPack(), requester))
                .orElseThrow(() -> new GeneratedFileNotFoundException());
        return presign(item.getMidiObjectKey(), item.getFileName(), "audio/midi", previewTtl, false);
    }

    @Transactional(readOnly = true)
    public PresignedUrlResponse downloadItem(UUID packId, UUID itemId, User requester) {
        GeneratedPackItem item = itemRepository.findByIdAndPackId(itemId, packId)
                .filter(found -> canAccess(found.getPack(), requester))
                .orElseThrow(() -> new GeneratedFileNotFoundException());
        return presign(item.getMidiObjectKey(), item.getFileName(), "audio/midi", downloadTtl, true);
    }

    @Transactional(readOnly = true)
    public PresignedUrlResponse downloadPack(UUID packId, User requester) {
        GeneratedPack pack = packRepository.findById(packId)
                .filter(found -> canAccess(found, requester))
                .orElseThrow(() -> new GeneratedFileNotFoundException());
        return presign(pack.getZipObjectKey(), safeName(pack.getName(), "icepunk-midi-pack") + ".zip", "application/zip", downloadTtl, true);
    }

    private boolean canAccess(GeneratedPack pack, User requester) {
        return pack.getStatus() == GeneratedPackStatus.READY
                && (pack.getVisibility() == GeneratedPackVisibility.PUBLIC
                || (requester != null && pack.getOwner() != null && pack.getOwner().getId().equals(requester.getId())));
    }

    private PresignedUrlResponse presign(String objectKey, String fileName, String type, Duration ttl, boolean attachment) {
        OffsetDateTime expiresAt = OffsetDateTime.now().plus(ttl);
        String disposition = (attachment ? "attachment" : "inline") + "; filename=\"" + safeName(fileName, "icepunk-midi") + "\"";
        return new PresignedUrlResponse(storageService.createPresignedGetUrl(objectKey, ttl, type, disposition), expiresAt);
    }

    private String safeName(String value, String fallback) {
        String name = value == null || value.isBlank() ? fallback : value.trim();
        name = name.replaceAll("[^A-Za-z0-9._-]+", "-").replaceAll("^-+|-+$", "");
        return name.isBlank() ? fallback : name;
    }

    public static class GeneratedFileNotFoundException extends RuntimeException {
    }
}
