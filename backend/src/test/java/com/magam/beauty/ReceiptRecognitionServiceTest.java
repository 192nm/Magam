package com.magam.beauty;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.util.Map;
import java.util.List;
import static org.assertj.core.api.Assertions.*;

class ReceiptRecognitionServiceTest {
    private final ReceiptRecognitionService service = new ReceiptRecognitionService("", "gpt-4.1-mini");
    private final JsonMapper mapper = JsonMapper.builder().build();
    private String response(String extracted) {
        return mapper.writeValueAsString(Map.of("status", "completed", "output", List.of(Map.of("type", "message", "content", List.of(Map.of("type", "output_text", "text", extracted))))));
    }

    @Test void preservesMissingNamesAndAmountsInsteadOfInventingValues() {
        var parsed = service.parseResponse(response("{\"entries\":[{\"name\":\"\",\"service\":\"커트\",\"amount\":null,\"needsReview\":true}],\"warnings\":[\"이름 없음\"]}"));
        assertThat(parsed.entries().get(0).name()).isEmpty();
        assertThat(parsed.entries().get(0).amount()).isNull();
        assertThat(parsed.entries().get(0).needsReview()).isTrue();
        assertThat(parsed.warnings()).containsExactly("이름 없음");
    }

    @Test void alwaysRequiresHumanReviewAndRejectsOutOfRangeAmounts() {
        var parsed = service.parseResponse(response("{\"entries\":[{\"name\":\"김민지\",\"service\":\"커트\",\"amount\":-5000,\"needsReview\":false}],\"warnings\":[]}"));
        assertThat(parsed.entries().get(0).needsReview()).isTrue();
        assertThat(parsed.entries().get(0).amount()).isNull();
    }

    @Test void rejectsIncompleteRefusedAndMalformedResponses() {
        assertThatThrownBy(() -> service.parseResponse("{\"status\":\"incomplete\",\"output\":[]}")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.parseResponse("{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"refusal\"}]}]}")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.parseResponse(response("not json"))).isInstanceOf(ApiException.class);
    }

    @Test void distinguishesExhaustedCreditsFromTemporaryRateLimits() {
        assertThat(service.rateLimitError("{\"error\":{\"code\":\"credit_balance_exhausted\"}}").getMessage()).contains("크레딧이 소진");
        assertThat(service.rateLimitError("{\"error\":{\"code\":\"project_spend_limit_exceeded\"}}").getMessage()).contains("프로젝트의 월 지출 한도");
        assertThat(service.rateLimitError("{\"error\":{\"code\":\"rate_limit_exceeded\"}}").getMessage()).contains("잠시 후 다시");
    }

    @Test void sumsRepeatedNamesAndShowsTheirServicesOnOneLine() {
        var parsed = service.parseResponse(response("{\"entries\":[{\"name\":\"김민지\",\"service\":\"커트\",\"amount\":30000},{\"name\":\"이서연\",\"service\":\"염색\",\"amount\":70000},{\"name\":\"김민지\",\"service\":\"클리닉\",\"amount\":50000}],\"warnings\":[]}"));
        assertThat(parsed.entries()).hasSize(2);
        assertThat(parsed.entries().get(0).name()).isEqualTo("김민지");
        assertThat(parsed.entries().get(0).service()).isEqualTo("커트 + 클리닉");
        assertThat(parsed.entries().get(0).amount()).isEqualTo(80000L);
        assertThat(parsed.entries().get(1).amount()).isEqualTo(70000L);
    }

    @Test void removesUnreadableMarkersWithoutGuessingMissingServices() {
        var parsed = service.parseResponse(response("{\"entries\":[{\"name\":\"김민지\",\"service\":\"긴머리 ??\",\"amount\":30000},{\"name\":\"김민지\",\"service\":\"??\",\"amount\":50000}],\"warnings\":[]}"));
        assertThat(parsed.entries()).hasSize(1);
        assertThat(parsed.entries().get(0).service()).isEqualTo("긴머리 + 시술명 확인 필요");
        assertThat(parsed.entries().get(0).amount()).isEqualTo(80000L);
        assertThat(parsed.warnings()).anyMatch(warning -> warning.contains("원본 영수증"));
    }

    @Test void leavesCombinedAmountUnconfirmedWhenOnePaymentIsUnreadable() {
        var parsed = service.parseResponse(response("{\"entries\":[{\"name\":\"김민지\",\"service\":\"커트\",\"amount\":30000},{\"name\":\"김민지\",\"service\":\"클리닉\",\"amount\":null}],\"warnings\":[]}"));
        assertThat(parsed.entries()).hasSize(1);
        assertThat(parsed.entries().get(0).amount()).isNull();
        assertThat(parsed.warnings()).anyMatch(warning -> warning.contains("합계"));
    }

    @Test void doesNotMergeUnknownNames() {
        var parsed = service.parseResponse(response("{\"entries\":[{\"name\":\"\",\"service\":\"커트\",\"amount\":30000},{\"name\":\"\",\"service\":\"염색\",\"amount\":70000}],\"warnings\":[]}"));
        assertThat(parsed.entries()).hasSize(2);
    }

    @Test void warnsWhenPrintedRowCountOrGrandTotalDoesNotMatch() {
        var parsed = service.parseResponse(response("{\"entries\":[{\"name\":\"가명\",\"service\":\"커트\",\"amount\":30000},{\"name\":\"가명\",\"service\":\"펌\",\"amount\":35000}],\"receiptRowCount\":3,\"receiptTotal\":95000,\"warnings\":[]}"));
        assertThat(parsed.entries()).hasSize(1);
        assertThat(parsed.entries().get(0).amount()).isEqualTo(65000L);
        assertThat(parsed.warnings()).anyMatch(warning -> warning.contains("3건 중 2건"));
        assertThat(parsed.warnings()).anyMatch(warning -> warning.contains("65,000원") && warning.contains("95,000원"));
    }

    @Test void acceptsMatchingPrintedRowCountAndGrandTotal() {
        var parsed = service.parseResponse(response("{\"entries\":[{\"name\":\"가명\",\"service\":\"커트\",\"amount\":30000},{\"name\":\"가명\",\"service\":\"펌\",\"amount\":35000}],\"receiptRowCount\":2,\"receiptTotal\":65000,\"warnings\":[]}"));
        assertThat(parsed.entries()).hasSize(1);
        assertThat(parsed.warnings()).isEmpty();
    }
}
