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
}
