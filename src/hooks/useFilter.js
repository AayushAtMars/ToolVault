import { useMemo } from 'react';

export function useFilter(tools, category) {
  return useMemo(() => {
    if (!category || category === 'all') return tools;
    return tools.filter((tool) => tool.category === category);
  }, [tools, category]);
}
