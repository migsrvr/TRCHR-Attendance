import { describe, it } from "vitest";

describe("QR credential signing and verification", () => {
  it.todo("signs a credential with HS256 and the configured kid");
  it.todo("rejects a token whose algorithm is not in the HS256 allowlist");
  it.todo("rejects an expired or not-yet-valid credential (exp, nbf)");
  it.todo("rejects an unexpected issuer or audience");
  it.todo("rejects a credential whose checkpoint or credentialVersion was revoked");
  it.todo("never resolves keys from a token-supplied URL");
});
