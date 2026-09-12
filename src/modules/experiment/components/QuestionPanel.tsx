import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Stage, Layer, Line } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { getAssetUrl } from '@/lib/api';
import type { DrawingStroke, EventType, StrokePoint } from '../types/experiment';

const ANNOTATION_COLOR = '#1a1a1a';
const ANNOTATION_WIDTH = 2.5;

interface QuestionPanelProps {
  content: string;
  questionIndex?: number;
  totalQuestions?: number;
  minimal?: boolean;
  /** 允许在题目上画笔标注 */
  annotatable?: boolean;
  annotations?: DrawingStroke[];
  onAnnotationsChange?: (strokes: DrawingStroke[]) => void;
  onRecordEvent?: (type: EventType, data?: Record<string, unknown>) => void;
  annotationDisabled?: boolean;
  sectionRef?: RefObject<HTMLElement | null>;
}

function generateStrokeId(): string {
  return `q-anno-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function pointsToFlatArray(points: StrokePoint[]): number[] {
  return points.flatMap((p) => [p.x, p.y]);
}

export function QuestionPanel({
  content,
  questionIndex,
  totalQuestions,
  minimal = false,
  annotatable = false,
  annotations = [],
  onAnnotationsChange,
  onRecordEvent,
  annotationDisabled = false,
  sectionRef,
}: QuestionPanelProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);
  const annotationsRef = useRef(annotations);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || !annotatable) return;

    const syncSize = () => {
      const { width, height } = surface.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      });
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [annotatable, content]);

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
      if (!annotatable || annotationDisabled || !onAnnotationsChange) return;
      e.evt.preventDefault();
      const point = getPointerPos(e);
      if (!point) return;

      isDrawingRef.current = true;
      const stroke: DrawingStroke = {
        id: generateStrokeId(),
        points: [{ x: point.x, y: point.y, pressure: point.pressure, timestamp: point.timestamp }],
        color: ANNOTATION_COLOR,
        strokeWidth: ANNOTATION_WIDTH * (0.5 + point.pressure),
        tool: 'pen',
      };
      currentStrokeRef.current = stroke;
      onAnnotationsChange([...annotationsRef.current, stroke]);
      onRecordEvent?.('stroke_start', {
        area: 'question',
        strokeId: stroke.id,
        x: point.x,
        y: point.y,
        pressure: point.pressure,
        tool: stroke.tool,
      });
    },
    [annotatable, annotationDisabled, getPointerPos, onAnnotationsChange, onRecordEvent],
  );

  const handlePointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (!isDrawingRef.current || annotationDisabled || !onAnnotationsChange) return;
      e.evt.preventDefault();
      const point = getPointerPos(e);
      const current = currentStrokeRef.current;
      if (!point || !current) return;

      const updated: DrawingStroke = {
        ...current,
        points: [...current.points, { x: point.x, y: point.y, pressure: point.pressure, timestamp: point.timestamp }],
      };
      currentStrokeRef.current = updated;
      const next = [...annotationsRef.current];
      next[next.length - 1] = updated;
      onAnnotationsChange(next);
    },
    [annotationDisabled, getPointerPos, onAnnotationsChange],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const current = currentStrokeRef.current;
    if (current) {
      onRecordEvent?.('stroke_end', {
        area: 'question',
        strokeId: current.id,
        pointCount: current.points.length,
        tool: current.tool,
      });
    }
    currentStrokeRef.current = null;
  }, [onRecordEvent]);

  const canAnnotate = annotatable && !annotationDisabled;

  return (
    <section
      ref={sectionRef}
      className={`experiment-aoi experiment-aoi--question relative h-auto rounded-[12px] border-2 border-dashed border-[#e07b39] bg-[#faf8f4] select-none ${
        minimal ? 'px-7 py-4' : 'flex flex-col min-h-0 px-8 py-6'
      }`}
      aria-label="题目区域"
    >
      {!minimal && (
        <>
          <span className="experiment-aoi-label experiment-aoi-label--question absolute top-3 right-4 rounded-[8px] border border-[#e07b39] bg-white/80 px-2.5 py-0.5 text-xs text-[#c45f1f]">
            AOI 1：题目区域
          </span>
          {questionIndex !== undefined && totalQuestions !== undefined && (
            <div className="mb-2 text-xs text-neutral-500 tracking-wide select-none">
              第 {questionIndex + 1} / {totalQuestions} 题
            </div>
          )}
        </>
      )}

      <div ref={surfaceRef} className="relative">
        <div
          className={`experiment-markdown pr-2 text-neutral-900 select-none pointer-events-none ${
            minimal ? 'text-[36px] leading-[2]' : 'text-[15px] leading-relaxed flex-1 min-h-0 overflow-y-auto'
          }`}
          style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              img: ({ src, alt }) => (
                <img
                  src={getAssetUrl(src)}
                  alt={alt ?? '题目图片'}
                  draggable={false}
                  className={`max-w-full rounded-lg border border-neutral-200 object-contain my-2 select-none ${
                    minimal ? 'max-h-[min(420px,46vh)]' : 'max-h-[min(360px,40vh)]'
                  }`}
                />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>

        {annotatable && size.width > 0 && size.height > 0 && (
          <div
            className={`absolute inset-0 z-[1] touch-none ${
              canAnnotate ? 'cursor-crosshair' : 'cursor-not-allowed'
            }`}
            aria-hidden={!canAnnotate}
          >
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
                {annotations.map((stroke) => (
                  <Line
                    key={stroke.id}
                    points={pointsToFlatArray(stroke.points)}
                    stroke={stroke.color}
                    strokeWidth={stroke.strokeWidth}
                    tension={0.4}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))}
              </Layer>
            </Stage>
          </div>
        )}
      </div>
    </section>
  );
}
