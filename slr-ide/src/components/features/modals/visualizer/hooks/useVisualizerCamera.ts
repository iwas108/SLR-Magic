import { useState, useCallback } from 'react';
import type { FittingAnchor } from '../types';

export function useVisualizerCamera() {
  // Chart Scale & Zoom (applies to all chart types, 0.5x to 2.0x)
  const [chartScale, setChartScale] = useState<number>(1.0); 

  // Google Maps-Style Pan & 3D Tilt View State
  const [panX, setPanX] = useState<number>(0); // -50% to +50% horizontal center offset
  const [panY, setPanY] = useState<number>(0); // -50% to +50% vertical center offset
  const [tiltAngle, setTiltAngle] = useState<number>(0); // 0° (flat) to 60° 3D perspective pitch tilt
  const [rotationAngle, setRotationAngle] = useState<number>(0); // 0° to 360° Z-axis rotation angle
  const [isCameraOverlayMinimized, setIsCameraOverlayMinimized] = useState<boolean>(false);
  const [isCameraOverlayHidden, setIsCameraOverlayHidden] = useState<boolean>(false);

  // In-Frame Chart Fitting Point & Safe Margin Insets
  const [fitOffsetX, setFitOffsetX] = useState<number>(0); // -50% to +50% horizontal chart focal center
  const [fitOffsetY, setFitOffsetY] = useState<number>(0); // -50% to +50% vertical chart focal center
  const [containerPadding, setContainerPadding] = useState<number>(12); // 0px to 60px safe breathing room
  const [showSafeGuides, setShowSafeGuides] = useState<boolean>(false); // Visual print-safe boundary guide lines
  const [fittingAnchor, setFittingAnchorState] = useState<FittingAnchor>('center');

  const handleZoomIn = useCallback(() => {
    setChartScale(prev => Math.min(2.5, Math.round((prev + 0.1) * 10) / 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setChartScale(prev => Math.max(0.4, Math.round((prev - 0.1) * 10) / 10));
  }, []);

  const setFittingAnchor = useCallback((anchor: FittingAnchor) => {
    setFittingAnchorState(anchor);
    switch (anchor) {
      case 'top-left':
        setFitOffsetX(-12);
        setFitOffsetY(-12);
        break;
      case 'top':
        setFitOffsetX(0);
        setFitOffsetY(-12);
        break;
      case 'top-right':
        setFitOffsetX(12);
        setFitOffsetY(-12);
        break;
      case 'left':
        setFitOffsetX(-12);
        setFitOffsetY(0);
        break;
      case 'center':
        setFitOffsetX(0);
        setFitOffsetY(0);
        break;
      case 'right':
        setFitOffsetX(12);
        setFitOffsetY(0);
        break;
      case 'bottom-left':
        setFitOffsetX(-12);
        setFitOffsetY(12);
        break;
      case 'bottom':
        setFitOffsetX(0);
        setFitOffsetY(12);
        break;
      case 'bottom-right':
        setFitOffsetX(12);
        setFitOffsetY(12);
        break;
    }
  }, []);

  const handleAutoFit = useCallback((opts?: { chartType?: string; hasLegend?: boolean; legendPos?: string }) => {
    const hasLegend = opts?.hasLegend ?? true;
    const legendPos = opts?.legendPos || 'bottom-center';
    
    setContainerPadding(14);
    setChartScale(0.95);

    if (hasLegend && legendPos.includes('bottom')) {
      setFitOffsetX(0);
      setFitOffsetY(-6);
      setFittingAnchorState('top');
    } else if (hasLegend && legendPos.includes('top')) {
      setFitOffsetX(0);
      setFitOffsetY(6);
      setFittingAnchorState('bottom');
    } else if (hasLegend && legendPos.includes('right')) {
      setFitOffsetX(-8);
      setFitOffsetY(0);
      setFittingAnchorState('left');
    } else if (hasLegend && legendPos.includes('left')) {
      setFitOffsetX(8);
      setFitOffsetY(0);
      setFittingAnchorState('right');
    } else {
      setFitOffsetX(0);
      setFitOffsetY(0);
      setFittingAnchorState('center');
    }
  }, []);

  const handleResetFitting = useCallback(() => {
    setFitOffsetX(0);
    setFitOffsetY(0);
    setContainerPadding(12);
    setFittingAnchorState('center');
    setChartScale(1.0);
  }, []);

  const handleResetCamera = useCallback(() => {
    setPanX(0);
    setPanY(0);
    setTiltAngle(0);
    setRotationAngle(0);
    setChartScale(1.0);
    handleResetFitting();
  }, [handleResetFitting]);

  return {
    chartScale,
    setChartScale,
    handleZoomIn,
    handleZoomOut,
    panX,
    setPanX,
    panY,
    setPanY,
    tiltAngle,
    setTiltAngle,
    rotationAngle,
    setRotationAngle,
    isCameraOverlayMinimized,
    setIsCameraOverlayMinimized,
    isCameraOverlayHidden,
    setIsCameraOverlayHidden,
    handleResetCamera,
    // In-Frame Fitting Controls
    fitOffsetX,
    setFitOffsetX,
    fitOffsetY,
    setFitOffsetY,
    containerPadding,
    setContainerPadding,
    showSafeGuides,
    setShowSafeGuides,
    fittingAnchor,
    setFittingAnchor,
    handleAutoFit,
    handleResetFitting
  };
}
