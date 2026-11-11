package icepunk_backend.controller;

import icepunk_backend.api.AuthApi;
import icepunk_backend.dto.AuthResponse;
import icepunk_backend.dto.LoginRequest;
import icepunk_backend.dto.RegisterRequest;
import icepunk_backend.service.AuthService;
import icepunk_backend.service.ClientIpService;
import icepunk_backend.service.InMemoryRateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController implements AuthApi {

    private final AuthService authService;
    private final ClientIpService clientIpService;
    private final InMemoryRateLimitService rateLimitService;
    private final HttpServletRequest httpServletRequest;

    public AuthController(
            AuthService authService,
            ClientIpService clientIpService,
            InMemoryRateLimitService rateLimitService,
            HttpServletRequest httpServletRequest) {
        this.authService = authService;
        this.clientIpService = clientIpService;
        this.rateLimitService = rateLimitService;
        this.httpServletRequest = httpServletRequest;
    }

    @Override
    public ResponseEntity<AuthResponse> register(RegisterRequest request) {
        String ipAddress = clientIpService.getClientIp(httpServletRequest);
        rateLimitService.checkRegisterLimit(ipAddress);

        String token = authService.register(request);

        return ResponseEntity.ok(new AuthResponse(token));
    }

    @Override
    public ResponseEntity<AuthResponse> login(LoginRequest request) {
        String ipAddress = clientIpService.getClientIp(httpServletRequest);
        rateLimitService.checkLoginLimit(ipAddress);

        String token = authService.login(request);

        return ResponseEntity.ok(new AuthResponse(token));
    }
}
