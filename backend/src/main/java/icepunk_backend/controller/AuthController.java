package icepunk_backend.controller;

import icepunk_backend.dto.AuthResponse;
import icepunk_backend.dto.LoginRequest;
import icepunk_backend.dto.RegisterRequest;
import icepunk_backend.service.AuthService;
import icepunk_backend.service.ClientIpService;
import icepunk_backend.service.InMemoryRateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final ClientIpService clientIpService;
    private final InMemoryRateLimitService rateLimitService;

    public AuthController(
            AuthService authService,
            ClientIpService clientIpService,
            InMemoryRateLimitService rateLimitService
    ) {
        this.authService = authService;
        this.clientIpService = clientIpService;
        this.rateLimitService = rateLimitService;
    }

    @PostMapping("/register")
    public AuthResponse register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpServletRequest
    ) {
        String ipAddress = clientIpService.getClientIp(httpServletRequest);
        rateLimitService.checkRegisterLimit(ipAddress);

        String token = authService.register(request);

        return new AuthResponse(token);
    }

    @PostMapping("/login")
    public AuthResponse login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpServletRequest
    ) {
        String ipAddress = clientIpService.getClientIp(httpServletRequest);
        rateLimitService.checkLoginLimit(ipAddress);

        String token = authService.login(request);

        return new AuthResponse(token);
    }
}
