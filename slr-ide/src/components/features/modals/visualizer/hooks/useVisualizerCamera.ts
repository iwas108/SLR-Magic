import { useState, useCallback } from 'react';

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

  const handleResetCamera = useCallback(() => {
    setPanX(0);
    setPanY(0);
    setTiltAngle(0);
    setRotationAngle(0);
    setChartScale(1.0);
  }, []);

  return {
    chartScale,
    setChartScale,
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
    handleResetCamera
  };
}
