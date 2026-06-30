package icepunk_backend.service;

import icepunk_backend.exception.ServerBusyException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertThrows;

/*
 * | EP                  | Setup                          | Expected             |
 * |---------------------|--------------------------------|----------------------|
 * | semaphore exhausted | maxConcurrent = 0              | ServerBusyException  |
 *
 * Note: timeout, non-zero exit code, success-path, and cleanup cases require
 * injecting a mock Process (the service forks the real OS process internally).
 * Those are blocked until the production seams from PHASE2_TODO are added:
 *   MidiGenerationService.setMockedProcess(Process) and getLastWorkDir().
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
}
