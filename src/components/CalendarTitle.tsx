import React from "react"
import { useCalendar } from "../contexts/CalendarContext"

const CalendarTitle: React.FC = () => {
  const { selectedYear, setSelectedYear } = useCalendar()
  const currentYear = new Date().getFullYear()

  const yearOptions = Array.from(new Set([selectedYear, ...Array.from({ length: 7 }, (_, i) => currentYear - 1 + i)])).sort((a, b) => a - b)

  return (
    <h1 className="calendar-title">
      <span className="calendar-title-prefix">My plans for</span>{" "}
      <select aria-label="Calendar year" className="year-select" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
        {yearOptions.map((yearOption) => (
          <option key={yearOption} value={yearOption}>
            {yearOption}
          </option>
        ))}
      </select>
    </h1>
  )
}

export default CalendarTitle
