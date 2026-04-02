package io.innait.wiam.adminconfigservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "FEATURE_FLAGS")
@AttributeOverride(name = "id", column = @Column(name = "FEATURE_FLAG_ID", columnDefinition = "RAW(16)"))
public class FeatureFlag extends BaseEntity {

    @Column(name = "FLAG_KEY", nullable = false, length = 100)
    private String flagKey;

    @Column(name = "FLAG_VALUE", nullable = false)
    private boolean flagValue;

    @Column(name = "DESCRIPTION", length = 500)
    private String description;

    protected FeatureFlag() {}

    public FeatureFlag(String flagKey, boolean flagValue, String description) {
        this.flagKey = flagKey;
        this.flagValue = flagValue;
        this.description = description;
    }

    // Getters
    public String getFlagKey() { return flagKey; }
    public boolean isFlagValue() { return flagValue; }
    public String getDescription() { return description; }

    // Setters
    public void setFlagValue(boolean flagValue) { this.flagValue = flagValue; }
    public void setDescription(String description) { this.description = description; }
}
