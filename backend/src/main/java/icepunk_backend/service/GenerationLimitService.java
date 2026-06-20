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
        User currentUser = userRepository.findByEmail(user.getEmail())
                .orElseThrow();

        LocalDate today = LocalDate.now();

        if (isLimitReached(
                currentUser.getGenerationDate(),
                currentUser.getGenerationsToday(),
                USER_DAILY_LIMIT,
                today
        )) {
            throw new GenerationLimitException("User daily generation limit reached");
        }
    }

    @Transactional
    public void incrementUserUsage(User user) {
        User lockedUser = userRepository.findByEmailForUpdate(user.getEmail())
                .orElseThrow();

        LocalDate today = LocalDate.now();

        resetUsageIfNeeded(lockedUser, today);

        if (lockedUser.getGenerationsToday() >= USER_DAILY_LIMIT) {
            throw new GenerationLimitException("User daily generation limit reached");
        }

        lockedUser.setGenerationsToday(lockedUser.getGenerationsToday() + 1);
        userRepository.save(lockedUser);
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

    private void resetUsageIfNeeded(User user, LocalDate today) {
        if (!today.equals(user.getGenerationDate())) {
            user.setGenerationDate(today);
            user.setGenerationsToday(0);
        }
    }
}
