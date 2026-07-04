package icepunk_backend.service;

import icepunk_backend.exception.GenerationLimitException;
import icepunk_backend.model.GuestUsage;
import icepunk_backend.model.User;
import icepunk_backend.repository.GuestUsageRepository;
import icepunk_backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
public class GenerationLimitService {

    private static final int GUEST_DAILY_LIMIT = 5;

    private final GuestUsageRepository guestUsageRepository;
    private final UserRepository userRepository;

    public GenerationLimitService(
            GuestUsageRepository guestUsageRepository,
            UserRepository userRepository
    ) {
        this.guestUsageRepository = guestUsageRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public GenerationUsage getGuestUsage(String ipAddress) {
        LocalDate today = LocalDate.now();

        GuestUsage guestUsage = guestUsageRepository
                .findByIpAddress(ipAddress)
                .orElseGet(() -> new GuestUsage(ipAddress));

        int used = today.equals(guestUsage.getGenerationDate()) ? guestUsage.getGenerationsToday() : 0;

        return new GenerationUsage(used, GUEST_DAILY_LIMIT);
    }

    @Transactional(readOnly = true)
    public GenerationUsage getUserUsage(User user) {
        return new GenerationUsage(0, 0);
    }

    public record GenerationUsage(int used, int limit) {
    }

    @Transactional(readOnly = true)
    public void checkGuestLimit(String ipAddress) {
        LocalDate today = LocalDate.now();

        GuestUsage guestUsage = guestUsageRepository
                .findByIpAddress(ipAddress)
                .orElseGet(() -> new GuestUsage(ipAddress));

        if (isLimitReached(
                guestUsage.getGenerationDate(),
                guestUsage.getGenerationsToday(),
                GUEST_DAILY_LIMIT,
                today
        )) {
            throw new GenerationLimitException("Guest daily generation limit reached");
        }
    }

    @Transactional
    public void incrementGuestUsage(String ipAddress) {
        LocalDate today = LocalDate.now();

        GuestUsage guestUsage = guestUsageRepository
                .findByIpAddressForUpdate(ipAddress)
                .orElseGet(() -> new GuestUsage(ipAddress));

        resetUsageIfNeeded(guestUsage, today);

        if (guestUsage.getGenerationsToday() >= GUEST_DAILY_LIMIT) {
            throw new GenerationLimitException("Guest daily generation limit reached");
        }

        guestUsage.setGenerationsToday(guestUsage.getGenerationsToday() + 1);
        guestUsageRepository.save(guestUsage);
    }

    @Transactional(readOnly = true)
    public void checkUserLimit(User user) {
    }

    @Transactional
    public void incrementUserUsage(User user) {
    }

    private boolean isLimitReached(
            LocalDate generationDate,
            int generationsToday,
            int dailyLimit,
            LocalDate today
    ) {
        return today.equals(generationDate) && generationsToday >= dailyLimit;
    }

    private void resetUsageIfNeeded(GuestUsage guestUsage, LocalDate today) {
        if (!today.equals(guestUsage.getGenerationDate())) {
            guestUsage.setGenerationDate(today);
            guestUsage.setGenerationsToday(0);
        }
    }

}
