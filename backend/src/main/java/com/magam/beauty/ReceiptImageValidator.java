package com.magam.beauty;

import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Set;

@Component
public class ReceiptImageValidator {
    public record Image(byte[] bytes, String mimeType) {}

    public Image validate(MultipartFile file) {
        if (file.isEmpty()) throw new ApiException(400, "영수증 사진을 선택해 주세요.");
        if (file.getSize() > 10 * 1024 * 1024) throw new ApiException(413, "사진은 10MB 이하로 올려 주세요.");
        try {
            byte[] bytes = file.getBytes();
            try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(stream);
                if (!readers.hasNext()) throw new ApiException(415, "JPG 또는 PNG 사진을 올려 주세요.");
                var reader = readers.next();
                try {
                    String format = reader.getFormatName().toLowerCase();
                    if (!Set.of("jpeg", "jpg", "png").contains(format)) throw new ApiException(415, "JPG 또는 PNG 사진을 올려 주세요.");
                    reader.setInput(stream);
                    long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                    if (pixels > 25_000_000L) throw new ApiException(413, "사진 해상도가 너무 큽니다. 크기를 줄여 다시 올려 주세요.");
                    if (pixels < 100) throw new ApiException(400, "사진이 너무 작습니다. 영수증 전체를 촬영해 주세요.");
                    if (reader.read(0) == null) throw new ApiException(400, "사진을 읽을 수 없습니다.");
                    return new Image(bytes, format.equals("png") ? "image/png" : "image/jpeg");
                } finally { reader.dispose(); }
            }
        } catch (IOException | IllegalArgumentException e) {
            throw new ApiException(400, "손상된 사진입니다. 다른 사진을 올려 주세요.");
        }
    }
}
