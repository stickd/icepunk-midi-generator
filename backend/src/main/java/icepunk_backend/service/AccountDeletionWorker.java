package icepunk_backend.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.LoggerFactory;

@Component
public class AccountDeletionWorker {
    private final AccountDeletionService service;
    public AccountDeletionWorker(AccountDeletionService service) { this.service = service; }
    @Scheduled(fixedDelayString="${account.deletion.interval-ms:60000}", initialDelayString="${account.deletion.initial-delay-ms:60000}")
    public void run() {
        try { service.processNext(); }
        catch (RuntimeException e) { LoggerFactory.getLogger(getClass()).error("Account deletion transaction failed; durable job retained"); }
    }
}
