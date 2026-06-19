package icepunk_backend.service;

import icepunk_backend.exception.GenerationLimitException;
import icepunk_backend.model.GuestUsage;
import icepunk_backend.model.User;
import icepunk_backend.repository.GuestUsageRepository;
import icepunk_backend.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GenerationLimitServiceTest {

    private final GuestUsageRepository guestUsageRepository = mock(GuestUsageRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final GenerationLimitService service = new GenerationLimitService(
            guestUsageRepository,
            userRepository
    );

    @Test
    void incrementsGuestUsageWhenLimitIsAvailable() {
        GuestUsage usage = new GuestUsage("127.0.0.1");
        usage.setGenerationsToday(2);
        when(guestUsageRepository.findByIpAddressForUpdate("127.0.0.1")).thenReturn(Optional.of(usage));

        service.checkAndIncreaseGuestLimit("127.0.0.1");

        assertEquals(3, usage.getGenerationsToday());
        verify(guestUsageRepository).save(usage);
    }

    @Test
    void rejectsGuestUsageWhenDailyLimitIsReached() {
        GuestUsage usage = new GuestUsage("127.0.0.1");
        usage.setGenerationsToday(3);
        when(guestUsageRepository.findByIpAddressForUpdate("127.0.0.1")).thenReturn(Optional.of(usage));

        assertThrows(
                GenerationLimitException.class,
                () -> service.checkAndIncreaseGuestLimit("127.0.0.1")
        );
    }

    @Test
    void resetsUserUsageOnNewDay() {
        User user = new User("nikul", "nikul@example.com", "hash");
        user.setGenerationsToday(7);
        user.setGenerationDate(LocalDate.now().minusDays(1));
        when(userRepository.findByEmailForUpdate("nikul@example.com")).thenReturn(Optional.of(user));

        service.checkAndIncreaseUserLimit(user);

        assertEquals(1, user.getGenerationsToday());
        assertEquals(LocalDate.now(), user.getGenerationDate());
        verify(userRepository).save(user);
    }

    @Test
    void createsGuestUsageForNewIpAddress() {
        when(guestUsageRepository.findByIpAddressForUpdate("127.0.0.2")).thenReturn(Optional.empty());

        service.checkAndIncreaseGuestLimit("127.0.0.2");

        verify(guestUsageRepository).save(any(GuestUsage.class));
    }
}
