import { useEffect } from 'react';
import { useDashboard } from '../state/store';
import { cleanupImages, assetReferences } from './images';
export function useImageCleanup() {
  const state = useDashboard();
  const refs = state.document ? [...assetReferences(state.document)].sort().join('|') : '';
  useEffect(() => {
    if (state.status === 'ready') void cleanupImages().catch(() => {});
  }, [refs, state.status]);
}
