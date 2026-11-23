import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { signQrCredential } from "@/lib/qr/signer";
import { QrVerificationError, verifyQrCredential } from "@/lib/qr/verifier";

const SECRET_K1 = "test-signing-secret-k1-at-least-32-chars-long";
const SECRET_K2 = "test-signing-secret-k2-at-least-32-chars-long";
const KEYRING = { k1: SECRET_K1, k2: SECRET_K2 };
const ISS = "trchr:office";
const AUD = "trchr:attendance";

describe("QR credential signing and verification", () => {
  it("signs a credential with HS256 and the configured kid", async () => {
    const token = await signQrCredential(
      {
        iss: ISS,
        aud: AUD,
        kid: "k1",
        checkpointId: "11111111-1111-4111-8111-111111111111",
        action: "TIME_IN",
        credentialVersion: 2,
        expiresAtUtc: new Date(Date.now() + 60_000),
      },
      SECRET_K1,
    );

    const verified = await verifyQrCredential(token, {
      issuer: ISS,
      audience: AUD,
      keyring: KEYRING,
    });

    expect(verified.kid).toBe("k1");
    expect(verified.checkpointId).toBe("11111111-1111-4111-8111-111111111111");
    expect(verified.action).toBe("TIME_IN");
    expect(verified.credentialVersion).toBe(2);
    expect(verified.expiresAtUtc).toBeInstanceOf(Date);
  });

  it("rejects a token whose algorithm is not in the HS256 allowlist", async () => {
    const hs512Token = await new SignJWT({
      checkpointId: "11111111-1111-4111-8111-111111111111",
      action: "TIME_IN",
      credentialVersion: 1,
    })
      .setProtectedHeader({ alg: "HS512", kid: "k1" })
      .setIssuer(ISS)
      .setAudience(AUD)
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(SECRET_K1));

    await expect(
      verifyQrCredential(hs512Token, { issuer: ISS, audience: AUD, keyring: KEYRING }),
    ).rejects.toThrowError(QrVerificationError);
  });

  it("rejects an expired or not-yet-valid credential (exp, nbf)", async () => {
    const expired = await signQrCredential(
      {
        iss: ISS,
        aud: AUD,
        kid: "k1",
        checkpointId: "11111111-1111-4111-8111-111111111111",
        action: "TIME_OUT",
        credentialVersion: 1,
        expiresAtUtc: new Date(Date.now() - 10_000),
      },
      SECRET_K1,
    );

    await expect(
      verifyQrCredential(expired, { issuer: ISS, audience: AUD, keyring: KEYRING }),
    ).rejects.toMatchObject({ code: "QR_EXPIRED" });

    const future = await signQrCredential(
      {
        iss: ISS,
        aud: AUD,
        kid: "k1",
        checkpointId: "11111111-1111-4111-8111-111111111111",
        action: "TIME_OUT",
        credentialVersion: 1,
        notBeforeUtc: new Date(Date.now() + 60_000),
        expiresAtUtc: new Date(Date.now() + 120_000),
      },
      SECRET_K1,
    );

    await expect(
      verifyQrCredential(future, { issuer: ISS, audience: AUD, keyring: KEYRING }),
    ).rejects.toMatchObject({ code: "QR_INVALID" });
  });

  it("rejects an unexpected issuer or audience", async () => {
    const token = await signQrCredential(
      {
        iss: "other:issuer",
        aud: AUD,
        kid: "k1",
        checkpointId: "11111111-1111-4111-8111-111111111111",
        action: "TIME_IN",
        credentialVersion: 1,
        expiresAtUtc: new Date(Date.now() + 60_000),
      },
      SECRET_K1,
    );

    await expect(
      verifyQrCredential(token, { issuer: ISS, audience: AUD, keyring: KEYRING }),
    ).rejects.toMatchObject({ code: "QR_INVALID" });
  });

  it("rejects a credential signed with an unknown or revoked kid", async () => {
    const token = await signQrCredential(
      {
        iss: ISS,
        aud: AUD,
        kid: "k2",
        checkpointId: "11111111-1111-4111-8111-111111111111",
        action: "TIME_IN",
        credentialVersion: 1,
        expiresAtUtc: new Date(Date.now() + 60_000),
      },
      SECRET_K2,
    );

    await expect(
      verifyQrCredential(token, { issuer: ISS, audience: AUD, keyring: { k1: SECRET_K1 } }),
    ).rejects.toMatchObject({ code: "QR_REVOKED" });
  });

  it("never resolves keys from a token-supplied URL (jku/x5u/jwk headers)", async () => {
    const poisoned = await new SignJWT({
      checkpointId: "11111111-1111-4111-8111-111111111111",
      action: "TIME_IN",
      credentialVersion: 1,
    })
      .setProtectedHeader({ alg: "HS256", kid: "k1", jku: "https://evil.example/jwks.json" })
      .setIssuer(ISS)
      .setAudience(AUD)
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode(SECRET_K1));

    await expect(
      verifyQrCredential(poisoned, { issuer: ISS, audience: AUD, keyring: KEYRING }),
    ).rejects.toMatchObject({ code: "QR_INVALID" });
  });
});
