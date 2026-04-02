package io.innait.wiam.adminconfigservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DnsVerificationServiceTest {

    private DnsVerificationService service;

    @BeforeEach
    void setUp() {
        service = new DnsVerificationService();
    }

    @Nested
    class DnsVerificationLogic {

        @Test
        void shouldReturnFalseForNonexistentDomain() {
            // A domain that won't have a TXT record with our token
            boolean result = service.verifyDomain("nonexistent.innait-test.invalid", "test-token");
            assertThat(result).isFalse();
        }

        @Test
        void shouldReturnFalseForDomainWithNoTxtRecords() {
            // Most random subdomains won't have TXT records
            boolean result = service.verifyDomain("no-txt-records.example.invalid", "abc123");
            assertThat(result).isFalse();
        }

        @Test
        void shouldReturnFalseForInvalidDomainName() {
            boolean result = service.verifyDomain("", "token");
            assertThat(result).isFalse();
        }
    }
}
