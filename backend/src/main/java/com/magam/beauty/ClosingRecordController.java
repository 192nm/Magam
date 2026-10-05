package com.magam.beauty;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessException;
import org.springframework.web.bind.annotation.*;
import static com.magam.beauty.ReceiptModels.*;

@RestController
@RequestMapping("/api/closing-records")
public class ClosingRecordController {
    public record SaveRequest(@NotNull UUID id, @NotNull @Valid ReportRequest report, boolean sample) {}
    private final ObjectProvider<ClosingRecordRepository> repository;
    public ClosingRecordController(ObjectProvider<ClosingRecordRepository> repository) { this.repository = repository; }
    private ClosingRecordRepository database() {
        var value = repository.getIfAvailable();
        if (value == null) throw new ApiException(503, "DB가 아직 설정되지 않았습니다. Supabase 연결 설정을 완료해 주세요.");
        return value;
    }
    @GetMapping
    public List<ClosingRecordRepository.SavedRecord> list(@RequestParam(defaultValue = "100") int limit,
                                                        @RequestParam(defaultValue = "0") int offset) {
        if (limit < 1 || limit > 100 || offset < 0) throw new ApiException(400, "조회 범위가 올바르지 않습니다.");
        return database().list(limit, offset);
    }
    @PostMapping
    public ClosingRecordRepository.SavedRecord save(@Valid @RequestBody SaveRequest request) {
        return database().save(request.id(), request.report(), request.sample());
    }
    @DeleteMapping("/{id}")
    public Map<String, Boolean> delete(@PathVariable UUID id) {
        database().delete(id);
        return Map.of("deleted", true);
    }
    @ExceptionHandler(DataAccessException.class)
    @ResponseStatus(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE)
    public Map<String, String> unavailable() {
        return Map.of("message", "DB에 연결하지 못했습니다. 저장 여부를 확인하려면 연결 복구 후 다시 시도해 주세요.");
    }
}
