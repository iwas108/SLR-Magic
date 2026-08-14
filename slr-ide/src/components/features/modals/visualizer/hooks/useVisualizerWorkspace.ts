import { useState, useEffect, useCallback } from 'react';
import type { SlotId, CanvasBackdrop } from '../types';

export function useVisualizerWorkspace(params: {
  isOpen: boolean;
  currentStep: number;
  setCurrentStep: (step: 1 | 2 | 3 | 4) => void;
  onClose: () => void;
}) {
  const { isOpen, currentStep, setCurrentStep, onClose } = params;

  // 1. Fullscreen mode
  const [isFullscreen, setIsFullscreenState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('slr_visualizer_fullscreen') === 'true';
    }
    return false;
  });

  const setIsFullscreen = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setIsFullscreenState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (typeof window !== 'undefined') {
        localStorage.setItem('slr_visualizer_fullscreen', String(next));
      }
      return next;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, [setIsFullscreen]);

  // 2. Live Split-Screen Preview (Steps 2 & 3)
  const [showLivePreview, setShowLivePreview] = useState<boolean>(true);
  const toggleLivePreview = useCallback(() => {
    setShowLivePreview(prev => !prev);
  }, []);

  // 3. Zen / Theater Mode (Step 4 - collapses export sidebar)
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const toggleZenMode = useCallback(() => {
    setIsZenMode(prev => !prev);
  }, []);

  // 4. Canvas Stage Backdrop Mode
  const [canvasBackdrop, setCanvasBackdrop] = useState<CanvasBackdrop>('slate');

  // 5. Single-Subfigure Deep Inspector (Slot Zoom)
  const [inspectedSlot, setInspectedSlot] = useState<SlotId | null>(null);

  // 6. Keyboard Shortcuts Cheatsheet Modal
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );

      // Escape key handling with hierarchical exit
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (inspectedSlot !== null) {
          setInspectedSlot(null);
        } else if (isZenMode) {
          setIsZenMode(false);
        } else {
          onClose();
        }
        return;
      }

      // Ignore other single-letter shortcuts when typing in an input
      if (isInput) return;

      // Fullscreen shortcut: Shift + F
      if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // Zen Mode shortcut: Z / z
      if (e.key === 'z' || e.key === 'Z') {
        if (currentStep === 4) {
          e.preventDefault();
          toggleZenMode();
        }
        return;
      }

      // Live Preview shortcut: P / p
      if (e.key === 'p' || e.key === 'P') {
        if (currentStep === 2 || currentStep === 3) {
          e.preventDefault();
          toggleLivePreview();
        }
        return;
      }

      // Number keys for step navigation: 1, 2, 3, 4
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        setCurrentStep(Number(e.key) as 1 | 2 | 3 | 4);
        return;
      }

      // ? for shortcuts help
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    currentStep,
    setCurrentStep,
    onClose,
    showShortcutsModal,
    inspectedSlot,
    isZenMode,
    toggleFullscreen,
    toggleZenMode,
    toggleLivePreview
  ]);

  return {
    isFullscreen,
    setIsFullscreen,
    toggleFullscreen,
    showLivePreview,
    setShowLivePreview,
    toggleLivePreview,
    isZenMode,
    setIsZenMode,
    toggleZenMode,
    canvasBackdrop,
    setCanvasBackdrop,
    inspectedSlot,
    setInspectedSlot,
    showShortcutsModal,
    setShowShortcutsModal
  };
}
