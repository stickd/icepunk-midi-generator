package icepunk_backend.security;

import icepunk_backend.model.User;
import icepunk_backend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/*
 * | EP                          | Setup                              | Expected                       |
 * |-----------------------------|------------------------------------|--------------------------------|
 * | no Authorization header     | header null                        | chain continues, no auth set   |
 * | valid token, user exists    | extractEmail ok, user found        | auth set to email, chain runs  |
 * | valid token, user deleted   | extractEmail ok, user not found    | no auth set, chain runs        |
 * | token parsing throws        | extractEmail throws                | context cleared, chain runs    |
 *
 * In the same package as JwtAuthFilter so the protected doFilterInternal is callable.
 */
class JwtAuthFilterTest {

    private final JwtService jwtService = mock(JwtService.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final JwtAuthFilter filter = new JwtAuthFilter(jwtService, userRepository);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void noHeaderContinuesChainWithoutAuth() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn(null);

        filter.doFilterInternal(request, response, chain);

        verify(chain).doFilter(request, response);
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void validTokenForExistingUserSetsAuthentication() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn("Bearer good-token");
        when(jwtService.extractEmail("good-token")).thenReturn("foo@bar.com");
        when(userRepository.findByEmail("foo@bar.com"))
                .thenReturn(Optional.of(new User("bob", "foo@bar.com", "hash")));

        filter.doFilterInternal(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertEquals("foo@bar.com", auth.getPrincipal());
        verify(chain).doFilter(request, response);
    }

    @Test
    void validTokenForDeletedUserLeavesNoAuthentication() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        when(request.getHeader("Authorization")).thenReturn("Bearer good-token");
        when(jwtService.extractEmail("good-token")).thenReturn("ghost@bar.com");
        when(userRepository.findByEmail("ghost@bar.com")).thenReturn(Optional.empty());

        filter.doFilterInternal(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(chain).doFilter(request, response);
    }

    @Test
    void tokenParsingExceptionClearsContextAndContinues() throws Exception {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpServletResponse response = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);
        // A stale authentication that must be cleared when token parsing fails.
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("stale@bar.com", null, List.of()));
        when(request.getHeader("Authorization")).thenReturn("Bearer bad-token");
        when(jwtService.extractEmail("bad-token")).thenThrow(new RuntimeException("malformed"));

        filter.doFilterInternal(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(chain).doFilter(request, response);
    }
}
