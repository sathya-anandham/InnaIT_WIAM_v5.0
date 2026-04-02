package io.innait.wiam.adminconfigservice.service;

import io.innait.wiam.adminconfigservice.entity.FeatureFlag;
import io.innait.wiam.adminconfigservice.repository.FeatureFlagRepository;
import io.innait.wiam.common.kafka.EventPublisher;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeatureFlagServiceTest {

    @Mock private FeatureFlagRepository repository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private EventPublisher eventPublisher;

    private FeatureFlagService service;
    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new FeatureFlagService(repository, redisTemplate, eventPublisher);
    }

    @Nested
    class CachingAndInvalidation {

        @Test
        void shouldReturnCachedValueWhenAvailable() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get("ff:" + tenantId + ":sso_enabled")).thenReturn("1");

            boolean result = service.getFlag(tenantId, "sso_enabled");

            assertThat(result).isTrue();
            verify(repository, never()).findByTenantIdAndFlagKey(any(), any());
        }

        @Test
        void shouldFallBackToDbWhenCacheMiss() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get(anyString())).thenReturn(null);

            FeatureFlag flag = new FeatureFlag("sso_enabled", true, "SSO");
            when(repository.findByTenantIdAndFlagKey(tenantId, "sso_enabled"))
                    .thenReturn(Optional.of(flag));

            boolean result = service.getFlag(tenantId, "sso_enabled");

            assertThat(result).isTrue();
            verify(valueOps).set(eq("ff:" + tenantId + ":sso_enabled"), eq("1"), any());
        }

        @Test
        void shouldReturnFalseWhenFlagNotFound() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get(anyString())).thenReturn(null);
            when(repository.findByTenantIdAndFlagKey(tenantId, "nonexistent"))
                    .thenReturn(Optional.empty());

            assertThat(service.getFlag(tenantId, "nonexistent")).isFalse();
        }

        @Test
        void shouldInvalidateCacheOnFlagChange() {
            FeatureFlag flag = new FeatureFlag("sso_enabled", false, "SSO");
            when(repository.findByTenantIdAndFlagKey(tenantId, "sso_enabled"))
                    .thenReturn(Optional.of(flag));
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            service.setFlag(tenantId, "sso_enabled", true);

            verify(redisTemplate).delete("ff:" + tenantId + ":sso_enabled");
        }

        @Test
        void shouldPublishEventOnFlagValueChange() {
            FeatureFlag flag = new FeatureFlag("sso_enabled", false, "SSO");
            when(repository.findByTenantIdAndFlagKey(tenantId, "sso_enabled"))
                    .thenReturn(Optional.of(flag));
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            service.setFlag(tenantId, "sso_enabled", true);

            verify(eventPublisher).publish(eq("innait.admin.feature.flag.changed"), any());
        }

        @Test
        void shouldNotPublishEventWhenValueUnchanged() {
            FeatureFlag flag = new FeatureFlag("sso_enabled", true, "SSO");
            when(repository.findByTenantIdAndFlagKey(tenantId, "sso_enabled"))
                    .thenReturn(Optional.of(flag));
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            service.setFlag(tenantId, "sso_enabled", true);

            verify(eventPublisher, never()).publish(any(), any());
        }

        @Test
        void shouldGracefullyHandleRedisFailureOnRead() {
            when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis down"));

            FeatureFlag flag = new FeatureFlag("sso_enabled", true, "SSO");
            when(repository.findByTenantIdAndFlagKey(tenantId, "sso_enabled"))
                    .thenReturn(Optional.of(flag));

            boolean result = service.getFlag(tenantId, "sso_enabled");
            assertThat(result).isTrue();
        }
    }

    @Nested
    class FlagListing {

        @Test
        void shouldListAllFlagsForTenant() {
            when(repository.findByTenantId(tenantId)).thenReturn(List.of(
                    new FeatureFlag("sso_enabled", true, null),
                    new FeatureFlag("iga_enabled", false, null)
            ));

            Map<String, Boolean> flags = service.listFlags(tenantId);

            assertThat(flags).containsEntry("sso_enabled", true);
            assertThat(flags).containsEntry("iga_enabled", false);
            assertThat(flags).hasSize(2);
        }
    }
}
