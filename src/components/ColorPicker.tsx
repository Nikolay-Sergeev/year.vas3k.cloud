import React from "react"
import { useCalendar } from "../contexts/CalendarContext"
import { ALL_COLOR_TEXTURE_CODES, COLOR_LABELS, getAppearanceName, COLORS, ColorTextureCode, TEXTURES, UI_COLORS } from "../utils/colors"

const ColorPicker: React.FC = () => {
  const { selectedColorTexture, setSelectedColorTexture } = useCalendar()
  const getBackgroundStyle = (code: ColorTextureCode): React.CSSProperties => code in COLORS
    ? { backgroundColor: COLORS[code as keyof typeof COLORS] }
    : { backgroundColor: UI_COLORS.background.secondary, backgroundImage: TEXTURES[code as keyof typeof TEXTURES], backgroundSize: "6px 6px" }
  return <div className="color-picker" role="group" aria-label="Colors and textures">
    {ALL_COLOR_TEXTURE_CODES.map((code, index) => <button
      type="button" key={code} className={`swatch${COLOR_LABELS[code] ? " swatch-labeled" : ""}${index === 8 ? " swatch-texture-start" : ""}`}
      onClick={() => setSelectedColorTexture(code)}
      aria-label={getAppearanceName(code)} aria-pressed={selectedColorTexture === code} title={getAppearanceName(code)}
    >
      <span className="swatch-color" style={getBackgroundStyle(code)} aria-hidden="true">
        {selectedColorTexture === code && <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>}
      </span>
      {COLOR_LABELS[code] && <span className="swatch-label">{COLOR_LABELS[code]}</span>}
    </button>)}
  </div>
}
export default ColorPicker
