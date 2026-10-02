package com.magam.beauty;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.transaction.support.TransactionTemplate;
import static com.magam.beauty.ReceiptModels.*;

public class ClosingRecordRepository {
    public record SavedRecord(UUID id, LocalDate date, String text, long total, int count,
                              Instant createdAt, boolean sample) {}
    private static final RowMapper<SavedRecord> MAPPER = (rs, row) -> new SavedRecord(
            rs.getObject("id", UUID.class), rs.getObject("closing_date", LocalDate.class),
            rs.getString("report_text"), rs.getLong("total"), rs.getInt("item_count"),
            rs.getTimestamp("created_at").toInstant(), rs.getBoolean("sample"));
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final ReportService reports;

    public ClosingRecordRepository(JdbcTemplate jdbc, TransactionTemplate transactions, ReportService reports) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.reports = reports;
    }

    public boolean available() {
        try { return Integer.valueOf(1).equals(jdbc.queryForObject("SELECT 1 FROM magam.flyway_schema_history LIMIT 1", Integer.class)); }
        catch (org.springframework.dao.DataAccessException error) { return false; }
    }

    public List<SavedRecord> list(int limit, int offset) {
        return jdbc.query("SELECT * FROM magam.closing_reports ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?", MAPPER, limit, offset);
    }

    public SavedRecord save(UUID id, ReportRequest request, boolean sample) {
        var report = reports.generate(request);
        return transactions.execute(status -> {
            // The unique key serializes concurrent retries; all items commit with the header.
            int inserted = jdbc.update("INSERT INTO magam.closing_reports(id, closing_date, salon_name, report_text, total, item_count, sample, include_service, compact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
                    id, request.date(), request.salonName(), report.text(), report.total(), report.count(), sample, request.includeService(), request.compact());
            if (inserted == 0) {
                var saved = jdbc.queryForObject("SELECT * FROM magam.closing_reports WHERE id = ?", MAPPER, id);
                // Compare full input too: compact reports can omit service names.
                var same = jdbc.queryForObject("SELECT COUNT(*) FROM magam.closing_reports WHERE id = ? AND closing_date = ? AND salon_name = ? AND include_service = ? AND compact = ? AND sample = ?", Integer.class,
                        id, request.date(), request.salonName(), request.includeService(), request.compact(), sample);
                var items = jdbc.query("SELECT name, service, amount FROM magam.closing_items WHERE report_id = ? ORDER BY position",
                        (rs, row) -> new Entry(rs.getString(1), rs.getString(2), rs.getLong(3), false), id);
                if (same == null || same != 1 || !items.equals(request.entries())) throw new ApiException(409, "이미 다른 내용으로 저장된 기록입니다. 마감 문구를 다시 만들어 주세요.");
                return saved;
            }
            for (int i = 0; i < request.entries().size(); i++) {
                var entry = request.entries().get(i);
                jdbc.update("INSERT INTO magam.closing_items(report_id, position, name, service, amount) VALUES (?, ?, ?, ?, ?)",
                        id, i, entry.name(), entry.service(), entry.amount());
            }
            return jdbc.queryForObject("SELECT * FROM magam.closing_reports WHERE id = ?", MAPPER, id);
        });
    }

    public void delete(UUID id) {
        jdbc.update("DELETE FROM magam.closing_reports WHERE id = ?", id);
    }
}
