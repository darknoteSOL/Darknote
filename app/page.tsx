'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { encryptMessage, generateNoteId, deriveEncryptionKeyFromSignature } from '@/lib/crypto';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export default function Home() {
  const { publicKey, signMessage, connected } = useWallet();
  const [message, setMessage] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [noteUrl, setNoteUrl] = useState('');
  const [error, setError] = useState('');
  const [selfDestruct, setSelfDestruct] = useState(true);
  const [maxReads, setMaxReads] = useState<number | null>(null);
  const [hasEncryptionKey, setHasEncryptionKey] = useState<boolean | null>(null);
  const [checkingKey, setCheckingKey] = useState(false);


  // Check if user has registered encryption key when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      checkForEncryptionKey();
    } else {
      setHasEncryptionKey(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey]);

  const checkForEncryptionKey = async () => {
    if (!publicKey) return;

    setCheckingKey(true);
    try {
      const response = await fetch(`/api/keys/${publicKey.toBase58()}`);
      setHasEncryptionKey(response.ok);
    } catch {
      setHasEncryptionKey(false);
    } finally {
      setCheckingKey(false);
    }
  };

  const handleRegisterKey = async () => {
    if (!publicKey || !signMessage) return;

    setCheckingKey(true);
    try {
      const { publicKey: encPubKey } = await deriveEncryptionKeyFromSignature(
        signMessage,
        publicKey.toBase58()
      );

      const response = await fetch('/api/keys/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          encryptionPublicKey: encPubKey,
        }),
      });

      if (response.ok) {
        setHasEncryptionKey(true);
      } else {
        throw new Error('Failed to register key');
      }
    } catch (err) {
      console.error('Key registration error:', err);
      alert('Failed to register encryption key. Please try again.');
    } finally {
      setCheckingKey(false);
    }
  };

  const handleCreateNote = async () => {
    setError('');
    setNoteUrl('');

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    if (!recipientAddress.trim()) {
      setError('Please enter a recipient address');
      return;
    }

    try {
      new PublicKey(recipientAddress);
    } catch {
      setError('Invalid Solana address');
      return;
    }

    setLoading(true);

    try {
      let x25519PublicKey: string;

      try {
        const keyResponse = await fetch(`/api/keys/${recipientAddress}`);

        if (keyResponse.ok) {
          const keyData = await keyResponse.json();
          x25519PublicKey = keyData.encryptionPublicKey;
        } else {
          setError(
            `Recipient hasn't registered their encryption key yet. Ask them to visit ${window.location.origin}/keys to register.`
          );
          setLoading(false);
          return;
        }
      } catch {
        setError('Failed to look up recipient encryption key');
        setLoading(false);
        return;
      }

      const encrypted = encryptMessage(message, x25519PublicKey);
      const noteId = generateNoteId();

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: noteId,
          ...encrypted,
          recipientAddress,
          selfDestruct,
          maxReads,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create note');
      }

      const url = `${window.location.origin}/note/${noteId}`;
      setNoteUrl(url);

      setMessage('');
      setRecipientAddress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
    } finally {
      setLoading(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(noteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Animated Grid Background - Homepage only */}
      <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 w-[200%] h-[200%] animate-[gridMove_30s_linear_infinite]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <div className="h-screen p-4 overflow-hidden">
        {/* Header Bar - Top */}
        <div className="absolute top-4 right-4 flex items-center gap-3 animate-[fadeIn_0.6s_ease-out_1s_forwards] opacity-0">
          <button
            onClick={() => {
              navigator.clipboard.writeText('...........................pump');
            }}
            className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-lg px-4 py-2 text-gray-300 hover:text-gray-100 hover:border-zinc-700 text-sm font-mono transition cursor-pointer"
          >
            CA: ...........................pump
          </button>
          <WalletMultiButton />
        </div>

        <div className="flex items-center justify-center h-screen">
          <div className="w-full max-w-2xl animate-fadeIn">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-4">
                <img
                  src="/darknote.jpg"
                  alt="DarkNote"
                  className="w-14 h-14 rounded-lg border border-zinc-700"
                />
                <h1 className="text-6xl font-black tracking-wider" style={{ fontFamily: 'var(--font-orbitron)' }}>
                  <span className="bg-gradient-to-r from-zinc-600 to-zinc-400 bg-clip-text text-transparent hover:from-zinc-500 hover:to-zinc-300 hover:drop-shadow-[0_0_10px_rgba(161,161,170,0.5)] transition-all cursor-pointer">
                    DARK
                  </span>
                  <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent hover:from-purple-300 hover:to-purple-500 hover:drop-shadow-[0_0_10px_rgba(192,132,252,0.5)] transition-all cursor-pointer">
                    NOTE
                  </span>
                </h1>
              </div>
              <p className="text-gray-400 text-sm mb-6">
                Send a private note to anyone on Solana.
              </p>

              {/* Links */}
              <div className="flex items-center justify-center gap-4">
                <a
                  href="https://x.com/darknotesol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 transition text-xs"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>@darknoteSOL</span>
                </a>
                <span className="text-gray-700">•</span>
                <a
                  href="https://github.com/darknoteSOL/darknote"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 transition text-xs"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>GitHub</span>
                </a>
                <span className="text-gray-700">•</span>
                <a
                  href="/faq"
                  className="text-gray-500 hover:text-gray-300 transition text-xs"
                >
                  FAQ
                </a>
              </div>
            </div>

          {/* Wallet Connection & Key Status */}
          {connected && (
            <div className="mb-6">
              {checkingKey ? (
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-lg p-4 text-center">
                  <p className="text-gray-400 text-sm">Checking encryption key...</p>
                </div>
              ) : hasEncryptionKey === false ? (
                <div className="bg-yellow-500/10 backdrop-blur-xl border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-yellow-400 text-sm font-medium mb-1">One-time setup required</p>
                      <p className="text-yellow-300/80 text-xs mb-3">
                        To receive encrypted messages, you need to generate a one-time public key.
                        This is crucial for zero-knowledge encryption and only needs to be done once.
                      </p>
                      <button
                        onClick={handleRegisterKey}
                        className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 text-xs font-medium rounded-md transition"
                      >
                        Generate Encryption Key
                      </button>
                    </div>
                  </div>
                </div>
              ) : hasEncryptionKey === true ? (
                <div className="bg-green-500/10 backdrop-blur-xl border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-green-400 text-sm">Encryption key registered • Ready to receive messages</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Main Card */}
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-6 shadow-2xl">
            {!noteUrl ? (
              <>

                {/* Recipient Address */}
                <div className="mb-5">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Recipient Solana Address
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="Enter Solana wallet address..."
                    className="w-full px-4 py-3 bg-black/50 border border-zinc-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 font-mono text-sm transition"
                  />
                </div>

                {/* Message */}
                <div className="mb-5">
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Secret Message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your encrypted message..."
                    rows={6}
                    className="w-full px-4 py-3 bg-black/50 border border-zinc-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 resize-none transition text-sm"
                  />
                </div>

                {/* Self-Destruct Options */}
                <div className="mb-5 p-4 bg-black/30 border border-zinc-800 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-medium text-gray-400">Self-Destruct</label>
                    <button
                      onClick={() => setSelfDestruct(!selfDestruct)}
                      className={`relative w-11 h-6 rounded-full transition ${
                        selfDestruct ? 'bg-purple-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition transform ${
                          selfDestruct ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {selfDestruct && (
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Max Reads (leave empty to self-destruct on first decrypt)
                      </label>
                      <input
                        type="number"
                        value={maxReads ?? ''}
                        onChange={(e) => setMaxReads(e.target.value ? Number(e.target.value) : null)}
                        placeholder="e.g. 3"
                        min="1"
                        max="100"
                        className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:border-zinc-500 placeholder-gray-600"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {maxReads ? `Note will self-destruct after ${maxReads} read(s)` : 'Note will self-destruct after being decrypted once'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-5 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-xs">
                    {error}
                  </div>
                )}

                {/* Create Button */}
                <button
                  onClick={handleCreateNote}
                  disabled={loading}
                  className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? 'Creating encrypted note...' : 'Create Encrypted Note'}
                </button>
              </>
            ) : (
              <>
                {/* Success State */}
                <div className="text-center">
                  <div className="mb-4 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h2 className="text-lg font-bold text-white">Note Created!</h2>
                  </div>
                  <p className="text-gray-400 text-xs mb-4">Share this link with the recipient</p>

                  {/* URL Display */}
                  <div className="mb-5 p-4 bg-black/50 border border-zinc-700 rounded-lg">
                    <p className="text-xs text-gray-300 break-all font-mono">{noteUrl}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={copyToClipboard}
                      className="flex-1 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-200 active:scale-95 transition-all duration-150 text-sm"
                    >
                      {copied ? '✓ Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={() => setNoteUrl('')}
                      className="flex-1 py-3 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition text-sm"
                    >
                      Create Another
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* How It Works */}
          <div className="mt-12 mb-2">
            <h3 className="text-center text-xl font-bold text-white mb-6">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1 */}
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-5 text-center">
                <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-sm font-bold text-gray-400">1</span>
                </div>
                <h4 className="text-white font-semibold mb-2 text-xs">Recipient Registers Key</h4>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Connect wallet and generate a one-time public key. Only needs to be done once.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-5 text-center">
                <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-sm font-bold text-gray-400">2</span>
                </div>
                <h4 className="text-white font-semibold mb-2 text-xs">You Send Encrypted Message</h4>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Enter recipient&apos;s wallet and message. We encrypt it with their public key.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-xl p-5 text-center">
                <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-sm font-bold text-gray-400">3</span>
                </div>
                <h4 className="text-white font-semibold mb-2 text-xs">Recipient Decrypts & Reads</h4>
                <p className="text-gray-400 text-xs leading-relaxed">
                  Connect wallet to decrypt and read. Optionally watch it self-destruct.
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Footer - Bottom of page */}
        <div className="text-center pb-2 text-gray-500 text-xs">
          <p>End-to-end encrypted • Zero-knowledge • Client-side encryption</p>
        </div>
        {/* Version */}
        <div className="absolute bottom-4 right-4 group">
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-300">
            {process.env.NEXT_PUBLIC_GIT_SHA || 'dev'}
          </div>
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-300 whitespace-nowrap">
              Verifies deployed code matches GitHub commit
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
