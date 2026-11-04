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
    private static final int USER_DAILY_LIMIT = 5;

    private final GuestUsageRepository guestUsageRepository;
    private final UserRepository userRepository;
    private final ProductMetricsService productMetricsService;

    public GenerationLimitService(
            GuestUsageRepository guestUsageRepository,
            UserRepository userRepository,
            ProductMetricsService productMetricsService
    ) {
        this.guestUsageRepository = guestUsageRepository;
        this.userRepository = userRepository;
        this.productMetricsService = productMetricsService;
    }

    /** Compatibility constructor for focused legacy tests. */
    public GenerationLimitService(GuestUsageRepository guestUsageRepository, UserRepository userRepository) {
        this(guestUsageRepository, userRepository, null);
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
        int used = LocalDate.now().equals(user.getGenerationDate()) ? user.getGenerationsToday() : 0;
        return new GenerationUsage(used, USER_DAILY_LIMIT);
    }

    public record GenerationUsage(int used, int limit) {
    }

    @Transactional
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
            recordLimitReached();
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

    @Transactional
    public void checkUserLimit(User user) {
        if (isLimitReached(user.getGenerationDate(), user.getGenerationsToday(), USER_DAILY_LIMIT, LocalDate.now())) {
            recordLimitReached();
            throw new GenerationLimitException("User daily generation limit reached");
        }
    }

    @Transactional
    public void incrementUserUsage(User user) {
        User lockedUser = userRepository.findByEmailForUpdate(user.getEmail()).orElseThrow();
        LocalDate today = LocalDate.now();
        resetUserUsageIfNeeded(lockedUser, today);

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

    private void recordLimitReached() {
        if (productMetricsService != null) productMetricsService.increment(ProductMetricsService.Metric.GENERATION_LIMIT_REACHED);
    }

    private void resetUsageIfNeeded(GuestUsage guestUsage, LocalDate today) {
        if (!today.equals(guestUsage.getGenerationDate())) {
            guestUsage.setGenerationDate(today);
            guestUsage.setGenerationsToday(0);
        }
    }

    private void resetUserUsageIfNeeded(User user, LocalDate today) {
        if (!today.equals(user.getGenerationDate())) {
            user.setGenerationDate(today);
            user.setGenerationsToday(0);
        }
    }

}
