package icepunk_backend.service;

import icepunk_backend.model.GenerationStats;
import icepunk_backend.repository.GenerationStatsRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GenerationStatsServiceTest {

    private final GenerationStatsRepository generationStatsRepository = mock(GenerationStatsRepository.class);
    private final GenerationStatsService service = new GenerationStatsService(generationStatsRepository);

    @Test
    void returnsZeroWhenStatsRowDoesNotExist() {
        when(generationStatsRepository.findById(GenerationStats.GLOBAL_STATS_ID))
                .thenReturn(Optional.empty());

        assertEquals(0L, service.getTotalGenerations());
    }

    @Test
    void incrementsExistingGlobalCounter() {
        GenerationStats stats = new GenerationStats(GenerationStats.GLOBAL_STATS_ID, 41L);
        when(generationStatsRepository.findByIdForUpdate(GenerationStats.GLOBAL_STATS_ID))
                .thenReturn(Optional.of(stats));
        when(generationStatsRepository.save(stats)).thenReturn(stats);

        long total = service.incrementTotalGenerations();

        assertEquals(42L, total);
        verify(generationStatsRepository).save(stats);
    }
}
