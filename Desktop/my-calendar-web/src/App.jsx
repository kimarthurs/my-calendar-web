import { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import "./App.css";

const API_BASE_URL = "";

const COLOR_MAP = {
  "운동": "#10b981",
  "중국 공휴일": "#ef4444",
  "중요": "#a855f7",
  "캘린더": "#3b82f6",
  "학교": "#eab308",
};

const FONT_OPTIONS = [
  { label: "시스템 기본 글꼴", value: "system-ui, -apple-system, sans-serif" },
  { label: "Noto Sans KR", value: "'Noto Sans KR', sans-serif" },
  { label: "나눔고딕", value: "'Nanum Gothic', sans-serif" },
  { label: "나눔명조", value: "'Nanum Myeongjo', serif" },
];

function App() {
  // 상단 탭 상태 ('calendar' | 'todo' | 'settings')
  const [activeTab, setActiveTab] = useState("calendar");

  // 캘린더 목록 및 필터 상태
  const [calendars, setCalendars] = useState([]); // [{ id, name, color }, ...]
  const [enabledCalendars, setEnabledCalendars] = useState({});
  const [showTodosOnCalendar, setShowTodosOnCalendar] = useState(true);

  // 일정 및 할 일 데이터 상태
  const [allEvents, setAllEvents] = useState([]);
  const [todos, setTodos] = useState([]);
  const [currentRange, setCurrentRange] = useState({ startStr: "", endStr: "" });

  // 선택된 일정 & 추가 모달 상태
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [addFormData, setAddFormData] = useState({
    calendarId: "",
    title: "",
    location: "",
    allDay: false,
    start: "",
    end: "",
    description: "",
  });

  // 글꼴 설정 상태 (localStorage 연동)
  const [selectedFont, setSelectedFont] = useState(() => {
    return localStorage.getItem("calendar_font") || FONT_OPTIONS[0].value;
  });

  // 1. 글꼴 변경 시 CSS 변수(--calendar-font) 및 localStorage 업데이트
  useEffect(() => {
    document.documentElement.style.setProperty("--calendar-font", selectedFont);
    localStorage.setItem("calendar_font", selectedFont);
  }, [selectedFont]);

  // 2. 초기 캘린더 목록 불러오기 (GET /api/calendar/calendars)
  useEffect(() => {
    async function fetchCalendars() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/calendar/calendars`);
        if (!res.ok) throw new Error(`캘린더 목록 조회 실패: ${res.status}`);
        const data = await res.json();
        // 백엔드 응답 형태가 배열이라고 가정 (예: [{ id: "...", name: "캘린더" }, ...])
        const calList = Array.isArray(data) ? data : data.calendars || [];
        setCalendars(calList);

        // 모든 캘린더 필터 기본 체크 활성화
        const initialEnabled = {};
        calList.forEach((cal) => {
          const key = cal.id || cal.name;
          initialEnabled[key] = true;
        });
        setEnabledCalendars(initialEnabled);

        // 추가 폼 기본 캘린더 ID 지정
        if (calList.length > 0) {
          setAddFormData((prev) => ({
            ...prev,
            calendarId: calList[0].id || calList[0].name,
          }));
        }
      } catch (err) {
        console.error("캘린더 목록을 불러오지 못했습니다:", err);
      }
    }

    fetchCalendars();
  }, []);

  // 3. 기간별 일정 조회 함수
  async function fetchEvents(startStr, endStr) {
    if (!startStr || !endStr) return;
    try {
      const params = new URLSearchParams({ start: startStr, end: endStr });
      const response = await fetch(
        `${API_BASE_URL}/api/calendar/events?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`서버 응답 에러: ${response.status}`);
      }

      const data = await response.json();
      setAllEvents(data);

      // 만약 /api/calendar/calendars 가 아직 없거나 누락된 캘린더가 있을 때를 대비한 보완
      setEnabledCalendars((prev) => {
        const next = { ...prev };
        let isChanged = false;
        data.forEach((event) => {
          const key = event.calendarId || event.calendarName;
          if (key && next[key] === undefined) {
            next[key] = true;
            isChanged = true;
          }
        });
        return isChanged ? next : prev;
      });
    } catch (error) {
      console.error("일정을 불러오는데 실패했습니다:", error);
    }
  }

  // 4. 할 일(VTODO) 목록 조회 함수 (백엔드에 /api/calendar/todos 구현 시 동작)
  async function fetchTodos() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/calendar/todos`);

      if (!res.ok) {
        throw new Error(`할 일 조회 실패 (${res.status})`);
      }

      const data = await res.json();
      setTodos(Array.isArray(data) ? data : data.todos || []);
    } catch (err) {
      console.error("할 일을 불러오지 못했습니다:", err);
    }
  }

  useEffect(() => {
    fetchTodos();
  }, []);

  // 달력 날짜 범위 변경 시 호출
  function handleDatesSet(dateInfo) {
    setCurrentRange({ startStr: dateInfo.startStr, endStr: dateInfo.endStr });
    fetchEvents(dateInfo.startStr, dateInfo.endStr);
  }

  // /todos 응답은 다음 필드를 사용하도록 백엔드와 맞출 예정:
  // id, calendarId, title, start, due, completed
  const todoEvents = showTodosOnCalendar
    ? todos
        .filter((todo) => !todo.completed && (todo.due || todo.start))
        .map((todo) => {
          // 달력에서는 마감일을 우선 표시
          const when = todo.due || todo.start;
          const cal = calendars.find((item) => item.id === todo.calendarId);
          const color = cal?.color || "#64748b";

          return {
            id: `todo:${todo.id}`,
            calendarId: todo.calendarId,
            title: `☐ ${todo.title}`,
            start: when,
            allDay: /^\d{4}-\d{2}-\d{2}$/.test(when),
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
              kind: "todo",
              todoId: todo.id,
              description: todo.description || "",
            },
          };
        })
    : [];

  const filteredEvents = [...allEvents, ...todoEvents]
    .filter((event) => {
      const key = event.calendarId || event.calendarName;
      return enabledCalendars[key] ?? true;
    })
    .map((event) => {
      const cal = calendars.find((item) => item.id === event.calendarId);
      const color =
        event.backgroundColor ||
        cal?.color ||
        COLOR_MAP[event.calendarName] ||
        "#3b82f6";

      return {
        ...event,
        backgroundColor: color,
        borderColor: color,
      };
    });

  // 날짜 드래그/클릭하여 일정 추가 모달 열기
  function handleDateSelect(selectInfo) {
    const startFormat = selectInfo.allDay
      ? selectInfo.startStr
      : selectInfo.startStr.slice(0, 16);
    const endFormat = selectInfo.allDay
      ? selectInfo.endStr || selectInfo.startStr
      : selectInfo.endStr
      ? selectInfo.endStr.slice(0, 16)
      : selectInfo.startStr.slice(0, 16);

    const defaultCalId =
      calendars.find((cal) => cal.name === "캘린더")?.id ||
      calendars[0]?.id ||
      "";

    setAddFormData({
      calendarId: defaultCalId,
      title: "",
      location: "",
      allDay: selectInfo.allDay,
      start: startFormat,
      end: endFormat,
      description: "",
    });

    setIsAddModalOpen(true);
    selectInfo.view.calendar.unselect();
  }

  // 5. 일정 추가 서버 전송 (POST /api/calendar/events)
  async function handleAddSubmit() {
    if (isSubmitting) return;

    if (
      !addFormData.calendarId ||
      !calendars.some((cal) => cal.id === addFormData.calendarId)
    ) {
      alert("캘린더 목록을 먼저 불러와야 합니다. 새로고침 후 다시 시도해 주세요.");
      return;
    }

    if (!addFormData.title.trim()) {
      alert("제목을 입력해 주세요!");
      return;
    }

    if (!addFormData.start) {
      alert("시작 날짜를 입력해 주세요.");
      return;
    }

    if (
      addFormData.end &&
      addFormData.end <= addFormData.start
    ) {
      alert(
        addFormData.allDay
          ? "종료일은 시작일보다 뒤여야 합니다. 하루 일정은 다음 날을 선택하세요."
          : "종료 시간은 시작 시간보다 뒤여야 합니다."
      );
      return;
    }

    setIsSubmitting(true);

    // 이 아래는 기존 try { ... } 코드를 그대로 유지
    try {
      const payload = {
        calendarId: addFormData.calendarId,
        title: addFormData.title.trim(),
        location: addFormData.location.trim(),
        allDay: addFormData.allDay,
        start: addFormData.start,
        end: addFormData.end,
        description: addFormData.description,
      };

      const response = await fetch(`${API_BASE_URL}/api/calendar/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`저장 실패 (${response.status}): ${errText}`);
      }

      setIsAddModalOpen(false);
      // 저장 성공 후 현재 화면 기간 다시 조회
      await fetchEvents(currentRange.startStr, currentRange.endStr);
    } catch (error) {
      console.error("일정 저장 중 오류:", error);
      alert(`일정을 저장하지 못했습니다.\n${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  // 일정 클릭 시 상세 모달 열기
  function handleEventClick(clickInfo) {
    if (clickInfo.event.extendedProps.kind === "todo") {
      setSelectedEvent(null);
      setActiveTab("todo");
      return;
    }

    setSelectedEvent(clickInfo.event);
  }

  // 6. 일정 삭제 서버 전송 (DELETE /api/calendar/events/{event_id}) + 반복 일정 409 처리
  async function handleDelete() {
    if (!selectedEvent) return;

    const shouldDelete = window.confirm(
      `"${selectedEvent.title}" 일정을 정말 삭제할까요?`
    );
    if (!shouldDelete) return;

    const eventId = encodeURIComponent(selectedEvent.id);

    try {
      let response = await fetch(
        `${API_BASE_URL}/api/calendar/events/${eventId}`,
        { method: "DELETE" }
      );

      // 반복 일정(409 Conflict)인 경우 사용자에게 전체 삭제 여부 확인
      if (response.status === 409) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch {
          // JSON 파싱 실패 시 무시
        }

        const isRecurring =
          errorData?.code === "RECURRING_SERIES" ||
          errorData?.detail?.code === "RECURRING_SERIES";

        if (isRecurring) {
          const confirmSeries = window.confirm(
            "이 일정은 반복 일정입니다. 반복 일정 전체를 삭제할까요?"
          );
          if (!confirmSeries) return;

          response = await fetch(
            `${API_BASE_URL}/api/calendar/events/${eventId}?series=true`,
            { method: "DELETE" }
          );
        }
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`삭제 실패 (${response.status}): ${errText}`);
      }

      setSelectedEvent(null);
      // 삭제 성공 후 현재 화면 기간 다시 조회
      await fetchEvents(currentRange.startStr, currentRange.endStr);
    } catch (error) {
      console.error("일정 삭제 중 오류:", error);
      alert(`일정을 삭제하지 못했습니다.\n${error.message}`);
    }
  }

  // 할 일 완료 토글 (PATCH 또는 POST /api/calendar/todos/{id}/toggle 예시)
  async function handleToggleTodo(todo) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/calendar/todos/${encodeURIComponent(todo.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: !todo.completed }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `상태 변경 실패 (${response.status}): ${await response.text()}`
        );
      }

      await fetchTodos();
    } catch (err) {
      console.error("할 일 상태 변경 실패:", err);
      alert(`할 일 상태를 변경하지 못했습니다.\n${err.message}`);
    }
  }

  const inputStyle = {
    flex: 1,
    padding: "8px",
    fontFamily: "inherit",
    border: "1px solid #d5d5d5",
    borderRadius: "4px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#333333",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: "32px 16px",
        boxSizing: "border-box",
      }}
    >
      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          background: "#ffffff",
          padding: "28px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <header style={{ marginBottom: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <h1 style={{ margin: 0, color: "#161616", fontSize: "28px" }}>
              My Calendar
            </h1>

            {/* 상단 탭: [캘린더] [할 일] [설정] */}
            <nav style={{ display: "flex", gap: "8px" }}>
              {[
                { key: "calendar", label: "캘린더" },
                { key: "todo", label: "할 일" },
                { key: "settings", label: "설정" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "8px 16px",
                    background: activeTab === tab.key ? "#161616" : "#ffffff",
                    color: activeTab === tab.key ? "#ffffff" : "#161616",
                    border: "2px solid #161616",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* 캘린더 탭일 때만 필터 목록 표시 */}
          {activeTab === "calendar" && (
            <div
              style={{
                display: "flex",
                gap: "16px",
                flexWrap: "wrap",
                marginTop: "16px",
                padding: "12px",
                background: "#f8f9fa",
                border: "2px solid #161616",
                borderRadius: "6px",
              }}
            >
              {calendars.length > 0
                ? calendars.map((cal) => {
                    const key = cal.id || cal.name;
                    const isChecked = enabledCalendars[key] ?? true;
                    return (
                      <label
                        key={key}
                        style={{
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontWeight: "bold",
                          color: "#161616",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setEnabledCalendars((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          style={{
                            width: "16px",
                            height: "16px",
                            accentColor: "#161616",
                            cursor: "pointer",
                          }}
                        />
                        {cal.name}
                      </label>
                    );
                  })
                : Object.entries(enabledCalendars).map(([calKey, isChecked]) => (
                    <label
                      key={calKey}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontWeight: "bold",
                        color: "#161616",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setEnabledCalendars((prev) => ({
                            ...prev,
                            [calKey]: e.target.checked,
                          }))
                        }
                        style={{
                          width: "16px",
                          height: "16px",
                          accentColor: "#161616",
                          cursor: "pointer",
                        }}
                      />
                      {calKey}
                    </label>
                  ))}

              {/* 할 일 표시 토글 */}
              <label
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: "bold",
                  color: "#161616",
                  marginLeft: "auto",
                }}
              >
                <input
                  type="checkbox"
                  checked={showTodosOnCalendar}
                  onChange={(e) => setShowTodosOnCalendar(e.target.checked)}
                  style={{
                    width: "16px",
                    height: "16px",
                    accentColor: "#161616",
                    cursor: "pointer",
                  }}
                />
                할 일 표시
              </label>
            </div>
          )}
        </header>

        {/* 탭 1: 캘린더 화면 */}
        {activeTab === "calendar" && (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={new Date()}
            locale="ko"
            height="auto"
            firstDay={1}
            selectable={true}
            editable={false}
            eventStartEditable={false}
            eventDurationEditable={false}
            select={handleDateSelect}
            eventClick={handleEventClick}
            events={filteredEvents}
            datesSet={handleDatesSet}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            buttonText={{ today: "오늘", month: "월", week: "주", day: "일" }}
          />
        )}

        {/* 탭 2: 할 일(VTODO) 화면 */}
        {activeTab === "todo" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <section>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "#161616" }}>
                미완료 할 일 (기한 있음)
              </h2>
              {todos.filter((t) => !t.completed && (t.due || t.start)).length === 0 ? (
                <p style={{ color: "#64748b" }}>기한이 지정된 할 일이 없습니다.</p>
              ) : (
                todos
                  .filter((t) => !t.completed && (t.due || t.start))
                  .map((todo) => (
                    <div
                      key={todo.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => handleToggleTodo(todo)}
                      />
                      <span style={{ fontWeight: "bold", color: "#161616" }}>
                        {todo.title}
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: "0.85rem", color: "#64748b" }}>
                        {todo.due || todo.start}
                      </span>
                    </div>
                  ))
              )}
            </section>

            <section>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "#161616" }}>
                미완료 할 일 (날짜 없음)
              </h2>
              {todos.filter((t) => !t.completed && !t.due && !t.start).length === 0 ? (
                <p style={{ color: "#64748b" }}>날짜 없는 할 일이 없습니다.</p>
              ) : (
                todos
                  .filter((t) => !t.completed && !t.due && !t.start)
                  .map((todo) => (
                    <div
                      key={todo.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => handleToggleTodo(todo)}
                      />
                      <span style={{ fontWeight: "bold", color: "#161616" }}>
                        {todo.title}
                      </span>
                    </div>
                  ))
              )}
            </section>

            <section>
              <h2 style={{ fontSize: "1.2rem", marginBottom: "12px", color: "#64748b" }}>
                완료된 항목
              </h2>
              {todos.filter((t) => t.completed).length === 0 ? (
                <p style={{ color: "#94a3b8" }}>완료된 항목이 없습니다.</p>
              ) : (
                todos
                  .filter((t) => t.completed)
                  .map((todo) => (
                    <div
                      key={todo.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        borderBottom: "1px solid #e2e8f0",
                        color: "#94a3b8",
                        textDecoration: "line-through",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => handleToggleTodo(todo)}
                      />
                      <span>{todo.title}</span>
                    </div>
                  ))
              )}
            </section>
          </div>
        )}

        {/* 탭 3: 설정 화면 (글꼴 선택) */}
        {activeTab === "settings" && (
          <div
            style={{
              padding: "20px",
              background: "#f8f9fa",
              border: "2px solid #161616",
              borderRadius: "8px",
              maxWidth: "480px",
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "1.25rem", color: "#161616" }}>
              화면 설정
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" }}>
              <label style={{ fontWeight: "bold", color: "#161616", minWidth: "90px" }}>
                글꼴 선택 :
              </label>
              <select
                value={selectedFont}
                onChange={(e) => setSelectedFont(e.target.value)}
                style={inputStyle}
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.label} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "#5b5b5b" }}>
              선택한 글꼴은 현재 브라우저(localStorage)에 자동 저장됩니다.
            </p>
          </div>
        )}
      </main>

      {/* ================================================= */}
      {/* 1. 커스텀 팝업 (일정 추가용) */}
      {/* ================================================= */}
      {isAddModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "20px 24px",
              border: "3px solid #161616",
              borderRadius: "8px",
              boxShadow: "6px 7px 0 #d5d5d5",
              width: "460px",
              maxWidth: "90%",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              fontSize: "0.9rem",
              color: "#161616",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ width: "75px", fontWeight: "bold" }}>캘린더 :</label>
              <select
                value={addFormData.calendarId}
                disabled={calendars.length === 0}
                onChange={(e) =>
                  setAddFormData((prev) => ({
                    ...prev,
                    calendarId: e.target.value,
                  }))
                }
                style={inputStyle}
              >
                {calendars.length === 0 && (
                  <option value="">캘린더 목록을 불러오지 못했습니다</option>
                )}

                {calendars.map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ width: "75px", fontWeight: "bold" }}>제목 :</label>
              <input
                type="text"
                value={addFormData.title}
                onChange={(e) =>
                  setAddFormData({ ...addFormData, title: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ width: "75px", fontWeight: "bold" }}>위치 :</label>
              <input
                type="text"
                value={addFormData.location}
                onChange={(e) =>
                  setAddFormData({ ...addFormData, location: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label
                style={{
                  width: "75px",
                  fontWeight: "bold",
                  fontSize: "0.85rem",
                }}
              >
                하루종일 :
              </label>

              <input
                type="checkbox"
                checked={addFormData.allDay}
                onChange={(e) => {
                  const allDay = e.target.checked;

                  const convert = (value) => {
                    if (!value) return "";

                    return allDay
                      ? value.slice(0, 10)
                      : value.length === 10
                      ? `${value}T00:00`
                      : value;
                  };

                  setAddFormData((prev) => ({
                    ...prev,
                    allDay,
                    start: convert(prev.start),
                    end: convert(prev.end),
                  }));
                }}
                style={{
                  width: "16px",
                  height: "16px",
                  accentColor: "#161616",
                  cursor: "pointer",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ width: "75px", fontWeight: "bold" }}>시작 :</label>
              <input
                type={addFormData.allDay ? "date" : "datetime-local"}
                value={addFormData.start}
                onChange={(e) =>
                  setAddFormData({ ...addFormData, start: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ width: "75px", fontWeight: "bold" }}>종료 :</label>
              <input
                type={addFormData.allDay ? "date" : "datetime-local"}
                value={addFormData.end}
                onChange={(e) =>
                  setAddFormData({ ...addFormData, end: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            {addFormData.allDay && (
              <small style={{ color: "#64748b" }}>
                종료일은 포함하지 않습니다. 하루 일정은 시작일의 다음 날을 선택하세요.
              </small>
            )}

            <div style={{ display: "flex", alignItems: "flex-start", marginTop: "4px" }}>
              <label style={{ width: "75px", fontWeight: "bold", paddingTop: "10px" }}>
                내용 :
              </label>
              <textarea
                value={addFormData.description}
                onChange={(e) =>
                  setAddFormData({ ...addFormData, description: e.target.value })
                }
                style={{
                  flex: 1,
                  padding: "12px",
                  fontFamily: "inherit",
                  border: "1px solid #e0e0e0",
                  borderRadius: "6px",
                  backgroundColor: "#ffffff",
                  color: "#333",
                  minHeight: "150px",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
                marginTop: "16px",
              }}
            >
              <button
                onClick={handleAddSubmit}
                disabled={isSubmitting}
                style={{
                  padding: "6px 16px",
                  background: "#161616",
                  color: "#ffffff",
                  border: "2px solid #161616",
                  borderRadius: "6px",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                {isSubmitting ? "저장 중..." : "저장"}
              </button>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  padding: "6px 16px",
                  background: "#ffffff",
                  color: "#161616",
                  border: "2px solid #161616",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* 2. 커스텀 팝업 (일정 상세 보기용) */}
      {/* ================================================= */}
      {selectedEvent && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "24px",
              border: "3px solid #161616",
              borderRadius: "8px",
              boxShadow: "6px 7px 0 #d5d5d5",
              width: "480px",
              maxWidth: "90%",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "16px",
              }}
            >
              <div style={{ flex: 1, paddingRight: "16px", textAlign: "left" }}>
                <h2
                  style={{
                    margin: "0 0 8px 0",
                    color: "#161616",
                    fontSize: "1.4rem",
                    wordBreak: "keep-all",
                  }}
                >
                  {selectedEvent.title}
                </h2>
                {selectedEvent.extendedProps?.location && (
                  <p
                    style={{
                      margin: 0,
                      color: "#5b5b5b",
                      fontSize: "0.95rem",
                      fontWeight: "bold",
                    }}
                  >
                    위치 : {selectedEvent.extendedProps.location}
                  </p>
                )}
              </div>
              <div
                style={{
                  color: "#5b5b5b",
                  fontSize: "0.85rem",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  paddingTop: "4px",
                }}
              >
                <p style={{ margin: "0 0 4px 0" }}>
                  시작:{" "}
                  {selectedEvent.start
                    ? selectedEvent.start.toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        hour12: true,
                      })
                    : "시간 없음"}
                </p>
                {selectedEvent.end && (
                  <p style={{ margin: 0 }}>
                    종료:{" "}
                    {selectedEvent.end.toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                      hour: "numeric",
                      minute: "numeric",
                      hour12: true,
                    })}
                  </p>
                )}
              </div>
            </div>
            <div
              style={{
                backgroundColor: "#fafafa",
                border: "2px solid #d5d5d5",
                borderRadius: "6px",
                padding: "16px",
                minHeight: "120px",
                maxHeight: "200px",
                overflowY: "auto",
                marginBottom: "24px",
                textAlign: "left",
                fontSize: "0.95rem",
                color: "#333",
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedEvent.extendedProps?.description || "상세 내용이 없습니다."}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={handleDelete}
                style={{
                  padding: "6px 12px",
                  background: "#fff",
                  color: "#ef4444",
                  border: "2px solid #ef4444",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                삭제
              </button>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  padding: "6px 12px",
                  background: "#161616",
                  color: "#fff",
                  border: "2px solid #161616",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
