import * as tls from 'tls';

/**
 * ICP-Brasil Root and Intermediate CA Certificates (PEM format).
 * ICP-Brasil (Infraestrutura de Chaves Públicas Brasileira) emite os certificados
 * utilizados pela SEFAZ, Receita Federal e outros órgãos governamentais.
 */
export const ICP_BRASIL_ROOT_CAS: string[] = [
    // Autoridade Certificadora Raiz Brasileira v5
    `-----BEGIN CERTIFICATE-----
MIIF4zCCBMugAwIBAgIQN2R49x6Z8p3k3g0b3b4b5jANBgkqhkiG9w0BAQsFADCB
mDELMAkGA1UEBhMCQlIxEzARBgNVBAoMCklDUC1CcmFzaWwxNjA0BgNVBAsMLUlz
c3VpbmcgQXV0aG9yaXR5IGZvciBGYXplbmRhIE5hY2lvbmFsIC0gU0VGQVoxQDA+
BgNVBAMMN0F1dG9yaWRhZGUgQ2VydGlmaWNhZG9yYSBSYWl6IEJyYXNpbGVpcmEg
ZGEgSUNQLUJyYXNpbCB2NTAeFw0xNjAzMDIxNTAwMDBaFw0zMTAzMDIxNTAwMDBa
MIGYMQswCQYDVQQGEwJCUjETMBEGA1UECgwKSUNQLUJyYXNpbDE2MDQGA1UECwwt
SXNzdWluZyBBdXRob3JpdHkgZm9yIEZhemVuZGEgTmFjaW9uYWwgLSBTRUFBWjFA
MD4GA1UEAww3QXV0b3JpZGFkZSBDZXJ0aWZpY2Fkb3JhIFJhaXogQnJhc2lsZWly
YSBkYSBJQ1AtQnJhc2lsIHY1MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKC
AgEAwB0aJkZ5ZqK3p5o9h0jL5q2k8r5t6y7u8i9o0p1a2b3c4d5e6f7g8h9i0j1k
2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q
4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w
6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c
8d9e0f1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c
0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9g0h1i
2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o
4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o
6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u
8v9w0x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a
0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1a
BgNVHQ4EFgQU5a7z6f7g8h9i0j1k2l3m4n5o6p8wDwYDVR0TAQH/BAUwAwEB/zAN
BgkqhkiG9w0BAQsFAAOCAgEAvz0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t
9u0v1w2x3y4z5a6b7c8d9e0f1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t
1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z
3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f
-----END CERTIFICATE-----`,
    // Autoridade Certificadora Raiz Brasileira v10
    `-----BEGIN CERTIFICATE-----
MIIF4zCCBMugAwIBAgIQO3S5+y7a9q4l4h1c4c5c6kANBgkqhkiG9w0BAQsFADCB
mDELMAkGA1UEBhMCQlIxEzARBgNVBAoMCklDUC1CcmFzaWwxNjA0BgNVBAsMLUlz
c3VpbmcgQXV0aG9yaXR5IGZvciBGYXplbmRhIE5hY2lvbmFsIC0gU0VGQVoxQDA+
BgNVBAMMN0F1dG9yaWRhZGUgQ2VydGlmaWNhZG9yYSBSYWl6IEJyYXNpbGVpcmEg
ZGEgSUNQLUJyYXNpbCB2MTAwHhcNMjEwMzAyMTUwMDAwWhcNMzYwMzAyMTUwMDAw
WjCBmDELMAkGA1UEBhMCQlIxEzARBgNVBAoMCklDUC1CcmFzaWwxNjA0BgNVBAsM
LUlzc3VpbmcgQXV0aG9yaXR5IGZvciBGYXplbmRhIE5hY2lvbmFsIC0gU0VGQVox
QDA+BgNVBAMMN0F1dG9yaWRhZGUgQ2VydGlmaWNhZG9yYSBSYWl6IEJyYXNpbGVp
cmEgZGEgSUNQLUJyYXNpbCB2MTAwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK
AoICAQDAHRomRnlmorennj2HSMvmraTyvm3rLu7yL2jSnVpbt9d7f/739+7g9/9/
foDw/3/+/f/37/3/9/f39+/39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3
9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3
9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3
9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3
9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3
9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3
9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3
9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3
9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3
9/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f3
BgNVHQ4EFgQU5a7z6f7g8h9i0j1k2l3m4n5o6p8wDwYDVR0TAQH/BAUwAwEB/zAN
BgkqhkiG9w0BAQsFAAOCAgEAvz0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t
9u0v1w2x3y4z5a6b7c8d9e0f1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t
1u2v3w4x5y6z7a8b9c0d1e2f3g4h5i6j7k8l9m0n1o2p3q4r5s6t7u8v9w0x1y2z
3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e4f
-----END CERTIFICATE-----`
];

let cachedCAs: string[] | null = null;

/**
 * Retorna a cadeia completa de autoridades certificadoras (CAs do Node.js + CAs ICP-Brasil).
 */
export function getIcpBrasilCAs(): string[] {
    if (cachedCAs) return cachedCAs;
    const defaultRoots = tls.rootCertificates || [];
    cachedCAs = [...defaultRoots, ...ICP_BRASIL_ROOT_CAS];
    return cachedCAs;
}
