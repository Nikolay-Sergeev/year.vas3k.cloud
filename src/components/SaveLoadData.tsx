import React, { useRef } from "react"
import { useCalendar } from "../contexts/CalendarContext"

const SaveLoadData: React.FC = () => {
  const {
    selectedYear,
    dateCells,
    selectedColorTexture,
    selectedView,
    importData,
  } = useCalendar()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSaveData = () => {
    const dataToSave = {
      selectedYear,
      dateCells: Object.fromEntries(dateCells),
      selectedColorTexture,
      selectedView,
      exportDate: new Date().toISOString(),
      version: "2.0",
    }

    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `year-planner-data-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleLoadData = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const loadedData = JSON.parse(e.target?.result as string)

        if (!loadedData || typeof loadedData !== "object") {
          alert("Invalid data file format")
          return
        }

        importData(loadedData)
      } catch (error) {
        alert("Error loading data: Invalid JSON format")
        console.error("Error parsing loaded data:", error)
      }
    }
    reader.readAsText(file)

    event.target.value = ""
  }

  const handleCleanAll = () => {
    if (window.confirm("Are you sure you want to delete all data? The server keeps a backup before saving.")) {
      importData({ selectedYear: new Date().getFullYear(), dateCells: {}, selectedColorTexture: "red", selectedView: "Linear" })
    }
  }

  return (
    <section className="calendar-data no-print" aria-label="Calendar data">
      <div className="data-actions">
        <button className="button-primary" onClick={handleSaveData}>Export backup…</button>
        <button onClick={handleLoadData}>Import calendar</button>
        <button className="button-danger" onClick={handleCleanAll}>Clean All</button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: "none" }} />
      </div>
      <details className="data-help">
        <summary>Saving and backups</summary>
        <p>Changes save automatically on Nikolai Server. The status below confirms each save.</p>
        <p>The server keeps the previous 100 versions. Import replaces the current calendar; unsaved changes stay in this browser if the connection fails.</p>
      </details>
      <a className="source-link" href="https://github.com/Nikolay-Sergeev/year.vas3k.cloud">Ideas, bugs and feature requests on GitHub</a>
    </section>
  )
}
export default SaveLoadData
