import { type RefObject, useEffect } from 'react';
import { ExperimentOverlayShell } from './ExperimentOverlayShell';

interface EnterToStartOverlayProps {
  show: boolean;
  onStart: () => void;
  displayRef?: RefObject<HTMLElement | null>;
  enterEnabled?: boolean;
}

export function EnterToStartOverlay({ show, onStart, displayRef, enterEnabled = true }: EnterToStartOverlayProps) {
  useEffect(() => {
    if (!show || !enterEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        if (e.repeat) return;
        onStart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enterEnabled, onStart, show]);

  return (
    <ExperimentOverlayShell show={show} backdropClassName="bg-neutral-900/85">
      <div ref={displayRef} className="inline-flex flex-col items-center gap-5 text-center text-white px-6">
        <p className="text-lg text-white/75">准备就绪，请按 F9 键开始作答</p>
        <div className="flex items-center gap-4">
          <kbd className="inline-flex min-w-[5.5rem] items-center justify-center rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-2xl font-semibold tracking-wide shadow-sm">
            F9
          </kbd>
          <span className="text-2xl font-medium">进入实验</span>
        </div>
      </div>
    </ExperimentOverlayShell>
  );
}
