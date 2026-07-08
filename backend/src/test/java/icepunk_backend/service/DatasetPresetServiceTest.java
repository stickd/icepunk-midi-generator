package icepunk_backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import icepunk_backend.dto.DatasetPresetResponse;
import icepunk_backend.exception.DatasetNameAlreadyExistsException;
import icepunk_backend.exception.ForbiddenActionException;
import icepunk_backend.exception.GenerationRequestException;
import icepunk_backend.exception.ResourceNotFoundException;
import icepunk_backend.model.DatasetPreset;
import icepunk_backend.model.User;
import icepunk_backend.repository.DatasetPresetRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.dao.DataIntegrityViolationException;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DatasetPresetServiceTest {

    private static final String TWO_FILE_ANALYSIS =
            "{\"files\":[{\"file_name\":\"a.mid\"},{\"file_name\":\"b.mid\"}]}";
    private static final String EMPTY_FILE_ANALYSIS = "{\"files\":[]}";

    @TempDir
    Path projectDir;

    private DatasetPresetRepository repository;
    private DatasetPresetStorageService storageService;
    private TempAnalysisService tempAnalysisService;
    private DatasetPresetService service;

    private User owner;

    @BeforeEach
    void setUp() {
        repository = mock(DatasetPresetRepository.class);
        storageService = mock(DatasetPresetStorageService.class);
        tempAnalysisService = mock(TempAnalysisService.class);

        service = new DatasetPresetService(
                repository,
                storageService,
                tempAnalysisService,
                new ObjectMapper(),
                projectDir.toString()
        );

        owner = new User("maco", "maco@example.com", "hash");
        owner.setId(10L);
    }

    private Path analysisFile(String json) throws Exception {
        Path file = projectDir.resolve(UUID.randomUUID() + ".json");
        Files.writeString(file, json, StandardCharsets.UTF_8);
        return file;
    }

    @Test
    void saveUploadsAnalysisAndPersistsPresetWithSourceMidiCount() throws Exception {
        Path analysisFile = analysisFile(TWO_FILE_ANALYSIS);
        when(tempAnalysisService.resolveAnalysisFile("temp-1")).thenReturn(analysisFile);
        when(storageService.uploadAnalysis(analysisFile)).thenReturn("dataset_presets/key.json");
        when(repository.save(any(DatasetPreset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        DatasetPresetResponse response = service.save(owner, "  My Dark Loops  ", "temp-1");

        assertEquals("My Dark Loops", response.name());
        assertEquals(2, response.sourceMidiCount());
        verify(storageService).uploadAnalysis(analysisFile);
        verify(repository).flush();
    }

    @Test
    void saveRejectsAnalysisWithNoUsableFiles() throws Exception {
        Path analysisFile = analysisFile(EMPTY_FILE_ANALYSIS);
        when(tempAnalysisService.resolveAnalysisFile("temp-empty")).thenReturn(analysisFile);

        GenerationRequestException thrown = assertThrows(
                GenerationRequestException.class,
                () -> service.save(owner, "Empty", "temp-empty")
        );

        assertEquals("Analyzed dataset has no usable MIDI files.", thrown.getMessage());
        verify(storageService, never()).uploadAnalysis(any());
    }

    @Test
    void saveCleansUpUploadedObjectAndThrowsDatasetNameAlreadyExistsOnDuplicateName() throws Exception {
        Path analysisFile = analysisFile(TWO_FILE_ANALYSIS);
        when(tempAnalysisService.resolveAnalysisFile("temp-1")).thenReturn(analysisFile);
        when(storageService.uploadAnalysis(analysisFile)).thenReturn("dataset_presets/dup.json");
        when(repository.save(any(DatasetPreset.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThrows(
                DatasetNameAlreadyExistsException.class,
                () -> service.save(owner, "Dupe", "temp-1")
        );

        verify(storageService).deleteObjectQuietly("dataset_presets/dup.json");
    }

    @Test
    void saveCleansUpUploadedObjectAndRethrowsOnUnexpectedFailure() throws Exception {
        Path analysisFile = analysisFile(TWO_FILE_ANALYSIS);
        when(tempAnalysisService.resolveAnalysisFile("temp-1")).thenReturn(analysisFile);
        when(storageService.uploadAnalysis(analysisFile)).thenReturn("dataset_presets/boom.json");
        when(repository.save(any(DatasetPreset.class))).thenThrow(new IllegalStateException("db down"));

        assertThrows(IllegalStateException.class, () -> service.save(owner, "Boom", "temp-1"));

        verify(storageService).deleteObjectQuietly("dataset_presets/boom.json");
    }

    @Test
    void listReturnsPresetsForOwnerOrderedByRepository() {
        DatasetPreset preset = presetFor(owner, "Loops");
        when(repository.findByOwner_IdOrderByCreatedAtDesc(10L)).thenReturn(List.of(preset));

        List<DatasetPresetResponse> responses = service.list(owner);

        assertEquals(1, responses.size());
        assertEquals("Loops", responses.get(0).name());
    }

    @Test
    void deleteRemovesOwnedPresetAndCleansUpStorage() {
        DatasetPreset preset = presetFor(owner, "Loops");
        when(repository.findById(preset.getId())).thenReturn(Optional.of(preset));

        service.delete(preset.getId(), owner);

        verify(repository).delete(preset);
        verify(storageService).deleteObjectQuietly(preset.getAnalysisObjectKey());
    }

    @Test
    void deleteThrowsResourceNotFoundWhenPresetMissing() {
        UUID missingId = UUID.randomUUID();
        when(repository.findById(missingId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.delete(missingId, owner));
    }

    @Test
    void deleteThrowsForbiddenWhenCallerDoesNotOwnPreset() {
        User someoneElse = new User("other", "other@example.com", "hash");
        someoneElse.setId(99L);
        DatasetPreset preset = presetFor(someoneElse, "Not Yours");
        when(repository.findById(preset.getId())).thenReturn(Optional.of(preset));

        assertThrows(ForbiddenActionException.class, () -> service.delete(preset.getId(), owner));
        verify(repository, never()).delete(any());
    }

    @Test
    void resolveMergedAnalysisFileRejectsWhenNothingSelected() {
        GenerationRequestException thrown = assertThrows(
                GenerationRequestException.class,
                () -> service.resolveMergedAnalysisFile(List.of(), false, owner)
        );

        assertEquals("Select at least one saved dataset or the factory pool.", thrown.getMessage());
    }

    @Test
    void resolveMergedAnalysisFileRejectsMoreThanTenSources() {
        List<UUID> ids = java.util.stream.IntStream.range(0, 11)
                .mapToObj(index -> UUID.randomUUID())
                .toList();

        GenerationRequestException thrown = assertThrows(
                GenerationRequestException.class,
                () -> service.resolveMergedAnalysisFile(ids, false, owner)
        );

        assertTrue(thrown.getMessage().contains("up to 10 sources"));
    }

    @Test
    void resolveMergedAnalysisFileRejectsUnownedOrMissingDatasetIds() {
        UUID requestedId = UUID.randomUUID();
        when(repository.findByIdInAndOwner_Id(List.of(requestedId), 10L)).thenReturn(List.of());

        GenerationRequestException thrown = assertThrows(
                GenerationRequestException.class,
                () -> service.resolveMergedAnalysisFile(List.of(requestedId), false, owner)
        );

        assertEquals("One or more selected datasets were not found.", thrown.getMessage());
    }

    @Test
    void resolveMergedAnalysisFileMergesMultiplePresetsAndFactoryPool() throws Exception {
        DatasetPreset presetA = presetFor(owner, "A");
        DatasetPreset presetB = presetFor(owner, "B");
        when(repository.findByIdInAndOwner_Id(List.of(presetA.getId(), presetB.getId()), 10L))
                .thenReturn(List.of(presetA, presetB));
        when(storageService.readObject(presetA.getAnalysisObjectKey()))
                .thenReturn("{\"files\":[{\"file_name\":\"a.mid\"}]}".getBytes(StandardCharsets.UTF_8));
        when(storageService.readObject(presetB.getAnalysisObjectKey()))
                .thenReturn("{\"files\":[{\"file_name\":\"b.mid\"}]}".getBytes(StandardCharsets.UTF_8));

        Path factoryDir = projectDir.resolve("analysis_output");
        Files.createDirectories(factoryDir);
        Files.writeString(factoryDir.resolve("midi_analysis.json"), "{\"files\":[{\"file_name\":\"factory.mid\"}]}");

        Path mergedFile = projectDir.resolve("merged.json");
        when(tempAnalysisService.allocateAnalysisFile()).thenReturn(mergedFile);

        Path result = service.resolveMergedAnalysisFile(List.of(presetA.getId(), presetB.getId()), true, owner);

        assertEquals(mergedFile, result);
        String merged = Files.readString(result);
        assertTrue(merged.contains("a.mid"));
        assertTrue(merged.contains("b.mid"));
        assertTrue(merged.contains("factory.mid"));
    }

    @Test
    void resolveMergedAnalysisFileRejectsMissingFactoryPoolWhenRequested() {
        GenerationRequestException thrown = assertThrows(
                GenerationRequestException.class,
                () -> service.resolveMergedAnalysisFile(List.of(), true, owner)
        );

        assertEquals("The factory pool is not available right now.", thrown.getMessage());
    }

    private DatasetPreset presetFor(User presetOwner, String name) {
        DatasetPreset preset = new DatasetPreset();
        preset.setId(UUID.randomUUID());
        preset.setOwner(presetOwner);
        preset.setName(name);
        preset.setAnalysisObjectKey("dataset_presets/" + preset.getId() + ".json");
        preset.setSourceMidiCount(3);
        return preset;
    }
}
