package com.stockez.api.module.notification;

import com.stockez.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@SecurityRequirement(name = "Bearer Authentication")
@Tag(name = "Notifications", description = "Notification counts for the header bell")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<NotificationDtos.NotificationSummary>> summary(
            @RequestHeader("X-Tenant-Id") UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(notificationService.getSummary(tenantId)));
    }
}
