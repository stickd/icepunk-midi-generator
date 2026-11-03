package icepunk_backend.controller;

import icepunk_backend.service.AccountDeletionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AccountDeletionController {
    private final AccountDeletionService service;
    public AccountDeletionController(AccountDeletionService service) { this.service=service; }
    @DeleteMapping("/account")
    public ResponseEntity<Void> delete(Authentication authentication) {
        service.request(authentication.getName());
        return ResponseEntity.accepted().build();
    }
}
