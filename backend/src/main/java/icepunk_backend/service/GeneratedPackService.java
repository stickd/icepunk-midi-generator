package icepunk_backend.service;

import icepunk_backend.dto.GeneratedMidiItemResponse;
import icepunk_backend.dto.GeneratedPackResponse;
import icepunk_backend.dto.GenerationRequest;
import icepunk_backend.dto.MidiPreviewNoteResponse;
import icepunk_backend.dto.MidiPreviewResponse;
import icepunk_backend.dto.PublicGeneratedPackFeedItem;
import icepunk_backend.dto.PublicGeneratedPackFeedResponse;
import icepunk_backend.exception.ForbiddenActionException;
import icepunk_backend.exception.ResourceNotFoundException;
import icepunk_backend.model.GeneratedPack;
import icepunk_backend.model.GeneratedPackItem;
import icepunk_backend.model.GeneratedPackType;
import icepunk_backend.model.GeneratedPackVisibility;
import icepunk_backend.model.GenerationSourceType;
import icepunk_backend.model.User;
import icepunk_backend.repository.GeneratedPackItemRepository;
import icepunk_backend.repository.GeneratedPackRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class GeneratedPackService {

    private static final Logger log = LoggerFactory.getLogger(GeneratedPackService.class);
    private static final int MAX_FEED_PAGE_SIZE = 50;

    private final GeneratedPackRepository packRepository;
    private final GeneratedPackItemRepository itemRepository;
    private final GeneratedPackStorageService storageService;
    private final MidiMetadataExtractor metadataExtractor;

    public GeneratedPackService(
            GeneratedPackRepository packRepository,
            GeneratedPackItemRepository itemRepository,
            GeneratedPackStorageService storageService,
            MidiMetadataExtractor metadataExtractor
    ) {
        this.packRepository = packRepository;
        this.itemRepository = itemRepository;
        this.storageService = storageService;
        this.metadataExtractor = metadataExtractor;
    }

    @Transactional
    public GeneratedPackResponse persistGeneratedPack(
            User owner,
            GenerationRequest request,
            MidiGenerationService.GeneratedFiles generatedFiles
    ) {
        if (owner == null) {
            return uploadGuestGeneratedPack(request, generatedFiles);
        }

        List<String> uploadedKeys = new ArrayList<>();

        try {
            List<GeneratedItemDraft> itemDrafts = uploadMidiItems(generatedFiles.midiFiles(), uploadedKeys);
            GeneratedPackStorageService.StoredObject zipUpload = storageService.uploadZip(generatedFiles.zipPath());
            uploadedKeys.add(zipUpload.objectKey());

            GeneratedPack pack = new GeneratedPack();
            pack.setId(UUID.randomUUID());
            pack.setOwner(owner);
            pack.setName(normalizedPackName(request.getPackName()));
            pack.setSourceType(GenerationSourceType.valueOf(request.getSource().name()));
            pack.setGenerationType(GeneratedPackType.valueOf(request.getType().name()));
            pack.setBpm(request.getBpm());
            pack.setPitch(request.getPitch());
            pack.setOctaves(request.getOctaves());
            pack.setAmount(request.getAmount());
            pack.setVisibility(visibilityFrom(request));
            pack.setZipObjectKey(zipUpload.objectKey());
            pack.setCreatedAt(OffsetDateTime.now());
            pack.setMetadata(metadataFor(request));

            GeneratedPack savedPack = packRepository.save(pack);
            List<GeneratedPackItem> savedItems = new ArrayList<>();

            for (GeneratedItemDraft draft : itemDrafts) {
                GeneratedPackItem item = new GeneratedPackItem();
                item.setId(UUID.randomUUID());
                item.setPack(savedPack);
                item.setItemIndex(draft.index());
                item.setFileName(draft.fileName());
                item.setMidiObjectKey(draft.upload().objectKey());
                item.setDurationSeconds(draft.metadata().durationSeconds());
                item.setNoteCount(draft.metadata().noteCount());
                item.setTrackCount(draft.metadata().trackCount());
                item.setMinPitch(draft.metadata().minPitch());
                item.setMaxPitch(draft.metadata().maxPitch());
                item.setAvgPitch(draft.metadata().avgPitch());
                item.setBpm(draft.metadata().bpm());
                item.setCreatedAt(savedPack.getCreatedAt());
                item.setMetadata(Map.of("preview", previewToMetadata(draft.metadata().preview())));
                savedItems.add(itemRepository.save(item));
            }

            packRepository.flush();
            itemRepository.flush();

            return toPackResponse(savedPack, savedItems);
        } catch (RuntimeException exception) {
            uploadedKeys.forEach(storageService::deleteObjectQuietly);
            log.warn("Generated pack persistence failed after uploads; uploaded objects were cleaned where possible: {}",
                    exception.getMessage());
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public Optional<GeneratedPackResponse> getPack(UUID packId, User viewer) {
        return packRepository.findWithItemsById(packId)
                .filter(pack -> isVisibleTo(pack, viewer))
                .map(pack -> toPackResponse(pack, sortedItems(pack.getItems())));
    }

    @Transactional(readOnly = true)
    public PublicGeneratedPackFeedResponse getPublicFeed(int page, int size) {
        int normalizedPage = Math.max(0, page);
        int normalizedSize = Math.max(1, Math.min(size, MAX_FEED_PAGE_SIZE));
        Page<GeneratedPack> packs = packRepository.findPublicAuthenticatedPacks(
                GeneratedPackVisibility.PUBLIC,
                PageRequest.of(normalizedPage, normalizedSize)
        );

        return new PublicGeneratedPackFeedResponse(
                packs.getContent().stream().map(this::toPublicFeedItem).toList(),
                packs.getNumber(),
                packs.getSize(),
                packs.getTotalElements(),
                packs.getTotalPages(),
                packs.hasNext()
        );
    }

    @Transactional(readOnly = true)
    public PublicGeneratedPackFeedResponse getPublicFeedByUsername(String username, int page, int size) {
        int normalizedPage = Math.max(0, page);
        int normalizedSize = Math.max(1, Math.min(size, MAX_FEED_PAGE_SIZE));
        Page<GeneratedPack> packs = packRepository.findPublicAuthenticatedPacksByUsername(
                username,
                GeneratedPackVisibility.PUBLIC,
                PageRequest.of(normalizedPage, normalizedSize)
        );

        return new PublicGeneratedPackFeedResponse(
                packs.getContent().stream().map(this::toPublicFeedItem).toList(),
                packs.getNumber(),
                packs.getSize(),
                packs.getTotalElements(),
                packs.getTotalPages(),
                packs.hasNext()
        );
    }

    @Transactional(readOnly = true)
    public Optional<String> getItemDownloadUrl(UUID packId, UUID itemId) {
        return itemRepository.findByIdAndPackId(itemId, packId)
                .map(item -> itemDownloadPath(packId, itemId));
    }

    @Transactional(readOnly = true)
    public Optional<String> getPackDownloadUrl(UUID packId) {
        return packRepository.findById(packId)
                .map(pack -> packDownloadPath(packId));
    }

    @Transactional(readOnly = true)
    public Optional<DownloadObject> getPackDownload(UUID packId, User viewer) {
        return packRepository.findById(packId)
                .filter(pack -> isVisibleTo(pack, viewer))
                .map(pack -> new DownloadObject(
                        storageService.readObject(pack.getZipObjectKey()),
                        safeFileName(pack.getName(), "icepunk-midi-pack") + ".zip",
                        "application/zip"
                ));
    }

    @Transactional(readOnly = true)
    public Optional<DownloadObject> getItemDownload(UUID packId, UUID itemId, User viewer) {
        return itemRepository.findByIdAndPackId(itemId, packId)
                .filter(item -> isVisibleTo(item.getPack(), viewer))
                .map(item -> new DownloadObject(
                        storageService.readObject(item.getMidiObjectKey()),
                        safeFileName(item.getFileName(), "icepunk-midi") + ".mid",
                        "audio/midi"
                ));
    }

    private boolean isVisibleTo(GeneratedPack pack, User viewer) {
        if (pack.getVisibility() == GeneratedPackVisibility.PUBLIC) {
            return true;
        }

        return viewer != null && pack.getOwner() != null && pack.getOwner().getId().equals(viewer.getId());
    }

    @Transactional(readOnly = true)
    public List<GeneratedPackResponse> listPacksByOwner(User owner) {
        return packRepository.findWithItemsByOwnerId(owner.getId()).stream()
                .map(pack -> toPackResponse(pack, sortedItems(pack.getItems())))
                .toList();
    }

    @Transactional
    public GeneratedPackResponse renamePack(UUID packId, User requester, String newName) {
        GeneratedPack pack = requireOwnedPack(packId, requester);
        pack.setName(normalizedPackName(newName));
        pack.setUpdatedAt(OffsetDateTime.now());
        GeneratedPack saved = packRepository.save(pack);

        return toPackResponse(saved, sortedItems(saved.getItems()));
    }

    @Transactional
    public GeneratedPackResponse updateVisibility(UUID packId, User requester, GeneratedPackVisibility visibility) {
        GeneratedPack pack = requireOwnedPack(packId, requester);
        pack.setVisibility(visibility);
        pack.setUpdatedAt(OffsetDateTime.now());
        GeneratedPack saved = packRepository.save(pack);

        return toPackResponse(saved, sortedItems(saved.getItems()));
    }

    @Transactional
    public void deletePack(UUID packId, User requester) {
        GeneratedPack pack = requireOwnedPack(packId, requester);

        List<String> objectKeys = new ArrayList<>();
        objectKeys.add(pack.getZipObjectKey());
        pack.getItems().forEach(item -> objectKeys.add(item.getMidiObjectKey()));

        packRepository.delete(pack);
        packRepository.flush();

        objectKeys.forEach(storageService::deleteObjectQuietly);
    }

    private GeneratedPack requireOwnedPack(UUID packId, User requester) {
        GeneratedPack pack = packRepository.findWithItemsById(packId)
                .orElseThrow(() -> new ResourceNotFoundException("Generated pack not found: " + packId));

        if (pack.getOwner() == null || !pack.getOwner().getId().equals(requester.getId())) {
            throw new ForbiddenActionException("You do not own this generated pack.");
        }

        return pack;
    }

    private GeneratedPackResponse uploadGuestGeneratedPack(
            GenerationRequest request,
            MidiGenerationService.GeneratedFiles generatedFiles
    ) {
        List<String> uploadedKeys = new ArrayList<>();

        try {
            List<GeneratedItemDraft> itemDrafts = uploadMidiItems(generatedFiles.midiFiles(), uploadedKeys);
            GeneratedPackStorageService.StoredObject zipUpload = storageService.uploadZip(generatedFiles.zipPath());
            uploadedKeys.add(zipUpload.objectKey());

            GeneratedPack pack = new GeneratedPack();
            pack.setId(UUID.randomUUID());
            pack.setName(normalizedPackName(request.getPackName()));
            pack.setSourceType(GenerationSourceType.valueOf(request.getSource().name()));
            pack.setGenerationType(GeneratedPackType.valueOf(request.getType().name()));
            pack.setBpm(request.getBpm());
            pack.setPitch(request.getPitch());
            pack.setOctaves(request.getOctaves());
            pack.setAmount(request.getAmount());
            pack.setVisibility(GeneratedPackVisibility.PUBLIC);
            pack.setZipObjectKey(zipUpload.objectKey());
            pack.setCreatedAt(OffsetDateTime.now());
            pack.setMetadata(metadataFor(request));

            GeneratedPack savedPack = packRepository.save(pack);
            List<GeneratedPackItem> savedItems = new ArrayList<>();
            for (GeneratedItemDraft draft : itemDrafts) {
                GeneratedPackItem item = new GeneratedPackItem();
                item.setId(UUID.randomUUID());
                item.setPack(savedPack);
                item.setItemIndex(draft.index());
                item.setFileName(draft.fileName());
                item.setMidiObjectKey(draft.upload().objectKey());
                item.setDurationSeconds(draft.metadata().durationSeconds());
                item.setNoteCount(draft.metadata().noteCount());
                item.setTrackCount(draft.metadata().trackCount());
                item.setMinPitch(draft.metadata().minPitch());
                item.setMaxPitch(draft.metadata().maxPitch());
                item.setAvgPitch(draft.metadata().avgPitch());
                item.setBpm(draft.metadata().bpm());
                item.setCreatedAt(savedPack.getCreatedAt());
                item.setMetadata(Map.of("preview", previewToMetadata(draft.metadata().preview())));
                savedItems.add(itemRepository.save(item));
            }
            packRepository.flush();
            itemRepository.flush();

            return toPackResponse(savedPack, savedItems);
        } catch (RuntimeException exception) {
            uploadedKeys.forEach(storageService::deleteObjectQuietly);
            log.warn("Guest generated pack upload failed; uploaded objects were cleaned where possible: {}",
                    exception.getMessage());
            throw exception;
        }
    }

    private List<GeneratedItemDraft> uploadMidiItems(List<Path> midiFiles, List<String> uploadedKeys) {
        List<GeneratedItemDraft> drafts = new ArrayList<>();
        int index = 0;

        for (Path midiFile : midiFiles) {
            MidiMetadataExtractor.MidiMetadata metadata = metadataExtractor.extract(midiFile);
            GeneratedPackStorageService.StoredObject upload = storageService.uploadMidi(midiFile);
            uploadedKeys.add(upload.objectKey());
            drafts.add(new GeneratedItemDraft(index, midiFile.getFileName().toString(), upload, metadata));
            index++;
        }

        return drafts;
    }

    private String normalizedPackName(String packName) {
        if (packName == null || packName.isBlank()) {
            return "IcePunk Pack";
        }

        return packName.trim();
    }

    private GeneratedPackVisibility visibilityFrom(GenerationRequest request) {
        if (request.getPublishMode() == GenerationRequest.PublishMode.PRIVATE) {
            return GeneratedPackVisibility.PRIVATE;
        }

        return GeneratedPackVisibility.PUBLIC;
    }

    private Map<String, Object> metadataFor(GenerationRequest request) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("source", request.getSource().name());
        metadata.put("type", request.getType().name());
        if (request.getTempAnalysisId() != null) {
            metadata.put("tempAnalysisId", request.getTempAnalysisId());
        }
        return metadata;
    }

    private GeneratedPackResponse toPackResponse(GeneratedPack pack, List<GeneratedPackItem> items) {
        return new GeneratedPackResponse(
                pack.getId(),
                pack.getName(),
                pack.getSourceType().name(),
                pack.getGenerationType().name(),
                pack.getBpm(),
                pack.getPitch(),
                pack.getOctaves(),
                pack.getAmount(),
                pack.getCreatedAt(),
                packDownloadPath(pack.getId()),
                items.stream().map(this::toItemResponse).toList()
        );
    }

    private PublicGeneratedPackFeedItem toPublicFeedItem(GeneratedPack pack) {
        User owner = pack.getOwner();

        return new PublicGeneratedPackFeedItem(
                pack.getId(),
                pack.getName(),
                owner == null ? null : owner.getId(),
                owner == null ? "guest" : owner.getUsername(),
                pack.getSourceType().name(),
                pack.getGenerationType().name(),
                pack.getBpm(),
                pack.getPitch(),
                pack.getOctaves(),
                pack.getAmount(),
                pack.getCreatedAt(),
                pack.getVisibility(),
                packDownloadPath(pack.getId()),
                sortedItems(pack.getItems()).stream().map(this::toItemResponse).toList()
        );
    }

    private GeneratedMidiItemResponse toItemResponse(GeneratedPackItem item) {
        return new GeneratedMidiItemResponse(
                item.getId(),
                item.getItemIndex(),
                item.getFileName(),
                itemDownloadPath(item.getPack().getId(), item.getId()),
                item.getDurationSeconds(),
                item.getNoteCount(),
                item.getTrackCount(),
                item.getMinPitch(),
                item.getMaxPitch(),
                item.getAvgPitch(),
                item.getBpm(),
                previewFromMetadata(item.getMetadata())
        );
    }

    private String packDownloadPath(UUID packId) {
        return "/generated-packs/" + packId + "/download";
    }

    private String itemDownloadPath(UUID packId, UUID itemId) {
        return "/generated-packs/" + packId + "/items/" + itemId + "/download";
    }

    private String safeFileName(String value, String fallback) {
        String name = value == null || value.isBlank() ? fallback : value.trim();
        name = name.replaceAll("[^A-Za-z0-9._-]+", "-").replaceAll("^-+|-+$", "");
        name = name.isBlank() ? fallback : name;
        return name.replaceAll("(?i)\\.(mid|midi|zip)$", "");
    }

    private Map<String, Object> previewToMetadata(MidiPreviewResponse preview) {
        List<Map<String, Object>> notes = preview.notes().stream()
                .map(note -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("pitch", note.pitch());
                    item.put("start", note.start());
                    item.put("duration", note.duration());
                    item.put("velocity", note.velocity());
                    return item;
                })
                .toList();

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("notes", notes);
        metadata.put("truncated", preview.truncated());
        return metadata;
    }

    @SuppressWarnings("unchecked")
    private MidiPreviewResponse previewFromMetadata(Map<String, Object> metadata) {
        if (metadata == null || !(metadata.get("preview") instanceof Map<?, ?> previewMap)) {
            return new MidiPreviewResponse(List.of(), false);
        }

        Object notesValue = previewMap.get("notes");
        List<MidiPreviewNoteResponse> notes = notesValue instanceof List<?> rawNotes
                ? rawNotes.stream()
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .map(this::previewNoteFromMap)
                .toList()
                : List.of();

        Object truncatedValue = previewMap.get("truncated");
        boolean truncated = truncatedValue instanceof Boolean booleanValue && booleanValue;

        return new MidiPreviewResponse(notes, truncated);
    }

    private MidiPreviewNoteResponse previewNoteFromMap(Map<?, ?> note) {
        return new MidiPreviewNoteResponse(
                number(note.get("pitch")).intValue(),
                number(note.get("start")).doubleValue(),
                number(note.get("duration")).doubleValue(),
                number(note.get("velocity")).intValue()
        );
    }

    private Number number(Object value) {
        return value instanceof Number number ? number : 0;
    }

    private List<GeneratedPackItem> sortedItems(List<GeneratedPackItem> items) {
        return items.stream()
                .sorted(Comparator.comparing(GeneratedPackItem::getItemIndex))
                .toList();
    }

    private record GeneratedItemDraft(
            int index,
            String fileName,
            GeneratedPackStorageService.StoredObject upload,
            MidiMetadataExtractor.MidiMetadata metadata
    ) {
    }

    public record DownloadObject(byte[] bytes, String fileName, String contentType) {
    }
}
