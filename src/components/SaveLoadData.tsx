import React, { useRef } from "react"
import { useCalendar } from "../contexts/CalendarContext"
import { UI_COLORS } from "../utils/colors"

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
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "16px",
          marginTop: "30px",
          padding: "20px",
          borderTop: `1px solid ${UI_COLORS.border.tertiary}`,
        }}
      >
        <button
          onClick={handleSaveData}
          style={{
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: "bold",
            backgroundColor: UI_COLORS.button.primary.normal,
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "background-color 0.2s ease",
            touchAction: "auto",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = UI_COLORS.button.primary.hover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = UI_COLORS.button.primary.normal
          }}
        >
          Export backup…
        </button>

        <button
          onClick={handleLoadData}
          style={{
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: "bold",
            backgroundColor: UI_COLORS.button.success.normal,
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "background-color 0.2s ease",
            touchAction: "auto",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = UI_COLORS.button.success.hover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = UI_COLORS.button.success.normal
          }}
        >
          Import calendar
        </button>

        <button
          onClick={handleCleanAll}
          style={{
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: "bold",
            backgroundColor: UI_COLORS.button.danger.normal,
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "background-color 0.2s ease",
            touchAction: "auto",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = UI_COLORS.button.danger.hover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = UI_COLORS.button.danger.normal
          }}
        >
          Clean All
        </button>

        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: "none" }} />
      </div>

      <div
        style={{
          color: UI_COLORS.text.secondary,
          textAlign: "center",
          maxWidth: "800px",
          margin: "0 auto",
          padding: "20px",
        }}
      >
        <p style={{ fontSize: "16px" }}>
          Changes are saved automatically on Nikolai Server. The status at the top confirms when your changes are saved.
        </p>
        <p style={{ fontSize: "13px", paddingTop: "20px" }}>
          The server keeps the previous 100 versions. You can also export a JSON backup or import an existing calendar.
          Import replaces the current calendar; unsaved changes stay in this browser if the connection fails.
        </p>
        <p style={{ fontSize: "13px", paddingBottom: "100px" }}>
          Ideas, bugs and feature requests — <a href="https://github.com/Nikolay-Sergeev/year.vas3k.cloud">on GitHub</a>.
        </p>
      </div>
    </>
  )
}

export default SaveLoadData
