package icepunk_backend.service;

import icepunk_backend.model.GenerationStats;
import icepunk_backend.repository.GenerationStatsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GenerationStatsService {

    private final GenerationStatsRepository generationStatsRepository;

    public GenerationStatsService(GenerationStatsRepository generationStatsRepository) {
        this.generationStatsRepository = generationStatsRepository;
    }

    @Transactional(readOnly = true)
    public long getTotalGenerations() {
        return generationStatsRepository.findById(GenerationStats.GLOBAL_STATS_ID)
                .map(GenerationStats::getTotalGenerations)
                .orElse(0L);
    }

    @Transactional
    public long incrementTotalGenerations() {
        GenerationStats stats = generationStatsRepository
                .findByIdForUpdate(GenerationStats.GLOBAL_STATS_ID)
                .orElseGet(() -> new GenerationStats(GenerationStats.GLOBAL_STATS_ID, 0L));

        stats.setTotalGenerations(stats.getTotalGenerations() + 1);

        return generationStatsRepository.save(stats).getTotalGenerations();
    }
}
