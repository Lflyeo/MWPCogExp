import { useEffect, useRef, useState } from 'react';
import { ExperimentOverlayShell } from './ExperimentOverlayShell';

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
  const [wasShown, setWasShown] = useState(show);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  if (show !== wasShown) {
    setWasShown(show);
    if (show && seconds > 0) setRemaining(seconds);
  }

  useEffect(() => {
    if (!show || seconds <= 0) return;

    setRemaining(seconds);
    let left = seconds;
    const timer = window.setInterval(() => {
      left -= 1;
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(timer);
        onCompleteRef.current();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [seconds, show]);

  return (
    <ExperimentOverlayShell show={show} backdropClassName="bg-neutral-900/85">
      <div className="text-center text-white px-6">
        <div
          key={remaining}
          className="text-5xl font-medium mb-4 experiment-fade-in"
        >
          {Math.max(remaining, 0)}
        </div>
        <p className="text-lg mb-2">休息 {seconds} 秒，即将开始下一道题</p>
        <p className="text-sm text-neutral-300">
          第 {nextQuestionIndex} / {totalQuestions} 题
        </p>
      </div>
    </ExperimentOverlayShell>
  );
}
