package io.innait.wiam.credentialservice.service;

import io.innait.wiam.credentialservice.dto.BackupCodeGenerateResponse;
import io.innait.wiam.credentialservice.entity.BackupCode;
import io.innait.wiam.credentialservice.entity.BackupCodeStatus;
import io.innait.wiam.credentialservice.repository.BackupCodeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class BackupCodeService {

    private static final Logger log = LoggerFactory.getLogger(BackupCodeService.class);
    private static final int CODE_COUNT = 10;
    private static final int CODE_LENGTH = 8;
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I/O/0/1 for readability

    private final BackupCodeRepository backupCodeRepository;
    private final BCryptPasswordEncoder bcryptEncoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    public BackupCodeService(BackupCodeRepository backupCodeRepository) {
        this.backupCodeRepository = backupCodeRepository;
    }

    public BackupCodeGenerateResponse generate(UUID accountId) {
        // Invalidate existing codes
        invalidateExistingCodes(accountId);

        List<String> plaintextCodes = new ArrayList<>();

        for (int i = 0; i < CODE_COUNT; i++) {
            String code = generateRandomCode();
            plaintextCodes.add(code);

            BackupCode backupCode = new BackupCode();
            backupCode.setAccountId(accountId);
            backupCode.setCodeHash(bcryptEncoder.encode(code));
            backupCode.setCodeIndex(i);
            backupCode.setStatus(BackupCodeStatus.UNUSED);
            backupCodeRepository.save(backupCode);
        }

        log.info("Generated {} backup codes for account [{}]", CODE_COUNT, accountId);
        return new BackupCodeGenerateResponse(plaintextCodes, CODE_COUNT);
    }

    public boolean verify(UUID accountId, String code) {
        List<BackupCode> unusedCodes = backupCodeRepository.findByAccountIdAndStatus(
                accountId, BackupCodeStatus.UNUSED);

        if (unusedCodes.isEmpty()) {
            return false;
        }

        for (BackupCode backupCode : unusedCodes) {
            if (bcryptEncoder.matches(code, backupCode.getCodeHash())) {
                backupCode.setStatus(BackupCodeStatus.USED);
                backupCode.setUsedAt(Instant.now());
                backupCodeRepository.save(backupCode);
                log.info("Backup code used for account [{}], index [{}]", accountId, backupCode.getCodeIndex());
                return true;
            }
        }

        return false;
    }

    public BackupCodeGenerateResponse regenerate(UUID accountId) {
        return generate(accountId); // generate() already invalidates old codes
    }

    @Transactional(readOnly = true)
    public int getRemainingCount(UUID accountId) {
        return (int) backupCodeRepository.countByAccountIdAndStatus(accountId, BackupCodeStatus.UNUSED);
    }

    // ---- Private helpers ----

    private void invalidateExistingCodes(UUID accountId) {
        List<BackupCode> existing = backupCodeRepository.findByAccountIdAndStatus(
                accountId, BackupCodeStatus.UNUSED);
        for (BackupCode code : existing) {
            code.setStatus(BackupCodeStatus.INVALIDATED);
        }
        backupCodeRepository.saveAll(existing);
    }

    String generateRandomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_CHARS.charAt(secureRandom.nextInt(CODE_CHARS.length())));
        }
        return sb.toString();
    }
}
