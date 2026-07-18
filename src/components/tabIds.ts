// The id scheme that ties a tab button to its panel. Shared so TabBar and the
// component holding the panels format the same strings — aria-controls on the
// button must equal the panel's id, and the panel's aria-labelledby must equal the
// button's id, or the association is silently broken.
export function tabButtonId(base: string, id: string): string {
  return `${base}-tab-${id}`
}

export function tabPanelId(base: string, id: string): string {
  return `${base}-panel-${id}`
}
