package io.innait.wiam.credentialservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class KekService {

    private static final Logger log = LoggerFactory.getLogger(KekService.class);
    private static final String AES_GCM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int IV_LENGTH = 12;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<Integer, SecretKey> kekVersions = new ConcurrentHashMap<>();

    @Value("${innait.kek.current-version:1}")
    private int currentKekVersion;

    public KekService() {
        // In production, KEK is loaded from Vault at startup.
        // For development/testing, a default key is generated.
    }

    public int getCurrentKekVersion() {
        return currentKekVersion;
    }

    public byte[] generateIv() {
        byte[] iv = new byte[IV_LENGTH];
        secureRandom.nextBytes(iv);
        return iv;
    }

    public byte[] encrypt(byte[] plaintext, byte[] iv, int kekVersion) {
        try {
            SecretKey key = getKey(kekVersion);
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            return cipher.doFinal(plaintext);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to encrypt with KEK version " + kekVersion, e);
        }
    }

    public byte[] decrypt(byte[] ciphertext, byte[] iv, int kekVersion) {
        try {
            SecretKey key = getKey(kekVersion);
            Cipher cipher = Cipher.getInstance(AES_GCM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            return cipher.doFinal(ciphertext);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to decrypt with KEK version " + kekVersion, e);
        }
    }

    public void registerKey(int version, byte[] keyBytes) {
        kekVersions.put(version, new SecretKeySpec(keyBytes, "AES"));
        log.info("Registered KEK version {}", version);
    }

    public void registerKey(int version, String base64Key) {
        registerKey(version, Base64.getDecoder().decode(base64Key));
    }

    private SecretKey getKey(int version) {
        SecretKey key = kekVersions.get(version);
        if (key == null) {
            throw new IllegalStateException("KEK version " + version + " not available. "
                    + "Ensure Vault has been loaded or key has been registered.");
        }
        return key;
    }
}
