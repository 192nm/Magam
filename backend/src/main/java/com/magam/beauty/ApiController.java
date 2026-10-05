package com.magam.beauty;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;
import java.util.concurrent.Semaphore;
import static com.magam.beauty.ReceiptModels.*;

@RestController
@RequestMapping("/api")
public class ApiController {
    private final ReceiptRecognitionService recognition;
    private final ReceiptImageValidator validator;
    private final ReportService reports;
    private final boolean accessKeyRequired;
    private final org.springframework.beans.factory.ObjectProvider<ClosingRecordRepository> database;
    private final Semaphore recognitionSlots = new Semaphore(2);

    public ApiController(ReceiptRecognitionService recognition, ReceiptImageValidator validator, ReportService reports,
                         @Value("${magam.access-key}") String accessKey,
                         org.springframework.beans.factory.ObjectProvider<ClosingRecordRepository> database) {
        this.database = database;
        this.recognition = recognition;
        this.validator = validator;
        this.reports = reports;
        this.accessKeyRequired = !accessKey.isBlank();
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        var repository = database.getIfAvailable();
        return Map.of("status", "ok", "recognitionAvailable", recognition.isConfigured(), "accessKeyRequired", accessKeyRequired,
                "databaseEnabled", repository != null, "databaseAvailable", repository != null && repository.available());
    }

    @PostMapping(value = "/receipts/extract", consumes = "multipart/form-data")
    public Extraction extract(@RequestParam("file") MultipartFile file,
                              @RequestParam(defaultValue = "customer") String nameMode) {
        if (!recognitionSlots.tryAcquire()) throw new ApiException(429, "다른 영수증을 인식하고 있습니다. 잠시 후 다시 시도해 주세요.");
        try { return recognition.extract(validator.validate(file), nameMode); }
        finally { recognitionSlots.release(); }
    }

    @PostMapping("/reports/preview")
    public ReportResponse report(@Valid @RequestBody ReportRequest request) { return reports.generate(request); }
}
