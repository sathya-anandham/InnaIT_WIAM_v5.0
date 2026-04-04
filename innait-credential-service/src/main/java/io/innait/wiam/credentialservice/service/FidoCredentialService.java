package io.innait.wiam.credentialservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.webauthn4j.WebAuthnManager;
import com.webauthn4j.credential.CredentialRecordImpl;
import com.webauthn4j.converter.AttestedCredentialDataConverter;
import com.webauthn4j.converter.util.ObjectConverter;
import com.webauthn4j.data.*;
import com.webauthn4j.data.attestation.AttestationObject;
import com.webauthn4j.data.attestation.authenticator.AttestedCredentialData;
import com.webauthn4j.data.attestation.statement.COSEAlgorithmIdentifier;
import com.webauthn4j.data.client.Origin;
import com.webauthn4j.data.client.challenge.Challenge;
import com.webauthn4j.data.client.challenge.DefaultChallenge;
import com.webauthn4j.server.ServerProperty;
import com.webauthn4j.validator.exception.ValidationException;
import io.innait.wiam.common.constant.CredentialStatus;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.common.redis.RedisCacheKeys;
import io.innait.wiam.credentialservice.dto.*;
import io.innait.wiam.credentialservice.entity.DeviceAssignment;
import io.innait.wiam.credentialservice.entity.FidoCredential;
import io.innait.wiam.credentialservice.repository.DeviceAssignmentRepository;
import io.innait.wiam.credentialservice.repository.FidoCredentialRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class FidoCredentialService {

    private static final Logger log = LoggerFactory.getLogger(FidoCredentialService.class);

    private final FidoCredentialRepository fidoRepo;
    private final DeviceAssignmentRepository assignmentRepo;
    private final StringRedisTemplate redisTemplate;
    private final EventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final WebAuthnManager webAuthnManager;
    private final ObjectConverter objectConverter;
    private final DeviceValidationService deviceValidationService;
    private final DeviceLifecycleService deviceLifecycleService;
    private final DeviceAssignmentService deviceAssignmentService;
    private final MagicLinkBootstrapService magicLinkBootstrapService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${innait.fido.rp-id:innait.io}")
    private String rpId;

    @Value("${innait.fido.rp-name:InnaIT WIAM}")
    private String rpName;

    @Value("${innait.fido.origin:https://innait.io}")
    private String origin;

    @org.springframework.beans.factory.annotation.Autowired
    public FidoCredentialService(FidoCredentialRepository fidoRepo,
                                  DeviceAssignmentRepository assignmentRepo,
                                  StringRedisTemplate redisTemplate,
                                  EventPublisher eventPublisher,
                                  ObjectMapper objectMapper,
                                  DeviceValidationService deviceValidationService,
                                  DeviceLifecycleService deviceLifecycleService,
                                  DeviceAssignmentService deviceAssignmentService,
                                  MagicLinkBootstrapService magicLinkBootstrapService) {
        this.fidoRepo = fidoRepo;
        this.assignmentRepo = assignmentRepo;
        this.redisTemplate = redisTemplate;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
        this.deviceValidationService = deviceValidationService;
        this.deviceLifecycleService = deviceLifecycleService;
        this.deviceAssignmentService = deviceAssignmentService;
        this.magicLinkBootstrapService = magicLinkBootstrapService;
        this.objectConverter = new ObjectConverter();
        this.webAuthnManager = WebAuthnManager.createNonStrictWebAuthnManager(objectConverter);
    }

    // visible for testing
    FidoCredentialService(FidoCredentialRepository fidoRepo,
                           DeviceAssignmentRepository assignmentRepo,
                           StringRedisTemplate redisTemplate,
                           EventPublisher eventPublisher,
                           ObjectMapper objectMapper,
                           WebAuthnManager webAuthnManager,
                           ObjectConverter objectConverter) {
        this.fidoRepo = fidoRepo;
        this.assignmentRepo = assignmentRepo;
        this.redisTemplate = redisTemplate;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
        this.webAuthnManager = webAuthnManager;
        this.objectConverter = objectConverter;
        this.deviceValidationService = null;
        this.deviceLifecycleService = null;
        this.deviceAssignmentService = null;
        this.magicLinkBootstrapService = null;
    }

    @Transactional
    public FidoRegistrationBeginResponse beginRegistration(UUID accountId, String displayName) {
        UUID txnId = UUID.randomUUID();
        byte[] challengeBytes = new byte[32];
        secureRandom.nextBytes(challengeBytes);

        // Store challenge in Redis
        String challengeB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(challengeBytes);
        String redisKey = RedisCacheKeys.fidoChallengeKey(txnId);
        redisTemplate.opsForValue().set(redisKey, challengeB64, RedisCacheKeys.FIDO_CHALLENGE_TTL, TimeUnit.SECONDS);

        // Build PublicKeyCredentialCreationOptions as JSON
        Map<String, Object> options = buildCreationOptions(accountId, displayName, challengeB64);

        try {
            String optionsJson = objectMapper.writeValueAsString(options);
            log.debug("FIDO registration begun for account {} with txnId {}", accountId, txnId);
            return new FidoRegistrationBeginResponse(txnId, optionsJson);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize creation options", e);
        }
    }

    @Transactional
    public FidoCredentialResponse completeRegistration(FidoRegistrationCompleteRequest request) {
        String redisKey = RedisCacheKeys.fidoChallengeKey(request.txnId());
        String storedChallenge = redisTemplate.opsForValue().get(redisKey);
        if (storedChallenge == null) {
            throw new IllegalStateException("Challenge expired or not found for txnId: " + request.txnId());
        }
        redisTemplate.delete(redisKey);

        byte[] challengeBytes = Base64.getUrlDecoder().decode(storedChallenge);
        Challenge challenge = new DefaultChallenge(challengeBytes);

        byte[] attestationObjectBytes = Base64.getUrlDecoder().decode(request.attestationObject());
        byte[] clientDataJSONBytes = Base64.getUrlDecoder().decode(request.clientDataJSON());

        ServerProperty serverProperty = new ServerProperty(
                new Origin(origin), rpId, challenge, null
        );

        RegistrationRequest registrationRequest = new RegistrationRequest(
                attestationObjectBytes, clientDataJSONBytes
        );

        RegistrationParameters registrationParameters = new RegistrationParameters(
                serverProperty, null, false, true
        );

        try {
            RegistrationData registrationData = webAuthnManager.parse(registrationRequest);
            webAuthnManager.validate(registrationData, registrationParameters);

            AttestationObject attestationObject = registrationData.getAttestationObject();
            AttestedCredentialData attestedCredData = attestationObject.getAuthenticatorData()
                    .getAttestedCredentialData();

            // Serialize COSE public key
            AttestedCredentialDataConverter converter = new AttestedCredentialDataConverter(objectConverter);
            byte[] publicKeyCose = converter.convert(attestedCredData);

            FidoCredential credential = new FidoCredential();
            credential.setAccountId(request.accountId());
            credential.setCredentialId(request.credentialId());
            credential.setPublicKeyCose(publicKeyCose);
            credential.setAaguid(uuidFromBytes(attestedCredData.getAaguid().getBytes()));
            credential.setSignCount(attestationObject.getAuthenticatorData().getSignCount());
            credential.setBackupEligible(attestationObject.getAuthenticatorData().isFlagBE());
            credential.setBackupState(attestationObject.getAuthenticatorData().isFlagBS());
            credential.setDisplayName(request.credentialId().substring(0, Math.min(request.credentialId().length(), 32)));
            credential.setCredentialStatus(CredentialStatus.ACTIVE);

            FidoCredential saved = fidoRepo.save(credential);

            publishCredentialEvent(InnaITTopics.CREDENTIAL_ENROLLED, "fido.registered",
                    request.accountId(), saved.getId());

            log.info("FIDO credential registered for account {}, credId {}", request.accountId(), saved.getId());
            return toResponse(saved);

        } catch (ValidationException e) {
            log.warn("FIDO registration validation failed for account {}: {}", request.accountId(), e.getMessage());
            throw new IllegalStateException("WebAuthn registration validation failed: " + e.getMessage(), e);
        }
    }

    @Transactional(readOnly = true)
    public FidoAuthenticationBeginResponse beginAuthentication(UUID accountId) {
        List<FidoCredential> activeCredentials = fidoRepo
                .findByAccountIdAndCredentialStatus(accountId, CredentialStatus.ACTIVE);

        if (activeCredentials.isEmpty()) {
            throw new ResourceNotFoundException("FidoCredential", accountId.toString());
        }

        UUID txnId = UUID.randomUUID();
        byte[] challengeBytes = new byte[32];
        secureRandom.nextBytes(challengeBytes);

        String challengeB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(challengeBytes);
        String redisKey = RedisCacheKeys.fidoChallengeKey(txnId);
        redisTemplate.opsForValue().set(redisKey, challengeB64, RedisCacheKeys.FIDO_CHALLENGE_TTL, TimeUnit.SECONDS);

        Map<String, Object> options = buildRequestOptions(challengeB64, activeCredentials);

        try {
            String optionsJson = objectMapper.writeValueAsString(options);
            log.debug("FIDO authentication begun for account {} with txnId {}", accountId, txnId);
            return new FidoAuthenticationBeginResponse(txnId, optionsJson);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize request options", e);
        }
    }

    @Transactional
    public boolean completeAuthentication(FidoAuthenticationCompleteRequest request) {
        String redisKey = RedisCacheKeys.fidoChallengeKey(request.txnId());
        String storedChallenge = redisTemplate.opsForValue().get(redisKey);
        if (storedChallenge == null) {
            throw new IllegalStateException("Challenge expired or not found for txnId: " + request.txnId());
        }
        redisTemplate.delete(redisKey);

        FidoCredential credential = fidoRepo.findByCredentialId(request.credentialId())
                .orElseThrow(() -> new ResourceNotFoundException("FidoCredential", request.credentialId()));

        if (credential.getCredentialStatus() != CredentialStatus.ACTIVE) {
            throw new IllegalStateException("FIDO credential is not active: " + request.credentialId());
        }

        if (!credential.getAccountId().equals(request.accountId())) {
            throw new IllegalStateException("Credential does not belong to the specified account");
        }

        byte[] challengeBytes = Base64.getUrlDecoder().decode(storedChallenge);
        Challenge challenge = new DefaultChallenge(challengeBytes);

        byte[] authenticatorDataBytes = Base64.getUrlDecoder().decode(request.authenticatorData());
        byte[] clientDataJSONBytes = Base64.getUrlDecoder().decode(request.clientDataJSON());
        byte[] signatureBytes = Base64.getUrlDecoder().decode(request.signature());

        ServerProperty serverProperty = new ServerProperty(
                new Origin(origin), rpId, challenge, null
        );

        // Reconstruct authenticator from stored data
        AttestedCredentialDataConverter converter = new AttestedCredentialDataConverter(objectConverter);
        AttestedCredentialData attestedCredData = converter.convert(credential.getPublicKeyCose());

        CredentialRecordImpl credentialRecord = new CredentialRecordImpl(
                null, null, null, false,
                credential.getSignCount(),
                attestedCredData, null, null, null, null
        );

        AuthenticationRequest authenticationRequest = new AuthenticationRequest(
                request.credentialId().getBytes(),
                authenticatorDataBytes,
                clientDataJSONBytes,
                signatureBytes
        );

        AuthenticationParameters authenticationParameters = new AuthenticationParameters(
                serverProperty, credentialRecord, null, false, true
        );

        try {
            AuthenticationData authenticationData = webAuthnManager.parse(authenticationRequest);
            webAuthnManager.validate(authenticationData, authenticationParameters);

            // Verify sign count (replay protection)
            long newSignCount = authenticationData.getAuthenticatorData().getSignCount();
            if (newSignCount > 0 && newSignCount <= credential.getSignCount()) {
                log.warn("Sign count replay detected for credential {}: stored={}, received={}",
                        credential.getId(), credential.getSignCount(), newSignCount);
                throw new IllegalStateException("Sign count indicates possible credential cloning");
            }

            credential.setSignCount(newSignCount);
            credential.setLastUsedAt(Instant.now());
            credential.setBackupState(authenticationData.getAuthenticatorData().isFlagBS());
            fidoRepo.save(credential);

            log.info("FIDO authentication successful for account {}", request.accountId());
            return true;

        } catch (ValidationException e) {
            log.warn("FIDO authentication validation failed for account {}: {}", request.accountId(), e.getMessage());
            return false;
        }
    }

    @Transactional
    public void revokeCredential(UUID accountId, UUID credentialId) {
        FidoCredential credential = fidoRepo.findById(credentialId)
                .orElseThrow(() -> new ResourceNotFoundException("FidoCredential", credentialId.toString()));

        if (!credential.getAccountId().equals(accountId)) {
            throw new IllegalStateException("Credential does not belong to the specified account");
        }

        credential.setCredentialStatus(CredentialStatus.REVOKED);
        fidoRepo.save(credential);

        publishCredentialEvent(InnaITTopics.CREDENTIAL_REVOKED, "fido.revoked", accountId, credentialId);
        log.info("FIDO credential {} revoked for account {}", credentialId, accountId);
    }

    @Transactional
    public int bulkRevoke(UUID accountId) {
        List<FidoCredential> activeCredentials = fidoRepo
                .findByAccountIdAndCredentialStatus(accountId, CredentialStatus.ACTIVE);

        for (FidoCredential credential : activeCredentials) {
            credential.setCredentialStatus(CredentialStatus.REVOKED);
        }
        fidoRepo.saveAll(activeCredentials);

        if (!activeCredentials.isEmpty()) {
            publishCredentialEvent(InnaITTopics.CREDENTIAL_REVOKED, "fido.bulk_revoked",
                    accountId, null);
        }

        log.info("Bulk revoked {} FIDO credentials for account {}", activeCredentials.size(), accountId);
        return activeCredentials.size();
    }

    @Transactional(readOnly = true)
    public List<FidoCredentialResponse> listCredentials(UUID accountId) {
        return fidoRepo.findByAccountId(accountId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ---- Device-Aware FIDO Enrollment (Bootstrap Flow) ----

    @Transactional
    public FidoRegistrationBeginResponse beginDeviceAwareRegistration(UUID accountId, UUID deviceId,
                                                                       String displayName) {
        // Validate device assignment and eligibility
        deviceValidationService.validateEnrollmentAllowed(accountId, deviceId);

        UUID txnId = UUID.randomUUID();
        byte[] challengeBytes = new byte[32];
        secureRandom.nextBytes(challengeBytes);

        String challengeB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(challengeBytes);
        String redisKey = RedisCacheKeys.fidoChallengeKey(txnId);

        // Store challenge with device context: "challengeB64|deviceId"
        String redisValue = challengeB64 + "|" + deviceId;
        redisTemplate.opsForValue().set(redisKey, redisValue, RedisCacheKeys.FIDO_CHALLENGE_TTL, TimeUnit.SECONDS);

        Map<String, Object> options = buildCreationOptions(accountId, displayName, challengeB64);

        try {
            String optionsJson = objectMapper.writeValueAsString(options);
            log.info("Device-aware FIDO registration begun: account={}, device={}, txnId={}",
                    accountId, deviceId, txnId);
            return new FidoRegistrationBeginResponse(txnId, optionsJson);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize creation options", e);
        }
    }

    @Transactional
    public FidoCredentialResponse completeDeviceAwareRegistration(
            DeviceAwareFidoRegistrationCompleteRequest request) {
        String redisKey = RedisCacheKeys.fidoChallengeKey(request.txnId());
        String storedValue = redisTemplate.opsForValue().get(redisKey);
        if (storedValue == null) {
            throw new IllegalStateException("Challenge expired or not found for txnId: " + request.txnId());
        }
        redisTemplate.delete(redisKey);

        // Parse stored value: "challengeB64|deviceId"
        String[] parts = storedValue.split("\\|", 2);
        String storedChallenge = parts[0];
        UUID storedDeviceId = parts.length > 1 ? UUID.fromString(parts[1]) : null;

        if (storedDeviceId != null && !storedDeviceId.equals(request.deviceId())) {
            throw new IllegalStateException("Device ID mismatch: expected " + storedDeviceId);
        }

        // Re-validate enrollment is still allowed
        deviceValidationService.validateEnrollmentAllowed(request.accountId(), request.deviceId());

        byte[] challengeBytes = Base64.getUrlDecoder().decode(storedChallenge);
        Challenge challenge = new DefaultChallenge(challengeBytes);

        byte[] attestationObjectBytes = Base64.getUrlDecoder().decode(request.attestationObject());
        byte[] clientDataJSONBytes = Base64.getUrlDecoder().decode(request.clientDataJSON());

        ServerProperty serverProperty = new ServerProperty(
                new Origin(origin), rpId, challenge, null
        );

        RegistrationRequest registrationRequest = new RegistrationRequest(
                attestationObjectBytes, clientDataJSONBytes
        );

        RegistrationParameters registrationParameters = new RegistrationParameters(
                serverProperty, null, false, true
        );

        try {
            RegistrationData registrationData = webAuthnManager.parse(registrationRequest);
            webAuthnManager.validate(registrationData, registrationParameters);

            AttestationObject attestationObject = registrationData.getAttestationObject();
            AttestedCredentialData attestedCredData = attestationObject.getAuthenticatorData()
                    .getAttestedCredentialData();

            AttestedCredentialDataConverter converter = new AttestedCredentialDataConverter(objectConverter);
            byte[] publicKeyCose = converter.convert(attestedCredData);

            // Save FIDO credential with device linkage
            FidoCredential credential = new FidoCredential();
            credential.setAccountId(request.accountId());
            credential.setCredentialId(request.credentialId());
            credential.setPublicKeyCose(publicKeyCose);
            credential.setAaguid(uuidFromBytes(attestedCredData.getAaguid().getBytes()));
            credential.setSignCount(attestationObject.getAuthenticatorData().getSignCount());
            credential.setBackupEligible(attestationObject.getAuthenticatorData().isFlagBE());
            credential.setBackupState(attestationObject.getAuthenticatorData().isFlagBS());
            credential.setDisplayName(request.credentialId().substring(
                    0, Math.min(request.credentialId().length(), 32)));
            credential.setCredentialStatus(CredentialStatus.ACTIVE);
            credential.setDeviceId(request.deviceId());

            FidoCredential saved = fidoRepo.save(credential);

            // Update device status → ACTIVE
            deviceLifecycleService.transitionDeviceStatus(request.deviceId(),
                    io.innait.wiam.credentialservice.entity.DeviceStatus.ACTIVE,
                    null, "FIDO enrollment completed");

            // Update assignment status → ACTIVE
            DeviceAssignment assignment = assignmentRepo
                    .findActiveByDeviceAndAccount(request.deviceId(), request.accountId())
                    .orElse(null);
            if (assignment != null) {
                deviceAssignmentService.activateAssignment(assignment.getId());
            }

            // Update bootstrap state: FIDO_ENROLLED=1, BOOTSTRAP_ENABLED=0, FIRST_LOGIN_PENDING=0
            magicLinkBootstrapService.disableBootstrapAfterFidoActivation(request.accountId());

            publishCredentialEvent(InnaITTopics.CREDENTIAL_ENROLLED, "fido.device_aware.registered",
                    request.accountId(), saved.getId());

            log.info("Device-aware FIDO registration complete: account={}, device={}, credId={}",
                    request.accountId(), request.deviceId(), saved.getId());
            return toResponse(saved);

        } catch (ValidationException e) {
            log.warn("Device-aware FIDO registration validation failed: account={}, device={}: {}",
                    request.accountId(), request.deviceId(), e.getMessage());
            throw new IllegalStateException("WebAuthn registration validation failed: " + e.getMessage(), e);
        }
    }

    private Map<String, Object> buildCreationOptions(UUID accountId, String displayName, String challengeB64) {
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("challenge", challengeB64);

        Map<String, Object> rp = new LinkedHashMap<>();
        rp.put("id", rpId);
        rp.put("name", rpName);
        options.put("rp", rp);

        Map<String, Object> user = new LinkedHashMap<>();
        user.put("id", Base64.getUrlEncoder().withoutPadding().encodeToString(uuidToBytes(accountId)));
        user.put("name", accountId.toString());
        user.put("displayName", displayName != null ? displayName : accountId.toString());
        options.put("user", user);

        List<Map<String, Object>> pubKeyCredParams = new ArrayList<>();
        pubKeyCredParams.add(Map.of("type", "public-key", "alg", COSEAlgorithmIdentifier.ES256.getValue()));
        pubKeyCredParams.add(Map.of("type", "public-key", "alg", COSEAlgorithmIdentifier.RS256.getValue()));
        options.put("pubKeyCredParams", pubKeyCredParams);

        options.put("attestation", "direct");

        Map<String, Object> authenticatorSelection = new LinkedHashMap<>();
        authenticatorSelection.put("residentKey", "preferred");
        authenticatorSelection.put("userVerification", "preferred");
        options.put("authenticatorSelection", authenticatorSelection);

        options.put("timeout", 120000);

        return options;
    }

    private Map<String, Object> buildRequestOptions(String challengeB64, List<FidoCredential> credentials) {
        Map<String, Object> options = new LinkedHashMap<>();
        options.put("challenge", challengeB64);
        options.put("rpId", rpId);
        options.put("timeout", 120000);
        options.put("userVerification", "preferred");

        List<Map<String, Object>> allowCredentials = credentials.stream()
                .map(c -> {
                    Map<String, Object> cred = new LinkedHashMap<>();
                    cred.put("type", "public-key");
                    cred.put("id", c.getCredentialId());
                    return cred;
                })
                .collect(Collectors.toList());
        options.put("allowCredentials", allowCredentials);

        return options;
    }

    private FidoCredentialResponse toResponse(FidoCredential credential) {
        return new FidoCredentialResponse(
                credential.getId(),
                credential.getCredentialId(),
                credential.getDisplayName(),
                credential.getCredentialStatus().name(),
                credential.isBackupEligible(),
                credential.isBackupState(),
                credential.getSignCount(),
                credential.getCreatedAt(),
                credential.getLastUsedAt()
        );
    }

    private void publishCredentialEvent(String topic, String eventType, UUID accountId, UUID credentialId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("accountId", accountId.toString());
        payload.put("credentialType", "FIDO2");
        if (credentialId != null) {
            payload.put("credentialId", credentialId.toString());
        }

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType(eventType)
                .tenantId(TenantContext.getTenantId())
                .payload(payload)
                .build();

        eventPublisher.publish(topic, event);
    }

    private static byte[] uuidToBytes(UUID uuid) {
        ByteBuffer buffer = ByteBuffer.allocate(16);
        buffer.putLong(uuid.getMostSignificantBits());
        buffer.putLong(uuid.getLeastSignificantBits());
        return buffer.array();
    }

    private static UUID uuidFromBytes(byte[] bytes) {
        if (bytes == null || bytes.length < 16) {
            return null;
        }
        ByteBuffer buffer = ByteBuffer.wrap(bytes);
        return new UUID(buffer.getLong(), buffer.getLong());
    }
}
