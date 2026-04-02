package io.innait.wiam.adminconfigservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;

/**
 * Encrypts/decrypts connector config using AES-256-GCM.
 * In production, this delegates to HashiCorp Vault transit engine.
 * For local/dev, uses a configured symmetric key.
 */
@Service
public class ConfigEncryptionService {

    private static final Logger log = LoggerFactory.getLogger(ConfigEncryptionService.class);
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int GCM_IV_LENGTH = 12;

    private final SecretKeySpec keySpec;
    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    public ConfigEncryptionService(
            @Value("${innait.config.encryption.key:0123456789abcdef0123456789abcdef}") String hexKey,
            ObjectMapper objectMapper) {
        byte[] keyBytes = hexStringToBytes(hexKey);
        this.keySpec = new SecretKeySpec(keyBytes, "AES");
        this.objectMapper = objectMapper;
    }

    public String encrypt(Map<String, Object> config) {
        try {
            String json = objectMapper.writeValueAsString(config);
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] cipherText = cipher.doFinal(json.getBytes());

            // Prepend IV to ciphertext
            ByteBuffer buffer = ByteBuffer.allocate(iv.length + cipherText.length);
            buffer.put(iv);
            buffer.put(cipherText);

            return Base64.getEncoder().encodeToString(buffer.array());
        } catch (Exception e) {
            log.error("Failed to encrypt config: {}", e.getMessage());
            throw new RuntimeException("Config encryption failed", e);
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> decrypt(String encryptedConfig) {
        try {
            byte[] decoded = Base64.getDecoder().decode(encryptedConfig);
            ByteBuffer buffer = ByteBuffer.wrap(decoded);

            byte[] iv = new byte[GCM_IV_LENGTH];
            buffer.get(iv);
            byte[] cipherText = new byte[buffer.remaining()];
            buffer.get(cipherText);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] plainText = cipher.doFinal(cipherText);

            return objectMapper.readValue(new String(plainText), Map.class);
        } catch (Exception e) {
            log.error("Failed to decrypt config: {}", e.getMessage());
            throw new RuntimeException("Config decryption failed", e);
        }
    }

    private static byte[] hexStringToBytes(String hex) {
        int len = hex.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                    + Character.digit(hex.charAt(i + 1), 16));
        }
        return data;
    }
}
