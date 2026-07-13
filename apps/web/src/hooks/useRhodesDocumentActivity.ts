"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function readAiFilledKeys(metadata: Record<string, unknown> | null | undefined): string[] {
  if (!metadata || !Array.isArray(metadata._ai_filled_keys)) return [];
  return metadata._ai_filled_keys.filter((key): key is string => typeof key === "string");
}

export function useRhodesDocumentActivity({
  documentId,
  documentMetadata,
  contentPlain,
  insightsLoading,
}: {
  documentId: string | null;
  documentMetadata: Record<string, unknown> | null;
  contentPlain: string;
  insightsLoading: boolean;
}) {
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [propertiesNotice, setPropertiesNotice] = useState(false);
  const baselineKeysRef = useRef<string[]>([]);
  const metadataTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef("");

  useEffect(() => {
    baselineKeysRef.current = readAiFilledKeys(documentMetadata);
    setPropertiesNotice(false);
    setMetadataBusy(false);
    lastContentRef.current = contentPlain;
  }, [documentId]);

  useEffect(() => {
    const currentKeys = readAiFilledKeys(documentMetadata);
    const newKeys = currentKeys.filter((key) => !baselineKeysRef.current.includes(key));

    if (newKeys.length > 0) {
      setPropertiesNotice(true);
      setMetadataBusy(false);
      if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);
    }
  }, [documentMetadata]);

  useEffect(() => {
    if (metadataTimerRef.current) clearTimeout(metadataTimerRef.current);

    const trimmed = contentPlain.trim();
    if (trimmed.length < 120 || trimmed === lastContentRef.current) return;

    metadataTimerRef.current = setTimeout(() => {
      lastContentRef.current = trimmed;
      setMetadataBusy(true);

      if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);
      busyTimeoutRef.current = setTimeout(() => {
        setMetadataBusy(false);
      }, 60_000);
    }, 4000);

    return () => {
      if (metadataTimerRef.current) clearTimeout(metadataTimerRef.current);
    };
  }, [contentPlain]);

  useEffect(
    () => () => {
      if (busyTimeoutRef.current) clearTimeout(busyTimeoutRef.current);
    },
    [],
  );

  const dismissPropertiesNotice = useCallback(() => {
    baselineKeysRef.current = readAiFilledKeys(documentMetadata);
    setPropertiesNotice(false);
  }, [documentMetadata]);

  const processing = insightsLoading || metadataBusy;
  const processingLabel = insightsLoading
    ? "Finding related sources…"
    : metadataBusy
      ? "Updating properties…"
      : "Rhodes is working…";

  return {
    processing,
    processingLabel,
    propertiesNotice,
    dismissPropertiesNotice,
  };
}
