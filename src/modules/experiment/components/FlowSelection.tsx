import { FlaskConical } from 'lucide-react';
import type { RefObject } from 'react';
import type { ExperimentFlow } from '../types/experiment';

interface FlowSelectionProps {
  flows: ExperimentFlow[];
  onStart: (flow: ExperimentFlow) => void;
  sectionTitle?: string;
  sectionRef?: RefObject<HTMLDivElement | null>;
  firstStartRef?: RefObject<HTMLButtonElement | null>;
}

export function FlowSelection({
  flows,
  onStart,
  sectionTitle,
  sectionRef,
  firstStartRef,
}: FlowSelectionProps) {
  if (flows.length === 0) return null;

  return (
    <div ref={sectionRef} className="w-full space-y-3 scroll-mt-36">
      {sectionTitle && (
        <h2 className="text-sm font-medium text-gray-500 px-1 pt-1">{sectionTitle}</h2>
      )}
      {flows.map((flow, index) => (
        <div
          key={flow.id}
          className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <FlaskConical size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-gray-900">{flow.name}</div>
                {flow.description && (
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2">{flow.description}</p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  共 {flow.question_count ?? 0} 道题目
                </p>
              </div>
            </div>
            <button
              ref={index === 0 ? firstStartRef : undefined}
              type="button"
              onClick={() => onStart(flow)}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shrink-0 mt-1 scroll-mt-36"
            >
              开始
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
