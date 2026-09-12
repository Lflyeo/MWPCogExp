import { EXPERIMENT_USE_NATIVE_FULLSCREEN } from '../constants/experimentDisplay';

export const EXPERIMENT_IMMERSIVE_CLASS = 'experiment-run-fullscreen';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
};

type KeyboardNavigator = Navigator & {
  keyboard?: {
    lock?: (keyCodes?: string[]) => Promise<void>;
    unlock?: () => void;
  };
};

/** 用户主动结束实验时置位，避免 fullscreenchange 自动拉回全屏 */
let intentionalFullscreenExit = false;
let restoreInFlight: Promise<boolean> | null = null;

export function isNativeFullscreenActive(): boolean {
  const doc = document as FullscreenDocument;
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function applyExperimentImmersiveMode(): void {
  document.documentElement.classList.add(EXPERIMENT_IMMERSIVE_CLASS);
  document.body.classList.add(EXPERIMENT_IMMERSIVE_CLASS);
}

export function removeExperimentImmersiveMode(): void {
  document.documentElement.classList.remove(EXPERIMENT_IMMERSIVE_CLASS);
  document.body.classList.remove(EXPERIMENT_IMMERSIVE_CLASS);
}

async function requestNativeFullscreen(el: HTMLElement): Promise<boolean> {
  try {
    if (isNativeFullscreenActive()) return true;
    const target = el as FullscreenElement;
    const options: FullscreenOptions = { navigationUI: 'hide' };
    if (target.requestFullscreen) {
      await target.requestFullscreen(options);
    } else if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen();
    } else {
      return false;
    }
    return isNativeFullscreenActive();
  } catch {
    return false;
  }
}

async function exitNativeFullscreen(): Promise<void> {
  try {
    if (!isNativeFullscreenActive()) return;
    const doc = document as FullscreenDocument;
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // 用户可能已按 Esc 退出
  }
}

/** 锁定 Esc，降低误触退出原生全屏的概率（需安全上下文） */
export async function lockExperimentFullscreenKeys(): Promise<void> {
  try {
    const keyboard = (navigator as KeyboardNavigator).keyboard;
    if (keyboard?.lock) {
      await keyboard.lock(['Escape']);
    }
  } catch {
    // 浏览器不支持或权限不足时忽略
  }
}

export function unlockExperimentFullscreenKeys(): void {
  try {
    (navigator as KeyboardNavigator).keyboard?.unlock?.();
  } catch {
    // ignore
  }
}

/** 在用户点击「开始」等手势后调用：进入沉浸式 + 可选原生全屏 */
export async function enterExperimentFullscreen(container?: HTMLElement | null): Promise<boolean> {
  intentionalFullscreenExit = false;
  applyExperimentImmersiveMode();
  if (!EXPERIMENT_USE_NATIVE_FULLSCREEN) return true;
  const target = container ?? document.documentElement;
  const ok = await requestNativeFullscreen(target);
  if (ok) {
    void lockExperimentFullscreenKeys();
  }
  return ok;
}

/** 取消开始或实验结束后退出全屏 */
export async function exitExperimentFullscreen(): Promise<void> {
  intentionalFullscreenExit = true;
  unlockExperimentFullscreenKeys();
  await exitNativeFullscreen();
  removeExperimentImmersiveMode();
}

/** 作答页挂载时确保沉浸式样式（不重复请求原生全屏） */
export function ensureExperimentImmersiveMode(): void {
  applyExperimentImmersiveMode();
}

/**
 * 作答过程中若因移到屏幕顶部点到浏览器「退出全屏」而离开全屏，
 * 自动重新进入，避免干扰被试。主动结束实验时不会拉回。
 */
export async function restoreExperimentFullscreenIfNeeded(
  container?: HTMLElement | null,
): Promise<boolean> {
  if (intentionalFullscreenExit || !EXPERIMENT_USE_NATIVE_FULLSCREEN) return false;
  if (isNativeFullscreenActive()) return true;
  if (restoreInFlight) return restoreInFlight;

  restoreInFlight = (async () => {
    applyExperimentImmersiveMode();
    const target = container ?? document.documentElement;
    const ok = await requestNativeFullscreen(target);
    if (ok) {
      void lockExperimentFullscreenKeys();
    }
    return ok;
  })().finally(() => {
    restoreInFlight = null;
  });

  return restoreInFlight;
}

export function isExperimentFullscreenExitIntentional(): boolean {
  return intentionalFullscreenExit;
}
