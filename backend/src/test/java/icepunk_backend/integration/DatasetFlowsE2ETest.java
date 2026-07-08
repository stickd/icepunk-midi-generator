package icepunk_backend.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import icepunk_backend.service.DatasetPresetStorageService;
import icepunk_backend.service.GeneratedPackStorageService;
import icepunk_backend.service.MidiGenerationService;
import icepunk_backend.service.TempAnalysisService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Smoke-tests the custom-dataset-preset user journey through the full Spring MVC
 * stack (security filters, controllers, services, JPA on the H2 {@code test}
 * profile): analyze a MIDI upload, save it as a named preset, generate a pack
 * from that preset, see the pack in "my packs", then delete the preset. This
 * path had zero test coverage before this file (see
 * docs/codex/KNOWN_ISSUES.md / DatasetPresetService|Controller). The Python
 * subprocess, generated-pack storage, and dataset-preset storage are stubbed;
 * everything else (HTTP, auth, validation, JPA) is real.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DatasetFlowsE2ETest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private TempAnalysisService tempAnalysisService;

    @MockitoBean
    private DatasetPresetStorageService datasetPresetStorageService;

    @MockitoBean
    private MidiGenerationService midiGenerationService;

    @MockitoBean
    private GeneratedPackStorageService generatedPackStorageService;

    @TempDir
    Path tempDir;

    private static final String TWO_FILE_ANALYSIS =
            "{\"files\":[{\"file_name\":\"a.mid\"},{\"file_name\":\"b.mid\"}]}";

    @Test
    void userCanSaveAnalyzedDatasetGenerateFromItAndSeeItInMyPacks() throws Exception {
        String token = register("dana", "dana@example.com", "secret123", "198.51.100.30");

        // 1. The user already analyzed some MIDI files (POST /datasets/analyze-temp
        // is exercised in DatasetControllerTest / TempAnalysisServiceTest; here we
        // stub the resulting tempAnalysisId resolving to a real analysis file).
        Path analysisFile = Files.writeString(
                tempDir.resolve("analysis.json"), TWO_FILE_ANALYSIS, StandardCharsets.UTF_8
        );
        when(tempAnalysisService.resolveAnalysisFile("temp-abc")).thenReturn(analysisFile);
        when(datasetPresetStorageService.uploadAnalysis(analysisFile))
                .thenReturn("dataset_presets/mock-key.json");

        // 2. Save it as a permanent, named preset.
        MvcResult saveResult = mockMvc.perform(post("/datasets")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "My Dark Loops", "tempAnalysisId", "temp-abc"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("My Dark Loops"))
                .andExpect(jsonPath("$.sourceMidiCount").value(2))
                .andReturn();

        JsonNode saved = objectMapper.readTree(saveResult.getResponse().getContentAsString());
        String presetId = saved.get("id").asText();

        // 3. It shows up when listing the caller's saved datasets.
        mockMvc.perform(get("/datasets").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(presetId))
                .andExpect(jsonPath("$[0].name").value("My Dark Loops"));

        // 4. Generate a pack from the saved preset (merge path: datasetIds, no
        // factory pool). The merge reads the preset's analysis back from storage.
        when(datasetPresetStorageService.readObject("dataset_presets/mock-key.json"))
                .thenReturn(TWO_FILE_ANALYSIS.getBytes(StandardCharsets.UTF_8));
        Path mergedAnalysisFile = tempDir.resolve("merged.json");
        when(tempAnalysisService.allocateAnalysisFile()).thenReturn(mergedAnalysisFile);
        stubSuccessfulGeneration("https://cdn.example/dataset-pack.zip");

        String generateBody = objectMapper.writeValueAsString(Map.of(
                "source", "CUSTOM_UPLOAD",
                "datasetIds", List.of(presetId)
        ));

        mockMvc.perform(post("/generate")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Forwarded-For", "198.51.100.30")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(generateBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("CUSTOM_UPLOAD"))
                .andExpect(jsonPath("$.downloadUrl", org.hamcrest.Matchers.matchesPattern("/generated-packs/.+/download")));

        // The merge step actually happened: the merged analysis file was written
        // with both source files' content, not just re-used the raw preset file.
        assertTrue(Files.exists(mergedAnalysisFile));
        String merged = Files.readString(mergedAnalysisFile);
        assertTrue(merged.contains("a.mid"));
        assertTrue(merged.contains("b.mid"));

        // 5. The generated pack is persisted and shows up in "my packs".
        mockMvc.perform(get("/users/me/generated-packs").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].source").value("CUSTOM_UPLOAD"));

        // 6. Deleting the preset removes both the DB row and its storage object.
        mockMvc.perform(delete("/datasets/" + presetId).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        verify(datasetPresetStorageService).deleteObjectQuietly("dataset_presets/mock-key.json");

        mockMvc.perform(get("/datasets").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void generatingFromAnotherUsersDatasetIsRejected() throws Exception {
        String ownerToken = register("erin", "erin@example.com", "secret123", "198.51.100.31");
        String intruderToken = register("frank", "frank@example.com", "secret123", "198.51.100.32");

        Path analysisFile = Files.writeString(
                tempDir.resolve("analysis.json"), TWO_FILE_ANALYSIS, StandardCharsets.UTF_8
        );
        when(tempAnalysisService.resolveAnalysisFile("temp-owner")).thenReturn(analysisFile);
        when(datasetPresetStorageService.uploadAnalysis(analysisFile))
                .thenReturn("dataset_presets/owner-key.json");

        MvcResult saveResult = mockMvc.perform(post("/datasets")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("name", "Owner Loops", "tempAnalysisId", "temp-owner"))))
                .andExpect(status().isCreated())
                .andReturn();

        String presetId = objectMapper.readTree(saveResult.getResponse().getContentAsString())
                .get("id").asText();

        String generateBody = objectMapper.writeValueAsString(Map.of(
                "source", "CUSTOM_UPLOAD",
                "datasetIds", List.of(presetId)
        ));

        // The intruder does not own the preset, so the merge must reject it as
        // "not found" rather than leaking or using someone else's dataset.
        mockMvc.perform(post("/generate")
                        .header("Authorization", "Bearer " + intruderToken)
                        .header("X-Forwarded-For", "198.51.100.32")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(generateBody))
                .andExpect(status().isBadRequest());

        // And deleting someone else's preset is forbidden, not silently ignored.
        mockMvc.perform(delete("/datasets/" + presetId).header("Authorization", "Bearer " + intruderToken))
                .andExpect(status().isForbidden());
    }

    private void stubSuccessfulGeneration(String downloadUrl) throws Exception {
        when(midiGenerationService.generateFiles(any(), any()))
                .thenAnswer(invocation -> createGeneratedFiles());
        when(generatedPackStorageService.uploadMidi(any()))
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi_items/item.mid", "https://cdn.example/item.mid"));
        when(generatedPackStorageService.uploadZip(any()))
                .thenReturn(new GeneratedPackStorageService.StoredObject("generated_midi/pack.zip", downloadUrl));
        when(generatedPackStorageService.publicUrlForObjectKey("generated_midi_items/item.mid"))
                .thenReturn("https://cdn.example/item.mid");
        when(generatedPackStorageService.publicUrlForObjectKey("generated_midi/pack.zip"))
                .thenReturn(downloadUrl);
    }

    private MidiGenerationService.GeneratedFiles createGeneratedFiles() throws Exception {
        Path outputDir = Files.createDirectories(tempDir.resolve("generated-" + java.util.UUID.randomUUID()));
        Path midiPath = Files.writeString(outputDir.resolve("track.mid"), "midi");
        Path zipPath = Files.writeString(tempDir.resolve("pack-" + java.util.UUID.randomUUID() + ".zip"), "zip");
        return new MidiGenerationService.GeneratedFiles(outputDir, zipPath, List.of(midiPath));
    }

    private String register(String username, String email, String password, String ip) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "username", username, "email", email, "password", password
        ));

        String response = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Forwarded-For", ip)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        return objectMapper.readTree(response).get("token").asText();
    }
}
