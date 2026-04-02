package io.innait.wiam.identityservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "ACCOUNT_ROLE_MAP")
@AttributeOverride(name = "id", column = @Column(name = "ACCOUNT_ROLE_ID", columnDefinition = "RAW(16)"))
public class AccountRoleMap extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ACCOUNT_ID", nullable = false, updatable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ROLE_ID", nullable = false, updatable = false)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(name = "ASSIGNMENT_SOURCE", nullable = false, length = 30)
    private MappingAssignmentSource assignmentSource;

    @Column(name = "IS_ACTIVE", nullable = false)
    private boolean active = true;

    @Column(name = "ASSIGNED_AT", nullable = false)
    private Instant assignedAt;

    @Column(name = "REMOVED_AT")
    private Instant removedAt;

    // Getters and setters

    public Account getAccount() { return account; }
    public void setAccount(Account account) { this.account = account; }

    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }

    public MappingAssignmentSource getAssignmentSource() { return assignmentSource; }
    public void setAssignmentSource(MappingAssignmentSource assignmentSource) { this.assignmentSource = assignmentSource; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Instant getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Instant assignedAt) { this.assignedAt = assignedAt; }

    public Instant getRemovedAt() { return removedAt; }
    public void setRemovedAt(Instant removedAt) { this.removedAt = removedAt; }
}
