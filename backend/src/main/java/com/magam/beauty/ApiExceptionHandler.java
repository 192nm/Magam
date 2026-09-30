package com.magam.beauty;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.Map;

@RestControllerAdvice(basePackages = "com.magam.beauty")
public class ApiExceptionHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<?> api(ApiException e) { return error(e.status(), e.getMessage()); }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<?> size() { return error(413, "사진은 10MB 이하로 올려 주세요."); }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
        MissingServletRequestPartException.class, MissingServletRequestParameterException.class, MultipartException.class})
    public ResponseEntity<?> invalid() { return error(400, "이름, 금액, 날짜와 사진을 확인해 주세요."); }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> unexpected() { return error(500, "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."); }

    private ResponseEntity<?> error(int status, String message) { return ResponseEntity.status(status).body(Map.of("message", message)); }
}
