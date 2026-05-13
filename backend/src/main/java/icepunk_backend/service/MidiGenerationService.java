package icepunk_backend.service;

import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class MidiGenerationService {

    private static final String PROJECT_DIR = "/home/nikul/iCEPUNKMIDIGENERATOR";
    private static final String PYTHON_PATH = PROJECT_DIR + "/venv/bin/python3";
    private static final String SCRIPT_NAME = "icepunk_midi_generator.py";

    public Path generateZip() throws Exception {

        ProcessBuilder processBuilder = new ProcessBuilder(
                PYTHON_PATH,
                SCRIPT_NAME
        );

        processBuilder.directory(new File(PROJECT_DIR));
        processBuilder.redirectErrorStream(true);

        Process process = processBuilder.start();

        BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream())
        );

        String line;
        while ((line = reader.readLine()) != null) {
            System.out.println("[PYTHON] " + line);
        }

        int exitCode = process.waitFor();

        if (exitCode != 0) {
            throw new RuntimeException("Python generator failed with exit code: " + exitCode);
        }

        Path outputDir = Paths.get(PROJECT_DIR, "generated_midi");
        Path zipPath = Paths.get(PROJECT_DIR, "icepunk-midi-pack.zip");

        createZipFromDirectory(outputDir, zipPath);

        return zipPath;
    }

    private void createZipFromDirectory(Path sourceDir, Path zipPath) throws IOException {

        if (Files.exists(zipPath)) {
            Files.delete(zipPath);
        }

        try (ZipOutputStream zipOutputStream = new ZipOutputStream(
                Files.newOutputStream(zipPath)
        )) {
            Files.walk(sourceDir)
                    .filter(path -> !Files.isDirectory(path))
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