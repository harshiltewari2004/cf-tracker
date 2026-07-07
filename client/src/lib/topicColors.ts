const TOPIC_COLORS: Record<string, string> = {
  dp: 'bg-purple-100 text-purple-800',
  greedy: 'bg-orange-100 text-orange-800',
  math: 'bg-blue-100 text-blue-800',
  implementation: 'bg-slate-200 text-slate-800',
  'binary search': 'bg-teal-100 text-teal-800',
  'brute force': 'bg-red-100 text-red-800',
  'constructive algorithms': 'bg-green-100 text-green-800',
  graphs: 'bg-indigo-100 text-indigo-800',
  strings: 'bg-pink-100 text-pink-800',
  geometry: 'bg-cyan-100 text-cyan-800',
};

const FALLBACK_TOPIC_COLOR = 'bg-gray-100 text-gray-700';

export const getTopicColor = (topic: string) =>
  TOPIC_COLORS[topic] ?? FALLBACK_TOPIC_COLOR;