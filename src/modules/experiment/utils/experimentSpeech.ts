/** 实验流程语音播报（Web Speech API） */

function pickZhVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'zh-CN') ||
    voices.find((v) => v.lang.toLowerCase().startsWith('zh')) ||
    null
  );
}

export function cancelExperimentSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function speakExperimentPrompt(
  text: string,
  options?: { rate?: number; interrupt?: boolean },
): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const interrupt = options?.interrupt !== false;
  if (interrupt) window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = options?.rate ?? 1.05;
  const voice = pickZhVoice();
  if (voice) utter.voice = voice;

  // 部分浏览器首次 getVoices 为空，voiceschanged 后再播一次
  if (!voice && window.speechSynthesis.getVoices().length === 0) {
    const retry = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', retry);
      const delayed = new SpeechSynthesisUtterance(text);
      delayed.lang = 'zh-CN';
      delayed.rate = options?.rate ?? 1.05;
      const v = pickZhVoice();
      if (v) delayed.voice = v;
      window.speechSynthesis.speak(delayed);
    };
    window.speechSynthesis.addEventListener('voiceschanged', retry);
  }

  window.speechSynthesis.speak(utter);
}
