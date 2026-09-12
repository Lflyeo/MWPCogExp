import { useLayoutEffect, type RefObject } from 'react';
import {
  ensureExperimentImmersiveMode,
  isExperimentFullscreenExitIntentional,
  isNativeFullscreenActive,
  lockExperimentFullscreenKeys,
  restoreExperimentFullscreenIfNeeded,
  unlockExperimentFullscreenKeys,
} from '../utils/experimentFullscreen';
import { EXPERIMENT_USE_NATIVE_FULLSCREEN } from '../constants/experimentDisplay';

/**
 * 作答页保持沉浸式布局；若原生全屏被顶部「退出」误触打断，则自动恢复。
 * 原生全屏仍在首页点击「开始」时首次请求。
 */
export function useExperimentRunImmersive(
  active = true,
  containerRef?: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    if (!active) return;

    ensureExperimentImmersiveMode();
    void lockExperimentFullscreenKeys();

    const tryRestore = () => {
      if (isExperimentFullscreenExitIntentional()) return;
      if (isNativeFullscreenActive()) return;
      void restoreExperimentFullscreenIfNeeded(containerRef?.current ?? null);
    };

    const onFullscreenChange = () => {
      // 延迟一帧：避免与浏览器退出动画抢时序，并过滤主动退出
      window.setTimeout(tryRestore, 50);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange as EventListener);

    // 笔移到顶部时偶发已退出但事件丢失，做轻量轮询兜底
    const pollId =
      EXPERIMENT_USE_NATIVE_FULLSCREEN
        ? window.setInterval(() => {
            if (!document.hasFocus()) return;
            tryRestore();
          }, 1200)
        : null;

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange as EventListener);
      if (pollId !== null) window.clearInterval(pollId);
      unlockExperimentFullscreenKeys();
    };
  }, [active, containerRef]);
}
