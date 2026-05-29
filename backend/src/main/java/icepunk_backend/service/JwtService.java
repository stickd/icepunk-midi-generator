package icepunk_backend.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

// Generates a new JWT token for a user based on their email address
public String generateToken(String email) {
    return Jwts.builder()

            // Store the user's email in the Subject field of the token
            .subject(email)

            // Set the token creation time
            .issuedAt(new Date())

            // Set the token expiration time
            // Current time + configured lifetime from application.properties
            .expiration(new Date(System.currentTimeMillis() + expiration))

            // Sign the token with the secret key
            // This prevents the token from being modified or forged
            .signWith(getSigningKey())

            // Build the final JWT string
            .compact();
}

// Extracts the user's email address from a JWT token
public String extractEmail(String token) {
    return Jwts.parser()

            // Use the same secret key to verify the token signature
            .verifyWith(getSigningKey())

            // Build the parser instance
            .build()

            // Parse the token and validate:
            // - signature
            // - expiration date
            // - token structure
            .parseSignedClaims(token)

            // Get the payload section of the token
            .getPayload()

            // Extract and return the Subject field (email)
            .getSubject();
}

    // Creates a SecretKey object from the configured JWT secret string
private SecretKey getSigningKey() {

    // Convert the secret string into a byte array using UTF-8 encoding
    // JWT signing algorithms work with bytes, not plain strings
    byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);

    // Create and return an HMAC-SHA signing key from the byte array
    // This key is used to sign and verify JWT tokens
    return Keys.hmacShaKeyFor(keyBytes);
}
}