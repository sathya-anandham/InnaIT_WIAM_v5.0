package io.innait.wiam.adminbff.controller;

import io.innait.wiam.adminbff.dto.DashboardResponse;
import io.innait.wiam.adminbff.dto.UserDetailResponse;
import io.innait.wiam.adminbff.service.DashboardService;
import io.innait.wiam.adminbff.service.UserDetailService;
import io.innait.wiam.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/bff")
public class DashboardController {

    private final DashboardService dashboardService;
    private final UserDetailService userDetailService;

    public DashboardController(DashboardService dashboardService,
                               UserDetailService userDetailService) {
        this.dashboardService = dashboardService;
        this.userDetailService = userDetailService;
    }

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard() {
        DashboardResponse dashboard = dashboardService.getDashboard();
        return ResponseEntity.ok(ApiResponse.success(dashboard));
    }

    @GetMapping("/users/{userId}/detail")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<UserDetailResponse>> getUserDetail(@PathVariable UUID userId) {
        UserDetailResponse detail = userDetailService.getUserDetail(userId);
        return ResponseEntity.ok(ApiResponse.success(detail));
    }
}
