package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.AuditServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.dto.FileImportResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class FileServiceTest {

    @Mock private IdentityServiceClient identityClient;
    @Mock private AuditServiceClient auditClient;

    private FileService fileService;

    @BeforeEach
    void setUp() {
        fileService = new FileService(identityClient, auditClient);
        ReflectionTestUtils.setField(fileService, "maxRows", 100);
    }

    @Nested
    class CsvValidation {

        @Test
        void shouldRejectNonCsvNonXlsxFile() throws IOException {
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.txt", "text/plain", "data".getBytes());

            FileImportResponse result = fileService.importUsers(file);

            assertThat(result.errors()).isNotEmpty();
            assertThat(result.errors().getFirst().message()).contains("CSV or XLSX");
            verify(identityClient, never()).bulkCreateUsers(any(), anyString());
        }

        @Test
        void shouldRejectCsvMissingRequiredColumns() throws IOException {
            String csv = "name,department\nJohn,Engineering\n";
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv", csv.getBytes());

            FileImportResponse result = fileService.importUsers(file);

            assertThat(result.errors()).isNotEmpty();
            assertThat(result.errors().stream().map(e -> e.column()))
                    .contains("firstname", "lastname", "email", "employeeno");
        }

        @Test
        void shouldRejectCsvExceedingMaxRows() throws IOException {
            StringBuilder csv = new StringBuilder("firstname,lastname,email,employeeno\n");
            for (int i = 0; i < 101; i++) {
                csv.append("John,Doe,john").append(i).append("@test.com,EMP").append(i).append("\n");
            }
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv", csv.toString().getBytes());

            FileImportResponse result = fileService.importUsers(file);

            assertThat(result.errors()).isNotEmpty();
            assertThat(result.errors().getFirst().message()).contains("maximum");
        }

        @Test
        void shouldValidateRowData() throws IOException {
            String csv = "firstname,lastname,email,employeeno\n,Doe,invalid-email,\n";
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv", csv.getBytes());

            FileImportResponse result = fileService.importUsers(file);

            assertThat(result.errors()).hasSizeGreaterThanOrEqualTo(3);
            assertThat(result.validRows()).isZero();
        }

        @Test
        void shouldAcceptValidCsv() throws IOException {
            String csv = "firstname,lastname,email,employeeno\nJohn,Doe,john@test.com,EMP001\nJane,Smith,jane@test.com,EMP002\n";
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv", csv.getBytes());

            FileImportResponse result = fileService.importUsers(file);

            assertThat(result.errors()).isEmpty();
            assertThat(result.totalRows()).isEqualTo(2);
            assertThat(result.validRows()).isEqualTo(2);
            verify(identityClient).bulkCreateUsers(any(), anyString());
        }

        @Test
        void shouldHandleCaseInsensitiveHeaders() throws IOException {
            String csv = "FirstName,LastName,Email,EmployeeNo\nJohn,Doe,john@test.com,EMP001\n";
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv", csv.getBytes());

            FileImportResponse result = fileService.importUsers(file);

            assertThat(result.errors()).isEmpty();
            assertThat(result.validRows()).isEqualTo(1);
        }
    }

    @Nested
    class XlsxValidation {

        @Test
        void shouldRejectXlsxWithMissingColumns() throws IOException {
            // Create minimal XLSX with wrong columns
            byte[] xlsxBytes = createMinimalXlsx("name", "department");
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    xlsxBytes);

            FileImportResponse result = fileService.importUsers(file);

            assertThat(result.errors()).isNotEmpty();
        }

        private byte[] createMinimalXlsx(String... headers) throws IOException {
            try (org.apache.poi.xssf.usermodel.XSSFWorkbook workbook =
                         new org.apache.poi.xssf.usermodel.XSSFWorkbook()) {
                org.apache.poi.ss.usermodel.Sheet sheet = workbook.createSheet("Users");
                org.apache.poi.ss.usermodel.Row headerRow = sheet.createRow(0);
                for (int i = 0; i < headers.length; i++) {
                    headerRow.createCell(i).setCellValue(headers[i]);
                }
                // Add one data row
                org.apache.poi.ss.usermodel.Row dataRow = sheet.createRow(1);
                for (int i = 0; i < headers.length; i++) {
                    dataRow.createCell(i).setCellValue("value" + i);
                }
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                workbook.write(out);
                return out.toByteArray();
            }
        }
    }
}
