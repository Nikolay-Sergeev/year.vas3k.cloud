import { isToday, isWeekend } from "date-fns"
import React, { useState } from "react"
import { COLORS, ColorTextureCode, TEXTURES, UI_COLORS, WEEKEND_COLOR } from "../utils/colors"
import CustomText from "./CustomText"

interface DayProps {
  date: Date
  isColored?: boolean
  colorTextureCode?: ColorTextureCode
  onClick?: () => void
  onMouseDown?: () => void
  onMouseEnter?: () => void
  onKeyboardPaint?: () => void
  customText?: string
  onCustomTextChange?: (text: string) => void
  customTextOverflow?: "overflow-x" | "overflow-y" | "no-overflow"
}

const Day: React.FC<DayProps> = ({
  date,
  isColored = false,
  colorTextureCode,
  onClick,
  onMouseDown,
  onMouseEnter,
  onKeyboardPaint,
  customText = "",
  onCustomTextChange,
  customTextOverflow = "overflow-x",
}) => {
  const dayNumber = date.getDate()
  const [isHovered, setIsHovered] = useState(false)
  const [isCreatingCustomText, setIsCreatingCustomText] = useState(false)

  const getBackgroundColor = (): string => {
    if (!isColored || !colorTextureCode || !(colorTextureCode in COLORS)) {
      if (isWeekend(date)) {
        return WEEKEND_COLOR
      }
      return isHovered ? UI_COLORS.background.quaternary : UI_COLORS.background.primary
    }

    const color = COLORS[colorTextureCode as keyof typeof COLORS]
    if (!color) return UI_COLORS.background.primary

    return color
  }

  const getBaseBackgroundColor = (): string => {
    if (!isColored || !colorTextureCode || !(colorTextureCode in COLORS)) {
      if (isWeekend(date)) {
        return WEEKEND_COLOR
      }
      return UI_COLORS.background.primary
    }

    const color = COLORS[colorTextureCode as keyof typeof COLORS]
    return color || UI_COLORS.background.primary
  }

  const getTextureStyles = (): React.CSSProperties => {
    if (!isColored || !colorTextureCode || !(colorTextureCode in TEXTURES)) {
      return {}
    }

    const textureCode = colorTextureCode as keyof typeof TEXTURES
    return {
      backgroundColor: UI_COLORS.background.secondary,
      backgroundImage: TEXTURES[textureCode],
      backgroundSize: "9px 9px",
      backgroundPosition: "center 2px",
    }
  }

  const handleDayNumberClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onCustomTextChange) {
      setIsCreatingCustomText(true)
      onCustomTextChange("")
    }
  }

  const handleCustomTextChange = (text: string) => {
    if (onCustomTextChange) {
      onCustomTextChange(text)
      // If text is empty and we're creating, stop creating mode
      if (text.trim().length === 0) {
        setIsCreatingCustomText(false)
      }
    }
  }

  const hasCustomText = customText.trim().length > 0 || isCreatingCustomText

  return (
    <div
      className="day"
      data-colored={isColored ? "true" : "false"}
      data-date={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
      data-today={isToday(date) ? "true" : "false"}
      role="group"
      tabIndex={0}
      aria-label={`${date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}${customText ? `: ${customText}` : ""}`}
      aria-keyshortcuts="Space"
      onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === " ") { event.preventDefault(); onKeyboardPaint?.() } }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) {
          return
        }
        if (onClick) onClick()
      }}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) {
          return
        }
        if (onMouseDown) onMouseDown()
      }}
      onPointerEnter={(e) => {
        if (e.target !== e.currentTarget) {
          return
        }
        setIsHovered(true)
        if (onMouseEnter) onMouseEnter()
      }}
      onPointerLeave={() => setIsHovered(false)}
      style={{ backgroundColor: getBackgroundColor(), ...getTextureStyles() }}
    >
      {hasCustomText ? <span className="day-number-label" aria-hidden="true">{dayNumber}</span> : (
        <button type="button" className="day-number" onClick={handleDayNumberClick} aria-label={`Add note for ${date.toLocaleDateString()}`}>{dayNumber}</button>
      )}
      {hasCustomText && (
        <CustomText
          text={customText}
          onTextChange={handleCustomTextChange}
          backgroundColor={getBaseBackgroundColor()}
          hoverBackgroundColor={UI_COLORS.background.quaternary}
          overflowDirection={customTextOverflow}
        />
      )}
    </div>
  )
}

export default Day
