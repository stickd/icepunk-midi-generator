package icepunk_backend.service;

import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class MidiGenerationService {

    private static final String PROJECT_DIR = "/home/nikul/iCEPUNKMIDIGENERATOR";
    private static final String PYTHON_PATH = PROJECT_DIR + "/venv/bin/python3";
    private static final String SCRIPT_NAME = "icepunk_midi_generator.py";

    private final Semaphore semaphore = new Semaphore(2);

    public Path generateZip() throws Exception {

        if (!semaphore.tryAcquire()) {
            throw new RuntimeException("Server is busy. Try again later.");
        }

        try {
            String generationId = UUID.randomUUID().toString();

            Path outputDir = Paths.get(PROJECT_DIR, "generated_midi", generationId);
            Files.createDirectories(outputDir);

            ProcessBuilder processBuilder = new ProcessBuilder(
                    PYTHON_PATH,
                    SCRIPT_NAME,
                    outputDir.toString()
            );

            processBuilder.directory(new File(PROJECT_DIR));
            processBuilder.redirectErrorStream(true);

            Process process = processBuilder.start();

            boolean finished = process.waitFor(60, TimeUnit.SECONDS);

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

            Path zipPath = Paths.get(
                    PROJECT_DIR,
                    "icepunk-midi-pack-" + generationId + ".zip"
            );

            createZipFromDirectory(outputDir, zipPath);

            return zipPath;

        } finally {
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
}