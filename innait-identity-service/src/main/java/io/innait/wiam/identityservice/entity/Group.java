package io.innait.wiam.identityservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "GROUPS")
@AttributeOverride(name = "id", column = @Column(name = "GROUP_ID", columnDefinition = "RAW(16)"))
public class Group extends BaseEntity {

    @Column(name = "GROUP_CODE", nullable = false, length = 100)
    private String groupCode;

    @Column(name = "GROUP_NAME", nullable = false, length = 255)
    private String groupName;

    @Column(name = "DESCRIPTION", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "GROUP_TYPE", nullable = false, length = 20)
    private GroupType groupType;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private ActiveStatus status;

    // Getters and setters

    public String getGroupCode() { return groupCode; }
    public void setGroupCode(String groupCode) { this.groupCode = groupCode; }

    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public GroupType getGroupType() { return groupType; }
    public void setGroupType(GroupType groupType) { this.groupType = groupType; }

    public ActiveStatus getStatus() { return status; }
    public void setStatus(ActiveStatus status) { this.status = status; }
}
