package com.magam.beauty;

import org.springframework.stereotype.Service;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import static com.magam.beauty.ReceiptModels.*;

@Service
public class ReportService {
    public ReportResponse generate(ReportRequest request) {
        if (request.entries().stream().anyMatch(Entry::needsReview)) {
            throw new ApiException(400, "확인이 필요한 항목을 먼저 확인해 주세요.");
        }
        var money = NumberFormat.getIntegerInstance(Locale.KOREA);
        var text = new StringBuilder();
        text.append('[').append(oneLine(request.salonName())).append("] ")
            .append(request.date().format(DateTimeFormatter.ofPattern("yyyy.MM.dd"))).append(" 마감\n\n");
        long total = 0;
        int index = 1;
        for (Entry entry : request.entries()) {
            if (!request.compact()) text.append(index++).append(". ");
            text.append(oneLine(entry.name()));
            if (request.includeService() && !entry.service().isBlank()) text.append(" / ").append(oneLine(entry.service()));
            text.append(" · ").append(money.format(entry.amount())).append("원\n");
            total += entry.amount();
        }
        text.append("\n총 ").append(request.entries().size()).append("건 · ").append(money.format(total)).append("원");
        if (!request.compact()) text.append("\n오늘도 수고하셨습니다.");
        return new ReportResponse(text.toString(), total, request.entries().size());
    }

    private String oneLine(String value) { return value.strip().replaceAll("[\\r\\n\\t]+", " "); }
}
