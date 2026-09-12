import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { DrawingStroke, EventType, StrokePoint } from '../types/experiment';

const STROKE_COLOR = '#1a1a1a';
const BASE_STROKE_WIDTH = 2.5;

export type ExperimentDrawingOverlayHandle = {
  flushBeforeCapture: () => void;
};

interface ExperimentDrawingOverlayProps {
  strokes: DrawingStroke[];
  onStrokesChange: (strokes: DrawingStroke[]) => void;
  onRecordEvent: (type: EventType, data?: Record<string, unknown>) => void;
  disabled?: boolean;
}

function generateStrokeId(): string {
  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function pointsToFlatArray(points: StrokePoint[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

/** 覆盖题目区+作答区的统一画笔层，避免分界处断笔 */
export const ExperimentDrawingOverlay = forwardRef<
  ExperimentDrawingOverlayHandle,
  ExperimentDrawingOverlayProps
>(function ExperimentDrawingOverlay({ strokes, onStrokesChange, onRecordEvent, disabled = false }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);
  const strokesRef = useRef(strokes);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useImperativeHandle(ref, () => ({
    flushBeforeCapture: () => {
      stageRef.current?.batchDraw();
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncSize = () => {
      const { width, height } = container.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      });
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const getPointerPos = useCallback((e: KonvaEventObject<PointerEvent>): StrokePoint | null => {
    const stage = e.target.getStage();
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const pressure = e.evt.pressure > 0 ? e.evt.pressure : 0.5;
    return { x: pos.x, y: pos.y, pressure, timestamp: Date.now() };
  }, []);

  const handlePointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (disabled) return;
      e.evt.preventDefault();
      const point = getPointerPos(e);
      if (!point) return;

      isDrawingRef.current = true;
      const stroke: DrawingStroke = {
        id: generateStrokeId(),
        points: [{ x: point.x, y: point.y, pressure: point.pressure, timestamp: point.timestamp }],
        color: STROKE_COLOR,
        strokeWidth: BASE_STROKE_WIDTH * (0.5 + point.pressure),
        tool: 'pen',
      };
      currentStrokeRef.current = stroke;
      onStrokesChange([...strokesRef.current, stroke]);
      onRecordEvent('stroke_start', {
        strokeId: stroke.id,
        x: point.x,
        y: point.y,
        pressure: point.pressure,
        tool: stroke.tool,
        area: 'unified',
      });
    },
    [disabled, getPointerPos, onRecordEvent, onStrokesChange],
  );

  const handlePointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (!isDrawingRef.current || disabled) return;
      e.evt.preventDefault();
      const point = getPointerPos(e);
      const current = currentStrokeRef.current;
      if (!point || !current) return;

      const updated: DrawingStroke = {
        ...current,
        points: [...current.points, { x: point.x, y: point.y, pressure: point.pressure, timestamp: point.timestamp }],
      };
      currentStrokeRef.current = updated;
      const next = [...strokesRef.current];
      next[next.length - 1] = updated;
      onStrokesChange(next);

      if (updated.points.length % 4 === 0) {
        onRecordEvent('stroke_point', {
          strokeId: updated.id,
          x: point.x,
          y: point.y,
          pressure: point.pressure,
          pointIndex: updated.points.length - 1,
          tool: updated.tool,
          area: 'unified',
        });
      }
    },
    [disabled, getPointerPos, onRecordEvent, onStrokesChange],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const current = currentStrokeRef.current;
    if (current) {
      onRecordEvent('stroke_end', {
        strokeId: current.id,
        pointCount: current.points.length,
        tool: current.tool,
        area: 'unified',
      });
    }
    currentStrokeRef.current = null;
  }, [onRecordEvent]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-[2] touch-none ${disabled ? 'pointer-events-none' : 'cursor-crosshair'}`}
      aria-hidden={disabled}
    >
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          <Layer>
            {strokes.map((stroke) => (
              <Line
                key={stroke.id}
                points={pointsToFlatArray(stroke.points)}
                stroke={stroke.color}
                strokeWidth={stroke.strokeWidth}
                tension={0.4}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={stroke.tool === 'eraser' ? 'destination-out' : 'source-over'}
              />
            ))}
          </Layer>
        </Stage>
      )}
    </div>
  );
});
