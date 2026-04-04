package io.innait.wiam.sessionservice.repository;

import io.innait.wiam.sessionservice.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findByTokenFamilyAndRevokedAtIsNull(UUID tokenFamily);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revokedAt = CURRENT_INSTANT WHERE r.tokenFamily = :family AND r.revokedAt IS NULL")
    void revokeTokenFamily(@Param("family") UUID tokenFamily);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revokedAt = CURRENT_INSTANT WHERE r.sessionId = :sessionId AND r.revokedAt IS NULL")
    void revokeBySessionId(@Param("sessionId") UUID sessionId);

    List<RefreshToken> findBySessionIdAndRevokedAtIsNull(UUID sessionId);
}
