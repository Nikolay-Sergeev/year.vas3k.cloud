import React, { useEffect, useRef, useState } from "react"
import type { StoredData } from "../contexts/CalendarContext"

const SaveLoadData: React.FC<{ data: StoredData; onImport: (data: unknown) => void }> = ({ data, onImport }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (isOpen && dialog.current && !dialog.current.open) dialog.current.showModal()
  }, [isOpen])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSaveData = () => {
    const dataToSave = {
      ...data,
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

        onImport(loadedData)
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
      onImport({ selectedYear: new Date().getFullYear(), dateCells: {}, selectedColorTexture: "red", selectedView: "Linear" })
    }
  }

  return (
    <>
      <button type="button" className="settings-toggle" aria-haspopup="dialog" aria-expanded={isOpen} aria-controls="calendar-settings" onClick={() => setIsOpen(true)}>Settings</button>
      {isOpen && <dialog id="calendar-settings" className="calendar-settings no-print" ref={dialog} aria-labelledby="settings-heading" onClose={() => setIsOpen(false)}
        onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close() } }}>
      <div className="settings-header">
        <h2 id="settings-heading">Settings</h2>
        <button type="button" aria-label="Close settings" onClick={() => dialog.current?.close()}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button>
      </div>
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
      </dialog>}
    </>
  )
}
export default SaveLoadData
