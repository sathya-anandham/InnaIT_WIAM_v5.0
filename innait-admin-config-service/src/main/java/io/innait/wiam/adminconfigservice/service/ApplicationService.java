package io.innait.wiam.adminconfigservice.service;

import io.innait.wiam.adminconfigservice.dto.*;
import io.innait.wiam.adminconfigservice.entity.Application;
import io.innait.wiam.adminconfigservice.repository.ApplicationRepository;
import io.innait.wiam.common.context.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ApplicationService {

    private static final Logger log = LoggerFactory.getLogger(ApplicationService.class);

    private final ApplicationRepository repository;

    public ApplicationService(ApplicationRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public ApplicationResponse createApplication(UUID tenantId, CreateApplicationRequest request) {
        TenantContext.setTenantId(tenantId);
        try {
            if (repository.findByTenantIdAndAppCode(tenantId, request.appCode()).isPresent()) {
                throw new IllegalArgumentException("App code already exists: " + request.appCode());
            }

            Application app = new Application(request.appCode(), request.appName(),
                    request.appType(), request.appUrl(), request.description());
            repository.save(app);
            log.info("Created application [{}] for tenant [{}]", request.appCode(), tenantId);
            return toResponse(app);
        } finally {
            TenantContext.clear();
        }
    }

    @Transactional
    public ApplicationResponse updateApplication(UUID tenantId, UUID appId,
                                                  UpdateApplicationRequest request) {
        Application app = repository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + appId));

        TenantContext.setTenantId(tenantId);
        try {
            if (request.appName() != null) app.setAppName(request.appName());
            if (request.appType() != null) app.setAppType(request.appType());
            if (request.status() != null) app.setStatus(request.status());
            if (request.appUrl() != null) app.setAppUrl(request.appUrl());
            if (request.description() != null) app.setDescription(request.description());
            repository.save(app);
            return toResponse(app);
        } finally {
            TenantContext.clear();
        }
    }

    @Transactional(readOnly = true)
    public ApplicationResponse getApplication(UUID appId) {
        Application app = repository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + appId));
        return toResponse(app);
    }

    @Transactional(readOnly = true)
    public List<ApplicationResponse> listApplications(UUID tenantId) {
        return repository.findByTenantId(tenantId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public void deleteApplication(UUID appId) {
        Application app = repository.findById(appId)
                .orElseThrow(() -> new IllegalArgumentException("Application not found: " + appId));
        repository.delete(app);
    }

    private ApplicationResponse toResponse(Application a) {
        return new ApplicationResponse(a.getId(), a.getTenantId(), a.getAppCode(),
                a.getAppName(), a.getAppType(), a.getStatus(), a.getAppUrl(), a.getDescription());
    }
}
