package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.credentialservice.dto.BackupCodeGenerateResponse;
import io.innait.wiam.credentialservice.entity.BackupCode;
import io.innait.wiam.credentialservice.entity.BackupCodeStatus;
import io.innait.wiam.credentialservice.repository.BackupCodeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BackupCodeServiceTest {

    @Mock
    private BackupCodeRepository backupCodeRepository;

    private BackupCodeService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();
    private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        service = new BackupCodeService(backupCodeRepository);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- Generate ----

    @Nested
    class Generate {

        @Test
        void shouldGenerateTenCodes() {
            when(backupCodeRepository.findByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                    .thenReturn(Collections.emptyList());
            when(backupCodeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            BackupCodeGenerateResponse response = service.generate(accountId);

            assertThat(response.codes()).hasSize(10);
            assertThat(response.totalCount()).isEqualTo(10);
            verify(backupCodeRepository, times(10)).save(any(BackupCode.class));
        }

        @Test
        void shouldGenerateEightCharCodes() {
            when(backupCodeRepository.findByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                    .thenReturn(Collections.emptyList());
            when(backupCodeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            BackupCodeGenerateResponse response = service.generate(accountId);

            for (String code : response.codes()) {
                assertThat(code).hasSize(8);
                // Only allowed characters (no I, O, 0, 1)
                assertThat(code).matches("[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}");
            }
        }

        @Test
        void shouldGenerateUniqueCodes() {
            when(backupCodeRepository.findByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                    .thenReturn(Collections.emptyList());
            when(backupCodeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            BackupCodeGenerateResponse response = service.generate(accountId);

            long uniqueCount = response.codes().stream().distinct().count();
            assertThat(uniqueCount).isEqualTo(10);
        }

        @Test
        void shouldInvalidateExistingCodesOnGenerate() {
            BackupCode existingCode = new BackupCode();
            existingCode.setStatus(BackupCodeStatus.UNUSED);
            when(backupCodeRepository.findByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                    .thenReturn(List.of(existingCode))
                    .thenReturn(Collections.emptyList()); // Second call during invalidation
            when(backupCodeRepository.saveAll(any())).thenReturn(List.of(existingCode));
            when(backupCodeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.generate(accountId);

            assertThat(existingCode.getStatus()).isEqualTo(BackupCodeStatus.INVALIDATED);
            verify(backupCodeRepository).saveAll(any());
        }

        @Test
        void shouldHashCodesWithBCrypt() {
            when(backupCodeRepository.findByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                    .thenReturn(Collections.emptyList());

            List<BackupCode> savedCodes = new ArrayList<>();
            when(backupCodeRepository.save(any())).thenAnswer(inv -> {
                BackupCode bc = inv.getArgument(0);
                savedCodes.add(bc);
                return bc;
            });

            BackupCodeGenerateResponse response = service.generate(accountId);

            assertThat(savedCodes).hasSize(10);
            for (int i = 0; i < savedCodes.size(); i++) {
                BackupCode saved = savedCodes.get(i);
                // Verify the hash matches the plaintext code
                assertThat(bcrypt.matches(response.codes().get(i), saved.getCodeHash())).isTrue();
                assertThat(saved.getCodeIndex()).isEqualTo(i);
                assertThat(saved.getStatus()).isEqualTo(BackupCodeStatus.UNUSED);
            }
        }
    }

    // ---- Verify ----

    @Nested
    class Verify {

        @Test
        void shouldVerifyValidCode() {
            String plainCode = "ABCD1234";
            BackupCode backupCode = new BackupCode();
            backupCode.setCodeHash(bcrypt.encode(plainCode));
            backupCode.setCodeIndex(0);
            backupCode.setStatus(BackupCodeStatus.UNUSED);

            when(backupCodeRepository.findByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                    .thenReturn(List.of(backupCode));
            when(backupCodeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            boolean result = service.verify(accountId, plainCode);

            assertThat(result).isTrue();
            assertThat(backupCode.getStatus()).isEqualTo(BackupCodeStatus.USED);
            assertThat(backupCode.getUsedAt()).isNotNull();
        }

        @Test
        void shouldRejectInvalidCode() {
            BackupCode backupCode = new BackupCode();
            backupCode.setCodeHash(bcrypt.encode("REALCODE"));
            backupCode.setStatus(BackupCodeStatus.UNUSED);

            when(backupCodeRepository.findByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                    .thenReturn(List.of(backupCode));

            boolean result = service.verify(accountId, "WRONGCODE");

            assertThat(result).isFalse();
            assertThat(backupCode.getStatus()).isEqualTo(BackupCodeStatus.UNUSED);
        }

        @Test
        void shouldReturnFalseWhenNoUnusedCodes() {
            when(backupCodeRepository.findByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                    .thenReturn(Collections.emptyList());

            boolean result = service.verify(accountId, "ANYCODE");

            assertThat(result).isFalse();
        }

        @Test
        void shouldNotReuseAlreadyUsedCode() {
            // Only unused codes are returned by repository
            when(backupCodeRepository.findByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                    .thenReturn(Collections.emptyList());

            boolean result = service.verify(accountId, "USEDCODE");

            assertThat(result).isFalse();
        }
    }

    // ---- Regenerate ----

    @Test
    void shouldRegenerateAndInvalidateOld() {
        BackupCode existingCode = new BackupCode();
        existingCode.setStatus(BackupCodeStatus.UNUSED);
        when(backupCodeRepository.findByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                .thenReturn(List.of(existingCode))
                .thenReturn(Collections.emptyList());
        when(backupCodeRepository.saveAll(any())).thenReturn(List.of(existingCode));
        when(backupCodeRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BackupCodeGenerateResponse response = service.regenerate(accountId);

        assertThat(response.codes()).hasSize(10);
        assertThat(existingCode.getStatus()).isEqualTo(BackupCodeStatus.INVALIDATED);
    }

    // ---- Remaining count ----

    @Test
    void shouldReturnRemainingCount() {
        when(backupCodeRepository.countByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                .thenReturn(7L);

        int remaining = service.getRemainingCount(accountId);

        assertThat(remaining).isEqualTo(7);
    }

    @Test
    void shouldReturnZeroWhenNoCodesLeft() {
        when(backupCodeRepository.countByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED))
                .thenReturn(0L);

        int remaining = service.getRemainingCount(accountId);

        assertThat(remaining).isZero();
    }

    // ---- Code generation quality ----

    @Test
    void shouldGenerateRandomCodeWithCorrectCharset() {
        String code = service.generateRandomCode();
        assertThat(code).hasSize(8);
        assertThat(code).matches("[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}");
    }

    @Test
    void shouldGenerateDifferentCodesEachTime() {
        String code1 = service.generateRandomCode();
        String code2 = service.generateRandomCode();
        // Extremely unlikely to be equal with 32^8 possibilities
        assertThat(code1).isNotEqualTo(code2);
    }
}
