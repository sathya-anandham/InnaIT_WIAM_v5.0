package io.innait.wiam.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

import java.time.Instant;

@MappedSuperclass
@FilterDef(name = "softDeleteFilter", parameters = @ParamDef(name = "isDeleted", type = Integer.class))
@Filter(name = "softDeleteFilter", condition = "IS_DELETED = :isDeleted")
public abstract class SoftDeletableEntity extends AuditableEntity {

    @Column(name = "IS_DELETED", columnDefinition = "NUMBER(1)", nullable = false)
    private boolean deleted = false;

    @Column(name = "DELETED_AT")
    private Instant deletedAt;

    public void softDelete() {
        this.deleted = true;
        this.deletedAt = Instant.now();
    }

    public void restore() {
        this.deleted = false;
        this.deletedAt = null;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }
}
