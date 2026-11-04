package icepunk_backend.model;

import jakarta.persistence.*;
import java.time.LocalDate;

/** Deliberately aggregate-only product telemetry: no user, IP, session, or event identifiers. */
@Entity
@Table(name = "product_metric_daily", uniqueConstraints = @UniqueConstraint(name = "uk_product_metric_daily", columnNames = {"metric_date", "metric_name"}))
public class ProductMetricDaily {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "metric_date", nullable = false)
    private LocalDate metricDate;
    @Column(name = "metric_name", nullable = false, length = 64)
    private String metricName;
    @Column(nullable = false)
    private long count;

    public LocalDate getMetricDate() { return metricDate; }
    public String getMetricName() { return metricName; }
    public long getCount() { return count; }
}
