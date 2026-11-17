import { createHash, createHmac } from 'crypto';

export const KEY_HEADER = 'Pingpong-Key';
export const SIGNATURE_HEADER = 'Pingpong-Signature';

/**
 * The `Pingpong-Signature` header of an API request: `t=<unix time>,v1=<hex HMAC-SHA256>` of
 * `{t}.{METHOD}.{path}.{hex SHA-256 of the body}` with the project's secret. The secret itself is
 * never sent. See "Signing API requests" in Pingpong's docs/protocol.md.
 */
export const signRequest = (
    secret,
    { method, path, body = '' },
    timestamp = Math.floor(Date.now() / 1000),
) => {
    const bodyHash = createHash('sha256').update(body).digest('hex');
    const subject = `${timestamp}.${method.toUpperCase()}.${path}.${bodyHash}`;
    const signature = createHmac('sha256', secret).update(subject).digest('hex');
    return `t=${timestamp},v1=${signature}`;
};
