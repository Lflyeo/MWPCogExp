import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { getAssetUrl } from '@/lib/api';

interface QuestionPanelProps {
  content: string;
  questionIndex?: number;
  totalQuestions?: number;
  minimal?: boolean;
}

export function QuestionPanel({ content, questionIndex, totalQuestions, minimal = false }: QuestionPanelProps) {
  return (
    <section
      className={`experiment-aoi experiment-aoi--question relative h-auto rounded-[12px] border-2 border-dashed border-[#e07b39] bg-[#faf8f4] ${
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
            <div className="mb-2 text-xs text-neutral-500 tracking-wide">
              第 {questionIndex + 1} / {totalQuestions} 题
            </div>
          )}
        </>
      )}

      <div
        className={`experiment-markdown pr-2 text-neutral-900 ${
          minimal ? 'text-[36px] leading-[2]' : 'text-[15px] leading-relaxed flex-1 min-h-0 overflow-y-auto'
        }`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            img: ({ src, alt }) => (
              <img
                src={getAssetUrl(src)}
                alt={alt ?? '题目图片'}
                className={`max-w-full rounded-lg border border-neutral-200 object-contain my-2 ${
                  minimal ? 'max-h-[min(420px,46vh)]' : 'max-h-[min(360px,40vh)]'
                }`}
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </section>
  );
}
