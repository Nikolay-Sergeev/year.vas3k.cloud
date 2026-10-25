import React from "react"
export type CalendarView = "Linear" | "Classic" | "Column"
interface ViewSelectorProps { selectedView: CalendarView; onViewChange: (view: CalendarView) => void }
const ViewSelector: React.FC<ViewSelectorProps> = ({ selectedView, onViewChange }) => {
  const views: CalendarView[] = ["Linear", "Classic", "Column"]
  return <div className="view-selector" role="group" aria-label="Calendar view">
    {views.map(view => <button type="button" key={view} aria-pressed={selectedView === view} onClick={() => onViewChange(view)}>{view}</button>)}
  </div>
}
export default ViewSelector
