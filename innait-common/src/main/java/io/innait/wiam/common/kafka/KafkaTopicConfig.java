package io.innait.wiam.common.kafka;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {

    @Value("${innait.kafka.partitions:6}")
    private int partitions;

    @Value("${innait.kafka.replication-factor:1}")
    private short replicationFactor;

    // Identity domain
    @Bean public NewTopic userCreatedTopic() { return buildTopic(InnaITTopics.USER_CREATED); }
    @Bean public NewTopic userUpdatedTopic() { return buildTopic(InnaITTopics.USER_UPDATED); }
    @Bean public NewTopic accountStatusChangedTopic() { return buildTopic(InnaITTopics.ACCOUNT_STATUS_CHANGED); }
    @Bean public NewTopic accountTerminatedTopic() { return buildTopic(InnaITTopics.ACCOUNT_TERMINATED); }
    @Bean public NewTopic accountRoleAssignedTopic() { return buildTopic(InnaITTopics.ACCOUNT_ROLE_ASSIGNED); }
    @Bean public NewTopic accountRoleRemovedTopic() { return buildTopic(InnaITTopics.ACCOUNT_ROLE_REMOVED); }

    // Credential domain
    @Bean public NewTopic credentialEnrolledTopic() { return buildTopic(InnaITTopics.CREDENTIAL_ENROLLED); }
    @Bean public NewTopic credentialRevokedTopic() { return buildTopic(InnaITTopics.CREDENTIAL_REVOKED); }

    // Authentication domain
    @Bean public NewTopic authStartedTopic() { return buildTopic(InnaITTopics.AUTH_STARTED); }
    @Bean public NewTopic authSucceededTopic() { return buildTopic(InnaITTopics.AUTH_SUCCEEDED); }
    @Bean public NewTopic authFailedTopic() { return buildTopic(InnaITTopics.AUTH_FAILED); }

    // Session domain
    @Bean public NewTopic sessionCreatedTopic() { return buildTopic(InnaITTopics.SESSION_CREATED); }
    @Bean public NewTopic sessionRevokedTopic() { return buildTopic(InnaITTopics.SESSION_REVOKED); }

    // Policy domain
    @Bean public NewTopic policyUpdatedTopic() { return buildTopic(InnaITTopics.POLICY_UPDATED); }

    // Admin domain
    @Bean public NewTopic adminActionLoggedTopic() { return buildTopic(InnaITTopics.ADMIN_ACTION_LOGGED); }

    // Notification domain
    @Bean public NewTopic notificationRequestedTopic() { return buildTopic(InnaITTopics.NOTIFICATION_REQUESTED); }

    // Connector domain
    @Bean public NewTopic connectorSyncCompletedTopic() { return buildTopic(InnaITTopics.CONNECTOR_SYNC_COMPLETED); }

    private NewTopic buildTopic(String name) {
        return TopicBuilder.name(name)
                .partitions(partitions)
                .replicas(replicationFactor)
                .build();
    }
}
