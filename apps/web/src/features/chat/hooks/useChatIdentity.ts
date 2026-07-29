import { useState, useEffect } from 'react';
import { trpc } from '../../../lib/trpc';
import { hasKeyPair, loadKeyPair, saveKeyPair } from '../crypto/key-store';
import { generateKeyPair, toBase64, getFingerprint } from '../crypto/crypto';
import { ChatIdentity } from '../types';

export function useChatIdentity() {
  const [isSetUp, setIsSetUp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [keyPair, setKeyPair] = useState<{ publicKey: Uint8Array; privateKey: Uint8Array } | null>(null);
  const [identity, setIdentity] = useState<ChatIdentity | null>(null);

  const { data: serverIdentity, isLoading: isQueryLoading, refetch } = trpc.chat.getMyIdentity.useQuery();
  const registerMutation = trpc.chat.registerIdentity.useMutation();

  useEffect(() => {
    async function checkSetup() {
      setIsLoading(true);
      const hasKeys = await hasKeyPair();
      if (hasKeys && serverIdentity) {
        const keys = await loadKeyPair();
        setKeyPair(keys);
        setIdentity(serverIdentity as any);
        setIsSetUp(true);
      } else {
        setIsSetUp(false);
      }
      setIsLoading(false);
    }

    if (!isQueryLoading) {
      checkSetup();
    }
  }, [serverIdentity, isQueryLoading]);

  const setup = async (displayName: string) => {
    setIsLoading(true);
    try {
      const keys = generateKeyPair();
      await saveKeyPair(keys.publicKey, keys.privateKey);
      
      const pubKeyB64 = toBase64(keys.publicKey);
      const inviteCode = getFingerprint(keys.publicKey);
      
      await registerMutation.mutateAsync({ 
        publicKey: pubKeyB64,
        inviteCode,
        displayName,
      });

      await refetch();
    } catch (error) {
      console.error('Failed to setup identity:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    identity, 
    keyPair, 
    isLoading: isLoading || isQueryLoading, 
    isSetUp, 
    setup 
  };
}
