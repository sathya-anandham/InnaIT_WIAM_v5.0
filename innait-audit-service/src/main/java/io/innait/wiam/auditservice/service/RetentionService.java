package io.innait.wiam.auditservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * Nightly retention job that drops Oracle partitions older than the configured retention period.
 * Flashback Archive retains data beyond partition drop for compliance.
 */
@Service
public class RetentionService {

    private static final Logger log = LoggerFactory.getLogger(RetentionService.class);
    private static final DateTimeFormatter PARTITION_FORMAT = DateTimeFormatter.ofPattern("yyyyMM");

    private final JdbcTemplate jdbcTemplate;

    @Value("${innait.audit.retention.audit-events-months:24}")
    private int auditEventsRetentionMonths;

    @Value("${innait.audit.retention.admin-actions-months:36}")
    private int adminActionsRetentionMonths;

    @Value("${innait.audit.retention.security-incidents-months:12}")
    private int securityIncidentsRetentionMonths;

    public RetentionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Runs nightly at 2:00 AM. Drops Oracle partitions older than configured retention.
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void runRetention() {
        log.info("Starting audit retention job");

        dropOldPartitions("AUDIT_EVENTS", auditEventsRetentionMonths);
        dropOldPartitions("ADMIN_ACTIONS", adminActionsRetentionMonths);
        dropOldPartitions("SECURITY_INCIDENTS", securityIncidentsRetentionMonths);

        log.info("Audit retention job completed");
    }

    void dropOldPartitions(String tableName, int retentionMonths) {
        LocalDate cutoffDate = LocalDate.now().minusMonths(retentionMonths);
        String cutoffPartition = "P_" + cutoffDate.format(PARTITION_FORMAT);

        try {
            // Query USER_TAB_PARTITIONS for partitions older than cutoff
            var partitions = jdbcTemplate.queryForList(
                    "SELECT PARTITION_NAME FROM USER_TAB_PARTITIONS " +
                            "WHERE TABLE_NAME = ? AND PARTITION_NAME < ? " +
                            "ORDER BY PARTITION_NAME",
                    tableName, cutoffPartition);

            for (var row : partitions) {
                String partitionName = (String) row.get("PARTITION_NAME");
                try {
                    jdbcTemplate.execute(
                            "ALTER TABLE " + tableName + " DROP PARTITION " + partitionName);
                    log.info("Dropped partition {} from table {}", partitionName, tableName);
                } catch (Exception e) {
                    log.error("Failed to drop partition {} from {}: {}",
                            partitionName, tableName, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Failed to query partitions for {}: {}", tableName, e.getMessage());
        }
    }
}
