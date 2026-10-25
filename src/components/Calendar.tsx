import React, { useEffect, useState } from "react"
import { flushSync } from "react-dom"
import { useCalendar } from "../contexts/CalendarContext"
import CalendarTitle from "./CalendarTitle"
import ColorPicker from "./ColorPicker"
import ClassicView from "./views/ClassicView"
import ColumnView from "./views/ColumnView"
import LinearView from "./views/LinearView"
import MobileCalendar from "./MobileCalendar"
import ViewSelector from "./ViewSelector"

const Calendar: React.FC = () => {
  const { selectedYear, dateCells, setDateCells, selectedColorTexture, selectedView, setSelectedView } = useCalendar()

  const [isPrinting, setIsPrinting] = useState(() => window.matchMedia("print").matches)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches)
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)")
    const changed = () => setIsMobile(query.matches)
    query.addEventListener("change", changed)
    return () => query.removeEventListener("change", changed)
  }, [])

  useEffect(() => {
    const query = window.matchMedia("print")
    const changed = () => setIsPrinting(query.matches)
    // Mount the full year before print captures it, without rendering it on phones.
    const before = () => flushSync(() => setIsPrinting(true))
    const after = () => setIsPrinting(false)
    query.addEventListener("change", changed)
    window.addEventListener("beforeprint", before)
    window.addEventListener("afterprint", after)
    return () => {
      query.removeEventListener("change", changed)
      window.removeEventListener("beforeprint", before)
      window.removeEventListener("afterprint", after)
    }
  }, [])

  return (
    <main className="calendar-shell">
      {(!isMobile || isPrinting) && <header className="calendar-header">
        <span className="calendar-brand">Nikolai Calendar</span>
        <CalendarTitle />
      </header>}
      <div className="calendar-toolbar desktop-controls no-print">
        <ViewSelector selectedView={selectedView} onViewChange={setSelectedView} />
        <ColorPicker />
      </div>
      <p className="calendar-instruction desktop-controls no-print">Paint a day with a color. Select a date to add a note.
        {selectedView !== "Classic" && <span className="calendar-scroll-hint">Scroll sideways to see the full calendar.</span>}
      </p>

      {isMobile && <MobileCalendar />}
      <div className="desktop-calendar">
        {(!isMobile || isPrinting) && (selectedView === "Linear" ? (
          <LinearView
            selectedYear={selectedYear}
            dateCells={dateCells}
            setDateCells={setDateCells}
            selectedColorTexture={selectedColorTexture}
          />
        ) : selectedView === "Classic" ? (
          <ClassicView
            selectedYear={selectedYear}
            dateCells={dateCells}
            setDateCells={setDateCells}
            selectedColorTexture={selectedColorTexture}
          />
        ) : (
          <ColumnView
            selectedYear={selectedYear}
            dateCells={dateCells}
            setDateCells={setDateCells}
            selectedColorTexture={selectedColorTexture}
          />
        ))}
      </div>
    </main>
  )
}

export default Calendar
