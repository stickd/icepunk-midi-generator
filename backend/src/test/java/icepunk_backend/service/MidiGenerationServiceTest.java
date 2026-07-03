package icepunk_backend.service;

import icepunk_backend.exception.ServerBusyException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/*
 * | EP                  | Setup                                   | Expected                       |
 * |---------------------|-----------------------------------------|--------------------------------|
 * | semaphore exhausted | maxConcurrent = 0                       | ServerBusyException            |
 * | process times out   | waitFor() returns false                 | RuntimeException, dir cleaned   |
 * | non-zero exit       | exitValue() != 0                        | RuntimeException, dir cleaned   |
 * | success             | exitValue() == 0, output file written   | zip path returned, dir cleaned  |
 *
 * The real service forks an OS process; tests substitute a controllable
 * {@link Process} by overriding the {@code startGeneratorProcess} seam.
 */
class MidiGenerationServiceTest {

    @TempDir
    Path projectDir;

    @Test
    void generateZipThrowsServerBusyWhenNoPermitsAvailable() {
        // maxConcurrent = 0 → the semaphore has no permits, so tryAcquire() fails
        // immediately and no OS process is ever forked.
        MidiGenerationService service = new MidiGenerationService(
                projectDir.toString(),
                "python3",
                "icepunk_midi_generator.py",
                60L,
                0
        );

        assertThrows(ServerBusyException.class, service::generateZip);
    }

    @Test
    void generateZipThrowsWhenProcessExceedsTimeout() {
        Process process = mock(Process.class);
        // waitFor(timeout) returning false models the process still running when
        // the timeout elapsed.
        TestableService service = new TestableService(outputDir -> {
            try {
                when(process.waitFor(anyLong(), any())).thenReturn(false);
            } catch (InterruptedException e) {
                throw new IllegalStateException(e);
            }
            when(process.getInputStream())
                    .thenReturn(new ByteArrayInputStream(new byte[0]));
            return process;
        });

        RuntimeException thrown = assertThrows(RuntimeException.class, service::generateZip);

        assertEquals("Python generator timeout", thrown.getMessage());
        verify(process).destroyForcibly();
        assertOutputDirRemoved(service);
    }

    @Test
    void generateZipThrowsOnNonZeroExitCode() {
        Process process = mock(Process.class);
        TestableService service = new TestableService(outputDir -> {
            stubFinishedProcess(process, 3, "");
            return process;
        });

        RuntimeException thrown = assertThrows(RuntimeException.class, service::generateZip);

        assertEquals("Python generator failed with exit code: 3", thrown.getMessage());
        assertOutputDirRemoved(service);
    }

    @Test
    void generateZipReturnsZipPathOnSuccessAndCleansOutputDir() throws Exception {
        Process process = mock(Process.class);
        TestableService service = new TestableService(outputDir -> {
            // Simulate the generator writing its MIDI output before exiting 0.
            Files.writeString(outputDir.resolve("track.mid"), "midi-bytes");
            stubFinishedProcess(process, 0, "[PYTHON] wrote 1 file\n");
            return process;
        });

        Path zipPath = service.generateZip();

        assertNotNull(zipPath);
        assertTrue(Files.exists(zipPath), "zip file must exist on success");
        assertTrue(zipPath.getFileName().toString().matches("icepunk-midi-pack-.*\\.zip"));
        assertTrue(zipContainsEntry(zipPath, "track.mid"), "zip must contain the generated MIDI file");
        assertOutputDirRemoved(service);

        Files.deleteIfExists(zipPath);
    }

    @Test
    void generateZipCleansOutputDirEvenWhenGenerationFails() {
        Process process = mock(Process.class);
        TestableService service = new TestableService(outputDir -> {
            // The generator wrote partial output, then failed.
            Files.writeString(outputDir.resolve("partial.mid"), "half");
            stubFinishedProcess(process, 1, "boom\n");
            return process;
        });

        assertThrows(RuntimeException.class, service::generateZip);

        assertOutputDirRemoved(service);
    }

    // --- Helpers ----------------------------------------------------------

    private void assertOutputDirRemoved(TestableService service) {
        Path outputDir = service.capturedOutputDir;
        assertNotNull(outputDir, "the generator output directory should have been created");
        assertFalse(Files.exists(outputDir), "output directory must be removed after generation");
    }

    private static void stubFinishedProcess(Process process, int exitCode, String stdout) {
        try {
            when(process.waitFor(anyLong(), any())).thenReturn(true);
        } catch (InterruptedException e) {
            throw new IllegalStateException(e);
        }
        when(process.exitValue()).thenReturn(exitCode);
        when(process.getInputStream())
                .thenReturn(new ByteArrayInputStream(stdout.getBytes(StandardCharsets.UTF_8)));
    }

    private static boolean zipContainsEntry(Path zipPath, String entryName) throws IOException {
        try (ZipFile zipFile = new ZipFile(zipPath.toFile())) {
            Enumeration<? extends ZipEntry> entries = zipFile.entries();
            while (entries.hasMoreElements()) {
                if (entries.nextElement().getName().equals(entryName)) {
                    return true;
                }
            }
        }
        return false;
    }

    @FunctionalInterface
    private interface ProcessStub {
        Process create(Path outputDir) throws Exception;
    }

    /**
     * Overrides the process-launch seam to hand back a controllable mock
     * {@link Process} and records the output directory so cleanup can be asserted.
     */
    private class TestableService extends MidiGenerationService {

        private final ProcessStub stub;
        private Path capturedOutputDir;

        private TestableService(ProcessStub stub) {
            super(projectDir.toString(), "python3", "icepunk_midi_generator.py", 60L, 2);
            this.stub = stub;
        }

        @Override
        Process startGeneratorProcess(Path outputDir) throws IOException {
            this.capturedOutputDir = outputDir;
            try {
                return stub.create(outputDir);
            } catch (IOException e) {
                throw e;
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }
    }
}
