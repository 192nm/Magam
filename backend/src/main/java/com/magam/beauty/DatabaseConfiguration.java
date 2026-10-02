package com.magam.beauty;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "magam.database.enabled", havingValue = "true")
public class DatabaseConfiguration {
    @Bean(destroyMethod = "close")
    HikariDataSource databaseDataSource(@Value("${magam.database.url}") String url,
                                      @Value("${magam.database.username}") String username,
                                      @Value("${magam.database.password}") String password,
                                      @Value("${magam.access-key}") String accessKey) {
        if (accessKey.isBlank()) throw new IllegalStateException("DB storage requires APP_ACCESS_KEY until user login is implemented.");
        if (!url.startsWith("jdbc:postgresql:") || username.isBlank() || password.isBlank()) {
            throw new IllegalStateException("DB_ENABLED=true requires DB_URL (JDBC PostgreSQL), DB_USERNAME and DB_PASSWORD.");
        }
        var config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        config.setMaximumPoolSize(3);
        config.setMinimumIdle(0);
        config.setConnectionTimeout(3000);
        config.setValidationTimeout(3000);
        config.setPoolName("magam-database");
        // Do not log credentials or connection properties, even with global debug enabled.
        var source = new HikariDataSource(config);
        try {
            Flyway.configure().dataSource(source).schemas("magam").defaultSchema("magam")
                    .locations("classpath:db/migration").cleanDisabled(true).load().migrate();
            return source;
        } catch (RuntimeException error) {
            source.close();
            throw error;
        }
    }

    @Bean
    ClosingRecordRepository closingRecordRepository(HikariDataSource databaseDataSource, ReportService reports) {
        return new ClosingRecordRepository(new JdbcTemplate(databaseDataSource),
                new TransactionTemplate(new JdbcTransactionManager(databaseDataSource)), reports);
    }
}
