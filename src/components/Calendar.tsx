import React from "react"
import { useCalendar } from "../contexts/CalendarContext"
import CalendarTitle from "./CalendarTitle"
import ColorPicker from "./ColorPicker"
import SaveLoadData from "./SaveLoadData"
import ClassicView from "./views/ClassicView"
import ColumnView from "./views/ColumnView"
import LinearView from "./views/LinearView"
import ViewSelector from "./ViewSelector"

const Calendar: React.FC = () => {
  const { selectedYear, dateCells, setDateCells, selectedColorTexture, selectedView, setSelectedView } = useCalendar()

  return (
    <main className="calendar-shell">
      <header className="calendar-header">
        <span className="calendar-brand">Nikolai Calendar</span>
        <CalendarTitle />
      </header>
      <div className="calendar-toolbar no-print">
        <ViewSelector selectedView={selectedView} onViewChange={setSelectedView} />
        <ColorPicker />
      </div>
      <p className="calendar-instruction no-print">Paint a day with a color. Select a date to add a note.
        {selectedView !== "Classic" && <span className="calendar-scroll-hint">Scroll sideways to see the full calendar.</span>}
      </p>

      {selectedView === "Linear" ? (
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
      )}

      <div className="no-print">
        <SaveLoadData />
      </div>
    </main>
  )
}

export default Calendar
