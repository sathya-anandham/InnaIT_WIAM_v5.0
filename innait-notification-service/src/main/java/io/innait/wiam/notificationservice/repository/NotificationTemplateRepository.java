package io.innait.wiam.notificationservice.repository;

import io.innait.wiam.notificationservice.entity.NotificationChannel;
import io.innait.wiam.notificationservice.entity.NotificationTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, UUID> {

    @Query("SELECT t FROM NotificationTemplate t WHERE t.templateKey = :key AND t.channel = :channel " +
            "AND t.tenantId = :tenantId AND t.active = true")
    Optional<NotificationTemplate> findTenantTemplate(
            @Param("tenantId") UUID tenantId,
            @Param("key") String key,
            @Param("channel") NotificationChannel channel);

    @Query("SELECT t FROM NotificationTemplate t WHERE t.templateKey = :key AND t.channel = :channel " +
            "AND t.isDefault = true AND t.active = true")
    Optional<NotificationTemplate> findDefaultTemplate(
            @Param("key") String key,
            @Param("channel") NotificationChannel channel);

    List<NotificationTemplate> findByTenantIdAndActiveTrue(UUID tenantId);

    List<NotificationTemplate> findByIsDefaultTrueAndActiveTrue();
}
