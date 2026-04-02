package io.innait.wiam.identityservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.identityservice.dto.BulkOperationResponse;
import io.innait.wiam.identityservice.service.BulkOperationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/identity/jobs")
public class JobController {

    private final BulkOperationService bulkOperationService;

    public JobController(BulkOperationService bulkOperationService) {
        this.bulkOperationService = bulkOperationService;
    }

    @GetMapping("/{jobId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<BulkOperationResponse>> getJobStatus(@PathVariable UUID jobId) {
        return ResponseEntity.ok(ApiResponse.success(bulkOperationService.getJobStatus(jobId)));
    }
}
