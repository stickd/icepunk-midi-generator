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

        // Guest access is allowed only when the Authorization header is absent.
        // A supplied credential must never silently downgrade the request to guest.
        if (authHeader == null) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!authHeader.startsWith("Bearer ") || authHeader.substring(7).isBlank()) {
            rejectInvalidToken(response);
            return;
        }

        try {
            // Remove the "Bearer " prefix and extract the JWT token
            String token = authHeader.substring(7);

            // Validate the token and extract the user's email
            String email = jwtService.extractEmail(token);

            if (email == null || email.isBlank()) {
                rejectInvalidToken(response);
                return;
            }

            User user = userRepository.findByEmail(email)
                    .or(() -> userRepository.findByEmail(email.trim().toLowerCase(java.util.Locale.ROOT)))
                    .or(() -> userRepository.findByUsernameIgnoreCase(email))
                    .orElse(null);

            if (user == null) {
                rejectInvalidToken(response);
                return;
            }

            UsernamePasswordAuthenticationToken authToken =
                    new UsernamePasswordAuthenticationToken(
                            user.getEmail(),
                            null,
                            Collections.emptyList()
                    );

            authToken.setDetails(
                    new WebAuthenticationDetailsSource().buildDetails(request)
            );
            SecurityContextHolder.getContext().setAuthentication(authToken);
        } catch (Exception exception) {
            SecurityContextHolder.clearContext();
            rejectInvalidToken(response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void rejectInvalidToken(HttpServletResponse response) throws IOException {
        SecurityContextHolder.clearContext();
        response.setHeader("WWW-Authenticate", "Bearer");
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired authentication token.");
    }
}
