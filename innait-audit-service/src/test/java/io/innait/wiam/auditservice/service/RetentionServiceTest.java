package io.innait.wiam.auditservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RetentionServiceTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    private RetentionService retentionService;

    @BeforeEach
    void setUp() {
        retentionService = new RetentionService(jdbcTemplate);
        ReflectionTestUtils.setField(retentionService, "auditEventsRetentionMonths", 24);
        ReflectionTestUtils.setField(retentionService, "adminActionsRetentionMonths", 36);
        ReflectionTestUtils.setField(retentionService, "securityIncidentsRetentionMonths", 12);
    }

    @Nested
    @DisplayName("runRetention")
    class RunRetention {

        @Test
        void shouldCallDropOldPartitionsForAllThreeTables() {
            when(jdbcTemplate.queryForList(anyString(), (Object) any(), (Object) any()))
                    .thenReturn(Collections.emptyList());

            retentionService.runRetention();

            // Verify queries were made for all three tables
            verify(jdbcTemplate, times(3)).queryForList(anyString(), (Object) any(), (Object) any());
        }
    }

    @Nested
    @DisplayName("dropOldPartitions")
    class DropOldPartitions {

        @Test
        void shouldDropPartitionsOlderThanRetentionPeriod() {
            List<Map<String, Object>> partitions = List.of(
                    Map.of("PARTITION_NAME", "P_202201"),
                    Map.of("PARTITION_NAME", "P_202202")
            );
            when(jdbcTemplate.queryForList(anyString(), (Object) eq("AUDIT_EVENTS"), (Object) anyString()))
                    .thenReturn(partitions);

            retentionService.dropOldPartitions("AUDIT_EVENTS", 24);

            verify(jdbcTemplate).execute("ALTER TABLE AUDIT_EVENTS DROP PARTITION P_202201");
            verify(jdbcTemplate).execute("ALTER TABLE AUDIT_EVENTS DROP PARTITION P_202202");
        }

        @Test
        void shouldCalculateCorrectCutoffPartitionName() {
            when(jdbcTemplate.queryForList(anyString(), (Object) eq("AUDIT_EVENTS"), (Object) anyString()))
                    .thenReturn(Collections.emptyList());

            retentionService.dropOldPartitions("AUDIT_EVENTS", 24);

            LocalDate expectedCutoff = LocalDate.now().minusMonths(24);
            String expectedPartition = "P_" + expectedCutoff.format(DateTimeFormatter.ofPattern("yyyyMM"));

            ArgumentCaptor<String> partitionCaptor = ArgumentCaptor.forClass(String.class);
            verify(jdbcTemplate).queryForList(anyString(), (Object) eq("AUDIT_EVENTS"), (Object) partitionCaptor.capture());
            assertThat(partitionCaptor.getValue()).isEqualTo(expectedPartition);
        }

        @Test
        void shouldNotExecuteDropWhenNoOldPartitionsExist() {
            when(jdbcTemplate.queryForList(anyString(), (Object) eq("ADMIN_ACTIONS"), (Object) anyString()))
                    .thenReturn(Collections.emptyList());

            retentionService.dropOldPartitions("ADMIN_ACTIONS", 36);

            verify(jdbcTemplate, never()).execute(anyString());
        }

        @Test
        void shouldContinueDroppingWhenOnePartitionFails() {
            List<Map<String, Object>> partitions = List.of(
                    Map.of("PARTITION_NAME", "P_202101"),
                    Map.of("PARTITION_NAME", "P_202102"),
                    Map.of("PARTITION_NAME", "P_202103")
            );
            when(jdbcTemplate.queryForList(anyString(), (Object) eq("SECURITY_INCIDENTS"), (Object) anyString()))
                    .thenReturn(partitions);

            // Second partition drop fails
            doNothing().when(jdbcTemplate).execute("ALTER TABLE SECURITY_INCIDENTS DROP PARTITION P_202101");
            doThrow(new RuntimeException("ORA-14083")).when(jdbcTemplate)
                    .execute("ALTER TABLE SECURITY_INCIDENTS DROP PARTITION P_202102");
            doNothing().when(jdbcTemplate).execute("ALTER TABLE SECURITY_INCIDENTS DROP PARTITION P_202103");

            retentionService.dropOldPartitions("SECURITY_INCIDENTS", 12);

            // All three should be attempted despite the failure of P_202102
            verify(jdbcTemplate).execute("ALTER TABLE SECURITY_INCIDENTS DROP PARTITION P_202101");
            verify(jdbcTemplate).execute("ALTER TABLE SECURITY_INCIDENTS DROP PARTITION P_202102");
            verify(jdbcTemplate).execute("ALTER TABLE SECURITY_INCIDENTS DROP PARTITION P_202103");
        }

        @Test
        void shouldHandleQueryFailureGracefully() {
            when(jdbcTemplate.queryForList(anyString(), (Object) eq("AUDIT_EVENTS"), (Object) anyString()))
                    .thenThrow(new RuntimeException("Connection failed"));

            // Should not throw
            retentionService.dropOldPartitions("AUDIT_EVENTS", 24);

            verify(jdbcTemplate, never()).execute(anyString());
        }

        @Test
        void shouldUseCorrectQueryForPartitionLookup() {
            when(jdbcTemplate.queryForList(anyString(), (Object) eq("AUDIT_EVENTS"), (Object) anyString()))
                    .thenReturn(Collections.emptyList());

            retentionService.dropOldPartitions("AUDIT_EVENTS", 24);

            ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
            verify(jdbcTemplate).queryForList(sqlCaptor.capture(), (Object) eq("AUDIT_EVENTS"), (Object) anyString());
            assertThat(sqlCaptor.getValue())
                    .contains("USER_TAB_PARTITIONS")
                    .contains("TABLE_NAME = ?")
                    .contains("PARTITION_NAME < ?");
        }
    }
}
