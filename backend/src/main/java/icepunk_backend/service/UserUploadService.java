package icepunk_backend.service;

import icepunk_backend.dto.PublicUploadFeedItem;
import icepunk_backend.dto.PublicUploadFeedResponse;
import icepunk_backend.dto.UserUploadResponse;
import icepunk_backend.exception.UploadValidationException;
import icepunk_backend.model.UploadVisibility;
import icepunk_backend.model.User;
import icepunk_backend.model.UserUploadedProject;
import icepunk_backend.repository.UserUploadedProjectRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class UserUploadService {

    private static final Set<String> MIDI_MIME_TYPES = Set.of(
            "audio/midi",
            "audio/mid",
            "audio/x-midi",
            "application/x-midi",
            "application/octet-stream"
    );

    private static final Set<String> SAMPLE_MIME_TYPES = Set.of(
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/wave",
            "audio/x-wav"
    );
    private static final int MAX_FEED_PAGE_SIZE = 50;

    private final UserUploadStorageService storageService;
    private final UserUploadedProjectRepository projectRepository;
    private final long maxMidiSizeBytes;
    private final long maxSampleSizeBytes;

    public UserUploadService(
            UserUploadStorageService storageService,
            UserUploadedProjectRepository projectRepository,
            @Value("${uploads.midi.max-size-bytes}") long maxMidiSizeBytes,
            @Value("${uploads.sample.max-size-bytes}") long maxSampleSizeBytes
    ) {
        this.storageService = storageService;
        this.projectRepository = projectRepository;
        this.maxMidiSizeBytes = maxMidiSizeBytes;
        this.maxSampleSizeBytes = maxSampleSizeBytes;
    }

    @Transactional(readOnly = true)
    public PublicUploadFeedResponse getPublicFeed(int page, int size) {
        int normalizedPage = Math.max(0, page);
        int normalizedSize = Math.max(1, Math.min(size, MAX_FEED_PAGE_SIZE));
        Page<UserUploadedProject> projects = projectRepository.findByVisibilityOrderByUploadedAtDesc(
                UploadVisibility.PUBLIC,
                PageRequest.of(normalizedPage, normalizedSize)
        );

        return new PublicUploadFeedResponse(
                projects.getContent().stream().map(this::toPublicFeedItem).toList(),
                projects.getNumber(),
                projects.getSize(),
                projects.getTotalElements(),
                projects.getTotalPages(),
                projects.hasNext()
        );
    }

    @Transactional
    public UserUploadResponse uploadProject(
            User owner,
            String title,
            String visibility,
            MultipartFile midiFile,
            MultipartFile sampleFile
    ) throws IOException {
        String normalizedTitle = validateTitle(title);
        UploadVisibility normalizedVisibility = parseVisibility(visibility);

        validateMidi(midiFile);
        validateSample(sampleFile);

        UserUploadStorageService.StoredUpload midiUpload = storageService.upload(
                owner.getId(),
                midiFile.getOriginalFilename(),
                normalizedContentType(midiFile),
                midiFile.getSize(),
                midiFile.getInputStream()
        );

        UserUploadStorageService.StoredUpload sampleUpload = storageService.upload(
                owner.getId(),
                sampleFile.getOriginalFilename(),
                normalizedContentType(sampleFile),
                sampleFile.getSize(),
                sampleFile.getInputStream()
        );

        UserUploadedProject project = new UserUploadedProject();
        project.setOwner(owner);
        project.setTitle(normalizedTitle);
        project.setMidiObjectKey(midiUpload.objectKey());
        project.setSampleObjectKey(sampleUpload.objectKey());
        project.setUploadedAt(OffsetDateTime.now());
        project.setVisibility(normalizedVisibility);
        project.setMetadata(metadataFor(midiFile, sampleFile));

        UserUploadedProject saved = projectRepository.save(project);

        return toResponse(saved);
    }

    private String validateTitle(String title) {
        if (title == null || title.trim().isEmpty()) {
            throw new UploadValidationException("Project title is required.");
        }

        String normalizedTitle = title.trim();
        if (normalizedTitle.length() > 120) {
            throw new UploadValidationException("Project title must be 120 characters or less.");
        }

        return normalizedTitle;
    }

    private UploadVisibility parseVisibility(String visibility) {
        if (visibility == null || visibility.isBlank()) {
            return UploadVisibility.PRIVATE;
        }

        try {
            return UploadVisibility.valueOf(visibility.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new UploadValidationException("Visibility must be PRIVATE, UNLISTED, or PUBLIC.");
        }
    }

    private void validateMidi(MultipartFile file) {
        validateFile(file, "MIDI file");
        validateExtension(file, Set.of(".mid"), "MIDI file must use .mid extension.");
        validateMimeType(file, MIDI_MIME_TYPES, "MIDI file type is not supported.");
        validateSize(file, maxMidiSizeBytes, "MIDI file is too large.");
    }

    private void validateSample(MultipartFile file) {
        validateFile(file, "Sample file");
        validateExtension(file, Set.of(".mp3", ".wav"), "Sample file must use .mp3 or .wav extension.");
        validateMimeType(file, SAMPLE_MIME_TYPES, "Sample file type is not supported.");
        validateSize(file, maxSampleSizeBytes, "Sample file is too large.");
    }

    private void validateFile(MultipartFile file, String label) {
        if (file == null || file.isEmpty()) {
            throw new UploadValidationException(label + " is required.");
        }
    }

    private void validateExtension(MultipartFile file, Set<String> allowedExtensions, String message) {
        String filename = file.getOriginalFilename();
        if (filename == null) {
            throw new UploadValidationException(message);
        }

        String lowerFilename = filename.toLowerCase(Locale.ROOT);
        boolean allowed = allowedExtensions.stream().anyMatch(lowerFilename::endsWith);
        if (!allowed) {
            throw new UploadValidationException(message);
        }
    }

    private void validateMimeType(MultipartFile file, Set<String> allowedMimeTypes, String message) {
        String contentType = normalizedContentType(file);
        if (!allowedMimeTypes.contains(contentType)) {
            throw new UploadValidationException(message);
        }
    }

    private void validateSize(MultipartFile file, long maxSizeBytes, String message) {
        if (file.getSize() > maxSizeBytes) {
            throw new UploadValidationException(message);
        }
    }

    private String normalizedContentType(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null || contentType.isBlank()) {
            return "application/octet-stream";
        }

        return contentType.toLowerCase(Locale.ROOT);
    }

    private Map<String, Object> metadataFor(MultipartFile midiFile, MultipartFile sampleFile) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("midiOriginalFilename", midiFile.getOriginalFilename());
        metadata.put("midiContentType", normalizedContentType(midiFile));
        metadata.put("midiSizeBytes", midiFile.getSize());
        metadata.put("sampleOriginalFilename", sampleFile.getOriginalFilename());
        metadata.put("sampleContentType", normalizedContentType(sampleFile));
        metadata.put("sampleSizeBytes", sampleFile.getSize());
        return metadata;
    }

    private String metadataString(Map<String, Object> metadata, String key, String fallback) {
        Object value = metadata.get(key);
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            return stringValue;
        }

        return fallback;
    }

    private UserUploadResponse toResponse(UserUploadedProject project) {
        return new UserUploadResponse(
                project.getId(),
                project.getOwner().getId(),
                project.getTitle(),
                project.getMidiObjectKey(),
                midiUrl(project.getId()),
                project.getSampleObjectKey(),
                null,
                project.getUploadedAt(),
                project.getVisibility(),
                project.getMetadata()
        );
    }

    private PublicUploadFeedItem toPublicFeedItem(UserUploadedProject project) {
        User owner = project.getOwner();

        return new PublicUploadFeedItem(
                project.getId(),
                owner.getId(),
                owner.getUsername(),
                project.getTitle(),
                midiUrl(project.getId()),
                null,
                project.getUploadedAt(),
                project.getVisibility(),
                project.getMetadata()
        );
    }

    @Transactional
    public Optional<PublicMidiFile> getMidiFile(Long projectId, User viewer) {
        return projectRepository.findById(projectId)
                .filter(project -> project.getVisibility() == UploadVisibility.PUBLIC
                        || viewer != null && project.getOwner().getId().equals(viewer.getId()))
                .map(project -> {
                    byte[] bytes = storageService.readObjectBytes(project.getMidiObjectKey());
                    if (project.getVisibility() == UploadVisibility.PUBLIC) {
                        projectRepository.incrementDownloadCount(project.getId());
                    }
                    return new PublicMidiFile(
                            bytes,
                            metadataString(project.getMetadata(), "midiContentType", "audio/midi"),
                            metadataString(project.getMetadata(), "midiOriginalFilename", "project.mid")
                    );
                });
    }

    private String midiUrl(Long projectId) {
        return "/uploads/projects/" + projectId + "/midi";
    }

    public record PublicMidiFile(byte[] bytes, String contentType, String filename) {
    }
}
