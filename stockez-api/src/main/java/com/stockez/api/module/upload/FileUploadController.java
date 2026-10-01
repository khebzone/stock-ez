package com.stockez.api.module.upload;

import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/upload")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Upload", description = "File upload endpoints")
public class FileUploadController {

    private final OrphanedUploadCleanupService cleanupService;
    private final ImageStorageService imageStorageService;

    @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN') or hasAnyAuthority('SALES_ORDERS','MANAGE_CUSTOMERS')")
    @Operation(summary = "Upload an image. Auto-resized to max 1000x1000 JPEG, quality 0.85.")
    public ResponseEntity<ApiResponse<Map<String, String>>> upload(
            @RequestParam("file") MultipartFile file) throws IOException {

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Only image files are allowed", "INVALID_FILE_TYPE"));
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("File size must be less than 5MB", "FILE_TOO_LARGE"));
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        Thumbnails.of(file.getInputStream())
                .size(1000, 1000)
                .keepAspectRatio(true)
                .outputFormat("jpg")
                .outputQuality(0.85)
                .toOutputStream(baos);

        String filename = UUID.randomUUID() + ".jpg";
        String url = imageStorageService.store(baos.toByteArray(), filename);
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
