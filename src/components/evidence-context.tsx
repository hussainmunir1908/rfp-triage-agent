"use client";

import { createContext, useContext } from "react";
import type { Evidence } from "@/lib/types";

export interface EvidenceTarget {
  label: string;
  evidence: Evidence;
}

interface EvidenceContextValue {
  open: (target: EvidenceTarget) => void;
}

export const EvidenceContext = createContext<EvidenceContextValue>({ open: () => {} });

export function useEvidence() {
  return useContext(EvidenceContext);
}
