package com.stockez.api.module.upload;

import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/upload")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Upload", description = "File upload endpoints")
public class FileUploadController {

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @Value("${app.upload.base-url:http://localhost:8080}")
    private String baseUrl;

    private final OrphanedUploadCleanupService cleanupService;

    @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    @Operation(summary = "Upload an image (JPG/PNG, max 5MB)")
    public ResponseEntity<ApiResponse<Map<String, String>>> upload(
            @RequestParam("file") MultipartFile file) throws IOException {

        // Validate type
        String contentType = file.getContentType();
        if (contentType == null || (!contentType.equals("image/jpeg") && !contentType.equals("image/png") && !contentType.equals("image/webp"))) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Only JPG, PNG, WEBP images are allowed", "INVALID_FILE_TYPE"));
        }

        // Validate size
        if (file.getSize() > 5 * 1024 * 1024) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("File size must be less than 5MB", "FILE_TOO_LARGE"));
        }

        // Create uploads directory if needed
        Path uploadPath = Paths.get(uploadDir);
        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        // Save with unique name
        String ext = contentType.contains("png") ? ".png" : contentType.contains("webp") ? ".webp" : ".jpg";
        String filename = UUID.randomUUID().toString() + ext;
        Path filePath = uploadPath.resolve(filename);
        file.transferTo(filePath.toFile());

        String url = baseUrl + "/uploads/" + filename;
        return ResponseEntity.ok(ApiResponse.success(Map.of("url", url), "File uploaded"));
    }

    @DeleteMapping("/cleanup-orphaned")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete uploaded files not referenced by any record")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> cleanupOrphaned() {
        int deleted = cleanupService.cleanOrphanedUploads();
        return ResponseEntity.ok(ApiResponse.success(Map.of("deletedCount", deleted), deleted + " orphaned file(s) deleted"));
    }
}
