import React, { createContext, useContext, useEffect, useRef, useState } from "react"
import { ALL_COLOR_TEXTURE_CODES, COLORS, TEXTURES, ColorTextureCode, DateCellData } from "../utils/colors"

type CalendarView = "Linear" | "Classic" | "Column"
interface StoredData {
  selectedYear: number
  dateCells: Record<string, DateCellData>
  selectedColorTexture: ColorTextureCode
  selectedView: CalendarView
}
interface CalendarContextType {
  saveStatus: string
  saveError: boolean
  selectedYear: number
  setSelectedYear: (year: number) => void
  dateCells: Map<string, DateCellData>
  setDateCells: (cells: Map<string, DateCellData>) => void
  selectedColorTexture: ColorTextureCode
  setSelectedColorTexture: (color: ColorTextureCode) => void
  selectedView: CalendarView
  setSelectedView: (view: CalendarView) => void
  importData: (data: unknown) => void
}
const CalendarContext = createContext<CalendarContextType | undefined>(undefined)
const DRAFT_KEY = "nikolai_calendar_unsaved_draft"
const empty: StoredData = { selectedYear: new Date().getFullYear(), dateCells: {}, selectedColorTexture: "red", selectedView: "Linear" }
function parseData(value: unknown): StoredData {
  const data = value as StoredData
  if (!data || !Number.isInteger(data.selectedYear) || data.selectedYear < 1900 || data.selectedYear > 2200 ||
      !data.dateCells || typeof data.dateCells !== "object" || Array.isArray(data.dateCells) ||
      !ALL_COLOR_TEXTURE_CODES.includes(data.selectedColorTexture) || !["Linear", "Classic", "Column"].includes(data.selectedView)) {
    throw new Error("Invalid calendar file")
  }
  if (Object.keys(data.dateCells).length > 30000) throw new Error("Too many calendar entries")
  for (const [key, cell] of Object.entries(data.dateCells)) {
    const parts = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key)
    if (!parts || !cell || typeof cell !== "object" || Array.isArray(cell)) throw new Error("Invalid calendar entry")
    const [year, month, day] = parts.slice(1).map(Number)
    const date = new Date(Date.UTC(year, month, day))
    if (year < 1900 || year > 2200 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day ||
        (cell.color !== undefined && !Object.prototype.hasOwnProperty.call(COLORS, cell.color)) ||
        (cell.texture !== undefined && !Object.prototype.hasOwnProperty.call(TEXTURES, cell.texture)) ||
        (cell.customText !== undefined && (typeof cell.customText !== "string" || cell.customText.length > 10000)) ||
        Object.keys(cell).some(k => !["color", "texture", "customText"].includes(k))) throw new Error("Invalid calendar entry")
  }
  return { selectedYear: data.selectedYear, dateCells: data.dateCells, selectedColorTexture: data.selectedColorTexture, selectedView: data.selectedView }
}
const request = (init: RequestInit = {}) => fetch("/api/calendar", { credentials: "same-origin", cache: "no-store", ...init, signal: AbortSignal.timeout(15000) })

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<StoredData>(empty)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState("Loading calendar…")
  const [error, setError] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const current = useRef(empty)
  const tag = useRef("")
  const dirty = useRef(false)
  const saving = useRef(false)
  const blocked = useRef(false)
  const generation = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [hasDraft, setHasDraft] = useState(() => { try { return !!localStorage.getItem(DRAFT_KEY) } catch { return false } })

  const cacheDraft = (value: StoredData) => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(value)) } catch { /* Export remains available. */ }
  }
  const save = async () => {
    if (!dirty.current || saving.current || blocked.current || !tag.current) return
    saving.current = true
    const sent = generation.current
    setStatus("Saving…")
    try {
      const response = await request({ method: "PUT", headers: { "Content-Type": "application/json", "If-Match": tag.current }, body: JSON.stringify(current.current) })
      if (response.status === 412) {
        blocked.current = true
        setConflict(true)
        throw new Error("Another device saved changes. Export your draft, then reload the server calendar.")
      }
      if (response.status === 401) setSessionExpired(true)
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in again, then retry saving." : "Could not save. Your draft is kept in this browser; retry when connected.")
      tag.current = response.headers.get("ETag") || ""
      if (!tag.current) throw new Error("Server did not confirm the saved version. Retry saving.")
      if (generation.current === sent) {
        dirty.current = false
        try { localStorage.removeItem(DRAFT_KEY) } catch { /* No data loss. */ }
        setHasDraft(false)
        setStatus("Saved on server")
      }
      setError(false)
    } catch (err) {
      setError(true)
      setStatus(err instanceof Error ? err.message : "Could not save. Retry when connected.")
    } finally {
      saving.current = false
      if (dirty.current && generation.current !== sent && !blocked.current) timer.current = setTimeout(save, 500)
    }
  }
  const update = (patch: Partial<StoredData>) => {
    current.current = { ...current.current, ...patch }
    generation.current++
    dirty.current = true
    cacheDraft(current.current)
    setData(current.current)
    setStatus(blocked.current ? "Conflict: export your draft before reloading." : "Unsaved changes…")
    clearTimeout(timer.current)
    timer.current = setTimeout(save, 500)
  }

  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (dirty.current || saving.current || blocked.current) return
      const started = generation.current
      try {
        const response = await request()
        if (response.status === 401) setSessionExpired(true)
        if (!response.ok) throw new Error("Could not load calendar. Sign in again or reconnect.")
        const loaded = parseData(await response.json())
        const revision = response.headers.get("ETag")
        if (!revision) throw new Error("Server version is missing. Reload to try again.")
        if (!active || dirty.current || generation.current !== started) return
        tag.current = revision
        current.current = loaded
        setData(loaded)
        setReady(true)
        setSessionExpired(false)
        setStatus("Saved on server")
        setError(false)
      } catch (err) {
        if (active) { setError(true); setStatus(err instanceof Error ? err.message : "Connection failed. Reconnect and retry.") }
      }
    }
    void refresh()
    const interval = setInterval(refresh, 15000)
    window.addEventListener("focus", refresh)
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) { cacheDraft(current.current); event.preventDefault(); event.returnValue = "" }
    }
    window.addEventListener("beforeunload", beforeUnload)
    return () => {
      active = false
      clearInterval(interval)
      clearTimeout(timer.current)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("beforeunload", beforeUnload)
    }
  }, [])

  const exportDraft = () => {
    const blob = new Blob([JSON.stringify(current.current, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "calendar-unsaved-draft.json"
    link.click()
    URL.revokeObjectURL(url)
  }
  const restoreDraft = () => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY)
      if (draft && window.confirm("Restore this browser’s unsaved draft over the displayed server calendar?")) update(parseData(JSON.parse(draft)))
    } catch { setError(true); setStatus("The saved draft could not be read. Import a JSON backup instead.") }
  }
  const value: CalendarContextType = {
    ...data,
    saveStatus: status,
    saveError: error,
    dateCells: new Map(Object.entries(data.dateCells)),
    setSelectedYear: year => update({ selectedYear: year }),
    setDateCells: cells => update({ dateCells: Object.fromEntries(cells) }),
    setSelectedColorTexture: color => update({ selectedColorTexture: color }),
    setSelectedView: view => update({ selectedView: view }),
    importData: loaded => update(parseData(loaded)),
  }
  return <CalendarContext.Provider value={value}>
    {ready && children}
    <footer className={`save-status no-print${error ? " save-status-error" : ""}`} role="status" aria-live="polite">
      <span className="save-status-label">{status}</span>
      <div className="save-status-actions">
      {sessionExpired && <button onClick={() => window.location.assign("/login")}>Sign in</button>}{" "}
      {ready && error && !conflict && <button onClick={() => void save()}>Retry save</button>}{" "}
      {ready && (error || conflict) && <button onClick={exportDraft}>Export draft</button>}{" "}
      {(conflict || !ready) && <button onClick={() => { if (!dirty.current || window.confirm("Export your draft first. Reload the server calendar now?")) window.location.reload() }}>Reload server calendar</button>}
      {ready && hasDraft && !dirty.current && <button onClick={restoreDraft}>Restore unsaved draft</button>}
      {ready && !sessionExpired && <button className="sign-out" onClick={async () => {
        if (dirty.current && !window.confirm("Your draft will stay in this browser. Sign out with unsaved changes?")) return
        try {
          const response = await fetch("/api/logout", { method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(15000) })
          if (!response.ok) throw new Error("Could not sign out. Try again.")
          window.location.assign("/login")
        } catch { setError(true); setStatus("Could not sign out. Check your connection and try again.") }
      }}>Sign out</button>}
      </div>
    </footer>
  </CalendarContext.Provider>
}
export const useCalendar = (): CalendarContextType => {
  const context = useContext(CalendarContext)
  if (!context) throw new Error("useCalendar must be used within a CalendarProvider")
  return context
}
