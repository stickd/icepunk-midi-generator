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
import static org.mockito.Mockito.never;
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
    void checkGuestUsageDoesNotIncrementWhenLimitIsAvailable() {
        GuestUsage usage = new GuestUsage("127.0.0.1");
        usage.setGenerationsToday(2);
        when(guestUsageRepository.findByIpAddress("127.0.0.1")).thenReturn(Optional.of(usage));

        service.checkGuestLimit("127.0.0.1");

        assertEquals(2, usage.getGenerationsToday());
        verify(guestUsageRepository, never()).save(usage);
    }

    @Test
    void rejectsGuestUsageWhenDailyLimitIsReached() {
        GuestUsage usage = new GuestUsage("127.0.0.1");
        usage.setGenerationsToday(3);
        when(guestUsageRepository.findByIpAddress("127.0.0.1")).thenReturn(Optional.of(usage));

        assertThrows(
                GenerationLimitException.class,
                () -> service.checkGuestLimit("127.0.0.1")
        );
    }

    @Test
    void incrementsGuestUsageAfterSuccessfulGeneration() {
        GuestUsage usage = new GuestUsage("127.0.0.1");
        usage.setGenerationsToday(2);
        when(guestUsageRepository.findByIpAddressForUpdate("127.0.0.1")).thenReturn(Optional.of(usage));

        service.incrementGuestUsage("127.0.0.1");

        assertEquals(3, usage.getGenerationsToday());
        verify(guestUsageRepository).save(usage);
    }

    @Test
    void resetsUserUsageOnNewDayWhenIncrementing() {
        User user = new User("nikul", "nikul@example.com", "hash");
        user.setGenerationsToday(7);
        user.setGenerationDate(LocalDate.now().minusDays(1));
        when(userRepository.findByEmailForUpdate("nikul@example.com")).thenReturn(Optional.of(user));

        service.incrementUserUsage(user);

        assertEquals(1, user.getGenerationsToday());
        assertEquals(LocalDate.now(), user.getGenerationDate());
        verify(userRepository).save(user);
    }

    @Test
    void createsGuestUsageForNewIpAddress() {
        when(guestUsageRepository.findByIpAddressForUpdate("127.0.0.2")).thenReturn(Optional.empty());

        service.incrementGuestUsage("127.0.0.2");

        verify(guestUsageRepository).save(any(GuestUsage.class));
    }

    @Test
    void checkUserUsageDoesNotIncrementWhenLimitIsAvailable() {
        User user = new User("nikul", "nikul@example.com", "hash");
        user.setGenerationsToday(6);
        when(userRepository.findByEmail("nikul@example.com")).thenReturn(Optional.of(user));

        service.checkUserLimit(user);

        assertEquals(6, user.getGenerationsToday());
        verify(userRepository, never()).save(user);
    }

    @Test
    void rejectsUserUsageWhenDailyLimitIsReached() {
        User user = new User("nikul", "nikul@example.com", "hash");
        user.setGenerationsToday(7);
        when(userRepository.findByEmail("nikul@example.com")).thenReturn(Optional.of(user));

        assertThrows(
                GenerationLimitException.class,
                () -> service.checkUserLimit(user)
        );
    }
}
