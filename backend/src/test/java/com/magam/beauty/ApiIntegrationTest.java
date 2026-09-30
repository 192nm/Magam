package com.magam.beauty;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {"magam.openai.api-key=", "magam.access-key=test-key"})
class ApiIntegrationTest {
    @LocalServerPort int port;
    private final HttpClient client = HttpClient.newHttpClient();
    private HttpRequest.Builder request(String path) { return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)); }
    private HttpResponse<String> send(HttpRequest request) throws Exception { return client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)); }

    @Test void reportsAvailabilityWithoutRevealingCredentials() throws Exception {
        var response = send(request("/api/health").GET().build());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"recognitionAvailable\":false", "\"accessKeyRequired\":true").doesNotContain("test-key");
        assertThat(response.headers().firstValue("Cache-Control")).contains("no-store");
    }

    @Test void buildsValidatedReportThroughHttp() throws Exception {
        var body = "{\"date\":\"2026-09-30\",\"salonName\":\"테스트 매장\",\"includeService\":true,\"compact\":false,\"entries\":[{\"name\":\"김민지\",\"service\":\"커트\",\"amount\":45000,\"needsReview\":false}]}";
        var response = send(request("/api/reports/preview").header("X-Magam-Client", "1").header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("45,000원", "\"total\":45000", "김민지");
    }

    @Test void rejectsMalformedReportsAndCrossOriginSimplePosts() throws Exception {
        var invalid = send(request("/api/reports/preview").header("X-Magam-Client", "1").header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("{\"date\":\"2026-02-30\",\"entries\":[]}")).build());
        assertThat(invalid.statusCode()).isEqualTo(400);
        var missingHeader = send(request("/api/reports/preview").header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString("{}")).build());
        assertThat(missingHeader.statusCode()).isEqualTo(403);
    }

    @Test void protectsPaidRecognitionBeforeProcessingUploads() throws Exception {
        var response = send(request("/api/receipts/extract").header("X-Magam-Client", "1").POST(HttpRequest.BodyPublishers.noBody()).build());
        assertThat(response.statusCode()).isEqualTo(401);
        assertThat(response.body()).contains("접속 키").doesNotContain("test-key");
    }

    @Test void rejectsFractionalAmountsRatherThanSilentlyTruncating() throws Exception {
        var body = "{\"date\":\"2026-09-30\",\"salonName\":\"매장\",\"entries\":[{\"name\":\"고객\",\"service\":\"커트\",\"amount\":123.5,\"needsReview\":false}]}";
        var response = send(request("/api/reports/preview").header("X-Magam-Client", "1").header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build());
        assertThat(response.statusCode()).isEqualTo(400);
    }
}
