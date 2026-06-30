package icepunk_backend.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/*
 * | EP                                  | Input                          | Expected             |
 * |-------------------------------------|--------------------------------|----------------------|
 * | round-trip                          | token for "a@b.com"            | extractEmail = a@b.com|
 * | expired token                       | expiration in the past         | ExpiredJwtException  |
 * | malformed token                     | "not-a-jwt"                    | JwtException         |
 * | wrong signing key                   | token signed with other secret | JwtException         |
 */
class JwtServiceTest {

    private static final String SECRET = "test-secret-that-is-long-enough-for-hmac-sha-signing-key";

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        ReflectionTestUtils.setField(jwtService, "secret", SECRET);
        ReflectionTestUtils.setField(jwtService, "expiration", 60_000L);
    }

    @Test
    void extractEmailReturnsSubjectFromGeneratedToken() {
        String token = jwtService.generateToken("user@example.com");

        assertEquals("user@example.com", jwtService.extractEmail(token));
    }

    @Test
    void extractEmailThrowsOnExpiredToken() {
        ReflectionTestUtils.setField(jwtService, "expiration", -1_000L);
        String expired = jwtService.generateToken("user@example.com");

        assertThrows(ExpiredJwtException.class, () -> jwtService.extractEmail(expired));
    }

    @Test
    void extractEmailThrowsOnMalformedToken() {
        assertThrows(JwtException.class, () -> jwtService.extractEmail("not-a-jwt"));
    }

    @Test
    void extractEmailThrowsWhenTokenSignedWithDifferentSecret() {
        JwtService other = new JwtService();
        ReflectionTestUtils.setField(other, "secret", "a-completely-different-secret-key-value-here-padding");
        ReflectionTestUtils.setField(other, "expiration", 60_000L);
        String foreignToken = other.generateToken("user@example.com");

        assertThrows(JwtException.class, () -> jwtService.extractEmail(foreignToken));
    }
}
