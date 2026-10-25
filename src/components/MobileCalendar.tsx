import { eachDayOfInterval, endOfMonth, format, getDay, isToday, isWeekend, startOfMonth } from "date-fns"
import React, { useEffect, useRef, useState } from "react"
import { useCalendar } from "../contexts/CalendarContext"
import { ALL_COLOR_TEXTURE_CODES, applyColorToDate, COLORS, ColorTextureCode, DateCellData, getDateKey, TEXTURES, UI_COLORS, WEEKEND_COLOR } from "../utils/colors"
import "./MobileCalendar.css"

type MobileView = "Month" | "Agenda"
const monthKey = (year: number) => `nikolai_calendar_mobile_month_${year}`
const readMonth = (year: number): number => {
  try {
    const stored = localStorage.getItem(monthKey(year))
    if (stored !== null && /^\d+$/.test(stored) && Number(stored) < 12) return Number(stored)
  } catch { /* Browsing still works when storage is unavailable. */ }
  return year === new Date().getFullYear() ? new Date().getMonth() : 0
}
const appearance = (cell: DateCellData, date?: Date): React.CSSProperties => ({
  backgroundColor: cell.color ? COLORS[cell.color] : date && isWeekend(date) ? WEEKEND_COLOR : UI_COLORS.background.primary,
  ...(cell.texture ? { backgroundImage: TEXTURES[cell.texture], backgroundSize: "6px 6px" } : {}),
})
const NoteMark = () => <svg className="mobile-note-mark" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h8v12H4zM6 5h4M6 8h4M6 11h2" /></svg>

const MobileCalendar: React.FC = () => {
  const { selectedYear, dateCells, setDateCells, saveStatus, saveError } = useCalendar()
  const [month, setMonth] = useState(() => readMonth(selectedYear))
  const [view, setView] = useState<MobileView>(() => {
    try { return localStorage.getItem("nikolai_calendar_mobile_view") === "Agenda" ? "Agenda" : "Month" } catch { return "Month" }
  })
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const previousYear = useRef(selectedYear)

  useEffect(() => {
    if (previousYear.current !== selectedYear) {
      previousYear.current = selectedYear
      setMonth(readMonth(selectedYear))
      setSelectedDay(null)
    }
  }, [selectedYear])
  useEffect(() => {
    if (selectedDay !== null && dialog.current && !dialog.current.open) dialog.current.showModal()
  }, [selectedDay])

  const changeMonth = (next: number) => {
    setMonth(next)
    setSelectedDay(null)
    try { localStorage.setItem(monthKey(selectedYear), String(next)) } catch { /* Optional preference. */ }
  }
  const changeView = (next: MobileView) => {
    setView(next)
    try { localStorage.setItem("nikolai_calendar_mobile_view", next) } catch { /* Optional preference. */ }
  }
  const first = startOfMonth(new Date(selectedYear, month, 1))
  const days = eachDayOfInterval({ start: first, end: endOfMonth(first) })
  const leading = (getDay(first) + 6) % 7
  const plans = days.filter(day => {
    const cell = dateCells.get(getDateKey(day))
    return cell && (cell.customText || cell.color || cell.texture)
  })
  const selectedDate = selectedDay === null ? null : new Date(selectedYear, month, selectedDay)
  const selectedCell = selectedDate ? dateCells.get(getDateKey(selectedDate)) || {} : {}
  const selectedAppearance = selectedCell.color || selectedCell.texture
  const setNote = (text: string) => {
    if (!selectedDate) return
    const cells = new Map(dateCells)
    const cell = { ...selectedCell }
    if (text) cell.customText = text
    else delete cell.customText
    if (Object.keys(cell).length) cells.set(getDateKey(selectedDate), cell)
    else cells.delete(getDateKey(selectedDate))
    setDateCells(cells)
  }
  const setAppearance = (code: ColorTextureCode | null) => {
    if (!selectedDate || code === selectedAppearance || (!code && !selectedAppearance)) return
    if (code) applyColorToDate(selectedDate, dateCells, code, setDateCells)
    else {
      const cells = new Map(dateCells)
      const cell = { ...selectedCell }
      delete cell.color
      delete cell.texture
      if (Object.keys(cell).length) cells.set(getDateKey(selectedDate), cell)
      else cells.delete(getDateKey(selectedDate))
      setDateCells(cells)
    }
  }
  const closeEditor = () => dialog.current?.close()

  return <section className="mobile-planner no-print" aria-label="Mobile calendar">
    <div className="mobile-month-nav">
      <button type="button" aria-label="Previous month" disabled={month === 0} onClick={() => changeMonth(month - 1)}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5" /></svg></button>
      <h2><select className="mobile-month-select" aria-label="Month" value={month} onChange={event => changeMonth(Number(event.target.value))}>
        {Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{format(new Date(selectedYear, index, 1), "MMMM")}</option>)}
      </select></h2>
      <button type="button" aria-label="Next month" disabled={month === 11} onClick={() => changeMonth(month + 1)}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg></button>
    </div>
    <div className="mobile-view-selector" role="group" aria-label="Phone calendar view">
      {(["Month", "Agenda"] as MobileView[]).map(mode => <button type="button" key={mode} aria-pressed={view === mode} onClick={() => changeView(mode)}>{mode}</button>)}
    </div>
    <p className="mobile-instruction">Tap a date to edit its note or color.</p>
    {view === "Month" ? <>
      <div className="mobile-weekdays" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}</div>
      <div className="mobile-month-grid" role="group" aria-label={format(first, "MMMM yyyy")}>
        {Array.from({ length: leading }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
        {days.map(day => {
          const cell = dateCells.get(getDateKey(day)) || {}
          return <button type="button" className="mobile-day" key={day.getDate()} data-date={getDateKey(day)} data-today={isToday(day)}
            style={appearance(cell, day)} aria-label={`${format(day, "EEEE, d MMMM")}${cell.customText ? `: ${cell.customText}` : ""}`} onClick={() => setSelectedDay(day.getDate())}>
            <span className="mobile-day-number">{day.getDate()}</span>{cell.customText && <NoteMark />}
          </button>
        })}
      </div>
    </> : <div className="mobile-agenda">
      {plans.length ? <ul>{plans.map(day => {
        const cell = dateCells.get(getDateKey(day)) || {}
        return <li key={day.getDate()}><button type="button" className="mobile-agenda-item" aria-label={`Edit ${format(day, "EEEE, d MMMM")}`} onClick={() => setSelectedDay(day.getDate())}>
          <time className="mobile-agenda-date" dateTime={format(day, "yyyy-MM-dd")} style={appearance(cell, day)}><span>{day.getDate()}</span><span>{format(day, "EEE")}</span></time>
          <span className="mobile-agenda-content"><span className="mobile-agenda-heading">{format(day, "d MMMM")}</span><span className="mobile-agenda-note">{cell.customText || (cell.texture ? cell.texture.replace(/-/g, " ") : "Colored day")}</span></span>
          <svg className="mobile-agenda-chevron" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg>
        </button></li>
      })}</ul> : <div className="mobile-empty"><p>No plans in {format(first, "MMMM")} yet.</p><button type="button" onClick={() => changeView("Month")}>Choose a date</button></div>}
    </div>}
    {selectedDate && <dialog className="mobile-day-editor no-print" ref={dialog} aria-labelledby="mobile-editor-heading" onClose={() => setSelectedDay(null)}
      onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeEditor() } }}>
      <div className="mobile-editor-header"><h2 id="mobile-editor-heading">{format(selectedDate, "EEEE, d MMMM")}</h2><button type="button" aria-label="Close day editor" onClick={closeEditor}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button></div>
      <label htmlFor="mobile-note">Note</label>
      <textarea id="mobile-note" value={selectedCell.customText || ""} rows={3} maxLength={10000} placeholder="Add a note…" onChange={event => setNote(event.target.value)} />
      <div className="mobile-appearance-label"><span>Color and texture</span><span>{selectedAppearance ? selectedAppearance.replace(/-/g, " ") : "None"}</span></div>
      <div className="mobile-appearance-picker" role="group" aria-label="Day color and texture">
        {ALL_COLOR_TEXTURE_CODES.map(code => <button type="button" className="swatch" key={code} aria-label={code.replace(/-/g, " ")} aria-pressed={selectedAppearance === code} onClick={() => setAppearance(code)}>
          <span className="swatch-color" aria-hidden="true" style={code in COLORS ? { backgroundColor: COLORS[code as keyof typeof COLORS] } : { backgroundImage: TEXTURES[code as keyof typeof TEXTURES], backgroundSize: "6px 6px" }}>
            {selectedAppearance === code && <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>}
          </span>
        </button>)}
        <button type="button" className="swatch" aria-label="No color or texture" title="No color or texture" aria-pressed={!selectedAppearance} onClick={() => setAppearance(null)}><span className="swatch-color" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4 4 12" /></svg></span></button>
      </div>
      <p className={`mobile-editor-status${saveError ? " mobile-editor-status-error" : ""}`} role="status" aria-live="polite">{saveStatus}</p>
      <button type="button" className="button-primary mobile-editor-done" onClick={closeEditor}>Done</button>
    </dialog>}
  </section>
}

export default MobileCalendar
