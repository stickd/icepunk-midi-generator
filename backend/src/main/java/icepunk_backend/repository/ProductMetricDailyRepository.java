package icepunk_backend.repository;

import icepunk_backend.model.ProductMetricDaily;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ProductMetricDailyRepository extends JpaRepository<ProductMetricDaily, Long> {
    @Modifying
    @Query(value = """
            INSERT INTO product_metric_daily (metric_date, metric_name, count)
            VALUES (:metricDate, :metricName, 1)
            ON CONFLICT (metric_date, metric_name) DO UPDATE
            SET count = product_metric_daily.count + 1
            """, nativeQuery = true)
    void increment(@Param("metricDate") LocalDate metricDate, @Param("metricName") String metricName);

    List<ProductMetricDaily> findByMetricDateGreaterThanEqualOrderByMetricDateAscMetricNameAsc(LocalDate metricDate);
}
