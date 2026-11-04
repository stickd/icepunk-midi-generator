CREATE TABLE product_metric_daily (
    id BIGSERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    metric_name VARCHAR(64) NOT NULL,
    count BIGINT NOT NULL DEFAULT 0 CHECK (count >= 0),
    CONSTRAINT uk_product_metric_daily UNIQUE (metric_date, metric_name)
);

CREATE INDEX idx_product_metric_daily_date ON product_metric_daily(metric_date);
