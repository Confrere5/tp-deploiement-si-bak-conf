CREATE TABLE IF NOT EXISTS automates (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    host VARCHAR(253) NOT NULL,
    port SMALLINT UNSIGNED NOT NULL DEFAULT 502,
    unit_id TINYINT UNSIGNED NOT NULL DEFAULT 1,
    archived_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_automates_port CHECK (port > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS variables (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    automate_id INT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(24) NOT NULL DEFAULT '',
    register_type ENUM('holding', 'input') NOT NULL,
    register_address SMALLINT UNSIGNED NOT NULL,
    data_type ENUM('uint16', 'int16') NOT NULL DEFAULT 'uint16',
    scale_factor DOUBLE NOT NULL DEFAULT 1,
    interval_ms INT UNSIGNED NOT NULL DEFAULT 1000,
    archived_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_variables_automates
        FOREIGN KEY (automate_id) REFERENCES automates (id),
    CONSTRAINT chk_variables_interval CHECK (interval_ms > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mesures (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    variable_id INT UNSIGNED NOT NULL,
    value_number DOUBLE NOT NULL,
    measured_at DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_mesures_variable_date (variable_id, measured_at),
    CONSTRAINT fk_mesures_variables
        FOREIGN KEY (variable_id) REFERENCES variables (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;