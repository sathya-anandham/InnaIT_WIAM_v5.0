package io.innait.wiam.tokenservice.service;

import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Manages RSA key pairs for JWT signing with key rotation support.
 * Active key signs new tokens; previous key remains valid for 24h verification.
 */
public class KeyPairHolder {

    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    private RSAKey activeKey;
    private RSAKey previousKey;
    private Instant activeKeyCreatedAt;
    private Instant previousKeyExpiresAt;

    private final long keyOverlapSeconds;

    public KeyPairHolder(long keyOverlapSeconds) {
        this.keyOverlapSeconds = keyOverlapSeconds;
        this.activeKey = generateRsaKey();
        this.activeKeyCreatedAt = Instant.now();
    }

    /** Constructor for testing with a pre-built key. */
    KeyPairHolder(RSAKey activeKey, long keyOverlapSeconds) {
        this.keyOverlapSeconds = keyOverlapSeconds;
        this.activeKey = activeKey;
        this.activeKeyCreatedAt = Instant.now();
    }

    public RSAKey getActiveSigningKey() {
        lock.readLock().lock();
        try {
            return activeKey;
        } finally {
            lock.readLock().unlock();
        }
    }

    public String getActiveKid() {
        lock.readLock().lock();
        try {
            return activeKey.getKeyID();
        } finally {
            lock.readLock().unlock();
        }
    }

    public void rotateKey() {
        lock.writeLock().lock();
        try {
            previousKey = activeKey;
            previousKeyExpiresAt = Instant.now().plusSeconds(keyOverlapSeconds);
            activeKey = generateRsaKey();
            activeKeyCreatedAt = Instant.now();
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Returns the JWKS containing all valid public keys.
     */
    public JWKSet getJwks() {
        lock.readLock().lock();
        try {
            List<JWK> keys = new ArrayList<>();
            keys.add(activeKey.toPublicJWK());
            if (previousKey != null && previousKeyExpiresAt != null
                    && Instant.now().isBefore(previousKeyExpiresAt)) {
                keys.add(previousKey.toPublicJWK());
            }
            return new JWKSet(keys);
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Find a key by kid for token verification.
     */
    public RSAKey findKeyByKid(String kid) {
        lock.readLock().lock();
        try {
            if (activeKey.getKeyID().equals(kid)) {
                return activeKey;
            }
            if (previousKey != null && previousKey.getKeyID().equals(kid)
                    && previousKeyExpiresAt != null
                    && Instant.now().isBefore(previousKeyExpiresAt)) {
                return previousKey;
            }
            return null;
        } finally {
            lock.readLock().unlock();
        }
    }

    Instant getActiveKeyCreatedAt() {
        return activeKeyCreatedAt;
    }

    private RSAKey generateRsaKey() {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
            gen.initialize(2048);
            KeyPair keyPair = gen.generateKeyPair();

            return new RSAKey.Builder((RSAPublicKey) keyPair.getPublic())
                    .privateKey((RSAPrivateKey) keyPair.getPrivate())
                    .keyID(UUID.randomUUID().toString())
                    .build();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("RSA not available", e);
        }
    }
}
