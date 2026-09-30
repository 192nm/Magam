package com.magam.beauty;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import static org.assertj.core.api.Assertions.*;

class ReceiptImageValidatorTest {
    private final ReceiptImageValidator validator = new ReceiptImageValidator();

    @Test void checksActualImageContentInsteadOfTrustingMimeType() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(20, 20, BufferedImage.TYPE_INT_RGB), "png", bytes);
        var image = validator.validate(new MockMultipartFile("file", "receipt.jpg", "image/jpeg", bytes.toByteArray()));
        assertThat(image.mimeType()).isEqualTo("image/png");
    }

    @Test void rejectsDisguisedFilesAndOversizedImages() {
        assertThatThrownBy(() -> validator.validate(new MockMultipartFile("file", "receipt.jpg", "image/jpeg", "<script>bad</script>".getBytes())))
            .isInstanceOf(ApiException.class).hasMessageContaining("JPG");
        assertThatThrownBy(() -> validator.validate(new MockMultipartFile("file", "large.jpg", "image/jpeg", new byte[10 * 1024 * 1024 + 1])))
            .isInstanceOf(ApiException.class).hasMessageContaining("10MB");
    }
}
