package io.innait.wiam.adminconfigservice.service;

import io.innait.wiam.adminconfigservice.dto.*;
import io.innait.wiam.adminconfigservice.entity.*;
import io.innait.wiam.adminconfigservice.repository.*;
import io.innait.wiam.common.kafka.EventPublisher;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantServiceTest {

    @Mock private TenantRepository tenantRepository;
    @Mock private FeatureFlagRepository featureFlagRepository;
    @Mock private TenantDomainRepository domainRepository;
    @Mock private OrgUnitRepository orgUnitRepository;
    @Mock private EventPublisher eventPublisher;
    @Mock private DnsVerificationService dnsVerificationService;

    private TenantService service;

    @BeforeEach
    void setUp() {
        service = new TenantService(tenantRepository, featureFlagRepository, domainRepository,
                orgUnitRepository, eventPublisher, dnsVerificationService);
    }

    @Nested
    class TenantCreation {

        @Test
        void shouldCreateTenantWithAllDefaults() {
            when(tenantRepository.existsByTenantCode("acme")).thenReturn(false);
            when(tenantRepository.save(any(Tenant.class))).thenAnswer(i -> i.getArgument(0));
            when(featureFlagRepository.save(any(FeatureFlag.class))).thenAnswer(i -> i.getArgument(0));

            CreateTenantRequest request = new CreateTenantRequest(
                    "acme", "Acme Corporation", SubscriptionTier.PREMIUM, "admin@acme.com", "Admin");

            TenantResponse response = service.createTenant(request);

            assertThat(response.tenantCode()).isEqualTo("acme");
            assertThat(response.tenantName()).isEqualTo("Acme Corporation");
            assertThat(response.subscriptionTier()).isEqualTo(SubscriptionTier.PREMIUM);
            assertThat(response.status()).isEqualTo(TenantStatus.PENDING_SETUP);

            // Should clone 9 default feature flags
            verify(featureFlagRepository, times(9)).save(any(FeatureFlag.class));

            // Should publish tenant.created event
            verify(eventPublisher).publish(eq("innait.admin.tenant.created"), any());
        }

        @Test
        void shouldDefaultToStandardTierWhenNotSpecified() {
            when(tenantRepository.existsByTenantCode("basic")).thenReturn(false);
            when(tenantRepository.save(any(Tenant.class))).thenAnswer(i -> i.getArgument(0));
            when(featureFlagRepository.save(any(FeatureFlag.class))).thenAnswer(i -> i.getArgument(0));

            CreateTenantRequest request = new CreateTenantRequest(
                    "basic", "Basic Corp", null, null, null);

            TenantResponse response = service.createTenant(request);
            assertThat(response.subscriptionTier()).isEqualTo(SubscriptionTier.STANDARD);
        }

        @Test
        void shouldRejectDuplicateTenantCode() {
            when(tenantRepository.existsByTenantCode("acme")).thenReturn(true);

            CreateTenantRequest request = new CreateTenantRequest(
                    "acme", "Acme 2", null, null, null);

            assertThatThrownBy(() -> service.createTenant(request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("already exists");
        }

        @Test
        void shouldCloneSystemLevelFlagValues() {
            when(tenantRepository.existsByTenantCode("test")).thenReturn(false);
            when(tenantRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            // System has sso_enabled=true
            FeatureFlag ssoFlag = new FeatureFlag("sso_enabled", true, "SSO");
            when(featureFlagRepository.findByTenantIdAndFlagKey(eq(TenantService.SYSTEM_TENANT_ID), anyString()))
                    .thenReturn(Optional.empty());
            when(featureFlagRepository.findByTenantIdAndFlagKey(TenantService.SYSTEM_TENANT_ID, "federation_enabled"))
                    .thenReturn(Optional.of(ssoFlag));
            when(featureFlagRepository.save(any(FeatureFlag.class))).thenAnswer(i -> i.getArgument(0));

            service.createTenant(new CreateTenantRequest("test", "Test", null, null, null));

            ArgumentCaptor<FeatureFlag> captor = ArgumentCaptor.forClass(FeatureFlag.class);
            verify(featureFlagRepository, times(9)).save(captor.capture());

            // federation_enabled should be cloned as true from system default
            Optional<FeatureFlag> federation = captor.getAllValues().stream()
                    .filter(f -> "federation_enabled".equals(f.getFlagKey()))
                    .findFirst();
            assertThat(federation).isPresent();
            assertThat(federation.get().isFlagValue()).isTrue();
        }
    }

    @Nested
    class TenantUpdate {

        @Test
        void shouldUpdateTenantFields() {
            UUID tenantId = UUID.randomUUID();
            Tenant tenant = new Tenant(tenantId, "acme", "Acme", SubscriptionTier.STANDARD);
            when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(tenant));
            when(tenantRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            UpdateTenantRequest request = new UpdateTenantRequest(
                    "Acme Updated", TenantStatus.ACTIVE, SubscriptionTier.ENTERPRISE, null);

            TenantResponse response = service.updateTenant(tenantId, request);

            assertThat(response.tenantName()).isEqualTo("Acme Updated");
            assertThat(response.status()).isEqualTo(TenantStatus.ACTIVE);
            assertThat(response.subscriptionTier()).isEqualTo(SubscriptionTier.ENTERPRISE);
        }

        @Test
        void shouldThrowWhenTenantNotFound() {
            UUID tenantId = UUID.randomUUID();
            when(tenantRepository.findById(tenantId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.updateTenant(tenantId,
                    new UpdateTenantRequest(null, null, null, null)))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    class DomainManagement {

        @Test
        void shouldAddDomainWithVerificationToken() {
            UUID tenantId = UUID.randomUUID();
            when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(
                    new Tenant(tenantId, "acme", "Acme", SubscriptionTier.STANDARD)));
            when(domainRepository.findByDomainNameIgnoreCase("acme.com")).thenReturn(Optional.empty());
            when(domainRepository.save(any(TenantDomain.class))).thenAnswer(i -> i.getArgument(0));

            TenantDomainResponse response = service.addDomain(tenantId, new AddDomainRequest("acme.com"));

            assertThat(response.domainName()).isEqualTo("acme.com");
            assertThat(response.verificationStatus()).isEqualTo(DomainVerificationStatus.PENDING);
            assertThat(response.verificationToken()).startsWith("innait-verify-");
        }

        @Test
        void shouldRejectDuplicateDomain() {
            UUID tenantId = UUID.randomUUID();
            when(tenantRepository.findById(tenantId)).thenReturn(Optional.of(
                    new Tenant(tenantId, "acme", "Acme", SubscriptionTier.STANDARD)));
            when(domainRepository.findByDomainNameIgnoreCase("acme.com"))
                    .thenReturn(Optional.of(new TenantDomain("acme.com")));

            assertThatThrownBy(() -> service.addDomain(tenantId, new AddDomainRequest("acme.com")))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("already registered");
        }

        @Test
        void shouldVerifyDomainViaDns() {
            UUID domainId = UUID.randomUUID();
            TenantDomain domain = new TenantDomain("acme.com");
            when(domainRepository.findById(domainId)).thenReturn(Optional.of(domain));
            when(dnsVerificationService.verifyDomain("acme.com", domain.getVerificationToken()))
                    .thenReturn(true);
            when(domainRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            TenantDomainResponse response = service.verifyDomain(UUID.randomUUID(), domainId);

            assertThat(response.verificationStatus()).isEqualTo(DomainVerificationStatus.VERIFIED);
            assertThat(response.verifiedAt()).isNotNull();
        }

        @Test
        void shouldMarkDomainFailedWhenDnsCheckFails() {
            UUID domainId = UUID.randomUUID();
            TenantDomain domain = new TenantDomain("bad.com");
            when(domainRepository.findById(domainId)).thenReturn(Optional.of(domain));
            when(dnsVerificationService.verifyDomain(eq("bad.com"), anyString())).thenReturn(false);
            when(domainRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            TenantDomainResponse response = service.verifyDomain(UUID.randomUUID(), domainId);
            assertThat(response.verificationStatus()).isEqualTo(DomainVerificationStatus.FAILED);
        }
    }
}
