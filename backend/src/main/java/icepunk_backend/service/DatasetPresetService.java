package icepunk_backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import icepunk_backend.dto.DatasetPresetResponse;
import icepunk_backend.exception.DatasetNameAlreadyExistsException;
import icepunk_backend.exception.ForbiddenActionException;
import icepunk_backend.exception.GenerationRequestException;
import icepunk_backend.exception.ResourceNotFoundException;
import icepunk_backend.model.DatasetPreset;
import icepunk_backend.model.User;
import icepunk_backend.repository.DatasetPresetRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DatasetPresetService {

    private static final int MAX_COMBINE_COUNT = 10;

    private final DatasetPresetRepository presetRepository;
    private final DatasetPresetStorageService storageService;
    private final TempAnalysisService tempAnalysisService;
    private final ObjectMapper objectMapper;
    private final Path factoryAnalysisFile;

    public DatasetPresetService(
            DatasetPresetRepository presetRepository,
            DatasetPresetStorageService storageService,
            TempAnalysisService tempAnalysisService,
            ObjectMapper objectMapper,
            @Value("${icepunk.generator.project-dir}") String projectDir
    ) {
        this.presetRepository = presetRepository;
        this.storageService = storageService;
        this.tempAnalysisService = tempAnalysisService;
        this.objectMapper = objectMapper;
        this.factoryAnalysisFile = Paths.get(projectDir).toAbsolutePath().normalize()
                .resolve("analysis_output/midi_analysis.json");
    }

    @Transactional
    public DatasetPresetResponse save(User owner, String name, String tempAnalysisId, String tempAnalysisAccessToken) {
        String normalizedName = name.trim();
        Path analysisFile = tempAnalysisService.resolveAnalysisFile(tempAnalysisId, owner, tempAnalysisAccessToken);
        return saveAnalysis(owner, normalizedName, analysisFile);
    }

    private DatasetPresetResponse saveAnalysis(User owner, String normalizedName, Path analysisFile) {
        Map<String, Object> analysis = readAnalysis(analysisFile);
        int sourceMidiCount = filesFrom(analysis).size();

        if (sourceMidiCount == 0) {
            throw new GenerationRequestException("Analyzed dataset has no usable MIDI files.");
        }

        String objectKey = storageService.uploadAnalysis(analysisFile);

        try {
            DatasetPreset preset = new DatasetPreset();
            preset.setId(UUID.randomUUID());
            preset.setOwner(owner);
            preset.setName(normalizedName);
            preset.setAnalysisObjectKey(objectKey);
            preset.setSourceMidiCount(sourceMidiCount);

            DatasetPreset saved = presetRepository.save(preset);
            presetRepository.flush();

            return toResponse(saved);
        } catch (DataIntegrityViolationException exception) {
            storageService.deleteObjectQuietly(objectKey);
            throw new DatasetNameAlreadyExistsException(
                    "A dataset named \"" + normalizedName + "\" already exists."
            );
        } catch (RuntimeException exception) {
            storageService.deleteObjectQuietly(objectKey);
            throw exception;
        }
    }

    public DatasetPresetResponse save(User owner, String name, String tempAnalysisId) {
        String normalizedName = name.trim();
        Path analysisFile = tempAnalysisService.resolveAnalysisFile(tempAnalysisId);
        return saveAnalysis(owner, normalizedName, analysisFile);
    }

    @Transactional(readOnly = true)
    public List<DatasetPresetResponse> list(User owner) {
        return presetRepository.findByOwner_IdOrderByCreatedAtDesc(owner.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void delete(UUID presetId, User owner) {
        DatasetPreset preset = requireOwnedPreset(presetId, owner);

        presetRepository.delete(preset);
        presetRepository.flush();

        storageService.deleteObjectQuietly(preset.getAnalysisObjectKey());
    }

    public Path resolveMergedAnalysisFile(List<UUID> datasetIds, boolean includeFactoryPool, User owner) {
        List<UUID> ids = datasetIds == null ? List.of() : datasetIds;
        int totalCount = ids.size() + (includeFactoryPool ? 1 : 0);

        if (totalCount == 0) {
            throw new GenerationRequestException("Select at least one saved dataset or the factory pool.");
        }

        if (totalCount > MAX_COMBINE_COUNT) {
            throw new GenerationRequestException("You can combine up to " + MAX_COMBINE_COUNT + " sources at once.");
        }

        List<DatasetPreset> presets = ids.isEmpty()
                ? List.of()
                : presetRepository.findByIdInAndOwner_Id(ids, owner.getId());

        if (presets.size() != ids.size()) {
            throw new ResourceNotFoundException("Dataset not found.");
        }

        List<Object> mergedFiles = new ArrayList<>();
        for (DatasetPreset preset : presets) {
            mergedFiles.addAll(filesFrom(readAnalysis(preset.getAnalysisObjectKey())));
        }

        if (includeFactoryPool) {
            mergedFiles.addAll(filesFrom(readFactoryAnalysis()));
        }

        if (mergedFiles.isEmpty()) {
            throw new GenerationRequestException("Selected datasets have no usable MIDI files.");
        }

        Map<String, Object> merged = new LinkedHashMap<>();
        merged.put("files", mergedFiles);

        try {
            Path mergedFile = tempAnalysisService.allocateAnalysisFile();
            objectMapper.writeValue(mergedFile.toFile(), merged);
            return mergedFile;
        } catch (IOException exception) {
            throw new UncheckedIOException("Failed to prepare merged dataset analysis.", exception);
        }
    }

    private DatasetPreset requireOwnedPreset(UUID presetId, User requester) {
        DatasetPreset preset = presetRepository.findById(presetId)
                .orElseThrow(() -> new ResourceNotFoundException("Dataset not found."));
        if (!preset.getOwner().getId().equals(requester.getId())) {
            throw new ResourceNotFoundException("Dataset not found.");
        }
        return preset;
    }

    @SuppressWarnings("unchecked")
    private List<Object> filesFrom(Map<String, Object> analysis) {
        Object filesValue = analysis.get("files");
        return filesValue instanceof List<?> files ? new ArrayList<>((List<Object>) files) : List.of();
    }

    private Map<String, Object> readAnalysis(Path analysisFile) {
        try {
            return objectMapper.readValue(analysisFile.toFile(), new TypeReference<>() {
            });
        } catch (IOException exception) {
            throw new UncheckedIOException("Failed to read analysis file: " + analysisFile, exception);
        }
    }

    private Map<String, Object> readAnalysis(String objectKey) {
        byte[] bytes = storageService.readObject(objectKey);
        try {
            return objectMapper.readValue(bytes, new TypeReference<>() {
            });
        } catch (IOException exception) {
            throw new UncheckedIOException("Failed to read dataset analysis: " + objectKey, exception);
        }
    }

    private Map<String, Object> readFactoryAnalysis() {
        if (!Files.isRegularFile(factoryAnalysisFile)) {
            throw new GenerationRequestException("The factory pool is not available right now.");
        }

        return readAnalysis(factoryAnalysisFile);
    }

    private DatasetPresetResponse toResponse(DatasetPreset preset) {
        return new DatasetPresetResponse(
                preset.getId(),
                preset.getName(),
                preset.getSourceMidiCount(),
                preset.getCreatedAt()
        );
    }
}
