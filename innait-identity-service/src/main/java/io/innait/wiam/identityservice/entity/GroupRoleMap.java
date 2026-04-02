package io.innait.wiam.identityservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "GROUP_ROLE_MAP")
@AttributeOverride(name = "id", column = @Column(name = "GROUP_ROLE_ID", columnDefinition = "RAW(16)"))
public class GroupRoleMap extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "GROUP_ID", nullable = false, updatable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ROLE_ID", nullable = false, updatable = false)
    private Role role;

    @Column(name = "IS_ACTIVE", nullable = false)
    private boolean active = true;

    // Getters and setters

    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
