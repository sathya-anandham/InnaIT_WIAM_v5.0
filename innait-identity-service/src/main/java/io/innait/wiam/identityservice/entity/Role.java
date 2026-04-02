package io.innait.wiam.identityservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "ROLES")
@AttributeOverride(name = "id", column = @Column(name = "ROLE_ID", columnDefinition = "RAW(16)"))
public class Role extends BaseEntity {

    @Column(name = "ROLE_CODE", nullable = false, length = 100)
    private String roleCode;

    @Column(name = "ROLE_NAME", nullable = false, length = 255)
    private String roleName;

    @Column(name = "DESCRIPTION", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "ROLE_TYPE", nullable = false, length = 20)
    private io.innait.wiam.common.constant.RoleType roleType;

    @Column(name = "IS_SYSTEM", nullable = false)
    private boolean system = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private ActiveStatus status;

    // Getters and setters

    public String getRoleCode() { return roleCode; }
    public void setRoleCode(String roleCode) { this.roleCode = roleCode; }

    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public io.innait.wiam.common.constant.RoleType getRoleType() { return roleType; }
    public void setRoleType(io.innait.wiam.common.constant.RoleType roleType) { this.roleType = roleType; }

    public boolean isSystem() { return system; }
    public void setSystem(boolean system) { this.system = system; }

    public ActiveStatus getStatus() { return status; }
    public void setStatus(ActiveStatus status) { this.status = status; }
}
