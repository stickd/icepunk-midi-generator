CREATE TABLE users (
    id              BIGSERIAL    PRIMARY KEY,
    username        VARCHAR(40)  NOT NULL,
    email           VARCHAR(254) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    generations_today INTEGER    DEFAULT 0,
    generation_date DATE,
    CONSTRAINT uk_users_email    UNIQUE (email),
    CONSTRAINT uk_users_username UNIQUE (username)
);

CREATE TABLE generation_stats (
    id                BIGINT PRIMARY KEY,
    total_generations BIGINT DEFAULT 0
);

CREATE TABLE guest_usage (
    id                BIGSERIAL    PRIMARY KEY,
    ip_address        VARCHAR(255) NOT NULL,
    generations_today INTEGER      DEFAULT 0,
    generation_date   DATE,
    CONSTRAINT uq_guest_usage_ip_address UNIQUE (ip_address)
);