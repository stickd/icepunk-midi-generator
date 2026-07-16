package icepunk_backend.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import icepunk_backend.exception.ServerBusyException;
import icepunk_backend.model.GeneratedPackStatus;
import icepunk_backend.repository.GeneratedPackRepository;
import icepunk_backend.service.GeneratedPackStorageService;
import icepunk_backend.service.GeneratedPackTransactionService;
import icepunk_backend.service.MidiGenerationService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.hamcrest.Matchers.matchesPattern;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end HTTP flows through the full Spring MVC stack (security filters,
 * controllers, services, JPA on the H2 {@code test} profile). Only the two
 * external side-effects are stubbed: the Python subprocess
 * ({@link MidiGenerationService}) and generated object storage.
 *
 * <p>Each test isolates itself two ways: {@code @Transactional} rolls back all
 * database writes, and a unique {@code X-Forwarded-For} IP gives each test its
 * own guest-usage row and its own in-memory rate-limit bucket (the rate-limit
 * service is a context-cached singleton whose state is not transactional).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ApiFlowsE2ETest {

    private static final String JWT_PATTERN = "[\\w-]+\\.[\\w-]+\\.[\\w-]+";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private GeneratedPackRepository generatedPackRepository;

    @MockitoBean
    private MidiGenerationService midiGenerationService;

    @MockitoBean
    private GeneratedPackStorageService generatedPackStorageService;

    @MockitoSpyBean
    private GeneratedPackTransactionService generatedPackTransactionService;

    @TempDir
    Path tempDir;

    // --- Auth flows -------------------------------------------------------

    @Test
    void registerReturnsJwt() throws Exception {
        mockMvc.perform(registerBody("alice", "alice@example.com", "secret123")
                        .header("X-Forwarded-For", "198.51.100.1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", matchesPattern(JWT_PATTERN)));
    }

    @Test
    void loginReturnsJwt() throws Exception {
        register("bob", "bob@example.com", "secret123", "198.51.100.2");

        String body = objectMapper.writeValueAsString(loginPayload("bob@example.com", "secret123"));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Forwarded-For", "198.51.100.2")
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", matchesPattern(JWT_PATTERN)));
    }

    // --- Stats ------------------------------------------------------------

    @Test
    void generationStatsReturnsTotal() throws Exception {
        mockMvc.perform(get("/generation-stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalGenerations").value(0));
    }

    // --- Generation success flows ----------------------------------------

    @Test
    void guestGenerateDoesNotExposeDownloadUrlsAndIncrementsCounter() throws Exception {
        stubSuccessfulGeneration();

        MvcResult result = mockMvc.perform(post("/generate").header("X-Forwarded-For", "198.51.100.10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.packId").exists())
                .andExpect(jsonPath("$.items[0].fileName").value("track.mid"))
                .andExpect(jsonPath("$.totalGenerations").value(1))
                .andExpect(jsonPath("$.downloadUrl").doesNotExist())
                .andExpect(jsonPath("$.packDownloadUrl").doesNotExist())
                .andExpect(jsonPath("$.items[0].downloadUrl").doesNotExist())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        JsonNode response = objectMapper.readTree(responseBody);
        String packId = response.get("packId").asText();

        assertFalse(responseBody.contains("generated_midi/"));
        assertFalse(responseBody.contains("generated_midi_items/"));
        assertFalse(responseBody.contains("/home/"));
        assertFalse(responseBody.contains("\\\\"));

        entityManager.flush();
        entityManager.clear();

        mockMvc.perform(get("/generated-packs/" + packId))
                .andExpect(status().isOk());

        mockMvc.perform(get("/generation-stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalGenerations").value(1));
    }

    @Test
    void authenticatedUserGenerateDoesNotExposeDownloadUrlAndIncrementsCounter() throws Exception {
        stubSuccessfulGeneration();
        String token = register("carol", "carol@example.com", "secret123", "198.51.100.11");
        TestTransaction.flagForCommit();
        TestTransaction.end();
        TestTransaction.start();

        mockMvc.perform(post("/generate")
                        .header("Authorization", "Bearer " + token)
                        .header("X-Forwarded-For", "198.51.100.11"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.downloadUrl").doesNotExist())
                .andExpect(jsonPath("$.items[0].fileName").value("track.mid"))
                .andExpect(jsonPath("$.totalGenerations").value(1));

        mockMvc.perform(get("/generation-stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalGenerations").value(1));
    }

    // --- Generation failure flows (counter must NOT advance) -------------

    @Test
    void semaphoreBusyReturns429AndDoesNotIncrementCounter() throws Exception {
        when(midiGenerationService.generateFiles(any(), any()))
                .thenThrow(new ServerBusyException("Server is busy. Try again later."));

        mockMvc.perform(post("/generate").header("X-Forwarded-For", "198.51.100.20"))
                .andExpect(status().isTooManyRequests());

        assertCounterUnchanged();
    }

    @Test
    void pythonTimeoutReturns500AndDoesNotIncrementCounter() throws Exception {
        when(midiGenerationService.generateFiles(any(), any()))
                .thenThrow(new RuntimeException("Python generator timeout"));

        mockMvc.perform(post("/generate").header("X-Forwarded-For", "198.51.100.21"))
                .andExpect(status().isInternalServerError());

        assertCounterUnchanged();
    }

    @Test
    void generatedPackPersistenceFailureReturns500AndDoesNotIncrementCounter() throws Exception {
        when(midiGenerationService.generateFiles(any(), any()))
                .thenAnswer(invocation -> createGeneratedFiles());
        when(generatedPackStorageService.uploadMidi(any(), any()))
                .thenAnswer(invocation -> new GeneratedPackStorageService.StoredObject(invocation.getArgument(1)));
        when(generatedPackStorageService.uploadZip(any(), any()))
                .thenAnswer(invocation -> new GeneratedPackStorageService.StoredObject(invocation.getArgument(1)));
        RuntimeException finalizationFailure = new RuntimeException("simulated finalization failure");
        doThrow(finalizationFailure).when(generatedPackTransactionService).finalizeReady(any());

        mockMvc.perform(post("/generate").header("X-Forwarded-For", "198.51.100.22"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Unexpected server error"));

        assertCounterUnchanged();
        assertEquals(1, generatedPackRepository.findAll().stream()
                .filter(pack -> pack.getStatus() == GeneratedPackStatus.FAILED)
                .count());
        verify(generatedPackStorageService, times(2)).deleteObject(anyString());
    }

    // --- Helpers ----------------------------------------------------------

    private void stubSuccessfulGeneration() throws Exception {
        when(midiGenerationService.generateFiles(any(), any()))
                .thenAnswer(invocation -> createGeneratedFiles());
        when(generatedPackStorageService.uploadMidi(any(), any()))
                .thenAnswer(invocation -> new GeneratedPackStorageService.StoredObject(invocation.getArgument(1)));
        when(generatedPackStorageService.uploadZip(any(), any()))
                .thenAnswer(invocation -> new GeneratedPackStorageService.StoredObject(invocation.getArgument(1)));
    }

    private MidiGenerationService.GeneratedFiles createGeneratedFiles() throws Exception {
        Path outputDir = Files.createDirectories(tempDir.resolve("generated-" + java.util.UUID.randomUUID()));
        Path midiPath = Files.writeString(outputDir.resolve("track.mid"), "midi");
        Path zipPath = Files.writeString(tempDir.resolve("pack-" + java.util.UUID.randomUUID() + ".zip"), "zip");
        return new MidiGenerationService.GeneratedFiles(outputDir, zipPath, List.of(midiPath));
    }

    private void assertCounterUnchanged() throws Exception {
        mockMvc.perform(get("/generation-stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalGenerations").value(0));
    }

    private String register(String username, String email, String password, String ip) throws Exception {
        String response = mockMvc.perform(registerBody(username, email, password)
                        .header("X-Forwarded-For", ip))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode node = objectMapper.readTree(response);
        return node.get("token").asText();
    }

    private MockHttpServletRequestBuilder registerBody(String username, String email, String password)
            throws Exception {
        String body = objectMapper.writeValueAsString(registerPayload(username, email, password));
        return post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
    }

    private java.util.Map<String, String> registerPayload(String username, String email, String password) {
        return java.util.Map.of("username", username, "email", email, "password", password);
    }

    private java.util.Map<String, String> loginPayload(String identifier, String password) {
        return java.util.Map.of("identifier", identifier, "password", password);
    }
}
