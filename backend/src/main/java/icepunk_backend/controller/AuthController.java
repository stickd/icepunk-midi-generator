package icepunk_backend.controller;

import icepunk_backend.dto.AuthResponse;
import icepunk_backend.dto.LoginRequest;
import icepunk_backend.dto.RegisterRequest;
import icepunk_backend.dto.ResendVerificationRequest;
import icepunk_backend.dto.VerificationResponse;
import icepunk_backend.service.AuthService;
import icepunk_backend.service.AuthRateLimitService;
import icepunk_backend.service.ClientIpService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final ClientIpService clientIpService;
    private final AuthRateLimitService rateLimitService;
    private final icepunk_backend.service.EmailVerificationService emailVerificationService;

    public AuthController(
            AuthService authService,
            ClientIpService clientIpService,
            AuthRateLimitService rateLimitService,
            icepunk_backend.service.EmailVerificationService emailVerificationService
    ) {
        this.authService = authService;
        this.clientIpService = clientIpService;
        this.rateLimitService = rateLimitService;
        this.emailVerificationService = emailVerificationService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpServletRequest
    ) {
        String ipAddress = clientIpService.getClientIp(httpServletRequest);
        rateLimitService.checkRegisterLimit(ipAddress, request.getEmail());

        authService.register(request);
        // Identical response for new, duplicate, and recovery attempts avoids
        // exposing whether an account is already registered.
        return ResponseEntity.accepted().body(new AuthResponse(null, true));
    }

    @PostMapping("/login")
    public AuthResponse login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpServletRequest
    ) {
        String ipAddress = clientIpService.getClientIp(httpServletRequest);
        rateLimitService.checkLoginLimit(ipAddress, request.getIdentifier());

        String token = authService.login(request);

        return new AuthResponse(token);
    }

    @GetMapping("/verify-email")
    public ResponseEntity<VerificationResponse> verifyEmail(@RequestParam(required = false) String token) {
        return switch (emailVerificationService.verify(token)) {
            case VERIFIED -> ResponseEntity.ok(new VerificationResponse("verified", "Email verified. You can now log in."));
            case EXPIRED -> ResponseEntity.status(410).body(new VerificationResponse("expired", "This verification link has expired."));
            case ALREADY_USED -> ResponseEntity.status(409).body(new VerificationResponse("already_used", "This verification link has already been used."));
            case INVALID -> ResponseEntity.status(404).body(new VerificationResponse("invalid", "This verification link is invalid."));
        };
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<VerificationResponse> resendVerification(@Valid @RequestBody ResendVerificationRequest request,
            HttpServletRequest httpServletRequest) {
        rateLimitService.checkResendVerificationLimit(clientIpService.getClientIp(httpServletRequest), request.getEmail());
        emailVerificationService.resend(request.getEmail());
        return ResponseEntity.accepted().body(new VerificationResponse("accepted", "If an account needs verification, an email has been sent."));
    }
}
