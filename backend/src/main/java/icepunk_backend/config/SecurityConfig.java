package icepunk_backend.config;

import icepunk_backend.security.JwtAuthFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.Arrays;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final List<String> allowedOrigins;

    public SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            @Value("${app.cors.allowed-origins}") String allowedOrigins
    ) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .toList();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
            // Disable CSRF because we use JWT instead of sessions
            .csrf(csrf -> csrf.disable())

            // Enable CORS configuration
            .cors(Customizer.withDefaults())

            // Make Spring Security stateless (no HTTP sessions)
            .sessionManagement(session ->
                    session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )

            // Configure endpoint authorization rules
            .authorizeHttpRequests(auth -> auth

                    // Public endpoints accessible without authentication
                    .requestMatchers(
                            "/auth/register",
                            "/auth/login",
                            "/generate",
                            "/generation-stats",
                            "/generation-usage",
                            "/datasets/analyze-temp",
                            "/uploads/feed",
                            "/uploads/projects/*/midi",
                            "/user-uploads/**"
                    ).permitAll()

                    .requestMatchers("/error").permitAll()

                    .requestMatchers(HttpMethod.GET, "/users/*/avatar").permitAll()

                    // Public reads only — rename/visibility/delete and "my packs" stay authenticated
                    .requestMatchers(HttpMethod.GET, "/generated-packs/**").permitAll()

                    // "My packs" must stay authenticated — declared before the /users/*/generated-packs
                    // wildcard below so it takes precedence (first matching rule wins).
                    .requestMatchers(HttpMethod.GET, "/users/me/generated-packs").authenticated()

                    // Public profile reads only — POST /users/me/profile stays authenticated
                    .requestMatchers(HttpMethod.GET,
                            "/users/*/profile",
                            "/users/*/packs",
                            "/users/*/generated-packs"
                    ).permitAll()

                    // Health endpoint (used by Docker / load-balancer healthchecks)
                    .requestMatchers("/actuator/health").permitAll()

                    // Swagger is only registered outside prod; never make it an unauthenticated fallback.
                    .requestMatchers(
                            "/v3/api-docs/**",
                            "/swagger-ui/**",
                            "/swagger-ui.html"
                    ).denyAll()

                    // All other endpoints require a valid JWT token
                    .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
}

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        // Configure Cross-Origin Resource Sharing (CORS)
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(allowedOrigins);

        // Allowed HTTP methods
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));

        // Allow all request headers
        config.setAllowedHeaders(List.of("*"));

        // Apply CORS configuration to all endpoints
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return source;
    }
}
