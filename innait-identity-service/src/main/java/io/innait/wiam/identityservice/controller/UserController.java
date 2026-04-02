package io.innait.wiam.identityservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.identityservice.dto.*;
import io.innait.wiam.identityservice.entity.UserStatus;
import io.innait.wiam.identityservice.service.BulkOperationService;
import io.innait.wiam.identityservice.service.UserService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/identity/users")
public class UserController {

    private final UserService userService;
    private final BulkOperationService bulkOperationService;

    public UserController(UserService userService, BulkOperationService bulkOperationService) {
        this.userService = userService;
        this.bulkOperationService = bulkOperationService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(@Valid @RequestBody CreateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.success(userService.createUser(request)));
    }

    @GetMapping("/{userId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<UserResponse>> getUserById(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(userService.getUserById(userId)));
    }

    @PatchMapping("/{userId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @PathVariable UUID userId, @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(ApiResponse.success(userService.updateUser(userId, request)));
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "false") boolean hard) {
        if (hard) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            boolean isSuperAdmin = auth.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"));
            if (!isSuperAdmin) {
                throw new AccessDeniedException("Hard delete requires SUPER_ADMIN role");
            }
            // Hard delete delegates to soft-delete until permanent purge is implemented
            userService.softDeleteUser(userId);
        } else {
            userService.softDeleteUser(userId);
        }
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{userId}/restore")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> restoreUser(@PathVariable UUID userId) {
        userService.restoreUser(userId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Page<UserResponse>>> searchUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String email,
            Pageable pageable) {
        UserSearchCriteria criteria = new UserSearchCriteria(search, email, status, department);
        return ResponseEntity.ok(ApiResponse.success(userService.searchUsers(criteria, pageable)));
    }

    @PostMapping(value = "/bulk", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<BulkOperationResponse>> bulkCreateUsers(
            @RequestParam("file") MultipartFile file) throws IOException {
        UUID jobId = bulkOperationService.startBulkCreateUsers(file.getInputStream());
        return ResponseEntity.accepted().body(ApiResponse.success(bulkOperationService.getJobStatus(jobId)));
    }

    @GetMapping(value = "/export", produces = "text/csv")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public void exportUsers(
            @RequestParam(defaultValue = "csv") String format,
            HttpServletResponse response) throws IOException {
        response.setContentType("text/csv");
        response.setHeader("Content-Disposition", "attachment; filename=\"users.csv\"");

        UserSearchCriteria criteria = new UserSearchCriteria(null, null, null, null);
        Page<UserResponse> page = userService.searchUsers(criteria, Pageable.ofSize(5000));

        try (PrintWriter writer = response.getWriter()) {
            writer.println("userId,tenantId,firstName,lastName,displayName,email,employeeNo,department,designation,userType,status,createdAt");
            for (UserResponse u : page.getContent()) {
                writer.printf("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s%n",
                        u.userId(), u.tenantId(),
                        escapeCsv(u.firstName()), escapeCsv(u.lastName()),
                        escapeCsv(u.displayName()), escapeCsv(u.email()),
                        escapeCsv(u.employeeNo()), escapeCsv(u.department()),
                        escapeCsv(u.designation()), u.userType(), u.status(), u.createdAt());
            }
        }
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
