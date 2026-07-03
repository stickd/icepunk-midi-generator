package icepunk_backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import icepunk_backend.dto.TempAnalysisResponse;
import icepunk_backend.exception.GenerationRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TempAnalysisServiceTest {

    @TempDir
    Path projectDir;

    @TempDir
    Path tempAnalysisDir;

    @Test
    void analyzeTempRejectsEmptyUpload() {
        TempAnalysisService service = serviceWithAnalyzer(true);

        GenerationRequestException thrown = assertThrows(
                GenerationRequestException.class,
                () -> service.analyzeTemp(List.of())
        );

        assertEquals("Upload at least one MIDI file.", thrown.getMessage());
    }

    @Test
    void analyzeTempRejectsNonMidiFile() {
        TempAnalysisService service = serviceWithAnalyzer(true);

        GenerationRequestException thrown = assertThrows(
                GenerationRequestException.class,
                () -> service.analyzeTemp(List.of(file("notes.txt", "text/plain")))
        );

        assertEquals("Only .mid and .midi files are supported.", thrown.getMessage());
    }

    @Test
    void analyzeTempRejectsTooManyFiles() {
        TempAnalysisService service = serviceWithAnalyzer(true);
        List<MultipartFile> files = java.util.stream.IntStream.range(0, 9)
                .mapToObj(index -> file("file-" + index + ".mid", "audio/midi"))
                .map(MultipartFile.class::cast)
                .toList();

        GenerationRequestException thrown = assertThrows(
                GenerationRequestException.class,
                () -> service.analyzeTemp(files)
        );

        assertEquals("Upload no more than 8 MIDI files.", thrown.getMessage());
    }

    @Test
    void analyzeTempAcceptsValidMidiFilesAndKeepsAnalysisFile() throws Exception {
        TempAnalysisService service = serviceWithAnalyzer(true);

        TempAnalysisResponse response = service.analyzeTemp(List.of(file("loop.mid", "audio/midi")));

        assertEquals(1, response.fileCount());
        Path analysisFile = service.resolveAnalysisFile(response.tempAnalysisId());
        assertTrue(Files.isRegularFile(analysisFile));
        assertFalse(Files.exists(analysisFile.getParent().resolve("input")));
    }

    @Test
    void analyzeTempRejectsAnalyzerOutputWithoutPatterns() {
        TempAnalysisService service = serviceWithAnalyzer(false);

        GenerationRequestException thrown = assertThrows(
                GenerationRequestException.class,
                () -> service.analyzeTemp(List.of(file("loop.mid", "audio/midi")))
        );

        assertEquals("Uploaded MIDI files did not produce usable generation patterns.", thrown.getMessage());
    }

    @Test
    void cleanupExpiredAnalysesDeletesOnlyOldAnalysisDirectories() throws Exception {
        Instant now = Instant.parse("2026-07-03T12:00:00Z");
        TempAnalysisService service = serviceWithAnalyzer(true, Clock.fixed(now, ZoneOffset.UTC), 24);
        Path oldWorkspace = tempAnalysisDir.resolve("old-analysis");
        Path freshWorkspace = tempAnalysisDir.resolve("fresh-analysis");
        Files.createDirectories(oldWorkspace);
        Files.createDirectories(freshWorkspace);
        Files.writeString(oldWorkspace.resolve("analysis.json"), "{}");
        Files.writeString(freshWorkspace.resolve("analysis.json"), "{}");
        Files.setLastModifiedTime(oldWorkspace.resolve("analysis.json"), FileTime.from(now.minusSeconds(25 * 60 * 60)));
        Files.setLastModifiedTime(freshWorkspace.resolve("analysis.json"), FileTime.from(now.minusSeconds(2 * 60 * 60)));

        TempAnalysisService.CleanupResult result = service.cleanupExpiredAnalysesNow();

        assertEquals(1, result.deleted());
        assertEquals(0, result.failures());
        assertFalse(Files.exists(oldWorkspace));
        assertTrue(Files.exists(freshWorkspace));
    }

    private MockMultipartFile file(String filename, String contentType) {
        return new MockMultipartFile(
                "files",
                filename,
                contentType,
                "midi".getBytes(StandardCharsets.UTF_8)
        );
    }

    private TempAnalysisService serviceWithAnalyzer(boolean withPatterns) {
        return serviceWithAnalyzer(withPatterns, Clock.systemUTC(), 24);
    }

    private TempAnalysisService serviceWithAnalyzer(boolean withPatterns, Clock clock, long retentionHours) {
        return new TempAnalysisService(
                projectDir.toString(),
                "python3",
                "icepunk_midi_temp_analyzer.py",
                5,
                tempAnalysisDir.toString(),
                1024 * 1024,
                retentionHours,
                new ObjectMapper(),
                clock
        ) {
            @Override
            Process startAnalyzerProcess(Path inputDir, Path analysisFile) throws IOException {
                Files.createDirectories(analysisFile.getParent());
                Files.writeString(analysisFile, analysisJson(withPatterns), StandardCharsets.UTF_8);

                Process process = mock(Process.class);
                when(process.getInputStream()).thenReturn(new ByteArrayInputStream("ok\n".getBytes(StandardCharsets.UTF_8)));
                try {
                    when(process.waitFor(anyLong(), any(TimeUnit.class))).thenReturn(true);
                } catch (InterruptedException exception) {
                    throw new IOException(exception);
                }
                when(process.exitValue()).thenReturn(0);
                return process;
            }
        };
    }

    private String analysisJson(boolean withPatterns) {
        String patterns = withPatterns
                ? """
                [{
                  "pattern_index": 0,
                  "register_distribution": {"mid": 2},
                  "notes": [
                    {"pitch": 60, "velocity": 90, "relative_start_beat": 0.0, "duration_beats": 1.0, "register": "mid"},
                    {"pitch": 64, "velocity": 90, "relative_start_beat": 1.0, "duration_beats": 1.0, "register": "mid"}
                  ]
                }]
                """
                : "[]";

        return """
                {
                  "dataset_summary": {"total_files_found": 1, "total_files_analyzed": 1, "usable_patterns": 1},
                  "files": [
                    {
                      "file_name": "loop.mid",
                      "tempo_bpm_estimate": 140,
                      "estimated_key": "C major",
                      "rhythm_position_distribution": {"0.0": 1},
                      "register_distribution": {"mid": 2},
                      "patterns": %s
                    }
                  ],
                  "failed_files": []
                }
                """.formatted(patterns);
    }
}
