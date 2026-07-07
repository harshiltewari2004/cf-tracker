import { getTopicColor } from '@/lib/topicColors';

interface TopicBadgeProps {
  topic: string;
}

export const TopicBadge = ({ topic }: TopicBadgeProps) => (
  <span className={`rounded px-2 py-0.5 text-xs font-medium ${getTopicColor(topic)}`}>
    {topic}
  </span>
);