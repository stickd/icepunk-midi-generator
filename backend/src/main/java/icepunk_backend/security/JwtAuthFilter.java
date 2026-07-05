package icepunk_backend.security;

import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final icepunk_backend.security.JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthFilter(icepunk_backend.security.JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        // If the request does not contain a valid Bearer token,
        // continue processing without authentication
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            // Remove the "Bearer " prefix and extract the JWT token
            String token = authHeader.substring(7);

            // Validate the token and extract the user's email
            String email = jwtService.extractEmail(token);

            // Continue only if an email was extracted and no user is authenticated yet
            if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {

                User user = userRepository.findByEmail(email)
                        .or(() -> userRepository.findByEmail(email.trim().toLowerCase(java.util.Locale.ROOT)))
                        .or(() -> userRepository.findByUsernameIgnoreCase(email))
                        .orElse(null);

                if (user != null) {
                    // Create an authentication object for the authenticated user
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    user.getEmail(),
                                    null,
                                    Collections.emptyList()
                            );

                    // Attach request details (IP address, session info, etc.)
                    authToken.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request)
                    );
                    
                    // Store the authenticated user in Spring Security context
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (Exception exception) {
             // Clear authentication if the token is invalid or expired
            SecurityContextHolder.clearContext();
        }

        filterChain.doFilter(request, response);
    }
}