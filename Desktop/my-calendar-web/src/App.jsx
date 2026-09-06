import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import './App.css';

const API_BASE_URL = "https://node02.overloader.cloud:8000";

const COLOR_MAP = {
  "운동": "#10b981",       
  "중국 공휴일": "#ef4444", 
  "중요": "#a855f7",       
  "캘린더": "#3b82f6",     
  "학교": "#eab308"        
};

function App() {
  const [allEvents, setAllEvents] = useState([]); 
  const [enabledCalendars, setEnabledCalendars] = useState({}); 
  
  const [selectedEvent, setSelectedEvent] = useState(null); 
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({
    calendarName: "캘린더",
    title: "",
    location: "",
    allDay: false,
    start: "",
    end: "",
    description: ""
  });

  async function handleDatesSet(dateInfo) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/calendar/events?start=${dateInfo.startStr}&end=${dateInfo.endStr}`);
      if (!response.ok) throw new Error("서버 응답 에러");
      
      const data = await response.json();
      setAllEvents(data);

      setEnabledCalendars((prev) => {
        const next = { ...prev };
        let isChanged = false;
        data.forEach((event) => {
          if (next[event.calendarName] === undefined) {
            next[event.calendarName] = true;
            isChanged = true;
          }
        });
        return isChanged ? next : prev;
      });
    } catch (error) {
      console.error("일정을 불러오는데 실패했습니다:", error);
    }
  }

  const filteredEvents = allEvents.filter(
    (event) => enabledCalendars[event.calendarName]
  );

  function handleDateSelect(selectInfo) {
    const startFormat = selectInfo.allDay ? selectInfo.startStr : selectInfo.startStr.slice(0, 16);
    const endFormat = selectInfo.allDay 
      ? (selectInfo.endStr || selectInfo.startStr)
      : (selectInfo.endStr ? selectInfo.endStr.slice(0, 16) : selectInfo.startStr.slice(0, 16));

    setAddFormData({
      calendarName: "캘린더", 
      title: "",
      location: "",
      allDay: selectInfo.allDay,
      start: startFormat,
      end: endFormat,
      description: ""
    });
    
    setIsAddModalOpen(true);
    selectInfo.view.calendar.unselect();
  }

  function handleAddSubmit() {
    if (!addFormData.title) {
      alert("제목을 입력해 주세요!");
      return;
    }

    const newEvent = {
      id: `temp_${Date.now()}`,
      calendarName: addFormData.calendarName,
      title: addFormData.title,
      start: addFormData.start,
      end: addFormData.end,
      allDay: addFormData.allDay,
      backgroundColor: COLOR_MAP[addFormData.calendarName] || "#222222",
      borderColor: COLOR_MAP[addFormData.calendarName] || "#222222",
      extendedProps: {
        location: addFormData.location,
        description: addFormData.description
      }
    };

    setAllEvents([...allEvents, newEvent]);
    setIsAddModalOpen(false);
  }

  function handleEventClick(clickInfo) {
    setSelectedEvent(clickInfo.event);
  }

  function handleDelete() {
    const shouldDelete = window.confirm(`"${selectedEvent.title}" 일정을 정말 삭제할까?`);
    if (shouldDelete) {
      setAllEvents((currentEvents) =>
        currentEvents.filter((event) => event.id !== selectedEvent.id)
      );
      setSelectedEvent(null);
    }
  }

  // --- 공통 입력칸 스타일 ---
  const inputStyle = {
    flex: 1, 
    padding: "8px", 
    fontFamily: "inherit", 
    border: "1px solid #d5d5d5", 
    borderRadius: "4px", 
    outline: "none",
    backgroundColor: "#ffffff", // 강제 흰색 배경
    color: "#333333"
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "32px 16px", boxSizing: "border-box", fontFamily: "'Gaegu', 'Comic Sans MS', 'Nanum Pen Script', sans-serif" }}>
      <main style={{ maxWidth: "1200px", margin: "0 auto", background: "#ffffff", padding: "28px", borderRadius: "16px", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)" }}>
        <header style={{ marginBottom: "24px" }}>
          <h1 style={{ margin: 0, color: "#161616", fontSize: "28px" }}>My Calendar</h1>
          
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "16px", padding: "12px", background: "#f8f9fa", border: "2px solid #161616", borderRadius: "4px 8px 6px 4px", transform: "rotate(0.2deg)" }}>
            {Object.entries(enabledCalendars).map(([calName, isChecked]) => (
              <label key={calName} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", color: "#161616" }}>
                <input type="checkbox" checked={isChecked} onChange={(e) => setEnabledCalendars((prev) => ({ ...prev, [calName]: e.target.checked }))} style={{ width: "16px", height: "16px", accentColor: "#161616", cursor: "pointer" }} />
                {calName}
              </label>
            ))}
          </div>
        </header>

        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate="2026-09-01"
          locale="ko"
          height="auto"
          firstDay={1}
          selectable={true}
          editable={true}
          eventStartEditable={true}
          eventDurationEditable={true}
          select={handleDateSelect} 
          eventClick={handleEventClick}
          events={filteredEvents} 
          datesSet={handleDatesSet} 
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          buttonText={{ today: "오늘", month: "월", week: "주", day: "일" }}
        />
      </main>

      {/* ================================================= */}
      {/* 1. 커스텀 팝업 (일정 추가용) */}
      {/* ================================================= */}
      {isAddModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.3)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }} onClick={() => setIsAddModalOpen(false)}>
          <div style={{ backgroundColor: "#fff", padding: "20px 24px", border: "3px solid #161616", borderRadius: "4px 10px 6px 8px", boxShadow: "6px 7px 0 #d5d5d5", transform: "rotate(0.5deg)", width: "460px", maxWidth: "90%", display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.85rem", color: "#161616" }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ width: "75px", fontWeight: "bold" }}>캘린더 :</label>
              <select value={addFormData.calendarName} onChange={(e) => setAddFormData({...addFormData, calendarName: e.target.value})} style={inputStyle}>
                <option value="캘린더">캘린더 (기본)</option>
                <option value="운동">운동</option>
                <option value="학교">학교</option>
                <option value="중요">중요</option>
                <option value="중국 공휴일">중국 공휴일</option>
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ width: "75px", fontWeight: "bold" }}>제목 :</label>
              <input type="text" value={addFormData.title} onChange={(e) => setAddFormData({...addFormData, title: e.target.value})} style={inputStyle} />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ width: "75px", fontWeight: "bold" }}>위치 :</label>
              <input type="text" value={addFormData.location} onChange={(e) => setAddFormData({...addFormData, location: e.target.value})} style={inputStyle} />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              {/* 하루종일 폰트 크기 살짝 작게 조정 */}
              <label style={{ width: "75px", fontWeight: "bold", fontSize: "0.8rem" }}>하루종일 :</label>
              <input type="checkbox" checked={addFormData.allDay} onChange={(e) => setAddFormData({...addFormData, allDay: e.target.checked})} style={{ width: "16px", height: "16px", accentColor: "#161616", cursor: "pointer" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ width: "75px", fontWeight: "bold" }}>시작 :</label>
              <input type={addFormData.allDay ? "date" : "datetime-local"} value={addFormData.start} onChange={(e) => setAddFormData({...addFormData, start: e.target.value})} style={inputStyle} />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <label style={{ width: "75px", fontWeight: "bold" }}>종료 :</label>
              <input type={addFormData.allDay ? "date" : "datetime-local"} value={addFormData.end} onChange={(e) => setAddFormData({...addFormData, end: e.target.value})} style={inputStyle} />
            </div>

            {/* 내용 라벨을 왼쪽으로 정렬하고 텍스트박스는 깨끗한 흰색(연한 테두리)으로 변경 */}
            <div style={{ display: "flex", alignItems: "flex-start", marginTop: "4px" }}>
              <label style={{ width: "75px", fontWeight: "bold", paddingTop: "10px" }}>내용 :</label>
              <textarea value={addFormData.description} onChange={(e) => setAddFormData({...addFormData, description: e.target.value})} style={{ flex: 1, padding: "12px", fontFamily: "inherit", border: "1px solid #e0e0e0", borderRadius: "6px", backgroundColor: "#ffffff", color: "#333", minHeight: "150px", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            </div>

            {/* 버튼 색상 서로 교체 */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
              <button onClick={handleAddSubmit} style={{ padding: "6px 16px", background: "#161616", color: "#ffffff", border: "2px solid #161616", borderRadius: "7px 4px 8px 5px", cursor: "pointer", fontWeight: "bold" }}>저장</button>
              <button onClick={() => setIsAddModalOpen(false)} style={{ padding: "6px 16px", background: "#ffffff", color: "#161616", border: "2px solid #161616", borderRadius: "4px 7px 5px 8px", cursor: "pointer", fontWeight: "bold" }}>취소</button>
            </div>

          </div>
        </div>
      )}

      {/* ================================================= */}
      {/* 2. 커스텀 팝업 (일정 상세 보기용) */}
      {/* ================================================= */}
      {selectedEvent && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.3)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }} onClick={() => setSelectedEvent(null)}>
          <div style={{ backgroundColor: "#fff", padding: "24px", border: "3px solid #161616", borderRadius: "4px 10px 6px 8px", boxShadow: "6px 7px 0 #d5d5d5", transform: "rotate(-0.5deg)", width: "480px", maxWidth: "90%", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ flex: 1, paddingRight: "16px", textAlign: "left" }}>
                <h2 style={{ margin: "0 0 8px 0", color: "#161616", fontSize: "1.4rem", wordBreak: "keep-all" }}>{selectedEvent.title}</h2>
                {selectedEvent.extendedProps?.location && (
                  <p style={{ margin: 0, color: "#5b5b5b", fontSize: "0.95rem", fontWeight: "bold" }}>위치 : {selectedEvent.extendedProps.location}</p>
                )}
              </div>
              <div style={{ color: "#5b5b5b", fontSize: "0.85rem", textAlign: "right", whiteSpace: "nowrap", paddingTop: "4px" }}>
                <p style={{ margin: "0 0 4px 0" }}>시작: {selectedEvent.start ? selectedEvent.start.toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }) : "시간 없음"}</p>
                {selectedEvent.end && (
                  <p style={{ margin: 0 }}>종료: {selectedEvent.end.toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })}</p>
                )}
              </div>
            </div>
            <div style={{ backgroundColor: "#fafafa", border: "2px solid #d5d5d5", borderRadius: "6px", padding: "16px", minHeight: "120px", maxHeight: "200px", overflowY: "auto", marginBottom: "24px", textAlign: "left", fontSize: "0.95rem", color: "#333", whiteSpace: "pre-wrap" }}>
              {selectedEvent.extendedProps?.description || "상세 내용이 없습니다."}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button onClick={handleDelete} style={{ padding: "6px 12px", background: "#fff", color: "#ef4444", border: "2px solid #ef4444", borderRadius: "4px 7px 5px 8px", cursor: "pointer", fontWeight: "bold" }}>삭제</button>
              <button onClick={() => setSelectedEvent(null)} style={{ padding: "6px 12px", background: "#161616", color: "#fff", border: "2px solid #161616", borderRadius: "7px 4px 8px 5px", cursor: "pointer", fontWeight: "bold" }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;