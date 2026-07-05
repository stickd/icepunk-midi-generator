package icepunk_backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

    @Autowired
    private MockMvc mockMvc;

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
                .andExpect(status().isForbidden());
    }

    @Test
    void publicUserGeneratedPacksFeedIsReachableWithoutToken() throws Exception {
        mockMvc.perform(get("/users/somebody/generated-packs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void ownGeneratedPacksListRequiresAuthenticationDespiteUsersWildcard() throws Exception {
        // "/users/me/generated-packs" must NOT be swallowed by the public
        // "/users/*/generated-packs" wildcard below it.
        mockMvc.perform(get("/users/me/generated-packs"))
                .andExpect(status().isForbidden());
    }

    @Test
    void protectedEndpointWithInvalidTokenIsForbidden() throws Exception {
        // JwtAuthFilter swallows a malformed/expired token and continues
        // unauthenticated, so the request still hits anyRequest().authenticated()
        // and is rejected with 403 — it must NOT leak a 500 from the bad token.
        mockMvc.perform(get("/internal/secret")
                        .header("Authorization", "Bearer not-a-real-jwt"))
                .andExpect(status().isForbidden());
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
