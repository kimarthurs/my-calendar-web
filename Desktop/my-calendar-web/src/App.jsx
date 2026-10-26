import { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import "./App.css";

const API_BASE_URL = "";
const EMPTY = { calendarId: "", title: "", location: "", allDay: false, start: "", end: "", description: "" };
const panel = { background: "white", padding: 24, borderRadius: 12, width: 500, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box", color: "#1f2937" };
const overlay = { position: "fixed", inset: 0, background: "#0006", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 };
const field = { width: "100%", boxSizing: "border-box", padding: 10, marginTop: 5, border: "1px solid #cbd5e1", borderRadius: 6, background: "white", color: "#111827", font: "inherit" };

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...options });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { throw new Error(`API가 JSON 대신 다른 응답을 보냈습니다 (${res.status}). 배포 설정을 확인하세요.`); }
  if (!res.ok) {
    const detail = data?.detail;
    const err = new Error(typeof detail === "string" ? detail : detail?.message || `요청 실패 (${res.status})`);
    err.code = detail?.code;
    throw err;
  }
  return data;
}

export default function App() {
  const [allEvents, setAllEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [enabled, setEnabled] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const range = useRef(null);
  const requestNumber = useRef(0);

  useEffect(() => {
    let active = true;
    api("/api/calendar/calendars").then((data) => {
      if (!active) return;
      setCalendars(data);
      setEnabled((prev) => Object.fromEntries(data.map((c) => [c.id, prev[c.id] ?? true])));
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);

  async function refreshEvents() {
    if (!range.current) return;
    const number = ++requestNumber.current;
    const params = new URLSearchParams(range.current);
    const data = await api(`/api/calendar/events?${params}`);
    if (number === requestNumber.current) setAllEvents(data);
  }

  async function handleDatesSet(info) {
    range.current = { start: info.startStr, end: info.endStr };
    try { await refreshEvents(); setError(""); } catch (e) { setError(e.message); }
  }

  function handleDateSelect(info) {
    if (!calendars.length || busy) { info.view.calendar.unselect(); return; }
    setError(""); setNotice("");
    setForm({ ...EMPTY, calendarId: calendars[0].id, allDay: info.allDay,
      start: info.allDay ? info.startStr : info.startStr.slice(0, 16),
      end: info.allDay ? info.endStr : info.endStr.slice(0, 16) });
    setShowAdd(true);
    info.view.calendar.unselect();
  }

  async function afterWrite(message) {
    setNotice(message);
    try { await refreshEvents(); }
    catch (e) { setError("저장·삭제 작업은 완료됐지만 목록 새로고침에 실패했어요: " + e.message); }
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/api/calendar/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setShowAdd(false);
      await afterWrite("Radicale에 저장했어요.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (busy || !selectedEvent) return;
    if (!window.confirm(`"${selectedEvent.title}" 일정을 Radicale에서 삭제할까요?`)) return;
    setBusy(true); setError(""); setNotice("");
    const path = `/api/calendar/events/${encodeURIComponent(selectedEvent.id)}`;
    try {
      try { await api(path, { method: "DELETE" }); }
      catch (err) {
        if (err.code !== "RECURRING_SERIES") throw err;
        if (!window.confirm("반복 일정입니다. 선택한 하루만이 아니라 이 반복 일정 전체(과거·미래·예외 일정)를 삭제합니다. 계속할까요?")) return;
        await api(`${path}?series=true`, { method: "DELETE" });
      }
      setSelectedEvent(null);
      await afterWrite("Radicale에서 삭제했어요.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  function change(key, value) { setForm((prev) => ({ ...prev, [key]: value })); }
  const shownEvents = allEvents.filter((event) => enabled[event.calendarId]);
  const renderError = error ? <p role="alert" style={{ color: "#b91c1c", whiteSpace: "pre-wrap" }}>{error}</p> : null;

  return (
    <div style={{ minHeight: "100vh", padding: "24px 12px", background: "#f1f5f9", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24, background: "white", borderRadius: 14, color: "#111827" }}>
        <h1>My Calendar</h1>
        {renderError}
        {notice && <p role="status" style={{ color: "#047857" }}>{notice}</p>}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
          {calendars.map((c) => <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={!!enabled[c.id]} onChange={(e) => setEnabled((prev) => ({ ...prev, [c.id]: e.target.checked }))} style={{ accentColor: c.color }} />
            <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: c.color }} />{c.name}
          </label>)}
        </div>
        <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="dayGridMonth" locale="ko" height="auto" firstDay={1}
          selectable={!busy && calendars.length > 0} editable={false} select={handleDateSelect} eventClick={(info) => { setError(""); setSelectedEvent(info.event); }}
          events={shownEvents} datesSet={handleDatesSet}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          buttonText={{ today: "오늘", month: "월", week: "주", day: "일" }} />
      </main>

      {showAdd && <div style={overlay} onClick={() => { if (!busy) setShowAdd(false); }}>
        <form style={panel} onSubmit={handleAddSubmit} onClick={(e) => e.stopPropagation()}>
          <h2>일정 추가</h2>{renderError}
          <label>캘린더<select style={field} value={form.calendarId} disabled={busy} onChange={(e) => change("calendarId", e.target.value)}>{calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <p><label>제목<input style={field} required maxLength={1000} value={form.title} disabled={busy} onChange={(e) => change("title", e.target.value)} /></label></p>
          <p><label>위치<input style={field} value={form.location} disabled={busy} onChange={(e) => change("location", e.target.value)} /></label></p>
          <p><label><input type="checkbox" checked={form.allDay} disabled={busy} onChange={(e) => {
            const checked = e.target.checked;
            setForm((prev) => ({ ...prev, allDay: checked, start: checked ? prev.start.slice(0, 10) : `${prev.start.slice(0, 10)}T09:00`, end: checked ? prev.end.slice(0, 10) : `${prev.end.slice(0, 10)}T10:00` }));
          }} /> 하루 종일</label></p>
          <p><label>시작<input style={field} type={form.allDay ? "date" : "datetime-local"} required value={form.start} disabled={busy} onChange={(e) => change("start", e.target.value)} /></label></p>
          <p><label>종료<input style={field} type={form.allDay ? "date" : "datetime-local"} required value={form.end} disabled={busy} onChange={(e) => change("end", e.target.value)} /></label></p>
          {form.allDay && <small>종료일은 포함하지 않습니다. 하루 일정은 다음 날을 종료일로 지정하세요.</small>}
          {!form.allDay && <p><small>입력 시간대는 서버 CALENDAR_TIMEZONE 설정 기준입니다.</small></p>}
          <p><label>내용<textarea style={{ ...field, minHeight: 130 }} value={form.description} disabled={busy} onChange={(e) => change("description", e.target.value)} /></label></p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><button type="button" disabled={busy} onClick={() => setShowAdd(false)}>취소</button><button type="submit" disabled={busy}>{busy ? "저장 중…" : "저장"}</button></div>
        </form>
      </div>}

      {selectedEvent && <div style={overlay} onClick={() => { if (!busy) setSelectedEvent(null); }}>
        <div style={panel} onClick={(e) => e.stopPropagation()}>
          <h2>{selectedEvent.title}</h2>{renderError}
          <p>{selectedEvent.extendedProps.calendarName}</p>
          {selectedEvent.extendedProps.location && <p>위치: {selectedEvent.extendedProps.location}</p>}
          <p>시작: {selectedEvent.start?.toLocaleString("ko-KR")}</p>
          {selectedEvent.end && <p>종료: {selectedEvent.end.toLocaleString("ko-KR")}{selectedEvent.allDay ? " (종료일 미포함)" : ""}</p>}
          <p style={{ whiteSpace: "pre-wrap", maxHeight: 250, overflowY: "auto" }}>{selectedEvent.extendedProps.description || "상세 내용이 없습니다."}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}><button disabled={busy} onClick={handleDelete} style={{ color: "#dc2626" }}>{busy ? "처리 중…" : "삭제"}</button><button disabled={busy} onClick={() => setSelectedEvent(null)}>닫기</button></div>
        </div>
      </div>}
    </div>
  );
}
