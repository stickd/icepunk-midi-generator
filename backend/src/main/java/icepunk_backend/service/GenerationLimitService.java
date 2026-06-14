package icepunk_backend.service;

import icepunk_backend.exception.GenerationLimitException;
import icepunk_backend.model.GuestUsage;
import icepunk_backend.model.User;
import icepunk_backend.repository.GuestUsageRepository;
import icepunk_backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class GenerationLimitService {

    private static final int GUEST_DAILY_LIMIT = 3;
    private static final int USER_DAILY_LIMIT = 7;

    private final GuestUsageRepository guestUsageRepository;
    private final UserRepository userRepository;

    public GenerationLimitService(
            GuestUsageRepository guestUsageRepository,
            UserRepository userRepository
    ) {
        this.guestUsageRepository = guestUsageRepository;
        this.userRepository = userRepository;
    }

    public void checkAndIncreaseGuestLimit(String ipAddress) {
        LocalDate today = LocalDate.now();

        GuestUsage guestUsage = guestUsageRepository
                .findByIpAddress(ipAddress)
                .orElseGet(() -> new GuestUsage(ipAddress));

        if (!today.equals(guestUsage.getGenerationDate())) {
            guestUsage.setGenerationDate(today);
            guestUsage.setGenerationsToday(0);
        }

        if (guestUsage.getGenerationsToday() >= GUEST_DAILY_LIMIT) {
            throw new GenerationLimitException("Guest daily generation limit reached");
        }

        guestUsage.setGenerationsToday(guestUsage.getGenerationsToday() + 1);
        guestUsageRepository.save(guestUsage);
    }

    public void checkAndIncreaseUserLimit(User user) {
        LocalDate today = LocalDate.now();

        if (!today.equals(user.getGenerationDate())) {
            user.setGenerationDate(today);
            user.setGenerationsToday(0);
        }

        if (user.getGenerationsToday() >= USER_DAILY_LIMIT) {
            throw new GenerationLimitException("User daily generation limit reached");
        }

        user.setGenerationsToday(user.getGenerationsToday() + 1);
        userRepository.save(user);
    }
}