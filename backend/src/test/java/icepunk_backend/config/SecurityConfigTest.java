package icepunk_backend.config;

import jakarta.servlet.RequestDispatcher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import icepunk_backend.service.EmailService;
import icepunk_backend.service.AuthRateLimitService;
import icepunk_backend.repository.UserRepository;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/*
 * | EP                                  | Request                                  | Expected                         |
 * |-------------------------------------|------------------------------------------|----------------------------------|
 * | public endpoint, no token           | GET /generation-stats                    | 200 (permitAll)                  |
 * | health endpoint, no token           | GET /actuator/health                     | 200 (permitAll)                  |
 * | protected endpoint, no token        | GET /internal/secret                     | 403 (anyRequest().authenticated)|
 * | protected endpoint, invalid token   | GET /internal/secret + bad Bearer        | 403 (filter degrades cleanly)    |
 * | CSRF disabled on stateless POST     | POST /auth/login (no CSRF token)         | 401, NOT 403                     |
 * | CORS applied for allowed origin     | GET /generation-stats with Origin header | Access-Control-Allow-Origin set  |
 *
 * Full @SpringBootTest on the H2 test profile so the real SecurityFilterChain,
 * JwtAuthFilter and CORS config are exercised end-to-end.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigTest {
    @MockitoBean
    private icepunk_backend.service.AccountDeletionService deletion;
    @Autowired
    private icepunk_backend.security.JwtService jwt;

    @Test
    void pendingAccountCanOnlyRepeatOwnDeletion() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/account"))
                .andExpect(status().isUnauthorized());
        var user = new icepunk_backend.model.User("delete-http", "delete-http@example.test", "hash");
        user.setVerified(true);
        user = userRepository.saveAndFlush(user);
        String token = jwt.generateToken(user.getEmail());
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/account")
                .header("Authorization", "Bearer " + token)).andExpect(status().isAccepted());
        user.setAccountStatus("DELETION_PENDING");
        userRepository.saveAndFlush(user);
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/account")
                .header("Authorization", "Bearer " + token)).andExpect(status().isAccepted());
        org.mockito.Mockito.verify(deletion, org.mockito.Mockito.times(2)).request(user.getEmail());
        for (String path : java.util.List.of("/generate", "/uploads/projects", "/users/me/profile", "/users/me/avatar")) {
            mockMvc.perform(post(path).header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        }
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/generated-packs/00000000-0000-0000-0000-000000000001/visibility")
                .header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @MockitoBean
    private EmailService emailService;

    @MockitoBean
    private AuthRateLimitService authRateLimitService;

    @Test
    void publicEndpointIsReachableWithoutToken() throws Exception {
        mockMvc.perform(get("/generation-stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalGenerations").exists());
    }

    @Test
    void publicUploadFeedIsReachableWithoutToken() throws Exception {
        mockMvc.perform(get("/uploads/feed"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void healthEndpointIsReachableWithoutToken() throws Exception {
        // Docker / load-balancer healthchecks hit /actuator/health unauthenticated.
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void unknownEndpointRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/internal/secret"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void publicUserGeneratedPacksFeedIsReachableWithoutToken() throws Exception {
        mockMvc.perform(get("/users/somebody/generated-packs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void publicAvatarReadIsReachableWithoutToken() throws Exception {
        mockMvc.perform(get("/users/123/avatar"))
                .andExpect(status().isNotFound());
    }

    @Test
    void anonymousAvatarUploadRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/users/me/avatar"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedAvatarUploadPassesSecurity() throws Exception {
        MvcResult register = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"avataruser\",\"email\":\"avataruser@example.com\",\"password\":\"safe-password-123\",\"termsAccepted\":true}"))
                .andExpect(status().isAccepted())
                .andReturn();

        var registeredUser = userRepository.findByEmail("avataruser@example.com").orElseThrow();
        registeredUser.setVerified(true);
        userRepository.saveAndFlush(registeredUser);
        String token = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"avataruser@example.com\",\"password\":\"safe-password-123\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()
                .replaceFirst(".*\"token\"\\s*:\\s*\"([^\"]+)\".*", "$1");

        mockMvc.perform(multipart("/users/me/avatar")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void registrationRequiresTwelveCharacterPassword() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"shortpass\",\"email\":\"shortpass@example.com\",\"password\":\"too-short\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void ownGeneratedPacksListRequiresAuthenticationDespiteUsersWildcard() throws Exception {
        // "/users/me/generated-packs" must NOT be swallowed by the public
        // "/users/*/generated-packs" wildcard below it.
        mockMvc.perform(get("/users/me/generated-packs"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointWithInvalidTokenIsUnauthorized() throws Exception {
        // JwtAuthFilter swallows a malformed/expired token and continues
        // unauthenticated, so the request still hits anyRequest().authenticated()
        // and is rejected with 403 — it must NOT leak a 500 from the bad token.
        mockMvc.perform(get("/internal/secret")
                        .header("Authorization", "Bearer not-a-real-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidTokenCannotFallBackToGuestForTempAnalysisOrGeneration() throws Exception {
        mockMvc.perform(multipart("/datasets/analyze-temp")
                        .file("files", new byte[] {0x4d, 0x54, 0x68, 0x64})
                        .header("Authorization", "Bearer expired-token"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"source\":\"FACTORY\"}")
                        .header("Authorization", "Bearer expired-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void errorEndpointIsReachableWithoutTokenSoInternalErrorsAreNotMaskedAsForbidden() throws Exception {
        mockMvc.perform(get("/error")
                        .requestAttr(RequestDispatcher.ERROR_STATUS_CODE, 500)
                        .requestAttr(RequestDispatcher.ERROR_REQUEST_URI, "/generate"))
                .andExpect(status().isInternalServerError());
    }

    @Test
    void csrfIsDisabledForStatelessPostEndpoints() throws Exception {
        // No CSRF token sent. If CSRF were enabled this POST would be 403.
        // Instead it reaches the controller and fails auth with 401 (unknown user).
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"nobody@example.com\",\"password\":\"whatever1\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void corsHeadersAppliedForAllowedOrigin() throws Exception {
        mockMvc.perform(get("/generation-stats")
                        .header("Origin", "http://localhost:3000"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));
    }
}
