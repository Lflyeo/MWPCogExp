import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { DrawingStroke, EventType, StrokePoint } from '../types/experiment';

const STROKE_COLOR = '#1a1a1a';
const BASE_STROKE_WIDTH = 2.5;

interface AnswerCanvasProps {
  strokes: DrawingStroke[];
  onStrokesChange: (strokes: DrawingStroke[]) => void;
  onRecordEvent: (type: EventType, data?: Record<string, unknown>) => void;
  disabled?: boolean;
  minimal?: boolean;
  answerHint?: string;
  sectionRef?: RefObject<HTMLElement | null>;
  /** 仅展示作答区边框，画笔由外层统一覆盖层负责 */
  frameOnly?: boolean;
}

export type AnswerCanvasHandle = {
  flushBeforeCapture: () => void;
};

function generateStrokeId(): string {
  return `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function pointsToFlatArray(points: StrokePoint[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

export const AnswerCanvas = forwardRef<AnswerCanvasHandle, AnswerCanvasProps>(function AnswerCanvas(
  {
    strokes,
    onStrokesChange,
    onRecordEvent,
    disabled,
    minimal = false,
    answerHint = '',
    sectionRef,
    frameOnly = false,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ width: 800, height: 400 });
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);
  const strokesRef = useRef(strokes);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useImperativeHandle(ref, () => ({
    flushBeforeCapture: () => {
      if (!frameOnly) stageRef.current?.batchDraw();
    },
  }));

  useEffect(() => {
    if (frameOnly) return;
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [frameOnly]);

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
      });
    }
    currentStrokeRef.current = null;
  }, [onRecordEvent]);

  const showPlaceholder = !minimal && !frameOnly && strokes.length === 0 && !disabled;
  const cursorClass = frameOnly ? '' : disabled ? 'cursor-not-allowed' : 'cursor-crosshair';

  return (
    <section
      ref={sectionRef}
      className={`experiment-aoi experiment-aoi--answer relative flex h-full min-h-0 flex-1 flex-col rounded-[12px] border-2 border-dashed border-[#4a7fc1] bg-white`}
      aria-label="作答区域"
    >
      {!minimal && (
        <>
          <span className="experiment-aoi-label experiment-aoi-label--answer absolute top-3 right-4 z-10 rounded-[8px] border border-[#4a7fc1] bg-white/90 px-2.5 py-0.5 text-xs text-[#2d5a8e]">
            AOI 2：作答区域
          </span>
          {answerHint ? (
            <div className="px-6 pt-5 pb-2 text-sm font-medium text-neutral-800">{answerHint}</div>
          ) : null}
        </>
      )}

      {minimal && answerHint ? (
        <div className="shrink-0 px-4 pt-1.5 pb-0.5 text-sm font-medium text-neutral-800">{answerHint}</div>
      ) : null}

      {frameOnly ? (
        <div className="relative mx-4 mb-3 mt-1 min-h-0 flex-1 rounded-[8px]" />
      ) : (
        <div
          ref={containerRef}
          className={`relative flex-1 min-h-0 overflow-hidden touch-none mx-4 mb-3 rounded-[8px] ${minimal ? 'mt-0' : ''} ${cursorClass}`}
        >
          {showPlaceholder && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-neutral-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 text-[#4a7fc1]">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
              </svg>
              <span className="text-sm">使用鼠标、触控笔或数位板在此书写</span>
            </div>
          )}

          {!minimal && disabled && strokes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
              请点击「开始实验」后开始作答
            </div>
          )}

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
        </div>
      )}
    </section>
  );
});
