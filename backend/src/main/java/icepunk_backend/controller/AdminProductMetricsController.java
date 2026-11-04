package icepunk_backend.controller;

import icepunk_backend.service.ProductMetricsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Secured by SecurityConfig's /admin/** ADMIN rule. */
@RestController
@RequestMapping("/admin/product-metrics")
public class AdminProductMetricsController {
    private final ProductMetricsService metrics;
    public AdminProductMetricsController(ProductMetricsService metrics) { this.metrics = metrics; }

    @GetMapping
    public ProductMetricsService.Dashboard dashboard(@RequestParam(defaultValue = "7") int days) {
        return metrics.dashboard(days);
    }
}
