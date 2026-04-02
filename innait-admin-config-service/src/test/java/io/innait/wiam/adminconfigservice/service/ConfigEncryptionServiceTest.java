package io.innait.wiam.adminconfigservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConfigEncryptionServiceTest {

    private ConfigEncryptionService service;

    @BeforeEach
    void setUp() {
        service = new ConfigEncryptionService(
                "0123456789abcdef0123456789abcdef", new ObjectMapper());
    }

    @Nested
    class EncryptionDecryption {

        @Test
        void shouldEncryptAndDecryptRoundTrip() {
            Map<String, Object> config = Map.of(
                    "url", "ldap://ldap.acme.com:389",
                    "bindDn", "cn=admin,dc=acme,dc=com",
                    "bindPassword", "secret123",
                    "baseDn", "dc=acme,dc=com"
            );

            String encrypted = service.encrypt(config);
            assertThat(encrypted).isNotEmpty();
            assertThat(encrypted).isNotEqualTo(config.toString());

            Map<String, Object> decrypted = service.decrypt(encrypted);
            assertThat(decrypted).containsEntry("url", "ldap://ldap.acme.com:389");
            assertThat(decrypted).containsEntry("bindDn", "cn=admin,dc=acme,dc=com");
            assertThat(decrypted).containsEntry("bindPassword", "secret123");
            assertThat(decrypted).containsEntry("baseDn", "dc=acme,dc=com");
        }

        @Test
        void shouldProduceDifferentCiphertextEachTime() {
            Map<String, Object> config = Map.of("key", "value");
            String enc1 = service.encrypt(config);
            String enc2 = service.encrypt(config);

            // Different IVs should produce different ciphertexts
            assertThat(enc1).isNotEqualTo(enc2);
        }

        @Test
        void shouldHandleEmptyConfig() {
            Map<String, Object> config = Map.of();
            String encrypted = service.encrypt(config);
            Map<String, Object> decrypted = service.decrypt(encrypted);
            assertThat(decrypted).isEmpty();
        }

        @Test
        void shouldHandleNestedConfig() {
            Map<String, Object> config = Map.of(
                    "connection", Map.of("host", "ldap.acme.com", "port", 389),
                    "search", Map.of("baseDn", "dc=acme,dc=com")
            );

            String encrypted = service.encrypt(config);
            Map<String, Object> decrypted = service.decrypt(encrypted);

            assertThat(decrypted).containsKey("connection");
            assertThat(decrypted).containsKey("search");
        }

        @Test
        void shouldFailDecryptionWithCorruptedData() {
            assertThatThrownBy(() -> service.decrypt("not-valid-base64-cipher"))
                    .isInstanceOf(RuntimeException.class);
        }

        @Test
        void shouldFailDecryptionWithTamperedCiphertext() {
            Map<String, Object> config = Map.of("key", "value");
            String encrypted = service.encrypt(config);
            // Tamper with the ciphertext
            String tampered = encrypted.substring(0, encrypted.length() - 4) + "AAAA";

            assertThatThrownBy(() -> service.decrypt(tampered))
                    .isInstanceOf(RuntimeException.class);
        }
    }
}
