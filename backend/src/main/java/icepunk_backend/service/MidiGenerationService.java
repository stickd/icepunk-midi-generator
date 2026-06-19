package icepunk_backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class MidiGenerationService {

    private final Path projectDir;
    private final String pythonPath;
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
        this.pythonPath = resolvePythonPath(pythonPath, this.projectDir);
        this.scriptName = scriptName;
        this.timeoutSeconds = timeoutSeconds;
        this.semaphore = new Semaphore(maxConcurrentGenerations);
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

    public Path generateZip() throws Exception {
        if (!semaphore.tryAcquire()) {
            throw new RuntimeException("Server is busy. Try again later.");
        }

        Path outputDir = null;

        try {
            String generationId = UUID.randomUUID().toString();

            outputDir = projectDir.resolve("generated_midi").resolve(generationId);
            Files.createDirectories(outputDir);

            ProcessBuilder processBuilder = new ProcessBuilder(
                    pythonPath,
                    scriptName,
                    outputDir.toString()
            );

            processBuilder.directory(projectDir.toFile());
            processBuilder.redirectErrorStream(true);

            Process process = processBuilder.start();
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                throw new RuntimeException("Python generator timeout");
            }

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream())
            )) {
                String line;
                while ((line = reader.readLine()) != null) {
                    System.out.println("[PYTHON] " + line);
                }
            }

            int exitCode = process.exitValue();

            if (exitCode != 0) {
                throw new RuntimeException("Python generator failed with exit code: " + exitCode);
            }

            Path zipPath = projectDir.resolve("icepunk-midi-pack-" + generationId + ".zip");
            createZipFromDirectory(outputDir, zipPath);

            return zipPath;
        } finally {
            if (outputDir != null) {
                deleteDirectoryIfExists(outputDir);
            }
            semaphore.release();
        }
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
}
