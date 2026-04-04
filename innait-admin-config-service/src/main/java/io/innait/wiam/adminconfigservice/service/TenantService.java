package io.innait.wiam.adminconfigservice.service;

import io.innait.wiam.adminconfigservice.dto.*;
import io.innait.wiam.adminconfigservice.entity.*;
import io.innait.wiam.adminconfigservice.repository.*;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class TenantService {

    private static final Logger log = LoggerFactory.getLogger(TenantService.class);

    /** System-level tenant ID for default feature flags (all-zeros UUID). */
    static final UUID SYSTEM_TENANT_ID = new UUID(0L, 0L);

    private static final List<String> DEFAULT_FLAG_KEYS = List.of(
            "self_registration_enabled", "passwordless_enabled", "softtoken_enabled",
            "iga_enabled", "device_trust_enabled", "federation_enabled",
            "risk_based_auth_enabled", "bulk_operations_enabled", "dpdp_erasure_enabled"
    );

    private final TenantRepository tenantRepository;
    private final FeatureFlagRepository featureFlagRepository;
    private final TenantDomainRepository domainRepository;
    private final OrgUnitRepository orgUnitRepository;
    private final EventPublisher eventPublisher;
    private final DnsVerificationService dnsVerificationService;

    public TenantService(TenantRepository tenantRepository,
                         FeatureFlagRepository featureFlagRepository,
                         TenantDomainRepository domainRepository,
                         OrgUnitRepository orgUnitRepository,
                         EventPublisher eventPublisher,
                         DnsVerificationService dnsVerificationService) {
        this.tenantRepository = tenantRepository;
        this.featureFlagRepository = featureFlagRepository;
        this.domainRepository = domainRepository;
        this.orgUnitRepository = orgUnitRepository;
        this.eventPublisher = eventPublisher;
        this.dnsVerificationService = dnsVerificationService;
    }

    // ---- Tenant CRUD ----

    @Transactional
    public TenantResponse createTenant(CreateTenantRequest request) {
        if (tenantRepository.existsByTenantCode(request.tenantCode())) {
            throw new IllegalArgumentException("Tenant code already exists: " + request.tenantCode());
        }

        UUID tenantId = UUID.randomUUID();
        Tenant tenant = new Tenant(tenantId, request.tenantCode(), request.tenantName(),
                request.subscriptionTier() != null ? request.subscriptionTier() : SubscriptionTier.STANDARD);
        tenantRepository.save(tenant);

        // Clone default feature flags for this tenant
        initializeFeatureFlags(tenantId);

        log.info("Created tenant [{}] code=[{}]", tenantId, request.tenantCode());

        publishTenantEvent(InnaITTopics.TENANT_CREATED, tenantId, Map.of(
                "tenant_code", request.tenantCode(),
                "tenant_name", request.tenantName(),
                "admin_email", request.adminEmail() != null ? request.adminEmail() : ""
        ));

        return toResponse(tenant);
    }

    @Transactional
    public TenantResponse updateTenant(UUID tenantId, UpdateTenantRequest request) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + tenantId));

        if (request.tenantName() != null) tenant.setTenantName(request.tenantName());
        if (request.status() != null) tenant.setStatus(request.status());
        if (request.subscriptionTier() != null) tenant.setSubscriptionTier(request.subscriptionTier());
        if (request.brandingConfig() != null) tenant.setBrandingConfig(request.brandingConfig());

        tenantRepository.save(tenant);

        publishTenantEvent(InnaITTopics.TENANT_UPDATED, tenantId, Map.of(
                "tenant_code", tenant.getTenantCode(),
                "status", tenant.getStatus().name()
        ));

        return toResponse(tenant);
    }

    @Transactional(readOnly = true)
    public TenantResponse getTenant(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + tenantId));
        return toResponse(tenant);
    }

    @Transactional(readOnly = true)
    public Page<TenantResponse> listTenants(Pageable pageable) {
        return tenantRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public TenantResponse getTenantByCode(String tenantCode) {
        Tenant tenant = tenantRepository.findByTenantCode(tenantCode)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found for code: " + tenantCode));
        return toResponse(tenant);
    }

    // ---- Domain Management ----

    @Transactional
    public TenantDomainResponse addDomain(UUID tenantId, AddDomainRequest request) {
        tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + tenantId));

        if (domainRepository.findByDomainNameIgnoreCase(request.domainName()).isPresent()) {
            throw new IllegalArgumentException("Domain already registered: " + request.domainName());
        }

        TenantContext.setTenantId(tenantId);
        TenantDomain domain = new TenantDomain(request.domainName());
        domainRepository.save(domain);
        log.info("Added domain [{}] for tenant [{}]", request.domainName(), tenantId);
        return toDomainResponse(domain);
    }

    @Transactional
    public TenantDomainResponse verifyDomain(UUID tenantId, UUID domainId) {
        TenantDomain domain = domainRepository.findById(domainId)
                .orElseThrow(() -> new IllegalArgumentException("Domain not found: " + domainId));

        boolean verified = dnsVerificationService.verifyDomain(
                domain.getDomainName(), domain.getVerificationToken());

        if (verified) {
            domain.markVerified();
        } else {
            domain.markFailed();
        }
        domainRepository.save(domain);
        return toDomainResponse(domain);
    }

    @Transactional
    public void removeDomain(UUID tenantId, UUID domainId) {
        TenantDomain domain = domainRepository.findById(domainId)
                .orElseThrow(() -> new IllegalArgumentException("Domain not found: " + domainId));
        domainRepository.delete(domain);
        log.info("Removed domain [{}] from tenant [{}]", domain.getDomainName(), tenantId);
    }

    @Transactional
    public TenantDomainResponse setPrimaryDomain(UUID tenantId, UUID domainId) {
        List<TenantDomain> allDomains = domainRepository.findByTenantId(tenantId);
        TenantDomain target = null;

        for (TenantDomain d : allDomains) {
            if (d.getId().equals(domainId)) {
                d.setPrimary(true);
                target = d;
            } else {
                d.setPrimary(false);
            }
        }

        if (target == null) {
            throw new IllegalArgumentException("Domain not found for tenant: " + domainId);
        }

        domainRepository.saveAll(allDomains);
        return toDomainResponse(target);
    }

    @Transactional(readOnly = true)
    public List<TenantDomainResponse> listDomains(UUID tenantId) {
        return domainRepository.findByTenantId(tenantId).stream()
                .map(this::toDomainResponse).toList();
    }

    // ---- OrgUnit Management ----

    @Transactional
    public OrgUnitResponse createOrgUnit(UUID tenantId, CreateOrgUnitRequest request) {
        TenantContext.setTenantId(tenantId);
        OrgUnit orgUnit = new OrgUnit(request.orgCode(), request.orgName(),
                request.parentOrgUnitId(), request.description());
        orgUnitRepository.save(orgUnit);
        return toOrgUnitResponse(orgUnit);
    }

    @Transactional
    public OrgUnitResponse updateOrgUnit(UUID tenantId, UUID orgUnitId, UpdateOrgUnitRequest request) {
        OrgUnit orgUnit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new IllegalArgumentException("OrgUnit not found: " + orgUnitId));

        TenantContext.setTenantId(tenantId);
        if (request.orgName() != null) orgUnit.setOrgName(request.orgName());
        if (request.description() != null) orgUnit.setDescription(request.description());
        if (request.parentOrgUnitId() != null) orgUnit.setParentOrgUnitId(request.parentOrgUnitId());
        orgUnitRepository.save(orgUnit);
        return toOrgUnitResponse(orgUnit);
    }

    @Transactional(readOnly = true)
    public List<OrgUnitResponse> listOrgUnits(UUID tenantId) {
        return orgUnitRepository.findByTenantId(tenantId).stream()
                .map(this::toOrgUnitResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<OrgUnitResponse> listRootOrgUnits(UUID tenantId) {
        return orgUnitRepository.findByTenantIdAndParentOrgUnitIdIsNull(tenantId).stream()
                .map(this::toOrgUnitResponse).toList();
    }

    @Transactional
    public void deleteOrgUnit(UUID orgUnitId) {
        OrgUnit orgUnit = orgUnitRepository.findById(orgUnitId)
                .orElseThrow(() -> new IllegalArgumentException("OrgUnit not found: " + orgUnitId));
        orgUnitRepository.delete(orgUnit);
    }

    // ---- Private helpers ----

    private void initializeFeatureFlags(UUID tenantId) {
        TenantContext.setTenantId(tenantId);
        for (String flagKey : DEFAULT_FLAG_KEYS) {
            // Check if system-level default exists
            boolean defaultValue = featureFlagRepository
                    .findByTenantIdAndFlagKey(SYSTEM_TENANT_ID, flagKey)
                    .map(FeatureFlag::isFlagValue)
                    .orElse(false);

            FeatureFlag flag = new FeatureFlag(flagKey, defaultValue, "Cloned from template");
            featureFlagRepository.save(flag);
        }
    }

    private void publishTenantEvent(String topic, UUID tenantId, Map<String, String> payload) {
        try {
            eventPublisher.publish(topic, EventEnvelope.<Map<String, String>>builder()
                    .eventId(UUID.randomUUID())
                    .eventType(topic.substring(topic.lastIndexOf('.') + 1))
                    .tenantId(tenantId)
                    .timestamp(Instant.now())
                    .source("innait-admin-config-service")
                    .payload(payload)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to publish event [{}]: {}", topic, e.getMessage());
        }
    }

    private TenantResponse toResponse(Tenant t) {
        return new TenantResponse(t.getTenantId(), t.getTenantCode(), t.getTenantName(),
                t.getStatus(), t.getSubscriptionTier(), t.getBrandingConfig(),
                t.getCreatedAt(), t.getUpdatedAt());
    }

    private TenantDomainResponse toDomainResponse(TenantDomain d) {
        return new TenantDomainResponse(d.getId(), d.getTenantId(), d.getDomainName(),
                d.getVerificationStatus(), d.getVerificationToken(),
                d.getVerifiedAt(), d.isPrimary());
    }

    private OrgUnitResponse toOrgUnitResponse(OrgUnit o) {
        return new OrgUnitResponse(o.getId(), o.getTenantId(), o.getOrgCode(),
                o.getOrgName(), o.getParentOrgUnitId(), o.getDescription(), o.getStatus());
    }
}
