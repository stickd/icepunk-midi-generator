package icepunk_backend.service;

import icepunk_backend.exception.ServerBusyException;
import icepunk_backend.dto.GenerationRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Comparator;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class MidiGenerationService {

    private final Path projectDir;
    private final Path pythonPath;
    private final String scriptName;
    private final long timeoutSeconds;
    private final Semaphore semaphore;

    public MidiGenerationService(
            @Value("${icepunk.generator.project-dir}") String projectDir,
            @Value("${icepunk.generator.python-path}") String pythonPath,
            @Value("${icepunk.generator.script-name}") String scriptName,
            @Value("${icepunk.generator.timeout-seconds}") long timeoutSeconds,
            @Value("${icepunk.generator.max-concurrent}") int maxConcurrentGenerations
    ) {
        this.projectDir = Paths.get(projectDir).toAbsolutePath().normalize();
        this.pythonPath = PythonExecutableResolver.resolve(pythonPath, this.projectDir);
        this.scriptName = scriptName;
        this.timeoutSeconds = timeoutSeconds;
        this.semaphore = new Semaphore(maxConcurrentGenerations);
    }

    public Path generateZip() throws Exception {
        return generateZip(null, null, null);
    }

    public Path generateZip(Path analysisFile, GenerationRequest request) throws Exception {
        Integer count = request == null ? null : request.getAmount();
        Integer bpm = request == null ? null : request.getBpm();
        return generateZip(analysisFile, count, bpm);
    }

    public GeneratedFiles generateFiles(Path analysisFile, GenerationRequest request) throws Exception {
        Integer count = request == null ? null : request.getAmount();
        Integer bpm = request == null ? null : request.getBpm();
        return generateFilesInternal(analysisFile, count, bpm);
    }

    private Path generateZip(Path analysisFile, Integer count, Integer bpm) throws Exception {
        try (GeneratedFiles generatedFiles = generateFilesInternal(analysisFile, count, bpm)) {
            Path persistentZip = projectDir.resolve("icepunk-midi-pack-" + UUID.randomUUID() + ".zip");
            Files.move(generatedFiles.zipPath(), persistentZip);
            return persistentZip;
        }
    }

    private GeneratedFiles generateFilesInternal(Path analysisFile, Integer count, Integer bpm) throws Exception {
        if (!semaphore.tryAcquire()) {
            throw new ServerBusyException("Server is busy. Try again later.");
        }

        Path outputDir = null;

        try {
            String generationId = UUID.randomUUID().toString();

            outputDir = projectDir.resolve("generated_midi").resolve(generationId);
            Files.createDirectories(outputDir);

            Process process = analysisFile == null && count == null && bpm == null
                    ? startGeneratorProcess(outputDir)
                    : startGeneratorProcess(outputDir, analysisFile, count, bpm);
            CompletableFuture<String> processOutput = CompletableFuture.supplyAsync(() -> readProcessOutput(process));
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                processOutput.cancel(true);
                throw new RuntimeException("Python generator timeout");
            }

            String output = awaitProcessOutput(processOutput);
            printProcessOutput(output);

            int exitCode = process.exitValue();

            if (exitCode != 0) {
                throw new RuntimeException("Python generator failed with exit code: " + exitCode);
            }

            Path zipPath = projectDir.resolve("icepunk-midi-pack-" + generationId + ".zip");
            createZipFromDirectory(outputDir, zipPath);

            List<Path> midiFiles;
            try (Stream<Path> paths = Files.list(outputDir)) {
                midiFiles = paths
                        .filter(path -> Files.isRegularFile(path)
                                && path.getFileName().toString().toLowerCase().endsWith(".mid"))
                        .sorted()
                        .toList();
            }

            return new GeneratedFiles(outputDir, zipPath, midiFiles);
        } catch (Exception exception) {
            if (outputDir != null) {
                deleteDirectoryIfExists(outputDir);
            }
            throw exception;
        } finally {
            semaphore.release();
        }
    }

    /**
     * Launches the Python generator subprocess that writes its MIDI output into
     * {@code outputDir}. Extracted as an overridable seam so tests can substitute
     * a controllable {@link Process} (timeout, non-zero exit, success) without
     * forking a real OS process.
     */
    Process startGeneratorProcess(Path outputDir) throws IOException {
        return startGeneratorProcess(outputDir, null, null, null);
    }

    Process startGeneratorProcess(
            Path outputDir,
            Path analysisFile,
            Integer count,
            Integer bpm
    ) throws IOException {
        java.util.List<String> command = new java.util.ArrayList<>();
        ensurePythonExecutableExists();
        command.add(pythonPath.toString());
        command.add(scriptName);
        command.add(outputDir.toString());

        if (analysisFile != null) {
            command.add("--analysis-file");
            command.add(analysisFile.toString());
        }

        if (count != null) {
            command.add("--count");
            command.add(String.valueOf(count));
        }

        if (bpm != null) {
            command.add("--bpm");
            command.add(String.valueOf(bpm));
        }

        ProcessBuilder processBuilder = new ProcessBuilder(
                command
        );

        processBuilder.directory(projectDir.toFile());
        processBuilder.redirectErrorStream(true);

        return processBuilder.start();
    }

    private void ensurePythonExecutableExists() {
        if (Files.isRegularFile(pythonPath)) {
            return;
        }

        throw new IllegalStateException(
                "Python generator executable not found: " + pythonPath
                        + ". Configure ICEPUNK_GENERATOR_PYTHON_PATH or create the project venv."
        );
    }

    private String readProcessOutput(Process process) {
        StringBuilder output = new StringBuilder();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream())
        )) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append(System.lineSeparator());
            }
        } catch (IOException exception) {
            throw new RuntimeException("Failed to read Python generator output", exception);
        }

        return output.toString();
    }

    private String awaitProcessOutput(CompletableFuture<String> processOutput) {
        try {
            return processOutput.get(5, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Interrupted while reading Python generator output", exception);
        } catch (ExecutionException exception) {
            throw new RuntimeException("Failed to read Python generator output", exception.getCause());
        } catch (TimeoutException exception) {
            throw new RuntimeException("Python generator output reader timeout", exception);
        }
    }

    private void printProcessOutput(String output) {
        if (output.isBlank()) {
            return;
        }

        output.lines().forEach(line -> System.out.println("[PYTHON] " + line));
    }

    private void createZipFromDirectory(Path sourceDir, Path zipPath) throws IOException {
        if (Files.exists(zipPath)) {
            Files.delete(zipPath);
        }

        try (
                ZipOutputStream zipOutputStream = new ZipOutputStream(
                        Files.newOutputStream(zipPath)
                );
                Stream<Path> paths = Files.walk(sourceDir)
        ) {
            paths.filter(path -> !Files.isDirectory(path))
                    .forEach(path -> {
                        ZipEntry zipEntry = new ZipEntry(
                                sourceDir.relativize(path).toString()
                        );

                        try {
                            zipOutputStream.putNextEntry(zipEntry);
                            Files.copy(path, zipOutputStream);
                            zipOutputStream.closeEntry();
                        } catch (IOException e) {
                            throw new RuntimeException(e);
                        }
                    });
        }
    }

    private void deleteDirectoryIfExists(Path directory) throws IOException {
        if (!Files.exists(directory)) {
            return;
        }

        try (Stream<Path> paths = Files.walk(directory)) {
            paths.sorted(Comparator.reverseOrder())
                    .map(Path::toFile)
                    .forEach(File::delete);
        }
    }

    public record GeneratedFiles(Path outputDir, Path zipPath, List<Path> midiFiles) implements AutoCloseable {
        @Override
        public void close() throws IOException {
            Files.deleteIfExists(zipPath);
            if (!Files.exists(outputDir)) {
                return;
            }

            try (Stream<Path> paths = Files.walk(outputDir)) {
                paths.sorted(Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(File::delete);
            }
        }
    }
}
