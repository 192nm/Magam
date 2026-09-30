package com.magam.beauty;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import static com.magam.beauty.ReceiptModels.*;
import static org.assertj.core.api.Assertions.*;

class ReportServiceTest {
    private final ReportService service = new ReportService();

    @Test void includesNamesAmountsAndCorrectTotal() {
        var result = service.generate(new ReportRequest(LocalDate.of(2026, 9, 30), "마감 헤어", List.of(
            new Entry("김민지", "커트", 45000L, false), new Entry("이서연", "컬러", 120000L, false)), true, false));
        assertThat(result.total()).isEqualTo(165000);
        assertThat(result.count()).isEqualTo(2);
        assertThat(result.text()).isEqualTo("[마감 헤어] 2026.09.30 마감\n\n1. 김민지 / 커트 · 45,000원\n2. 이서연 / 컬러 · 120,000원\n\n총 2건 · 165,000원\n오늘도 수고하셨습니다.");
    }

    @Test void doesNotExportUnreviewedRecognition() {
        assertThatThrownBy(() -> service.generate(new ReportRequest(LocalDate.now(), "매장", List.of(new Entry("김민지", "커트", 45000L, true)), true, false)))
            .isInstanceOf(ApiException.class).hasMessageContaining("확인");
    }

    @Test void handlesFreeServiceAndCompactFormatWithoutLineInjection() {
        var result = service.generate(new ReportRequest(LocalDate.of(2026, 9, 30), " 마감\n헤어 ", List.of(new Entry("김\n민지", "커트", 0L, false)), false, true));
        assertThat(result.text()).isEqualTo("[마감 헤어] 2026.09.30 마감\n\n김 민지 · 0원\n\n총 1건 · 0원");
    }
}
