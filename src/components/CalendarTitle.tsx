import React from "react"
import { useCalendar } from "../contexts/CalendarContext"

const CalendarTitle: React.FC = () => {
  const { selectedYear, setSelectedYear } = useCalendar()
  return (
    <h1 className="calendar-title">
      <span className="calendar-title-prefix">My plans for</span>{" "}
      <span className="year-navigation">
        <button type="button" className="no-print" aria-label="Previous year" disabled={selectedYear <= 1900} onClick={() => setSelectedYear(selectedYear - 1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5" /></svg>
        </button>
        <span className="calendar-year" aria-label="Calendar year" aria-live="polite" aria-atomic="true">{selectedYear}</span>
        <button type="button" className="no-print" aria-label="Next year" disabled={selectedYear >= 2200} onClick={() => setSelectedYear(selectedYear + 1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg>
        </button>
      </span>
    </h1>
  )
}

export default CalendarTitle
