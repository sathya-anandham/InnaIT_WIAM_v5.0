package io.innait.wiam.adminconfigservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "ORG_UNITS")
@AttributeOverride(name = "id", column = @Column(name = "ORG_UNIT_ID", columnDefinition = "RAW(16)"))
public class OrgUnit extends BaseEntity {

    @Column(name = "ORG_CODE", nullable = false, length = 100)
    private String orgCode;

    @Column(name = "ORG_NAME", nullable = false, length = 255)
    private String orgName;

    @Column(name = "PARENT_ORG_UNIT_ID", columnDefinition = "RAW(16)")
    private UUID parentOrgUnitId;

    @Column(name = "DESCRIPTION", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private OrgUnitStatus status = OrgUnitStatus.ACTIVE;

    protected OrgUnit() {}

    public OrgUnit(String orgCode, String orgName, UUID parentOrgUnitId, String description) {
        this.orgCode = orgCode;
        this.orgName = orgName;
        this.parentOrgUnitId = parentOrgUnitId;
        this.description = description;
    }

    // Getters
    public String getOrgCode() { return orgCode; }
    public String getOrgName() { return orgName; }
    public UUID getParentOrgUnitId() { return parentOrgUnitId; }
    public String getDescription() { return description; }
    public OrgUnitStatus getStatus() { return status; }

    // Setters
    public void setOrgName(String orgName) { this.orgName = orgName; }
    public void setDescription(String description) { this.description = description; }
    public void setParentOrgUnitId(UUID parentOrgUnitId) { this.parentOrgUnitId = parentOrgUnitId; }
    public void setStatus(OrgUnitStatus status) { this.status = status; }
}
