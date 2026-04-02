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
@Table(name = "ROLE_ENTITLEMENT_MAP")
@AttributeOverride(name = "id", column = @Column(name = "ROLE_ENTITLEMENT_ID", columnDefinition = "RAW(16)"))
public class RoleEntitlementMap extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ROLE_ID", nullable = false, updatable = false)
    private Role role;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ENTITLEMENT_ID", nullable = false, updatable = false)
    private Entitlement entitlement;

    @Column(name = "IS_ACTIVE", nullable = false)
    private boolean active = true;

    // Getters and setters

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public Entitlement getEntitlement() { return entitlement; }
    public void setEntitlement(Entitlement entitlement) { this.entitlement = entitlement; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
