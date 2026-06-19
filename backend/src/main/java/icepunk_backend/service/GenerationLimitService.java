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

    @Transactional
    public void checkAndIncreaseGuestLimit(String ipAddress) {
        LocalDate today = LocalDate.now();

        GuestUsage guestUsage = guestUsageRepository
                .findByIpAddressForUpdate(ipAddress)
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

    @Transactional
    public void checkAndIncreaseUserLimit(User user) {
        User lockedUser = userRepository.findByEmailForUpdate(user.getEmail())
                .orElseThrow();

        LocalDate today = LocalDate.now();

        if (!today.equals(lockedUser.getGenerationDate())) {
            lockedUser.setGenerationDate(today);
            lockedUser.setGenerationsToday(0);
        }

        if (lockedUser.getGenerationsToday() >= USER_DAILY_LIMIT) {
            throw new GenerationLimitException("User daily generation limit reached");
        }

        lockedUser.setGenerationsToday(lockedUser.getGenerationsToday() + 1);
        userRepository.save(lockedUser);
    }
}
