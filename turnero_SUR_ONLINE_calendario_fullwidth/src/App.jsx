import React, { useEffect, useMemo, useState } from "react";
import { supabase, modoOnline } from "./supabaseClient";
import {
  CalendarDays, Users, UserRound, Clock3, BarChart3, Settings, Bell, Plus,
  ChevronLeft, ChevronRight, Calendar, Search, Trash2, HeartPulse, ShieldCheck,
  Star, Wifi, WifiOff, Save
} from "lucide-react";

const lesionesBase = [
  "Contractura lumbar", "Cervicalgia", "Lumbalgia crónica", "Rehabilitación de hombro",
  "Rehabilitación de rodilla", "Esguince de tobillo", "Post operatorio", "Reeducación postural",
  "Dolor ciático", "Tendinitis", "Traumatología", "Neurológica", "Respiratoria"
];

const colores = ["green", "blue", "purple", "red", "orange", "teal"];

const configInicial = {
  horariosManana: ["08:00", "09:00", "10:00", "11:00", "12:00"],
  horariosTarde: ["14:00", "15:00", "16:00", "17:00", "18:00"],
  duracionTurno: 60,
  maxPorHora: 3,
  lesiones: lesionesBase
};

const leer = (clave, defecto) => {
  try {
    const valor = localStorage.getItem(clave);
    return valor ? JSON.parse(valor) : defecto;
  } catch {
    return defecto;
  }
};
const guardarLocal = (clave, valor) => localStorage.setItem(clave, JSON.stringify(valor));
const hoyISO = () => new Date().toISOString().slice(0, 10);
const sumarDias = (iso, dias) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const fechaLarga = (iso) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

const horaFin = (hora, minutos) => {
  const [h, m] = hora.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + Number(minutos), 0, 0);
  return d.toTimeString().slice(0, 5);
};

const diasDelMes = (iso) => {
  const base = new Date(iso + "T12:00:00");
  const y = base.getFullYear();
  const m = base.getMonth();
  const primero = new Date(y, m, 1);
  const ultimo = new Date(y, m + 1, 0);
  const inicioSemana = (primero.getDay() + 6) % 7;
  const dias = [];
  for (let i = 0; i < inicioSemana; i++) {
    const d = new Date(y, m, 1 - inicioSemana + i);
    dias.push({ iso: d.toISOString().slice(0, 10), num: d.getDate(), fuera: true });
  }
  for (let n = 1; n <= ultimo.getDate(); n++) {
    const d = new Date(y, m, n);
    dias.push({ iso: d.toISOString().slice(0, 10), num: n, fuera: false });
  }
  while (dias.length % 7 !== 0) {
    const d = new Date(y, m, ultimo.getDate() + (dias.length % 7));
    dias.push({ iso: d.toISOString().slice(0, 10), num: d.getDate(), fuera: true });
  }
  return dias;
};

export default function App() {
  const [vista, setVista] = useState("Agenda");
  const [fecha, setFecha] = useState(() => leer("sur_fecha", hoyISO()));
  const [config, setConfig] = useState(() => leer("sur_config", configInicial));
  const [profesionales, setProfesionales] = useState(() => leer("sur_profesionales", [
    { id: "local-cecilia", nombre: "Lic. Cecilia", especialidad: "Kinesiología", activo: true }
  ]));
  const [profId, setProfId] = useState(() => leer("sur_prof_id", "local-cecilia"));
  const [turnos, setTurnos] = useState(() => leer("sur_turnos", []));
  const [pacientes, setPacientes] = useState(() => leer("sur_pacientes", []));
  const [modalTurno, setModalTurno] = useState(null);
  const [modalPaciente, setModalPaciente] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [nuevoProf, setNuevoProf] = useState({ nombre: "", especialidad: "" });
  const [nuevoHorario, setNuevoHorario] = useState({ bloque: "mañana", hora: "" });
  const [nuevaLesion, setNuevaLesion] = useState("");
  const [estado, setEstado] = useState(modoOnline ? "Conectando..." : "Modo local");
  const [modoAgenda, setModoAgenda] = useState("Calendario");
  const [filtroCalendario, setFiltroCalendario] = useState("todos");
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);

  const profActual = profesionales.find(p => p.id === profId) || profesionales[0];

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => guardarLocal("sur_fecha", fecha), [fecha]);
  useEffect(() => guardarLocal("sur_config", config), [config]);
  useEffect(() => guardarLocal("sur_profesionales", profesionales), [profesionales]);
  useEffect(() => guardarLocal("sur_prof_id", profId), [profId]);
  useEffect(() => guardarLocal("sur_turnos", turnos), [turnos]);
  useEffect(() => guardarLocal("sur_pacientes", pacientes), [pacientes]);

  const cargarDatos = async () => {
    if (!supabase) return;
    try {
      setEstado("Online");
      const [profs, pacs, turns, conf] = await Promise.all([
        supabase.from("profesionales").select("*").order("created_at", { ascending: true }),
        supabase.from("pacientes").select("*").order("created_at", { ascending: false }),
        supabase.from("turnos").select("*").order("fecha", { ascending: true }),
        supabase.from("configuracion").select("*").eq("id", "principal").maybeSingle()
      ]);

      if (profs.data?.length) {
        const map = profs.data.map(p => ({ id: p.id, nombre: p.nombre, especialidad: p.especialidad, activo: p.activo }));
        setProfesionales(map);
        setProfId(map[0].id);
      }

      if (pacs.data) {
        setPacientes(pacs.data.map(p => ({
          id: p.id, nombre: p.nombre, dni: p.dni || "", telefono: p.telefono || "",
          obraSocial: p.obra_social || "", lesion: p.lesion || "", notas: p.notas || ""
        })));
      }

      if (turns.data) {
        setTurnos(turns.data.map(t => ({
          id: t.id, fecha: t.fecha, hora: t.hora, bloque: t.bloque,
          profesionalId: t.profesional_id, profesional: t.profesional,
          pacienteId: t.paciente_id, paciente: t.paciente, dni: t.dni || "",
          telefono: t.telefono || "", obraSocial: t.obra_social || "",
          lesion: t.lesion || "", notas: t.notas || "", estado: t.estado || "Confirmado",
          color: t.color || "teal"
        })));
      }

      if (conf.data?.data) setConfig({ ...configInicial, ...conf.data.data });
    } catch (e) {
      console.error(e);
      setEstado("Error online - usando local");
    }
  };

  const guardarConfigOnline = async (nuevaConfig) => {
    setConfig(nuevaConfig);
    if (!supabase) return;
    await supabase.from("configuracion").upsert({
      id: "principal",
      data: nuevaConfig,
      updated_at: new Date().toISOString()
    });
  };

  const turnosDia = useMemo(
    () => turnos.filter(t => t.fecha === fecha && t.profesionalId === profActual?.id),
    [turnos, fecha, profActual]
  );

  const estadisticas = useMemo(() => {
    const porLesion = {};
    const porProfesional = {};
    turnos.forEach(t => {
      porLesion[t.lesion || "Sin lesión"] = (porLesion[t.lesion || "Sin lesión"] || 0) + 1;
      porProfesional[t.profesional || "Sin profesional"] = (porProfesional[t.profesional || "Sin profesional"] || 0) + 1;
    });
    return { porLesion, porProfesional, total: turnos.length, pacientes: pacientes.length };
  }, [turnos, pacientes]);

  const turnosEnHora = (hora) => turnosDia.filter(t => t.hora === hora);

  const normalizarEstado = (valor = "") =>
    valor
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-");

  const etiquetaEstado = (valor = "") => {
    const estado = normalizarEstado(valor);
    const etiquetas = {
      confirmado: "Confirmado",
      pendiente: "Pendiente",
      asistio: "Asistió",
      aviso: "Avisó",
      "no-aviso": "No avisó"
    };
    return etiquetas[estado] || valor || "Sin estado";
  };

  const primerHorarioDisponible = (iso) => {
    const todosHorarios = [...config.horariosManana, ...config.horariosTarde];
    const libre = todosHorarios.find(h =>
      turnos.filter(t => t.fecha === iso && t.hora === h && t.profesionalId === profActual?.id).length < Number(config.maxPorHora)
    );
    return libre || todosHorarios[0] || "08:00";
  };

  const bloquePorHora = (hora) => config.horariosTarde.includes(hora) ? "Tarde" : "Mañana";

  const cambiarMes = (delta) => {
    const base = new Date(fecha + "T12:00:00");
    base.setMonth(base.getMonth() + delta, 1);
    setFecha(base.toISOString().slice(0, 10));
  };

  const abrirTurnoEnDia = (iso) => {
    const hora = primerHorarioDisponible(iso);
    setFecha(iso);
    setModalTurno({ fecha: iso, hora, bloque: bloquePorHora(hora) });
  };

  const moverTurnoFecha = async (id, nuevaFecha) => {
    const turno = turnos.find(t => String(t.id) === String(id));
    if (!turno || turno.fecha === nuevaFecha) return;

    const fechaAnterior = turno.fecha;
    setTurnoSeleccionado({ ...turno, fecha: nuevaFecha });
    setTurnos(prev => prev.map(t => String(t.id) === String(id) ? { ...t, fecha: nuevaFecha } : t));

    if (supabase) {
      const { error } = await supabase.from("turnos").update({ fecha: nuevaFecha }).eq("id", id);
      if (error) {
        alert("No se pudo reprogramar el turno online. Se vuelve a la fecha anterior.");
        setTurnos(prev => prev.map(t => String(t.id) === String(id) ? { ...t, fecha: fechaAnterior } : t));
        setTurnoSeleccionado(turno);
      }
    }
  };

  const turnosDelMes = useMemo(() => {
    const base = new Date(fecha + "T12:00:00");
    const mes = base.getMonth();
    const anio = base.getFullYear();
    return turnos.filter(t => {
      const d = new Date(t.fecha + "T12:00:00");
      return d.getMonth() === mes && d.getFullYear() === anio && t.profesionalId === profActual?.id;
    });
  }, [turnos, fecha, profActual]);

  const resumenMes = useMemo(() => {
    const contar = (estado) => turnosDelMes.filter(t => normalizarEstado(t.estado) === estado).length;
    return {
      total: turnosDelMes.length,
      confirmados: contar("confirmado"),
      pendientes: contar("pendiente"),
      asistieron: contar("asistio")
    };
  }, [turnosDelMes]);

  const turnosCalendario = useMemo(() => {
    if (filtroCalendario === "todos") return turnosDelMes;
    return turnosDelMes.filter(t => normalizarEstado(t.estado) === filtroCalendario);
  }, [turnosDelMes, filtroCalendario]);

  const agregarProfesional = async () => {
    const nombre = nuevoProf.nombre.trim();
    if (!nombre) return;
    const especialidad = nuevoProf.especialidad.trim() || "Kinesiología";

    if (supabase) {
      const { data, error } = await supabase.from("profesionales").insert({ nombre, especialidad }).select().single();
      if (!error && data) {
        const prof = { id: data.id, nombre: data.nombre, especialidad: data.especialidad, activo: data.activo };
        setProfesionales([...profesionales, prof]);
        setProfId(prof.id);
      }
    } else {
      const prof = { id: crypto.randomUUID(), nombre, especialidad, activo: true };
      setProfesionales([...profesionales, prof]);
      setProfId(prof.id);
    }
    setNuevoProf({ nombre: "", especialidad: "" });
  };

  const eliminarProfesional = async (id) => {
    if (profesionales.length <= 1) return alert("Debe quedar al menos un profesional.");
    if (!confirm("¿Eliminar profesional?")) return;

    if (supabase) await supabase.from("profesionales").delete().eq("id", id);
    const nuevos = profesionales.filter(p => p.id !== id);
    setProfesionales(nuevos);
    if (profId === id) setProfId(nuevos[0].id);
  };

  const guardarPaciente = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const paciente = {
      nombre: data.get("nombre").trim(),
      dni: data.get("dni").trim(),
      telefono: data.get("telefono").trim(),
      obraSocial: data.get("obraSocial").trim(),
      lesion: data.get("lesion"),
      notas: data.get("notas").trim()
    };
    if (!paciente.nombre) return;

    if (supabase) {
      const { data: saved, error } = await supabase.from("pacientes").insert({
        nombre: paciente.nombre, dni: paciente.dni, telefono: paciente.telefono,
        obra_social: paciente.obraSocial, lesion: paciente.lesion, notas: paciente.notas
      }).select().single();
      if (!error && saved) setPacientes([{ ...paciente, id: saved.id }, ...pacientes]);
    } else {
      setPacientes([{ ...paciente, id: crypto.randomUUID() }, ...pacientes]);
    }
    setModalPaciente(false);
  };

  const guardarTurno = async (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const pacienteId = data.get("pacienteId");
    const pacienteExistente = pacientes.find(p => p.id === pacienteId);
    const manual = data.get("pacienteManual").trim();
    const nombre = pacienteExistente?.nombre || manual;
    if (!nombre) return;

    let pacienteFinal = pacienteExistente;
    if (!pacienteFinal && manual) {
      pacienteFinal = {
        id: crypto.randomUUID(),
        nombre,
        dni: data.get("dni").trim(),
        telefono: data.get("telefono").trim(),
        obraSocial: data.get("obraSocial").trim(),
        lesion: data.get("lesion"),
        notas: ""
      };
      if (supabase) {
        const { data: saved } = await supabase.from("pacientes").insert({
          nombre: pacienteFinal.nombre, dni: pacienteFinal.dni, telefono: pacienteFinal.telefono,
          obra_social: pacienteFinal.obraSocial, lesion: pacienteFinal.lesion
        }).select().single();
        if (saved) pacienteFinal.id = saved.id;
      }
      setPacientes([pacienteFinal, ...pacientes]);
    }

    const fechaTurno = modalTurno.fecha || fecha;

    const turno = {
      id: crypto.randomUUID(),
      fecha: fechaTurno,
      hora: modalTurno.hora,
      bloque: modalTurno.bloque,
      profesionalId: profActual.id,
      profesional: profActual.nombre,
      pacienteId: pacienteFinal?.id || "",
      paciente: nombre,
      dni: pacienteFinal?.dni || data.get("dni").trim(),
      telefono: pacienteFinal?.telefono || data.get("telefono").trim(),
      obraSocial: pacienteFinal?.obraSocial || data.get("obraSocial").trim(),
      lesion: data.get("lesion") || pacienteFinal?.lesion || "Sesión kinesiológica",
      notas: data.get("notas").trim(),
      estado: "Confirmado",
      color: colores[turnos.length % colores.length]
    };

    if (supabase) {
      const { data: saved, error } = await supabase.from("turnos").insert({
        fecha: turno.fecha, hora: turno.hora, bloque: turno.bloque,
        profesional_id: turno.profesionalId, profesional: turno.profesional,
        paciente_id: turno.pacienteId || null, paciente: turno.paciente, dni: turno.dni,
        telefono: turno.telefono, obra_social: turno.obraSocial, lesion: turno.lesion,
        notas: turno.notas, estado: turno.estado, color: turno.color
      }).select().single();
      if (!error && saved) turno.id = saved.id;
    }

    setTurnos([...turnos, turno]);
    setModalTurno(null);
  };

  const cancelarTurno = async (id) => {
    if (!confirm("¿Cancelar este turno?")) return;
    if (supabase) await supabase.from("turnos").delete().eq("id", id);
    setTurnos(turnos.filter(t => t.id !== id));
    if (String(turnoSeleccionado?.id) === String(id)) setTurnoSeleccionado(null);
  };

  const agregarHorario = () => {
    if (!nuevoHorario.hora) return;
    const key = nuevoHorario.bloque === "mañana" ? "horariosManana" : "horariosTarde";
    const horarios = [...new Set([...config[key], nuevoHorario.hora])].sort();
    guardarConfigOnline({ ...config, [key]: horarios });
    setNuevoHorario({ ...nuevoHorario, hora: "" });
  };

  const eliminarHorario = (bloque, hora) => {
    const key = bloque === "mañana" ? "horariosManana" : "horariosTarde";
    guardarConfigOnline({ ...config, [key]: config[key].filter(h => h !== hora) });
  };

  const agregarLesion = () => {
    const v = nuevaLesion.trim();
    if (!v || config.lesiones.includes(v)) return;
    guardarConfigOnline({ ...config, lesiones: [...config.lesiones, v] });
    setNuevaLesion("");
  };

  const NavItem = ({ name, icon: Icon }) => (
    <button className={vista === name ? "active" : ""} onClick={() => setVista(name)}>
      <Icon /> {name}
    </button>
  );

  const Slot = ({ hora, bloque }) => {
    const lista = turnosEnHora(hora);
    const completo = lista.length >= Number(config.maxPorHora);
    return (
      <div className="time-row">
        <div className="time">{hora}</div>
        <div className="slot-stack">
          {lista.map(t => (
            <div className={`appointment ${t.color || "teal"}`} key={t.id}>
              <div>
                <strong>{t.paciente}</strong>
                <small>{t.lesion}</small>
                <em>{hora} - {horaFin(hora, config.duracionTurno)} · {t.telefono || "Sin teléfono"}</em>
              </div>
              <b>{t.estado}</b>
              <button className="delete" onClick={() => cancelarTurno(t.id)}><Trash2 size={15}/></button>
            </div>
          ))}
          {!completo ? (
            <button className="empty-slot" onClick={() => setModalTurno({ hora, bloque })}>
              <span><strong>Turno disponible</strong><small>{lista.length}/{config.maxPorHora} pacientes</small></span>
              <Plus size={18}/>
            </button>
          ) : <div className="full-slot">Horario completo · {lista.length}/{config.maxPorHora}</div>}
        </div>
      </div>
    );
  };

  const Agenda = () => (
    <>
      <div className="agenda-head">
        <div className="title"><CalendarDays/><div><h2>Agenda Online</h2><p>Administrá tus turnos</p></div></div>
        <div className="controls">
          <button onClick={() => modoAgenda === "Calendario" ? cambiarMes(-1) : setFecha(sumarDias(fecha, -1))}><ChevronLeft size={18}/></button>
          <button onClick={() => modoAgenda === "Calendario" ? cambiarMes(1) : setFecha(sumarDias(fecha, 1))}><ChevronRight size={18}/></button>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}/>
          <button onClick={() => setFecha(hoyISO())}>Hoy</button>
          <select value={profActual?.id || ""} onChange={e => setProfId(e.target.value)}>
            {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="agenda-viewbar">
        <div className="view-switch">
          <button className={modoAgenda === "Calendario" ? "active" : ""} onClick={() => setModoAgenda("Calendario")}>Calendario grande</button>
          <button className={modoAgenda === "Día" ? "active" : ""} onClick={() => setModoAgenda("Día")}>Agenda diaria</button>
        </div>
        <p>En el calendario grande podés arrastrar un turno y soltarlo en otro día para reprogramarlo.</p>
      </div>

      {modoAgenda === "Calendario" ? <CalendarioGrande/> : <AgendaDiaria/>}
    </>
  );

  const AgendaDiaria = () => (
    <div className="main-grid">
      <div className="agenda-card">
        <div className="agenda-date">{fechaLarga(fecha)} · {profActual?.nombre}</div>
        <div className="columns">
          <section className="agenda-block"><h3>☀️ MAÑANA</h3>{config.horariosManana.map(h => <Slot key={h} hora={h} bloque="Mañana"/>)}</section>
          <section className="agenda-block"><h3>🌤️ TARDE</h3>{config.horariosTarde.map(h => <Slot key={h} hora={h} bloque="Tarde"/>)}</section>
        </div>
      </div>
      <RightBar/>
    </div>
  );

  const CalendarioGrande = () => {
    const mesNombre = new Date(fecha + "T12:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    const dias = diasDelMes(fecha);
    const diasSemana = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
    const obtenerTurnosDia = (iso) => turnosCalendario
      .filter(t => t.fecha === iso)
      .sort((a, b) => a.hora.localeCompare(b.hora));

    return (
      <div className="big-calendar-layout">
        <div className="calendar-wide-card">
          <div className="calendar-stats">
            <article><span>Turnos del mes</span><b>{resumenMes.total}</b></article>
            <article><span>Confirmados</span><b>{resumenMes.confirmados}</b></article>
            <article><span>Pendientes</span><b>{resumenMes.pendientes}</b></article>
            <article><span>Asistieron</span><b>{resumenMes.asistieron}</b></article>
          </div>

          <div className="calendar-big-head">
            <div>
              <h3>{mesNombre}</h3>
              <p>{profActual?.nombre} · turnos visibles por día</p>
            </div>
            <div className="calendar-filters">
              {[
                ["todos", "Todos"],
                ["pendiente", "Pendientes"],
                ["confirmado", "Confirmados"],
                ["asistio", "Asistió"],
                ["aviso", "Avisó"],
                ["no-aviso", "No avisó"]
              ].map(([key, label]) => (
                <button key={key} className={filtroCalendario === key ? "active" : ""} onClick={() => setFiltroCalendario(key)}>{label}</button>
              ))}
            </div>
          </div>

          <div className="drag-note"><strong>Reprogramar:</strong> mantené presionado un turno, arrastralo y soltalo sobre otro día.</div>

          <div className="month-grid-large">
            {diasSemana.map(d => <div className="weekday-large" key={d}>{d}</div>)}
            {dias.map((d, i) => {
              const lista = obtenerTurnosDia(d.iso);
              return (
                <div
                  className={`day-large ${d.fuera ? "muted" : ""} ${d.iso === fecha ? "selected" : ""}`}
                  key={`${d.iso}-${i}`}
                  onClick={() => setFecha(d.iso)}
                  onDragOver={e => e.preventDefault()}
                  onDragEnter={e => e.currentTarget.classList.add("drop-over")}
                  onDragLeave={e => e.currentTarget.classList.remove("drop-over")}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("drop-over");
                    const id = e.dataTransfer.getData("text/plain");
                    moverTurnoFecha(id, d.iso);
                    setFecha(d.iso);
                  }}
                >
                  <div className="day-large-head">
                    <span>{d.num}</span>
                    {lista.length > 0 && <b>{lista.length}</b>}
                  </div>

                  <div className="events-large">
                    {lista.slice(0, 5).map(t => (
                      <div
                        key={t.id}
                        draggable
                        className={`calendar-appointment ${normalizarEstado(t.estado)} ${t.color || "teal"}`}
                        onClick={e => { e.stopPropagation(); setFecha(t.fecha); }}
                        onDragStart={e => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/plain", t.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.currentTarget.classList.add("dragging");
                        }}
                        onDragEnd={e => e.currentTarget.classList.remove("dragging")}
                      >
                        <strong>{t.hora} · {t.paciente}</strong>
                        <small>{t.lesion || "Sesión kinesiológica"}</small>
                      </div>
                    ))}
                    {lista.length > 5 && <span className="more-turnos">+{lista.length - 5} turnos más</span>}
                  </div>

                  <button className="add-day-turn" onClick={e => { e.stopPropagation(); abrirTurnoEnDia(d.iso); }}>+ turno</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const RightBar = () => {
    const totalHorarios = (config.horariosManana.length + config.horariosTarde.length) * Number(config.maxPorHora);
    return (
      <aside className="rightbar">
        {/* Se quitó el calendario chico lateral para que no quede cortado.
            La navegación principal queda en el calendario grande. */}
        <section className="mini-card">
          <div className="mini-head"><h3>Profesionales</h3><button onClick={agregarProfesional}>+ Agregar</button></div>
          {profesionales.map(p => (
            <div className="kine-line" key={p.id}>
              <div>{p.nombre.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div>
              <button className="kine-name" onClick={() => setProfId(p.id)}>{p.nombre}<small>{p.especialidad}</small></button>
              <button className="tiny-danger" onClick={() => eliminarProfesional(p.id)}>×</button>
            </div>
          ))}
          <div className="add-line">
            <input value={nuevoProf.nombre} onChange={e => setNuevoProf({...nuevoProf, nombre:e.target.value})} placeholder="Nombre profesional"/>
            <input value={nuevoProf.especialidad} onChange={e => setNuevoProf({...nuevoProf, especialidad:e.target.value})} placeholder="Especialidad"/>
            <button onClick={agregarProfesional}><Plus size={16}/></button>
          </div>
        </section>
        <section className="mini-card">
          <h3>Resumen del día</h3>
          <div className="summary"><span>Turnos confirmados</span><b className="ok">{turnosDia.length}</b></div>
          <div className="summary"><span>Capacidad diaria</span><b>{totalHorarios}</b></div>
          <div className="summary"><span>Disponibles</span><b className="warn">{Math.max(totalHorarios - turnosDia.length, 0)}</b></div>
        </section>
      </aside>
    );
  };

  const Pacientes = () => (
    <section className="module">
      <div className="module-head"><h2>Pacientes</h2><button className="new small" onClick={() => setModalPaciente(true)}><Plus/> Nuevo paciente</button></div>
      <SearchBox/>
      <div className="table">{pacientes.filter(p => `${p.nombre} ${p.dni} ${p.telefono} ${p.lesion}`.toLowerCase().includes(busqueda.toLowerCase())).map(p => <div className="table-row" key={p.id}><strong>{p.nombre}</strong><span>DNI: {p.dni || "-"}</span><span>{p.telefono || "-"}</span><span>{p.obraSocial || "-"}</span><b>{p.lesion}</b></div>)}</div>
    </section>
  );

  const Profesionales = () => (
    <section className="module">
      <h2>Profesionales</h2>
      <div className="prof-form"><input placeholder="Nombre profesional" value={nuevoProf.nombre} onChange={e=>setNuevoProf({...nuevoProf,nombre:e.target.value})}/><input placeholder="Especialidad" value={nuevoProf.especialidad} onChange={e=>setNuevoProf({...nuevoProf,especialidad:e.target.value})}/><button className="new small" onClick={agregarProfesional}><Plus/> Agregar</button></div>
      <div className="cards-grid">{profesionales.map(p => <div className="pro-card" key={p.id}><div>{p.nombre.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div><h3>{p.nombre}</h3><p>{p.especialidad}</p><button onClick={()=>setProfId(p.id)}>Seleccionar</button></div>)}</div>
    </section>
  );

  const Turnos = () => (
    <section className="module">
      <h2>Turnos</h2><SearchBox/>
      <div className="table">{turnos.filter(t => `${t.paciente} ${t.profesional} ${t.lesion} ${t.fecha}`.toLowerCase().includes(busqueda.toLowerCase())).map(t => <div className="table-row" key={t.id}><strong>{t.fecha} · {t.hora}</strong><span>{t.paciente}</span><span>{t.profesional}</span><b>{t.lesion}</b><button onClick={()=>cancelarTurno(t.id)}>Cancelar</button></div>)}</div>
    </section>
  );

  const Estadisticas = () => <section className="module"><h2>Estadísticas</h2><div className="stats-grid"><div className="stat-card"><span>Total turnos</span><b>{estadisticas.total}</b></div><div className="stat-card"><span>Pacientes</span><b>{estadisticas.pacientes}</b></div><div className="stat-card"><span>Profesionales</span><b>{profesionales.length}</b></div><div className="stat-card"><span>Máx. pacientes/hora</span><b>{config.maxPorHora}</b></div></div><h3>Por lesión / rehabilitación</h3><Bars data={estadisticas.porLesion}/><h3>Por profesional</h3><Bars data={estadisticas.porProfesional}/></section>;

  const Bars = ({data}) => {
    const entries = Object.entries(data).sort((a,b)=>b[1]-a[1]);
    const max = Math.max(...entries.map(e=>e[1]), 1);
    return <div className="bars">{entries.length === 0 ? <p>Sin datos todavía.</p> : entries.map(([k,v]) => <div className="bar" key={k}><span>{k}</span><div><i style={{width:`${(v/max)*100}%`}}></i></div><b>{v}</b></div>)}</div>
  };

  const Configuracion = () => (
    <section className="module">
      <h2>Configuración de horarios</h2>
      <div className="config-grid">
        <label>Duración del turno en minutos<input type="number" min="15" step="15" value={config.duracionTurno} onChange={e=>guardarConfigOnline({...config,duracionTurno:e.target.value})}/></label>
        <label>Máximo de pacientes por hora<input type="number" min="1" max="20" value={config.maxPorHora} onChange={e=>guardarConfigOnline({...config,maxPorHora:e.target.value})}/></label>
      </div>

      <h3>Horarios de mañana</h3>
      <div className="chips">{config.horariosManana.map(h => <span key={h}>{h}<button onClick={()=>eliminarHorario("mañana",h)}>×</button></span>)}</div>
      <h3>Horarios de tarde</h3>
      <div className="chips">{config.horariosTarde.map(h => <span key={h}>{h}<button onClick={()=>eliminarHorario("tarde",h)}>×</button></span>)}</div>

      <div className="inline-add wide">
        <select value={nuevoHorario.bloque} onChange={e=>setNuevoHorario({...nuevoHorario,bloque:e.target.value})}><option value="mañana">Mañana</option><option value="tarde">Tarde</option></select>
        <input type="time" value={nuevoHorario.hora} onChange={e=>setNuevoHorario({...nuevoHorario,hora:e.target.value})}/>
        <button onClick={agregarHorario}>Agregar horario</button>
      </div>

      <h3>Tipos de lesión / rehabilitación</h3>
      <div className="chips">{config.lesiones.map(l => <span key={l}>{l}</span>)}</div>
      <div className="inline-add"><input value={nuevaLesion} onChange={e=>setNuevaLesion(e.target.value)} placeholder="Nueva lesión o rehabilitación"/><button onClick={agregarLesion}>Agregar</button></div>
    </section>
  );

  const SearchBox = () => <div className="search"><Search size={17}/><input placeholder="Buscar..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/></div>;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><div className="sur-logo">SUR</div><h2>CENTRO KINESIOLÓGICO</h2><p>Cuidamos tu movimiento</p></div>
        <nav>
          <NavItem name="Agenda" icon={CalendarDays}/><NavItem name="Pacientes" icon={Users}/><NavItem name="Profesionales" icon={UserRound}/><NavItem name="Turnos" icon={Clock3}/><NavItem name="Estadísticas" icon={BarChart3}/><NavItem name="Configuración" icon={Settings}/>
        </nav>
        <div className="sidebar-card"><CalendarDays size={34}/><div><strong>Turnero</strong><span>{modoOnline ? "Online" : "Local"}</span></div><button onClick={()=>{setVista("Agenda");setFecha(hoyISO())}}>Ir a hoy</button></div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div><h1>Turnero SUR Online</h1><p>{modoOnline ? <><Wifi size={15}/> Base online Supabase activa</> : <><WifiOff size={15}/> Modo local: falta configurar Supabase</>}</p></div>
          <button className="new" onClick={()=>{setVista("Agenda");setModalTurno({hora:config.horariosManana[0] || "08:00", bloque:"Mañana"})}}><Plus/> Nuevo turno</button>
          <div className="profile"><div>{(profActual?.nombre || "LC").split(" ").map(x=>x[0]).slice(0,2).join("")}</div><span><strong>{profActual?.nombre}</strong><small>{profActual?.especialidad}</small></span></div>
        </header>

        <section className="panel">
          {vista === "Agenda" && <Agenda/>}
          {vista === "Pacientes" && <Pacientes/>}
          {vista === "Profesionales" && <Profesionales/>}
          {vista === "Turnos" && <Turnos/>}
          {vista === "Estadísticas" && <Estadisticas/>}
          {vista === "Configuración" && <Configuracion/>}
        </section>

        <section className="bottom">
          <div><HeartPulse/><strong>Atención personalizada</strong><span>Cuidamos cada detalle</span></div>
          <div><Users/><strong>Multi profesional</strong><span>Base online compartida</span></div>
          <div><Star/><strong>Horarios editables</strong><span>Mañana y tarde configurables</span></div>
          <div><ShieldCheck/><strong>Datos guardados</strong><span>Preparado para Supabase</span></div>
        </section>
      </main>

      {modalTurno && (
        <div className="modal-bg">
          <form className="modal" onSubmit={guardarTurno}>
            <h2>Nuevo turno</h2><p>{fechaLarga(modalTurno.fecha || fecha)} · {modalTurno.hora} a {horaFin(modalTurno.hora, config.duracionTurno)} · {profActual?.nombre}</p>
            <select name="pacienteId"><option value="">Paciente nuevo/manual</option>{pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre} · {p.lesion}</option>)}</select>
            <input name="pacienteManual" placeholder="Nombre paciente nuevo"/>
            <input name="dni" placeholder="DNI"/><input name="telefono" placeholder="Teléfono"/><input name="obraSocial" placeholder="Obra social"/>
            <select name="lesion">{config.lesiones.map(l => <option key={l}>{l}</option>)}</select>
            <textarea name="notas" placeholder="Notas del turno"></textarea>
            <div className="modal-actions"><button type="button" onClick={()=>setModalTurno(null)}>Cerrar</button><button className="save">Guardar turno</button></div>
          </form>
        </div>
      )}

      {modalPaciente && (
        <div className="modal-bg">
          <form className="modal" onSubmit={guardarPaciente}>
            <h2>Nuevo paciente</h2>
            <input name="nombre" placeholder="Nombre y apellido *" autoFocus/><input name="dni" placeholder="DNI"/><input name="telefono" placeholder="Teléfono"/><input name="obraSocial" placeholder="Obra social"/>
            <select name="lesion">{config.lesiones.map(l => <option key={l}>{l}</option>)}</select>
            <textarea name="notas" placeholder="Notas / antecedentes"></textarea>
            <div className="modal-actions"><button type="button" onClick={()=>setModalPaciente(false)}>Cerrar</button><button className="save">Guardar paciente</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
