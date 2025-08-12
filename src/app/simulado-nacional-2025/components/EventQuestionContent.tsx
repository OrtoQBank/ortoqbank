import StructuredContentRenderer, {
  ContentNode,
} from '@/components/common/StructuredContentRenderer';

interface EventQuestionContentProps {
  /**
   * @deprecated Use stringContent instead. This is kept for backward compatibility.
   */
  content?: ContentNode | string | null | undefined;
  /**
   * The preferred way to pass content - as a JSON string
   */
  stringContent?: string | null | undefined;
}

/**
 * Renders question content using either stringContent (preferred) or the legacy content object.
 * This is a copy of QuestionContent for the event quiz.
 */
export default function EventQuestionContent({
  content,
  stringContent,
}: EventQuestionContentProps) {
  return (
    <div className="prose max-w-none">
      <StructuredContentRenderer node={content} stringContent={stringContent} />
    </div>
  );
}
