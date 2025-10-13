import { useMutation } from 'convex/react';
import {
  BookmarkCheckIcon,
  BookmarkIcon,
  BookmarkPlusIcon,
} from 'lucide-react';

import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

interface BookmarkButtonProps {
  questionId: Id<'questions'>;
  isBookmarked: boolean;
  onToggle?: () => void; // Optional callback for parent component
  className?: string;
}

export default function BookmarkButton({
  questionId,
  isBookmarked,
  onToggle,
  className = 'rounded-full p-2 hover:bg-gray-100',
}: BookmarkButtonProps) {
  const toggleBookmark = useMutation(api.bookmark.toggleBookmark);

  const handleToggle = async () => {
    await toggleBookmark({ questionId });
    if (onToggle) onToggle();
  };

  return (
    <button
      onClick={handleToggle}
      className={className}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      {isBookmarked ? (
        <BookmarkCheckIcon className="h-6 w-6 text-brand-blue" />
      ) : (
        <BookmarkPlusIcon className="h-6 w-6 text-gray-400" />
      )}
    </button>
  );
}
