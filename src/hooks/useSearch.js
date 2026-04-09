import { useMemo } from 'react';

export function useSearch(tools, query) {
  return useMemo(() => {
    if (!query.trim()) return tools;
    const q = query.toLowerCase().trim();
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.keywords.some((k) => k.includes(q))
    );
  }, [tools, query]);
}
