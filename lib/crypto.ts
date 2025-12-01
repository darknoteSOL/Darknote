import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

/**
 * TRUE ZERO-KNOWLEDGE ASYMMETRIC ENCRYPTION
 *
 * Uses NaCl box (X25519 key agreement + XSalsa20-Poly1305 AEAD)
 *
 * Flow:
 * 1. Sender generates ephemeral keypair (forward secrecy)
 * 2. Encrypts with recipient's public X25519 key
 * 3. Server stores: ciphertext + ephemeral public key
 * 4. Only recipient's private key can decrypt
 *
 * Benefits:
 * - No passwords in URLs
 * - Forward secrecy (ephemeral sender key)
 * - Only wallet owner can decrypt
 * - Server literally cannot decrypt
 */

/**
 * Encrypt message for recipient using NaCl box
 * Generates ephemeral keypair for forward secrecy
 */
export function encryptMessage(
  message: string,
  recipientPublicKey: string
): {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
} {
  // Validate recipient public key
  const recipientPubKeyBytes = decodeBase64(recipientPublicKey);
  if (recipientPubKeyBytes.length !== 32) {
    throw new Error('Invalid recipient public key (must be 32 bytes)');
  }

  // Generate ephemeral keypair for THIS message only (forward secrecy)
  const ephemeralKeypair = nacl.box.keyPair();

  // Generate random nonce
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Encrypt using NaCl box (X25519 + XSalsa20-Poly1305)
  const messageBytes = decodeUTF8(message);
  const encrypted = nacl.box(
    messageBytes,
    nonce,
    recipientPubKeyBytes,
    ephemeralKeypair.secretKey
  );

  if (!encrypted) {
    throw new Error('Encryption failed');
  }

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
    ephemeralPublicKey: encodeBase64(ephemeralKeypair.publicKey),
  };
}

/**
 * Decrypt message using recipient's secret key
 */
export function decryptMessage(
  ciphertext: string,
  nonce: string,
  ephemeralPublicKey: string,
  recipientSecretKey: string
): string {
  try {
    const ciphertextBytes = decodeBase64(ciphertext);
    const nonceBytes = decodeBase64(nonce);
    const ephemeralPubKeyBytes = decodeBase64(ephemeralPublicKey);
    const recipientSecretKeyBytes = decodeBase64(recipientSecretKey);

    // Decrypt using NaCl box
    const decrypted = nacl.box.open(
      ciphertextBytes,
      nonceBytes,
      ephemeralPubKeyBytes,
      recipientSecretKeyBytes
    );

    if (!decrypted) {
      throw new Error('Decryption failed - invalid key or corrupted data');
    }

    return encodeUTF8(decrypted);
  } catch (error) {
    throw new Error(`Decryption failed: ${error}`);
  }
}

/**
 * Derive X25519 encryption keypair from wallet signature
 *
 * IMPORTANT: This is a workaround since we can't directly convert Ed25519 secret keys
 * to X25519 secret keys (wallets don't expose their Ed25519 private keys).
 *
 * Instead, we:
 * 1. Ask wallet to sign a deterministic message
 * 2. Hash the signature to create a 32-byte seed
 * 3. Generate X25519 keypair from that seed
 *
 * This means the encryption key is DERIVED from the wallet, not CONVERTED from it.
 * Same wallet signature → same encryption keypair (deterministic).
 *
 * @param signMessage - Wallet's signMessage function
 * @param walletAddress - Base58 Solana wallet address
 * @returns X25519 keypair for encryption
 */
export async function deriveEncryptionKeyFromSignature(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  walletAddress: string
): Promise<{ publicKey: string; secretKey: string }> {
  // Create deterministic message to sign
  const message = decodeUTF8(`DarkNote encryption key for ${walletAddress}`);

  // Get signature (proves wallet ownership)
  const signature = await signMessage(message);

  // Use signature as seed for keypair (deterministic)
  const seed = nacl.hash(signature).slice(0, 32);
  const keypair = nacl.box.keyPair.fromSecretKey(seed);

  return {
    publicKey: encodeBase64(keypair.publicKey),
    secretKey: encodeBase64(keypair.secretKey),
  };
}

/**
 * Generate a random note ID
 */
export function generateNoteId(): string {
  const bytes = nacl.randomBytes(16);
  return encodeBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
