package io.innait.wiam.common.entity;

import io.innait.wiam.common.security.InnaITAuthenticationToken;
import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

@MappedSuperclass
public abstract class AuditableEntity extends BaseEntity {

    @Column(name = "CREATED_BY", columnDefinition = "RAW(16)", updatable = false)
    private UUID createdBy;

    @Column(name = "UPDATED_BY", columnDefinition = "RAW(16)")
    private UUID updatedBy;

    @Override
    @PrePersist
    protected void onCreate() {
        super.onCreate();
        UUID actorId = getCurrentUserId();
        this.createdBy = actorId;
        this.updatedBy = actorId;
    }

    @Override
    @PreUpdate
    protected void onUpdate() {
        super.onUpdate();
        this.updatedBy = getCurrentUserId();
    }

    private UUID getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof InnaITAuthenticationToken token) {
            return token.getUserId();
        }
        return null;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UUID createdBy) {
        this.createdBy = createdBy;
    }

    public UUID getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(UUID updatedBy) {
        this.updatedBy = updatedBy;
    }
}
