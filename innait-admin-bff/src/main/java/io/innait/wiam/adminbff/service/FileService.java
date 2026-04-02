package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.AuditServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.dto.FileImportResponse;
import io.innait.wiam.adminbff.dto.FileValidationError;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class FileService {

    private static final Logger log = LoggerFactory.getLogger(FileService.class);
    private static final Set<String> REQUIRED_COLUMNS = Set.of("firstname", "lastname", "email", "employeeno");

    private final IdentityServiceClient identityClient;
    private final AuditServiceClient auditClient;

    @Value("${wiam.file.import-max-rows:5000}")
    private int maxRows;

    public FileService(IdentityServiceClient identityClient, AuditServiceClient auditClient) {
        this.identityClient = identityClient;
        this.auditClient = auditClient;
    }

    public FileImportResponse importUsers(MultipartFile file) throws IOException {
        String filename = file.getOriginalFilename();
        if (filename == null || (!filename.endsWith(".csv") && !filename.endsWith(".xlsx"))) {
            return new FileImportResponse(null, 0, 0, 0,
                    List.of(new FileValidationError(0, null, "File must be CSV or XLSX format")));
        }

        if (filename.endsWith(".csv")) {
            return importCsv(file);
        } else {
            return importXlsx(file);
        }
    }

    private FileImportResponse importCsv(MultipartFile file) throws IOException {
        List<FileValidationError> errors = new ArrayList<>();

        try (Reader reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8);
             CSVParser parser = CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setIgnoreHeaderCase(true)
                     .setTrim(true)
                     .build()
                     .parse(reader)) {

            // Validate required columns
            Map<String, Integer> headerMap = parser.getHeaderMap();
            Set<String> headers = new HashSet<>();
            headerMap.keySet().forEach(h -> headers.add(h.toLowerCase()));

            for (String required : REQUIRED_COLUMNS) {
                if (!headers.contains(required)) {
                    errors.add(new FileValidationError(0, required,
                            "Required column '" + required + "' is missing"));
                }
            }

            if (!errors.isEmpty()) {
                return new FileImportResponse(null, 0, 0, errors.size(), errors);
            }

            List<CSVRecord> records = parser.getRecords();
            int totalRows = records.size();

            if (totalRows > maxRows) {
                errors.add(new FileValidationError(0, null,
                        "File exceeds maximum of " + maxRows + " rows (found " + totalRows + ")"));
                return new FileImportResponse(null, totalRows, 0, 1, errors);
            }

            // Validate each row
            int validRows = 0;
            for (int i = 0; i < records.size(); i++) {
                CSVRecord record = records.get(i);
                int row = i + 2; // +2 for 1-based + header row

                String email = record.isMapped("email") ? record.get("email").trim() : "";
                String firstName = record.isMapped("firstname") ? record.get("firstname").trim() : "";
                String lastName = record.isMapped("lastname") ? record.get("lastname").trim() : "";
                String employeeNo = record.isMapped("employeeno") ? record.get("employeeno").trim() : "";

                boolean rowValid = true;
                if (firstName.isBlank()) {
                    errors.add(new FileValidationError(row, "firstname", "First name is required"));
                    rowValid = false;
                }
                if (lastName.isBlank()) {
                    errors.add(new FileValidationError(row, "lastname", "Last name is required"));
                    rowValid = false;
                }
                if (email.isBlank() || !email.contains("@")) {
                    errors.add(new FileValidationError(row, "email", "Valid email is required"));
                    rowValid = false;
                }
                if (employeeNo.isBlank()) {
                    errors.add(new FileValidationError(row, "employeeno", "Employee number is required"));
                    rowValid = false;
                }
                if (rowValid) validRows++;
            }

            if (!errors.isEmpty()) {
                return new FileImportResponse(null, totalRows, validRows, errors.size(), errors);
            }

            // Delegate to Identity Service bulk API
            UUID jobId = UUID.randomUUID();
            try {
                identityClient.bulkCreateUsers(file.getBytes(), "text/csv");
            } catch (Exception e) {
                log.error("Bulk create failed: {}", e.getMessage());
                errors.add(new FileValidationError(0, null, "Bulk import failed: " + e.getMessage()));
                return new FileImportResponse(jobId, totalRows, 0, totalRows, errors);
            }

            return new FileImportResponse(jobId, totalRows, validRows, 0, List.of());
        }
    }

    private FileImportResponse importXlsx(MultipartFile file) throws IOException {
        // XLSX parsing via Apache POI
        List<FileValidationError> errors = new ArrayList<>();

        try (org.apache.poi.xssf.usermodel.XSSFWorkbook workbook =
                     new org.apache.poi.xssf.usermodel.XSSFWorkbook(file.getInputStream())) {

            org.apache.poi.ss.usermodel.Sheet sheet = workbook.getSheetAt(0);
            if (sheet.getPhysicalNumberOfRows() < 2) {
                errors.add(new FileValidationError(0, null, "File is empty or has only header row"));
                return new FileImportResponse(null, 0, 0, 1, errors);
            }

            // Read header row
            org.apache.poi.ss.usermodel.Row headerRow = sheet.getRow(0);
            Map<String, Integer> columnIndex = new HashMap<>();
            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                org.apache.poi.ss.usermodel.Cell cell = headerRow.getCell(i);
                if (cell != null) {
                    columnIndex.put(cell.getStringCellValue().toLowerCase().trim(), i);
                }
            }

            for (String required : REQUIRED_COLUMNS) {
                if (!columnIndex.containsKey(required)) {
                    errors.add(new FileValidationError(0, required,
                            "Required column '" + required + "' is missing"));
                }
            }

            if (!errors.isEmpty()) {
                return new FileImportResponse(null, 0, 0, errors.size(), errors);
            }

            int totalRows = sheet.getLastRowNum(); // excludes header
            if (totalRows > maxRows) {
                errors.add(new FileValidationError(0, null,
                        "File exceeds maximum of " + maxRows + " rows (found " + totalRows + ")"));
                return new FileImportResponse(null, totalRows, 0, 1, errors);
            }

            // Convert XLSX to CSV bytes and delegate to bulk API
            UUID jobId = UUID.randomUUID();
            ByteArrayOutputStream csvOut = new ByteArrayOutputStream();
            try (CSVPrinter printer = new CSVPrinter(
                    new OutputStreamWriter(csvOut, StandardCharsets.UTF_8),
                    CSVFormat.DEFAULT.builder().setHeader("firstname", "lastname", "email", "employeeno").build())) {

                for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                    org.apache.poi.ss.usermodel.Row row = sheet.getRow(i);
                    if (row == null) continue;
                    printer.printRecord(
                            getCellString(row, columnIndex.getOrDefault("firstname", -1)),
                            getCellString(row, columnIndex.getOrDefault("lastname", -1)),
                            getCellString(row, columnIndex.getOrDefault("email", -1)),
                            getCellString(row, columnIndex.getOrDefault("employeeno", -1))
                    );
                }
            }

            identityClient.bulkCreateUsers(csvOut.toByteArray(), "text/csv");
            return new FileImportResponse(jobId, totalRows, totalRows, 0, List.of());
        }
    }

    private String getCellString(org.apache.poi.ss.usermodel.Row row, int index) {
        if (index < 0) return "";
        org.apache.poi.ss.usermodel.Cell cell = row.getCell(index);
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            default -> "";
        };
    }

    public void exportUsers(String format, HttpServletResponse response) throws IOException {
        byte[] data = identityClient.exportUsers(format);
        if ("xlsx".equalsIgnoreCase(format)) {
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=users.xlsx");
        } else {
            response.setContentType("text/csv");
            response.setHeader("Content-Disposition", "attachment; filename=users.csv");
        }
        if (data != null) {
            response.getOutputStream().write(data);
        }
    }

    public void generateComplianceReport(String startDate, String endDate,
                                         HttpServletResponse response) throws IOException {
        // Fetch audit data for the date range
        Map<String, String> params = new HashMap<>();
        params.put("startDate", startDate);
        params.put("endDate", endDate);
        params.put("size", "10000");
        params.put("sort", "eventTime,asc");

        List<Map<String, Object>> events = auditClient.getAuditEvents(params);

        // Generate CSV compliance report
        response.setContentType("text/csv");
        response.setHeader("Content-Disposition", "attachment; filename=compliance-report.csv");

        try (CSVPrinter printer = new CSVPrinter(
                new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8),
                CSVFormat.DEFAULT.builder()
                        .setHeader("Event Time", "Event Type", "Category", "Actor", "Action",
                                "Resource", "Outcome", "Details")
                        .build())) {

            for (Map<String, Object> event : events) {
                printer.printRecord(
                        event.getOrDefault("eventTime", ""),
                        event.getOrDefault("eventType", ""),
                        event.getOrDefault("eventCategory", ""),
                        event.getOrDefault("actorId", ""),
                        event.getOrDefault("action", ""),
                        event.getOrDefault("resourceType", ""),
                        event.getOrDefault("outcome", ""),
                        event.getOrDefault("detail", "")
                );
            }
        }
    }
}
