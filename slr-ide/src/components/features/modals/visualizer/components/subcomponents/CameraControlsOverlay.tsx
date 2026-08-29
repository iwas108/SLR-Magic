import React, { useState } from 'react';
import { 
  Compass, 
  RotateCcw, 
  ChevronUp, 
  ChevronDown, 
  X, 
  ZoomIn, 
  ZoomOut,
  Target,
  Zap,
  Crosshair
} from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';

export function CameraControlsOverlay() {
  const { camera, config } = useVisualizerContext();
  const {
    isCameraOverlayHidden,
    setIsCameraOverlayHidden,
    isCameraOverlayMinimized,
    setIsCameraOverlayMinimized,
    handleResetCamera,
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
    fitOffsetX,
    setFitOffsetX,
    fitOffsetY,
    setFitOffsetY,
    containerPadding,
    setContainerPadding,
    showSafeGuides,
    setShowSafeGuides,
    handleAutoFit,
    handleResetFitting
  } = camera;

  const [overlayMode, setOverlayMode] = useState<'fitting' | 'camera'>('fitting');

  if (isCameraOverlayHidden) {
    return null;
  }

  if (isCameraOverlayMinimized) {
    return (
      <button
        type="button"
        onClick={() => setIsCameraOverlayMinimized(false)}
        className="absolute top-4 right-4 bg-card/90 backdrop-blur-md border border-border rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-2 z-20 text-xs font-bold text-foreground hover:bg-primary/10 transition-all select-none"
        title="Expand Fitting & Camera Controls"
      >
        <Target className="w-3.5 h-3.5 text-primary" />
        <span>Placement Pad</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 bg-card/95 backdrop-blur-md border border-border rounded-xl p-2.5 shadow-xl flex flex-col gap-2 z-20 select-none w-44">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1 text-primary">
          {overlayMode === 'fitting' ? (
            <>
              <Target className="w-3.5 h-3.5" /> Chart Fitting
            </>
          ) : (
            <>
              <Compass className="w-3.5 h-3.5" /> 3D Viewport
            </>
          )}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Reset to Defaults"
            onClick={overlayMode === 'fitting' ? handleResetFitting : handleResetCamera}
            className="p-0.5 hover:bg-primary/20 rounded text-primary transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Minimize Overlay"
            onClick={() => setIsCameraOverlayMinimized(true)}
            className="p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            title="Hide Overlay"
            onClick={() => setIsCameraOverlayHidden(true)}
            className="p-0.5 hover:bg-red-500/20 rounded text-red-500 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 gap-1 p-0.5 bg-secondary/60 rounded-lg text-[10px] font-bold">
        <button
          type="button"
          onClick={() => setOverlayMode('fitting')}
          className={`py-1 rounded text-center transition-all ${
            overlayMode === 'fitting'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Placement
        </button>
        <button
          type="button"
          onClick={() => setOverlayMode('camera')}
          className={`py-1 rounded text-center transition-all ${
            overlayMode === 'camera'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          3D Camera
        </button>
      </div>

      {overlayMode === 'fitting' ? (
        <>
          {/* Fitting Focal Point Nudge Pad */}
          <div className="grid grid-cols-3 gap-1 w-full bg-secondary/40 rounded-lg p-1 items-center justify-center">
            <div />
            <button
              type="button"
              title="Shift Fitting Center Up"
              onClick={() => setFitOffsetY(Math.max(-40, fitOffsetY - 3))}
              className="p-1 hover:bg-primary/20 rounded text-foreground text-center text-xs font-bold transition-colors"
            >
              ▲
            </button>
            <div />
            <button
              type="button"
              title="Shift Fitting Center Left"
              onClick={() => setFitOffsetX(Math.max(-40, fitOffsetX - 3))}
              className="p-1 hover:bg-primary/20 rounded text-foreground text-center text-xs font-bold transition-colors"
            >
              ◀
            </button>
            <button
              type="button"
              title="Center Focal Position"
              onClick={() => { setFitOffsetX(0); setFitOffsetY(0); }}
              className="p-1 text-[8px] hover:bg-primary/20 rounded text-primary font-mono text-center font-bold"
            >
              •
            </button>
            <button
              type="button"
              title="Shift Fitting Center Right"
              onClick={() => setFitOffsetX(Math.min(40, fitOffsetX + 3))}
              className="p-1 hover:bg-primary/20 rounded text-foreground text-center text-xs font-bold transition-colors"
            >
              ▶
            </button>
            <div />
            <button
              type="button"
              title="Shift Fitting Center Down"
              onClick={() => setFitOffsetY(Math.min(40, fitOffsetY + 3))}
              className="p-1 hover:bg-primary/20 rounded text-foreground text-center text-xs font-bold transition-colors"
            >
              ▼
            </button>
            <div />
          </div>

          {/* Quick Fit Coordinate Readout & Inset Margin Adjustment */}
          <div className="flex items-center justify-between text-[9.5px] font-mono bg-secondary/30 px-2 py-1 rounded border border-border/40 text-muted-foreground">
            <span>X: <strong className="text-foreground">{fitOffsetX > 0 ? `+${fitOffsetX}` : fitOffsetX}%</strong></span>
            <span>Y: <strong className="text-foreground">{fitOffsetY > 0 ? `+${fitOffsetY}` : fitOffsetY}%</strong></span>
            <span>Pad: <strong className="text-primary">{containerPadding}px</strong></span>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-1 text-[9px] font-bold">
            <button
              type="button"
              onClick={() => handleAutoFit({
                chartType: config.currentSlotConfig?.chartType,
                hasLegend: config.currentSlotConfig?.showLegend,
                legendPos: config.currentSlotConfig?.sunburstLegendPosition || config.currentSlotConfig?.barLegendPosition
              })}
              className="py-1 bg-primary/15 hover:bg-primary/25 text-primary rounded text-center transition-colors border border-primary/30 flex items-center justify-center gap-1"
            >
              <Zap className="w-2.5 h-2.5" /> Auto-Fit
            </button>
            <button
              type="button"
              onClick={() => setShowSafeGuides(!showSafeGuides)}
              className={`py-1 rounded text-center transition-colors border ${
                showSafeGuides 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-secondary hover:bg-secondary/80 text-foreground border-border/40'
              } flex items-center justify-center gap-1`}
            >
              <Crosshair className="w-2.5 h-2.5" /> Safe Guides
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Pan Directional Pad */}
          <div className="grid grid-cols-3 gap-1 w-full bg-secondary/40 rounded-lg p-1 items-center justify-center">
            <div />
            <button
              type="button"
              title="Pan Up"
              onClick={() => setPanY(Math.max(-50, panY - 5))}
              className="p-1 hover:bg-primary/20 rounded text-foreground text-center text-xs font-bold transition-colors"
            >
              ▲
            </button>
            <div />
            <button
              type="button"
              title="Pan Left"
              onClick={() => setPanX(Math.max(-50, panX - 5))}
              className="p-1 hover:bg-primary/20 rounded text-foreground text-center text-xs font-bold transition-colors"
            >
              ◀
            </button>
            <button
              type="button"
              title="Center Pan"
              onClick={() => { setPanX(0); setPanY(0); }}
              className="p-1 text-[8px] hover:bg-primary/20 rounded text-muted-foreground font-mono text-center font-bold"
            >
              •
            </button>
            <button
              type="button"
              title="Pan Right"
              onClick={() => setPanX(Math.min(50, panX + 5))}
              className="p-1 hover:bg-primary/20 rounded text-foreground text-center text-xs font-bold transition-colors"
            >
              ▶
            </button>
            <div />
            <button
              type="button"
              title="Pan Down"
              onClick={() => setPanY(Math.min(50, panY + 5))}
              className="p-1 hover:bg-primary/20 rounded text-foreground text-center text-xs font-bold transition-colors"
            >
              ▼
            </button>
            <div />
          </div>

          {/* Tilt & Rotation Quick Buttons */}
          <div className="grid grid-cols-2 gap-1 text-[9px] font-bold">
            <button
              type="button"
              onClick={() => setTiltAngle(Math.min(60, tiltAngle + 5))}
              className="py-1 bg-secondary hover:bg-primary/20 rounded text-foreground text-center transition-colors border border-border/40"
            >
              Tilt +5°
            </button>
            <button
              type="button"
              onClick={() => setTiltAngle(Math.max(0, tiltAngle - 5))}
              className="py-1 bg-secondary hover:bg-primary/20 rounded text-foreground text-center transition-colors border border-border/40"
            >
              Tilt -5°
            </button>
            <button
              type="button"
              onClick={() => setRotationAngle((rotationAngle - 15 + 360) % 360)}
              className="py-1 bg-secondary hover:bg-primary/20 rounded text-foreground text-center transition-colors border border-border/40"
            >
              Rot ↺
            </button>
            <button
              type="button"
              onClick={() => setRotationAngle((rotationAngle + 15) % 360)}
              className="py-1 bg-secondary hover:bg-primary/20 rounded text-foreground text-center transition-colors border border-border/40"
            >
              Rot ↻
            </button>
          </div>
        </>
      )}

      {/* Zoom In / Zoom Out Controls */}
      <div className="flex items-center justify-between gap-1 bg-secondary/40 rounded-lg p-1">
        <button
          type="button"
          title="Zoom Out (-10%)"
          onClick={() => setChartScale(Math.max(0.4, Number((chartScale - 0.1).toFixed(2))))}
          className="flex-1 py-0.5 bg-card hover:bg-secondary rounded text-[10px] font-bold text-foreground flex items-center justify-center gap-0.5 border border-border/50"
        >
          <ZoomOut className="w-2.5 h-2.5" /> -
        </button>
        <span className="text-[9.5px] font-mono font-bold text-primary px-1 text-center min-w-[32px]">
          {(chartScale * 100).toFixed(0)}%
        </span>
        <button
          type="button"
          title="Zoom In (+10%)"
          onClick={() => setChartScale(Math.min(2.0, Number((chartScale + 0.1).toFixed(2))))}
          className="flex-1 py-0.5 bg-card hover:bg-secondary rounded text-[10px] font-bold text-foreground flex items-center justify-center gap-0.5 border border-border/50"
        >
          <ZoomIn className="w-2.5 h-2.5" /> +
        </button>
      </div>
    </div>
  );
}
