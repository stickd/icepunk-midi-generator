package icepunk_backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import icepunk_backend.dto.TempAnalysisResponse;
import icepunk_backend.exception.GenerationRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.FileTime;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class TempAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(TempAnalysisService.class);
    private static final int MAX_FILES = 100;
    private static final long DEFAULT_RETENTION_HOURS = 24;

    private final Path projectDir;
    private final Path tempAnalysisDir;
    private final String pythonPath;
    private final String analyzerScriptName;
    private final long timeoutSeconds;
    private final long maxMidiSizeBytes;
    private final long retentionHours;
    private final Clock clock;
    private final ObjectMapper objectMapper;

    @Autowired
    public TempAnalysisService(
            @Value("${icepunk.generator.project-dir}") String projectDir,
            @Value("${icepunk.generator.python-path}") String pythonPath,
            @Value("${icepunk.generator.temp-analyzer-script-name:icepunk_midi_temp_analyzer.py}") String analyzerScriptName,
            @Value("${icepunk.generator.timeout-seconds}") long timeoutSeconds,
            @Value("${datasets.temp.dir:${icepunk.generator.project-dir}/temp_analysis}") String tempAnalysisDir,
            @Value("${datasets.temp.midi.max-size-bytes:2097152}") long maxMidiSizeBytes,
            @Value("${datasets.temp.retention-hours:24}") long retentionHours,
            ObjectMapper objectMapper
    ) {
        this(
                projectDir,
                pythonPath,
                analyzerScriptName,
                timeoutSeconds,
                tempAnalysisDir,
                maxMidiSizeBytes,
                retentionHours,
                objectMapper,
                Clock.systemUTC()
        );
    }

    TempAnalysisService(
            String projectDir,
            String pythonPath,
            String analyzerScriptName,
            long timeoutSeconds,
            String tempAnalysisDir,
            long maxMidiSizeBytes,
            long retentionHours,
            ObjectMapper objectMapper,
            Clock clock
    ) {
        this.projectDir = Paths.get(projectDir).toAbsolutePath().normalize();
        this.pythonPath = resolvePythonPath(pythonPath, this.projectDir);
        this.analyzerScriptName = analyzerScriptName;
        this.timeoutSeconds = timeoutSeconds;
        this.tempAnalysisDir = Paths.get(tempAnalysisDir).toAbsolutePath().normalize();
        this.maxMidiSizeBytes = maxMidiSizeBytes;
        this.retentionHours = retentionHours > 0 ? retentionHours : DEFAULT_RETENTION_HOURS;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    private String resolvePythonPath(String configuredPythonPath, Path projectDir) {
        Path projectVenvPython = projectDir.resolve("venv").resolve("bin").resolve("python3");

        if (configuredPythonPath == null || configuredPythonPath.isBlank()) {
            return projectVenvPython.toString();
        }

        if ("python3".equals(configuredPythonPath) && Files.exists(projectVenvPython)) {
            return projectVenvPython.toString();
        }

        return configuredPythonPath;
    }

    public TempAnalysisResponse analyzeTemp(List<MultipartFile> files) throws IOException {
        List<MultipartFile> validFiles = validateFiles(files);
        String analysisId = UUID.randomUUID().toString();
        Path workspace = tempAnalysisDir.resolve(analysisId).normalize();
        Path inputDir = workspace.resolve("input");
        Path analysisFile = workspace.resolve("analysis.json");

        Files.createDirectories(inputDir);

        try {
            for (int index = 0; index < validFiles.size(); index++) {
                MultipartFile file = validFiles.get(index);
                Path target = inputDir.resolve(safeFilename(index, file.getOriginalFilename()));
                file.transferTo(target);
            }

            runAnalyzer(inputDir, analysisFile);
            Map<String, Object> analysis = readAnalysis(analysisFile);
            ensureAnalysisCanGenerate(analysis);

            Map<String, Object> metadata = new LinkedHashMap<>();
            Object summary = analysis.get("dataset_summary");
            if (summary instanceof Map<?, ?> summaryMap) {
                metadata.put("summary", summaryMap);
            }
            metadata.put("analysisFile", tempAnalysisDir.relativize(analysisFile).toString());

            return new TempAnalysisResponse(analysisId, validFiles.size(), metadata);
        } finally {
            deleteDirectoryIfExists(inputDir);
        }
    }

    public Path resolveAnalysisFile(String tempAnalysisId) {
        if (tempAnalysisId == null || !tempAnalysisId.matches("[0-9a-fA-F-]{36}")) {
            throw new GenerationRequestException("A valid tempAnalysisId is required for custom upload generation.");
        }

        Path analysisFile = tempAnalysisDir.resolve(tempAnalysisId).resolve("analysis.json").normalize();
        if (!analysisFile.startsWith(tempAnalysisDir) || !Files.isRegularFile(analysisFile)) {
            throw new GenerationRequestException("Custom upload analysis was not found. Analyze MIDI files again.");
        }

        return analysisFile;
    }

    @Scheduled(
            initialDelayString = "${datasets.temp.cleanup.initial-delay-ms:60000}",
            fixedDelayString = "${datasets.temp.cleanup.fixed-delay-ms:3600000}"
    )
    public void cleanupExpiredAnalyses() {
        try {
            CleanupResult result = cleanupExpiredAnalysesNow();
            log.info(
                    "Temporary analysis cleanup completed: deleted={} failures={} retentionHours={} dir={}",
                    result.deleted(),
                    result.failures(),
                    retentionHours,
                    tempAnalysisDir
            );
        } catch (RuntimeException exception) {
            log.warn("Temporary analysis cleanup failed for dir={}: {}", tempAnalysisDir, exception.getMessage());
        }
    }

    CleanupResult cleanupExpiredAnalysesNow() {
        if (!Files.isDirectory(tempAnalysisDir)) {
            return new CleanupResult(0, 0);
        }

        Instant cutoff = Instant.now(clock).minus(retentionHours, ChronoUnit.HOURS);
        int deleted = 0;
        int failures = 0;

        try (DirectoryStream<Path> entries = Files.newDirectoryStream(tempAnalysisDir)) {
            for (Path entry : entries) {
                if (!Files.isDirectory(entry) || !isExpired(entry, cutoff)) {
                    continue;
                }

                try {
                    deleteDirectoryIfExists(entry);
                    deleted++;
                } catch (IOException exception) {
                    failures++;
                    log.warn("Failed to delete temporary analysis dir={}: {}", entry, exception.getMessage());
                }
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to list temporary analysis directory", exception);
        }

        return new CleanupResult(deleted, failures);
    }

    private boolean isExpired(Path workspace, Instant cutoff) {
        Path analysisFile = workspace.resolve("analysis.json");
        Path timestampPath = Files.exists(analysisFile) ? analysisFile : workspace;

        try {
            FileTime modifiedTime = Files.getLastModifiedTime(timestampPath);
            return modifiedTime.toInstant().isBefore(cutoff);
        } catch (IOException exception) {
            log.warn("Failed to read temporary analysis timestamp dir={}: {}", workspace, exception.getMessage());
            return false;
        }
    }

    private List<MultipartFile> validateFiles(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw new GenerationRequestException("Upload at least one MIDI file.");
        }

        if (files.size() > MAX_FILES) {
            throw new GenerationRequestException("Upload no more than 100 MIDI files.");
        }

        List<MultipartFile> validFiles = new ArrayList<>();
        for (MultipartFile file : files) {
            validateMidiFile(file);
            validFiles.add(file);
        }

        return validFiles;
    }

    private void validateMidiFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new GenerationRequestException("MIDI files cannot be empty.");
        }

        String filename = file.getOriginalFilename();
        if (filename == null) {
            throw new GenerationRequestException("MIDI file must use .mid or .midi extension.");
        }

        String lowerFilename = filename.toLowerCase(Locale.ROOT);
        if (!lowerFilename.endsWith(".mid") && !lowerFilename.endsWith(".midi")) {
            throw new GenerationRequestException("Only .mid and .midi files are supported.");
        }

        if (file.getSize() > maxMidiSizeBytes) {
            throw new GenerationRequestException("MIDI file is too large.");
        }
    }

    private String safeFilename(int index, String originalFilename) {
        String fallback = "upload-" + index + ".mid";
        if (originalFilename == null || originalFilename.isBlank()) {
            return fallback;
        }

        String filename = Paths.get(originalFilename).getFileName().toString();
        filename = filename.replaceAll("[^A-Za-z0-9._-]", "_");
        return index + "-" + (filename.isBlank() ? fallback : filename);
    }

    private void runAnalyzer(Path inputDir, Path analysisFile) throws IOException {
        Process process = startAnalyzerProcess(inputDir, analysisFile);

        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append(System.lineSeparator());
            }
        }

        try {
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new GenerationRequestException("Temporary MIDI analysis timed out.");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new GenerationRequestException("Temporary MIDI analysis was interrupted.");
        }

        if (process.exitValue() != 0) {
            throw new GenerationRequestException("Temporary MIDI analysis failed.");
        }

        if (!output.isEmpty()) {
            output.toString().lines().forEach(line -> System.out.println("[TEMP_ANALYZER] " + line));
        }
    }

    Process startAnalyzerProcess(Path inputDir, Path analysisFile) throws IOException {
        ProcessBuilder processBuilder = new ProcessBuilder(
                pythonPath,
                analyzerScriptName,
                inputDir.toString(),
                analysisFile.toString()
        );

        processBuilder.directory(projectDir.toFile());
        processBuilder.redirectErrorStream(true);
        return processBuilder.start();
    }

    private Map<String, Object> readAnalysis(Path analysisFile) throws IOException {
        return objectMapper.readValue(
                analysisFile.toFile(),
                new TypeReference<>() {
                }
        );
    }

    @SuppressWarnings("unchecked")
    private void ensureAnalysisCanGenerate(Map<String, Object> analysis) {
        Object filesValue = analysis.get("files");
        if (!(filesValue instanceof List<?> files) || files.isEmpty()) {
            throw new GenerationRequestException("No usable MIDI files were found in the upload.");
        }

        boolean hasPattern = files.stream().anyMatch(file -> {
            if (!(file instanceof Map<?, ?> fileMap)) return false;
            Object patternsValue = fileMap.get("patterns");
            return patternsValue instanceof List<?> patterns && !patterns.isEmpty();
        });

        if (!hasPattern) {
            throw new GenerationRequestException("Uploaded MIDI files did not produce usable generation patterns.");
        }
    }

    private void deleteDirectoryIfExists(Path directory) throws IOException {
        if (!Files.exists(directory)) {
            return;
        }

        try (var paths = Files.walk(directory)) {
            paths.sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException exception) {
                            System.out.println("[TEMP_ANALYZER] Failed to delete " + path + ": " + exception.getMessage());
                        }
                    });
        }
    }

    record CleanupResult(int deleted, int failures) {
    }
}
