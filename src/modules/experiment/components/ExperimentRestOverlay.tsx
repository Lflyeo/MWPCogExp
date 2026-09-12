import { useEffect, useRef, useState } from 'react';
import { ExperimentOverlayShell } from './ExperimentOverlayShell';
import { cancelExperimentSpeech, speakExperimentPrompt } from '../utils/experimentSpeech';

interface ExperimentRestOverlayProps {
  show: boolean;
  seconds: number;
  nextQuestionIndex: number;
  totalQuestions: number;
  onComplete: () => void;
}

export function ExperimentRestOverlay({
  show,
  seconds,
  nextQuestionIndex,
  totalQuestions,
  onComplete,
}: ExperimentRestOverlayProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [awaitingContinue, setAwaitingContinue] = useState(false);
  const [wasShown, setWasShown] = useState(show);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  if (show !== wasShown) {
    setWasShown(show);
    if (show && seconds > 0) {
      setRemaining(seconds);
      setAwaitingContinue(false);
    }
    if (!show) {
      setAwaitingContinue(false);
    }
  }

  useEffect(() => {
    if (!show || seconds <= 0) return;

    cancelExperimentSpeech();
    setRemaining(seconds);
    setAwaitingContinue(false);

    let left = seconds;
    speakExperimentPrompt(String(left), { interrupt: true });

    const timer = window.setInterval(() => {
      left -= 1;
      setRemaining(left);
      if (left > 0) {
        speakExperimentPrompt(String(left), { interrupt: true });
        return;
      }
      window.clearInterval(timer);
      setAwaitingContinue(true);
      speakExperimentPrompt('休息结束，请按 F9 继续下一题', { interrupt: true });
    }, 1000);

    return () => {
      window.clearInterval(timer);
      cancelExperimentSpeech();
    };
  }, [seconds, show]);

  useEffect(() => {
    if (!show || !awaitingContinue) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F9') return;
      e.preventDefault();
      if (e.repeat) return;
      cancelExperimentSpeech();
      onCompleteRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [awaitingContinue, show]);

  return (
    <ExperimentOverlayShell show={show} backdropClassName="bg-neutral-900">
      <div className="text-center text-white px-6">
        {!awaitingContinue ? (
          <>
            <div key={remaining} className="text-5xl font-medium mb-4 experiment-fade-in">
              {Math.max(remaining, 0)}
            </div>
            <p className="text-lg mb-2">休息 {seconds} 秒</p>
            <p className="text-sm text-neutral-300">
              即将进入第 {nextQuestionIndex} / {totalQuestions} 题
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-medium mb-4">休息结束</p>
            <p className="text-lg mb-4 text-neutral-200">请按 F9 继续下一道题</p>
            <div className="flex items-center justify-center gap-3">
              <kbd className="inline-flex min-w-[4.5rem] items-center justify-center rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xl font-semibold tracking-wide">
                F9
              </kbd>
              <span className="text-lg">继续</span>
            </div>
            <p className="mt-4 text-sm text-neutral-300">
              第 {nextQuestionIndex} / {totalQuestions} 题
            </p>
          </>
        )}
      </div>
    </ExperimentOverlayShell>
  );
}
