package com.magam.beauty;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

public final class ReceiptModels {
    private ReceiptModels() {}

    public record Entry(
        @NotBlank @Size(max = 80) String name,
        @NotNull @Size(max = 500) String service,
        @NotNull @Min(0) @Max(100000000) Long amount,
        boolean needsReview
    ) {}

    public record Extraction(List<Entry> entries, List<String> warnings) {}

    public record ReportRequest(
        @NotNull LocalDate date,
        @NotBlank @Size(max = 60) String salonName,
        @NotEmpty @Size(max = 200) List<@NotNull @Valid Entry> entries,
        boolean includeService,
        boolean compact
    ) {}

    public record ReportResponse(String text, long total, int count) {}
}
