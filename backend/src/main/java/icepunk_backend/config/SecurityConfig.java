package icepunk_backend.config;

import icepunk_backend.security.JwtAuthFilter;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final List<String> allowedOrigins;
    private final boolean swaggerUiEnabled;

    public SecurityConfig(
            JwtAuthFilter jwtAuthFilter,
            @Value("${app.cors.allowed-origins}") String allowedOrigins,
            @Value("${springdoc.swagger-ui.enabled:false}") boolean swaggerUiEnabled) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.swaggerUiEnabled = swaggerUiEnabled;
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
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // Configure endpoint authorization rules
                .authorizeHttpRequests(auth -> {
                    // Public endpoints accessible without authentication
                    auth.requestMatchers("/auth/register", "/auth/login", "/generate", "/generation-stats")
                            .permitAll();

                    // Swagger UI and the contract it renders, unless turned off (SWAGGER_UI_ENABLED=false)
                    if (swaggerUiEnabled) {
                        auth.requestMatchers(
                                        "/swagger-ui.html",
                                        "/swagger-ui/**",
                                        "/v3/api-docs/swagger-config",
                                        "/openapi.yaml")
                                .permitAll();
                    }

                    // All other endpoints require a valid JWT token
                    auth.anyRequest().authenticated();
                })
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        // Configure Cross-Origin Resource Sharing (CORS)
        CorsConfiguration config = new CorsConfiguration();

        config.setAllowedOrigins(allowedOrigins);

        // Allowed HTTP methods
        config.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));

        // Allow all request headers
        config.setAllowedHeaders(List.of("*"));

        // Apply CORS configuration to all endpoints
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);

        return source;
    }
}
