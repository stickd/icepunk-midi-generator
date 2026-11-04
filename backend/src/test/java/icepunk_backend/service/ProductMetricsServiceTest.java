package icepunk_backend.service;

import icepunk_backend.repository.ProductMetricDailyRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ProductMetricsServiceTest {
    @Test
    void recordsOnlyAnAtomicDailyAggregate() {
        ProductMetricDailyRepository repository = mock(ProductMetricDailyRepository.class);
        ProductMetricsService service = new ProductMetricsService(
                repository, Clock.fixed(Instant.parse("2026-11-04T12:00:00Z"), ZoneOffset.UTC));

        service.increment(ProductMetricsService.Metric.GENERATION_SUCCEEDED);

        verify(repository).increment(java.time.LocalDate.of(2026, 11, 4), "GENERATION_SUCCEEDED");
    }
}
