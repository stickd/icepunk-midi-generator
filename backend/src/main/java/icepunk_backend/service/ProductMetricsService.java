package icepunk_backend.service;

import icepunk_backend.model.ProductMetricDaily;
import icepunk_backend.repository.ProductMetricDailyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
public class ProductMetricsService {
    public enum Metric {
        GENERATION_SUCCEEDED,
        GENERATION_FAILED,
        GENERATION_LIMIT_REACHED,
        REGISTRATION_COMPLETED,
        PUBLIC_PACK_CREATED,
        EXPORT_URL_ISSUED
    }

    private final ProductMetricDailyRepository repository;
    private Clock clock;

    public ProductMetricsService(ProductMetricDailyRepository repository) {
        this.repository = repository;
        this.clock = Clock.systemUTC();
    }

    void useClockForTesting(Clock clock) {
        this.clock = clock;
    }

    /** PostgreSQL upsert makes concurrent requests increment one aggregate row safely. */
    @Transactional
    public void increment(Metric metric) {
        repository.increment(LocalDate.now(clock), metric.name());
    }

    @Transactional(readOnly = true)
    public Dashboard dashboard(int days) {
        int window = days == 30 ? 30 : 7;
        LocalDate from = LocalDate.now(clock).minusDays(window - 1L);
        List<ProductMetricDaily> rows = repository.findByMetricDateGreaterThanEqualOrderByMetricDateAscMetricNameAsc(from);
        Map<Metric, Long> totals = new EnumMap<>(Metric.class);
        for (Metric metric : Metric.values()) totals.put(metric, 0L);
        for (ProductMetricDaily row : rows) {
            try { totals.merge(Metric.valueOf(row.getMetricName()), row.getCount(), Long::sum); }
            catch (IllegalArgumentException ignored) { /* forward-compatible unknown metric */ }
        }
        long succeeded = totals.get(Metric.GENERATION_SUCCEEDED);
        long failed = totals.get(Metric.GENERATION_FAILED);
        double failureRate = succeeded + failed == 0 ? 0 : (failed * 100.0d) / (succeeded + failed);
        return new Dashboard(window, rows, totals, failureRate);
    }

    public record Dashboard(int days, List<ProductMetricDaily> daily, Map<Metric, Long> totals, double generationFailurePercent) { }
}
