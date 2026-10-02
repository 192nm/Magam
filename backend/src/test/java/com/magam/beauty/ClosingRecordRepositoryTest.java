package com.magam.beauty;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static com.magam.beauty.ReceiptModels.*;
import static org.assertj.core.api.Assertions.*;

// Fast transactional tests. H2 is test-only; Supabase/PostgreSQL connectivity is verified separately.
class ClosingRecordRepositoryTest {
    JdbcTemplate jdbc;
    ClosingRecordRepository repository;
    @BeforeEach void setup() throws Exception {
        var source = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(source);
        jdbc.execute("CREATE SCHEMA magam");
        try (var stream = getClass().getResourceAsStream("/db/migration/V1__closing_records.sql")) {
            String sql = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            // Schema privilege syntax is PostgreSQL-specific; table DDL is exercised unchanged.
            sql = sql.substring(0, sql.indexOf("-- This schema"));
            for (String statement : sql.split(";")) if (!statement.isBlank()) jdbc.execute(statement);
        }
        repository = new ClosingRecordRepository(jdbc, new TransactionTemplate(new JdbcTransactionManager(source)), new ReportService());
    }
    ReportRequest report(String service, boolean needsReview) {
        return new ReportRequest(LocalDate.of(2026, 10, 2), "테스트 매장", List.of(new Entry("테스트 고객", service, 45000L, needsReview)), false, true);
    }
    @Test void savesCalculatedTotalsItemsAndListsPersistedRecords() {
        var id = UUID.randomUUID();
        var saved = repository.save(id, report("커트", false), false);
        assertThat(saved.total()).isEqualTo(45000);
        assertThat(saved.count()).isEqualTo(1);
        assertThat(saved.text()).contains("45,000원", "테스트 고객");
        assertThat(repository.list(100, 0)).containsExactly(saved);
        assertThat(jdbc.queryForObject("SELECT service FROM magam.closing_items WHERE report_id = ?", String.class, id)).isEqualTo("커트");
        assertThat(repository.list(100, 1)).isEmpty();
    }
    @Test void retriesAreIdempotentAndDifferentHiddenServicesConflict() {
        var id = UUID.randomUUID();
        var first = repository.save(id, report("커트", false), false);
        assertThat(repository.save(id, report("커트", false), false)).isEqualTo(first);
        assertThatThrownBy(() -> repository.save(id, report("염색", false), false)).isInstanceOf(ApiException.class);
        assertThat(repository.list(100, 0)).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM magam.closing_items", Integer.class)).isEqualTo(1);
    }
    @Test void aFailedItemRollsBackTheWholeRecord() {
        assertThatThrownBy(() -> repository.save(UUID.randomUUID(), report("x".repeat(121), false), false)).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(repository.list(100, 0)).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM magam.closing_items", Integer.class)).isZero();
    }
    @Test void rejectsUnreviewedOcrAndDeletesChildren() {
        assertThatThrownBy(() -> repository.save(UUID.randomUUID(), report("커트", true), false)).isInstanceOf(ApiException.class);
        var id = UUID.randomUUID();
        repository.save(id, report("커트", false), true);
        repository.delete(id);
        repository.delete(id);
        assertThat(repository.list(100, 0)).isEmpty();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM magam.closing_items", Integer.class)).isZero();
    }
}
