package io.innait.wiam.adminbff.controller;

import io.innait.wiam.adminbff.dto.ComplianceReportRequest;
import io.innait.wiam.adminbff.dto.FileImportResponse;
import io.innait.wiam.adminbff.service.FileService;
import io.innait.wiam.common.dto.ApiResponse;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/v1/bff")
public class FileController {

    private final FileService fileService;

    public FileController(FileService fileService) {
        this.fileService = fileService;
    }

    @PostMapping("/users/import")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<FileImportResponse>> importUsers(
            @RequestParam("file") MultipartFile file) throws IOException {
        FileImportResponse result = fileService.importUsers(file);
        if (result.errors() != null && !result.errors().isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.success(result));
        }
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/users/export")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public void exportUsers(
            @RequestParam(defaultValue = "csv") String format,
            HttpServletResponse response) throws IOException {
        fileService.exportUsers(format, response);
    }

    @PostMapping("/reports/compliance")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public void generateComplianceReport(
            @Valid @RequestBody ComplianceReportRequest request,
            HttpServletResponse response) throws IOException {
        fileService.generateComplianceReport(
                request.startDate().toString(),
                request.endDate().toString(),
                response);
    }
}
