package io.innait.wiam.identityservice.entity;

import io.innait.wiam.common.constant.UserType;
import io.innait.wiam.common.entity.SoftDeletableEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import org.hibernate.annotations.SQLRestriction;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "USERS")
@AttributeOverride(name = "id", column = @Column(name = "USER_ID", columnDefinition = "RAW(16)"))
@SQLRestriction("IS_DELETED = 0")
public class User extends SoftDeletableEntity {

    @Column(name = "EMPLOYEE_NO", length = 50)
    private String employeeNo;

    @Column(name = "FIRST_NAME", length = 100)
    private String firstName;

    @Column(name = "LAST_NAME", length = 100)
    private String lastName;

    @Column(name = "DISPLAY_NAME", length = 255)
    private String displayName;

    @Column(name = "EMAIL", nullable = false, length = 320)
    private String email;

    @Column(name = "PHONE_COUNTRY_CODE", length = 5)
    private String phoneCountryCode;

    @Column(name = "PHONE_NUMBER", length = 30)
    private String phoneNumber;

    @Column(name = "DEPARTMENT", length = 100)
    private String department;

    @Column(name = "DESIGNATION", length = 100)
    private String designation;

    @Column(name = "MANAGER_USER_ID", columnDefinition = "RAW(16)")
    private UUID managerUserId;

    @Column(name = "ORG_UNIT_ID", columnDefinition = "RAW(16)")
    private UUID orgUnitId;

    @Enumerated(EnumType.STRING)
    @Column(name = "USER_TYPE", nullable = false, length = 30)
    private UserType userType;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 30)
    private UserStatus status;

    @Column(name = "LOCALE", length = 10)
    private String locale;

    @Column(name = "TIMEZONE", length = 50)
    private String timezone;

    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Account> accounts = new ArrayList<>();

    // Getters and setters

    public String getEmployeeNo() { return employeeNo; }
    public void setEmployeeNo(String employeeNo) { this.employeeNo = employeeNo; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPhoneCountryCode() { return phoneCountryCode; }
    public void setPhoneCountryCode(String phoneCountryCode) { this.phoneCountryCode = phoneCountryCode; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }

    public UUID getManagerUserId() { return managerUserId; }
    public void setManagerUserId(UUID managerUserId) { this.managerUserId = managerUserId; }

    public UUID getOrgUnitId() { return orgUnitId; }
    public void setOrgUnitId(UUID orgUnitId) { this.orgUnitId = orgUnitId; }

    public UserType getUserType() { return userType; }
    public void setUserType(UserType userType) { this.userType = userType; }

    public UserStatus getStatus() { return status; }
    public void setStatus(UserStatus status) { this.status = status; }

    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public List<Account> getAccounts() { return accounts; }
    public void setAccounts(List<Account> accounts) { this.accounts = accounts; }
}
