package io.innait.wiam.credentialservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.security.SecureRandom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class KekServiceTest {

    private KekService kekService;

    @BeforeEach
    void setUp() {
        kekService = new KekService();
        // Register a test key (256-bit AES key)
        byte[] testKey = new byte[32];
        new SecureRandom().nextBytes(testKey);
        kekService.registerKey(1, testKey);
    }

    @Test
    void shouldEncryptAndDecrypt() {
        byte[] plaintext = "Hello TOTP Secret".getBytes();
        byte[] iv = kekService.generateIv();

        byte[] ciphertext = kekService.encrypt(plaintext, iv, 1);
        byte[] decrypted = kekService.decrypt(ciphertext, iv, 1);

        assertThat(decrypted).isEqualTo(plaintext);
    }

    @Test
    void shouldProduceDifferentCiphertextForSamePlaintext() {
        byte[] plaintext = "Same secret".getBytes();
        byte[] iv1 = kekService.generateIv();
        byte[] iv2 = kekService.generateIv();

        byte[] ciphertext1 = kekService.encrypt(plaintext, iv1, 1);
        byte[] ciphertext2 = kekService.encrypt(plaintext, iv2, 1);

        assertThat(ciphertext1).isNotEqualTo(ciphertext2);
    }

    @Test
    void shouldFailDecryptWithWrongIv() {
        byte[] plaintext = "Secret data".getBytes();
        byte[] iv = kekService.generateIv();
        byte[] wrongIv = kekService.generateIv();

        byte[] ciphertext = kekService.encrypt(plaintext, iv, 1);

        assertThatThrownBy(() -> kekService.decrypt(ciphertext, wrongIv, 1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to decrypt");
    }

    @Test
    void shouldFailWithUnregisteredKekVersion() {
        byte[] plaintext = "Secret".getBytes();
        byte[] iv = kekService.generateIv();

        assertThatThrownBy(() -> kekService.encrypt(plaintext, iv, 99))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to encrypt with KEK version 99")
                .hasCauseInstanceOf(IllegalStateException.class);
    }

    @Test
    void shouldSupportMultipleKekVersions() {
        byte[] key2 = new byte[32];
        new SecureRandom().nextBytes(key2);
        kekService.registerKey(2, key2);

        byte[] plaintext = "Secret data".getBytes();

        byte[] iv1 = kekService.generateIv();
        byte[] encrypted1 = kekService.encrypt(plaintext, iv1, 1);
        byte[] decrypted1 = kekService.decrypt(encrypted1, iv1, 1);

        byte[] iv2 = kekService.generateIv();
        byte[] encrypted2 = kekService.encrypt(plaintext, iv2, 2);
        byte[] decrypted2 = kekService.decrypt(encrypted2, iv2, 2);

        assertThat(decrypted1).isEqualTo(plaintext);
        assertThat(decrypted2).isEqualTo(plaintext);
    }

    @Test
    void shouldRegisterKeyFromBase64() {
        String base64Key = java.util.Base64.getEncoder().encodeToString(new byte[32]);
        kekService.registerKey(5, base64Key);

        byte[] plaintext = "Test".getBytes();
        byte[] iv = kekService.generateIv();

        byte[] encrypted = kekService.encrypt(plaintext, iv, 5);
        byte[] decrypted = kekService.decrypt(encrypted, iv, 5);

        assertThat(decrypted).isEqualTo(plaintext);
    }

    @Test
    void shouldGenerateIvWithCorrectLength() {
        byte[] iv = kekService.generateIv();
        assertThat(iv).hasSize(12); // GCM standard IV length
    }

    @Test
    void shouldGenerateUniqueIvs() {
        byte[] iv1 = kekService.generateIv();
        byte[] iv2 = kekService.generateIv();
        assertThat(iv1).isNotEqualTo(iv2);
    }

    @Test
    void shouldPreserveDataIntegrity() {
        // Encrypt various sizes of data
        for (int size : new int[]{1, 16, 20, 32, 64, 128, 256}) {
            byte[] plaintext = new byte[size];
            new SecureRandom().nextBytes(plaintext);
            byte[] iv = kekService.generateIv();

            byte[] encrypted = kekService.encrypt(plaintext, iv, 1);
            byte[] decrypted = kekService.decrypt(encrypted, iv, 1);

            assertThat(decrypted).isEqualTo(plaintext);
        }
    }
}
