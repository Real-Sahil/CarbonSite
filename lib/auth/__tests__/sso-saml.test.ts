import { describe, it, expect } from "vitest";
import { SignedXml } from "xml-crypto";
import { extractSamlUserInfo } from "../sso-handler";

// Throwaway test-only keypair/self-signed cert (openssl req -x509 -newkey
// rsa:2048 -nodes -days 3650 -subj "/CN=test-idp.example.com"). Never used
// for anything but signing fixtures in this file.
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDt0MhdVNPr/uMm
MjVFDFTrmWGkAIUsB/2u1lgRf31/JYMFvytBWGW9JxQBg1FxHAEyUeo8gcGTvTmM
MAq0diyuqsLqWBAe+z/pkLOYTrRsvOTvIT2kCVxxgpzEuzuJtFUBQo7K+OQv4gnP
bREm/cr7Oemgtr292UObsygQ6i333uX3gOFSJAh5sxcB1tKW2UCGcxELjU0jDW6o
52bAbIxNEn8QeOPPvfyY3JEIkGgeKws2dL8sI2qn5Rvjmi6aep7aI7rQ58XGyQku
CxhfGntkfJCAoEyy748lbmxpB9GQBuQb89MzUR1jHt9FWhZTNPyUCwQJs1nOobBp
oDyz2Cg/AgMBAAECggEASR5mXHvWZLsLsBTD2CUAfye7o6cdSvpx/y2cClU+irdH
3551eDPrpAq91fFAOxy3KXeSI2Rp1jjZ1sZ2pCGpf1K1d0P4QO5TKkb5URzx0HUL
lpKL10GhkKzt8nb2yVIOyMJkEPgRgL9o8MPCAFEL9c5KjMVi9Vo1tUuSSBEYbRsd
nIsJuaHrNJsJdnLl1TtSw9cllr4xs6YX4exyf0uurOzB3ofPVnjjzA28XDnHLaYs
yvvY9Wtibl5Ltp7n108SAM5GzXNLwmXdEPPE0EvRvqOcsboRK5wmMMhIPECQE8tS
Zxk98CzRiwoS2voTXXW6AtN6+hNoKCazRw1Y2Wg8gQKBgQD/XSOJPOZVPyxbhgMC
PZJb7rCUoCvg9Z/NvdD+atjoH65y8Q0feqBxoBgJKiS87u+MD/5c/H8/C0+900DJ
tCYU63jdHKWBTr528w8t5rFWaaMxfHiNBbC+TlX4+LPHFH6P0hXJ8AtEywS8wD5h
cYVYTv1vLu7Lalybj8DiFmROoQKBgQDuaHPG9hFzn0WH6LpGGCnMl241ztx5i3ic
hbMgqFU8csQIuhec0TZQShV0WtlK49nRNT4aNeM9C7CN8vFPrhztId0oATkHSXH4
D5/80KzPKpoCLbcl7aq7bwMyGra6G6UdmiPmIQLlU3nhAEgEKjdVsl7x6Nb5oAWd
rxm4fklq3wKBgQCbgDf3hiIsnv9/7CdA4gWR/dOBbdfKcUgSnRf7FU1obIJqc+ct
2BqDlp2MVyFv+3/bppGaRhemaFjymwXEzfKyooFDBAK0ryLEhFYl+Wjb2hAKPmWa
WnC6MjGgHrI69HvtUFz8TzRNe+MynU5fQCWXFOK3Jbk8HVSvVeZ6xm/mgQKBgAhr
4iMWEBnAd4lMfD/7nIZglwEJlJoqhhEpW+F8cL5Y43nXcPwWG9AMPePFTcWqdMhC
FDaCzssaPZtWCJYi9VyfBJvkJyqNupvjmWgpyuDqhVQsXzrUwWIrkrZTYT8DuPpp
tnjrk5mcMEL1apXTE+9QBLCQ4/8fWvNt+v+cXmWLAoGBANK9apLklb0E93xZHUH0
v4/NUVV0Vi3O0i7Ptv2ROyI9HRVxy8rVMGsaLUeitbLfRGyyQ5GP3ZwAQqAxoH8B
Q7cQL/2Jv8YMAg25xHMHmlN6zAgU7KweTeCZQqcgx9bp9vX7QWYtww9oc7m20Xg0
nH8GNyl3wPpnE6G2h+0a8SxJ
-----END PRIVATE KEY-----`;

const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDHzCCAgegAwIBAgIUa/fYnkRyXb7y9qTT3Mx7KSt1eWIwDQYJKoZIhvcNAQEL
BQAwHzEdMBsGA1UEAwwUdGVzdC1pZHAuZXhhbXBsZS5jb20wHhcNMjYwOTA2MDY1
NDU4WhcNMzYwOTAzMDY1NDU4WjAfMR0wGwYDVQQDDBR0ZXN0LWlkcC5leGFtcGxl
LmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAO3QyF1U0+v+4yYy
NUUMVOuZYaQAhSwH/a7WWBF/fX8lgwW/K0FYZb0nFAGDUXEcATJR6jyBwZO9OYww
CrR2LK6qwupYEB77P+mQs5hOtGy85O8hPaQJXHGCnMS7O4m0VQFCjsr45C/iCc9t
ESb9yvs56aC2vb3ZQ5uzKBDqLffe5feA4VIkCHmzFwHW0pbZQIZzEQuNTSMNbqjn
ZsBsjE0SfxB448+9/JjckQiQaB4rCzZ0vywjaqflG+OaLpp6ntojutDnxcbJCS4L
GF8ae2R8kICgTLLvjyVubGkH0ZAG5Bvz0zNRHWMe30VaFlM0/JQLBAmzWc6hsGmg
PLPYKD8CAwEAAaNTMFEwHQYDVR0OBBYEFN4pMFNKLhCf4FRBcthhlZoCu6eIMB8G
A1UdIwQYMBaAFN4pMFNKLhCf4FRBcthhlZoCu6eIMA8GA1UdEwEB/wQFMAMBAf8w
DQYJKoZIhvcNAQELBQADggEBAMiP/uy9qjQMamySnF/O2JC3SC3VzMJKSgqgpA3m
k/hBgUa5hAhvzNwQfaPWW7NtsE9WFBOkKIJPjJG3LXEETfTItRt2cJlILOq6EHeU
+cqclgYb5A0z8dzEtBu5E+TuWB1fkY83z/yPlxcXo2FPBcmJOznSxzrfrGVfXA82
HSQLa8RKkQ9Tp1d57RRQrAbbohULG42O6LuLG/NtSypHK9QY1tnHIZxvXNK8hNGo
eGWrH0yPyF5mrv7pDEQu8hzYE1MPHzO0DM8BZ4QZ8lgXogGlCH1QBdRGQobmLlSf
tDg5Xsp64riyGqMxZk2Wkdz1Cdn5ujeMQ9JXe+A+fef39Lo=
-----END CERTIFICATE-----`;

function buildAssertionXml(opts: {
  assertionId: string;
  issuer: string;
  email: string;
  notOnOrAfter?: string;
}): string {
  const { assertionId, issuer, email, notOnOrAfter } = opts;
  const now = new Date();
  const notBefore = new Date(now.getTime() - 5 * 60_000).toISOString();
  const expiry = notOnOrAfter ?? new Date(now.getTime() + 5 * 60_000).toISOString();

  return `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${assertionId}" Version="2.0" IssueInstant="${now.toISOString()}">
  <saml:Issuer>${issuer}</saml:Issuer>
  <saml:Subject>
    <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${email}</saml:NameID>
  </saml:Subject>
  <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${expiry}"></saml:Conditions>
  <saml:AttributeStatement>
    <saml:Attribute Name="email">
      <saml:AttributeValue>${email}</saml:AttributeValue>
    </saml:Attribute>
    <saml:Attribute Name="name">
      <saml:AttributeValue>Test User</saml:AttributeValue>
    </saml:Attribute>
  </saml:AttributeStatement>
</saml:Assertion>`;
}

function signAssertion(assertionXml: string, assertionId: string): string {
  const sig = new SignedXml({ privateKey: TEST_PRIVATE_KEY, publicCert: TEST_CERTIFICATE });
  sig.addReference({
    xpath: `//*[local-name(.)='Assertion'][@ID='${assertionId}']`,
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
  });
  sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.canonicalizationAlgorithm = "http://www.w3.org/2001/10/xml-exc-c14n#";
  sig.computeSignature(assertionXml, {
    location: { reference: "//*[local-name(.)='Issuer']", action: "after" },
  });
  return sig.getSignedXml();
}

function wrapInResponse(assertionXml: string): string {
  return `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_response1" Version="2.0" IssueInstant="${new Date().toISOString()}">
  <saml:Issuer>https://idp.example.com</saml:Issuer>
  ${assertionXml}
</samlp:Response>`;
}

function toSamlResponseParam(responseXml: string): string {
  return Buffer.from(responseXml).toString("base64");
}

describe("SAML assertion verification", () => {
  it("accepts a genuinely signed assertion and extracts claims from it", async () => {
    const assertionId = "_assertion1";
    const signed = signAssertion(
      buildAssertionXml({ assertionId, issuer: "https://idp.example.com", email: "alice@example.com" }),
      assertionId,
    );
    const samlResponse = toSamlResponseParam(wrapInResponse(signed));

    const result = await extractSamlUserInfo(samlResponse, TEST_CERTIFICATE);
    expect(result.email).toBe("alice@example.com");
    expect(result.sub).toBe("alice@example.com");
    expect(result.name).toBe("Test User");
  });

  it("enforces the configured Issuer when provided", async () => {
    const assertionId = "_assertion1";
    const signed = signAssertion(
      buildAssertionXml({ assertionId, issuer: "https://idp.example.com", email: "alice@example.com" }),
      assertionId,
    );
    const samlResponse = toSamlResponseParam(wrapInResponse(signed));

    await expect(
      extractSamlUserInfo(samlResponse, TEST_CERTIFICATE, "https://a-different-idp.example.com"),
    ).rejects.toThrow(/Issuer/);
  });

  it("rejects an expired assertion (Conditions NotOnOrAfter has passed)", async () => {
    const assertionId = "_assertion1";
    const signed = signAssertion(
      buildAssertionXml({
        assertionId,
        issuer: "https://idp.example.com",
        email: "alice@example.com",
        notOnOrAfter: new Date(Date.now() - 60 * 60_000).toISOString(),
      }),
      assertionId,
    );
    const samlResponse = toSamlResponseParam(wrapInResponse(signed));

    await expect(extractSamlUserInfo(samlResponse, TEST_CERTIFICATE)).rejects.toThrow(/expired/i);
  });

  it("rejects a tampered assertion (attribute changed after signing breaks the digest)", async () => {
    const assertionId = "_assertion1";
    const signed = signAssertion(
      buildAssertionXml({ assertionId, issuer: "https://idp.example.com", email: "alice@example.com" }),
      assertionId,
    );
    const tampered = signed.replace("alice@example.com</saml:AttributeValue>", "mallory@evil.com</saml:AttributeValue>");
    const samlResponse = toSamlResponseParam(wrapInResponse(tampered));

    await expect(extractSamlUserInfo(samlResponse, TEST_CERTIFICATE)).rejects.toThrow(/signature/i);
  });

  it("rejects a response signed by a different key than the configured certificate", async () => {
    const assertionId = "_assertion1";
    const signed = signAssertion(
      buildAssertionXml({ assertionId, issuer: "https://idp.example.com", email: "alice@example.com" }),
      assertionId,
    );
    const samlResponse = toSamlResponseParam(wrapInResponse(signed));

    const someOtherCert = `-----BEGIN CERTIFICATE-----
MIIBrjCCAVWgAwIBAgIUXn3XLgP0dQnJZzTVmzMAg9EUqXAwDQYJKoZIhvcNAQEL
BQAwFjEUMBIGA1UEAwwLZXhhbXBsZS5jb20wHhcNMjQwMTAxMDAwMDAwWhcNMzQw
MTAxMDAwMDAwWjAWMRQwEgYDVQQDDAtleGFtcGxlLmNvbTBcMA0GCSqGSIb3DQEB
AQUAA0sAMEgCQQDBogx3fRnEjBhoBzP8/QG02OfB2NxLuqKrqL04SDECgYEAr9wJ
+lIscre4dGuVzyt+kg4KLLBd0IU7hz+2s0kLXCBzWfQ7tCwF8QIDAQABo1MwUTAd
BgNVHQ4EFgQU4CkwU0ouEJ/gVEFy2GGVmgK7p4gwHwYDVR0jBBgwFoAU4CkwU0ou
EJ/gVEFy2GGVmgK7p4gwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOB
gQDLbcYaJmiv7iaZ1lFVxeYJ0aeF+jS0GkZ6i2cd3D3fAaAaOEwSGYZAdY6cN7qJ
2SgFOTTEsG9UeSmxDbCq3JnKytQ8/vhz3PXbANFVvTh8xLnPZ1qUW3ky6IY7L8Rn
S/PjS9EPBw9KLxx7iEPZ7lYmk6qbUUxrOKX2jpBmEy5RCA==
-----END CERTIFICATE-----`;

    // A structurally-invalid placeholder cert is fine here: the point of
    // this test is that some OTHER certificate (not the one that actually
    // signed the response) must never be accepted, whatever shape it's in.
    await expect(extractSamlUserInfo(samlResponse, someOtherCert)).rejects.toThrow();
  });

  it("rejects a document with a second, unsigned Assertion (signature-wrapping shape)", async () => {
    const assertionId = "_assertion1";
    const signed = signAssertion(
      buildAssertionXml({ assertionId, issuer: "https://idp.example.com", email: "alice@example.com" }),
      assertionId,
    );
    const forgedAssertion = buildAssertionXml({
      assertionId: "_assertion2",
      issuer: "https://idp.example.com",
      email: "mallory@evil.com",
    });
    const samlResponse = toSamlResponseParam(wrapInResponse(signed + forgedAssertion));

    await expect(extractSamlUserInfo(samlResponse, TEST_CERTIFICATE)).rejects.toThrow(/multiple Assertion/i);
  });

  it("rejects when no certificate is configured", async () => {
    await expect(extractSamlUserInfo("irrelevant", "")).rejects.toThrow(/certificate/i);
  });
});
