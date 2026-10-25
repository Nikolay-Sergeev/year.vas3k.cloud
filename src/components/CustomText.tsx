import React, { useEffect, useRef, useState } from "react"
import { UI_COLORS } from "../utils/colors"

interface CustomTextProps {
  text: string
  onTextChange: (text: string) => void
  backgroundColor: string
  hoverBackgroundColor: string
  overflowDirection?: "overflow-x" | "overflow-y" | "no-overflow"
}

const CustomText: React.FC<CustomTextProps> = ({
  text,
  onTextChange,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(text)
  const textRef = useRef<HTMLDivElement>(null)

  const handleTextClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsEditing(true)
    setEditText(text)
  }

  const handleTextEdit = () => {
    if (!isEditing) return
    const newText = textRef.current?.textContent || ""
    onTextChange(newText)
    setIsEditing(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleTextEdit()
    } else if (e.key === "Escape") {
      setIsEditing(false)
      setEditText(text)
      // If we're canceling empty text, remove it completely
      if (text === "") {
        onTextChange("")
      }
    }
  }

  useEffect(() => {
    if (isEditing && textRef.current) {
      textRef.current.focus()
      // Place cursor at the end
      const range = document.createRange()
      const selection = window.getSelection()
      range.selectNodeContents(textRef.current)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }, [isEditing])

  // Update edit text when text prop changes
  useEffect(() => {
    setEditText(text)
  }, [text])

  // Start editing immediately if text is empty (new custom text)
  useEffect(() => {
    if (text === "" && !isEditing) {
      setIsEditing(true)
      setEditText("")
    }
  }, [text, isEditing])

  // Don't render anything if text is empty and not editing
  if (text === "" && !isEditing) {
    return null
  }

  return (
    <div
      ref={textRef}
      className={`custom-text${isEditing ? " is-editing" : ""}`}
      tabIndex={0}
      role="textbox"
      aria-readonly={!isEditing}
      aria-multiline="true"
      aria-label={isEditing ? "Edit note" : `Edit note: ${text}`}
      title={text}
      contentEditable={isEditing}
      suppressContentEditableWarning={true}
      onClick={handleTextClick}
      onBlur={(e) => {
        e.stopPropagation()
        handleTextEdit()
      }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (!isEditing && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          setIsEditing(true)
          setEditText(text)
        } else handleKeyPress(e)
      }}
      style={{ backgroundColor: isEditing ? UI_COLORS.background.primary : "var(--color-transparent)" }}
    >
      {isEditing ? editText : text}
    </div>
  )
}

export default CustomText
