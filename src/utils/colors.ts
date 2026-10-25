export type ColorCode = "red" | "orange" | "green" | "blue" | "yellow" | "purple" | "teal" | "pink"

export type TextureCode = "diagonal-stripes" | "polka-dots" | "square-net"

export type ColorTextureCode = ColorCode | TextureCode

export interface ColorTextureSelection {
  colorCode?: ColorCode
  textureCode?: TextureCode
}

export interface DateCellData {
  color?: ColorCode
  texture?: TextureCode
  customText?: string
}

export const COLORS: Record<ColorCode, string> = {
  red: "var(--color-day-red)", orange: "var(--color-day-orange)", green: "var(--color-day-green)", blue: "var(--color-day-blue)",
  yellow: "var(--color-day-yellow)", purple: "var(--color-day-purple)", teal: "var(--color-day-teal)", pink: "var(--color-day-pink)",
}
export const COLOR_LABELS: Partial<Record<ColorTextureCode, string>> = {
  red: "Work", green: "Holidays", pink: "Vacation", blue: "Personal events",
  purple: "Leave / days off", yellow: "Visitors", orange: "Admin / appointments", teal: "Sport / outdoors",
}
export const getAppearanceLabel = (code: ColorTextureCode): string => COLOR_LABELS[code] || code.replace(/-/g, " ")
export const getAppearanceName = (code: ColorTextureCode): string => COLOR_LABELS[code] ? `${COLOR_LABELS[code]} (${code})` : getAppearanceLabel(code)

export const WEEKEND_COLOR = "var(--color-weekend)"
export const UI_COLORS = {
  background: { primary: "var(--color-paper)", secondary: "var(--color-paper-2)", tertiary: "var(--color-paper-2)", quaternary: "var(--color-paper-3)", hover: "var(--color-paper-3)" },
  border: { primary: "var(--color-rule-strong)", secondary: "var(--color-rule)", tertiary: "var(--color-rule)", inset: "var(--color-accent)" },
  text: { primary: "var(--color-ink)", secondary: "var(--color-muted)", white: "var(--color-paper)" },
  button: { primary: { normal: "var(--color-ink)", hover: "var(--color-ink-2)" }, success: { normal: "var(--color-success)", hover: "var(--color-ink)" }, danger: { normal: "var(--color-error)", hover: "var(--color-ink)" } },
} as const
export const TEXTURES: Record<TextureCode, string> = {
  "diagonal-stripes": "var(--texture-diagonal)", "polka-dots": "var(--texture-polka)", "square-net": "var(--texture-net)",
}

export const ALL_COLOR_TEXTURE_CODES: ColorTextureCode[] = [
  "red",
  "green",
  "pink",
  "blue",
  "orange",
  "yellow",
  "purple",
  "teal",
  "diagonal-stripes",
  "polka-dots",
  "square-net",
]

export const getDateKey = (date: Date): string => {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export const applyColorToDate = (
  date: Date,
  dateCells: Map<string, DateCellData>,
  selectedColorTexture: ColorTextureCode,
  setDateCells: (dateCells: Map<string, DateCellData>) => void
) => {
  const dateKey = getDateKey(date)
  const newDateCells = new Map(dateCells)
  const currentCell = dateCells.get(dateKey)

  // Check if the current selection matches what we're trying to apply
  const isColor = Object.keys(COLORS).includes(selectedColorTexture)
  const isTexture = Object.keys(TEXTURES).includes(selectedColorTexture)

  const currentMatchesSelection =
    (isColor && currentCell?.color === selectedColorTexture) ||
    (isTexture && currentCell?.texture === selectedColorTexture)

  if (currentMatchesSelection) {
    // Remove the color/texture if it's already applied
    const updatedCell = { ...currentCell }
    if (isColor) {
      delete updatedCell.color
    } else if (isTexture) {
      delete updatedCell.texture
    }

    // If the cell has no other properties, remove it entirely
    if (Object.keys(updatedCell).length === 0) {
      newDateCells.delete(dateKey)
    } else {
      newDateCells.set(dateKey, updatedCell)
    }
  } else {
    // Apply the new color/texture
    const updatedCell = { ...currentCell }
    if (isColor) {
      updatedCell.color = selectedColorTexture as ColorCode
      // Remove any existing texture when applying a color
      delete updatedCell.texture
    } else if (isTexture) {
      updatedCell.texture = selectedColorTexture as TextureCode
      // Remove any existing color when applying a texture
      delete updatedCell.color
    }
    newDateCells.set(dateKey, updatedCell)
  }

  setDateCells(newDateCells)
}
