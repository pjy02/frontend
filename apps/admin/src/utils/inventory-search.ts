export function inventorySearchTerm(search?: string) {
  return search?.trim().toLowerCase() ?? "";
}

export function matchesInventorySearch(
  item: { name: string; address: string; port?: number; tags?: string[] },
  term: string
) {
  return (
    item.name?.toLowerCase().includes(term) ||
    item.address?.toLowerCase().includes(term) ||
    item.tags?.some((tag) => tag.toLowerCase().includes(term)) ||
    (/^\d+$/.test(term) && item.port === Number(term))
  );
}
