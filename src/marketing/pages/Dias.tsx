import { SkeletonPantalla } from '../components/SkeletonPantalla';
import { useState } from 'react';
import { Link } from 'react-router';
import { useLocal } from '../components/Layout';
import { BloqueoModulo, useModulo } from '../components/Modulo';
import { Header, Card, Chip, Estado, Empty } from '../components/ui';
import { datosLocal, query } from '../lib/api';
import { useDatos } from '../lib/useDatos';
import type { DiasFlojos } from '../lib/tipos';
import { MARKETING } from "../lib/rutas";

const hora = (h: string) => String(Number(h.split(':')[0]));
const rangoFranja = (inicio: string, fin: string) => `${hora(inicio)} a ${hora(fin)} h`;
const dia = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

export function Dias() {
  const mod = useModulo('dias_flojos');
  if (mod.loading || mod.error) {
    return <><Header title="Llená los días flojos" sub="Mirá cuándo se vende menos y mandá a los clientes justo esos días." ayuda={{ seccion: 'dias-flojos', texto: 'Cómo se encuentran los días flojos' }} /><Estado skeleton={<SkeletonPantalla tipo="dias" />} loading={mod.loading} error={mod.error} reintentar={mod.recargar} /></>;
  }
  if (!mod.modulo?.activoAhora) {
    return <><Header title="Llená los días flojos" ayuda={{ seccion: 'dias-flojos', texto: 'Cómo se encuentran los días flojos' }} /><BloqueoModulo codigo="dias_flojos" nombre="Días flojos" /></>;
  }
  return <DiasContenido />;
}

function DiasContenido() {
  const l = useLocal();
  const [semanas, setSemanas] = useState(8);
  const d = useDatos(() => datosLocal<DiasFlojos>(`/clientes/dias-flojos${query({ semanas })}`), [l.restauranteId, semanas], { conservar: true });
  const data = d.data;
  const max = Math.max(1, ...(data?.dias.flatMap(x => x.franjas.map(f => f.pedidosPromedio)) ?? []));
  const maxDia = Math.max(1, ...(data?.dias.map(x => x.pedidosPromedio) ?? []));
  // La fila de hoy se marca: es la que se busca primero.
  const hoy = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date()) + 'T12:00:00-03:00').getUTCDay();
  const diaLink = (n: number) => `${MARKETING}/hoy${query({ diaSemana: n })}`;
  return <><Header title="Llená los días flojos" sub="Mirá cuándo se vende menos y mandá a los clientes justo esos días." ayuda={{ seccion: 'dias-flojos', texto: 'Cómo se encuentran los días flojos' }} />
    <div role="group" aria-label="Ventana de análisis" className="mb-5 flex flex-wrap gap-2">
      {[4, 8, 12, 26].map(n => <Chip key={n} className="min-h-10" activo={semanas === n} onClick={() => setSemanas(n)}>Últimas {n} semanas</Chip>)}
    </div>
    <Estado skeleton={<SkeletonPantalla tipo="dias" />} loading={d.loading && !data} error={d.error} reintentar={d.recargar} />
    {data && (!data.suficientesDatos ? <Empty title="Necesitamos un poco más de historia" text={`Hay pedidos en ${data.semanasConPedidos} semanas. Necesitamos al menos dos para reconocer días flojos.`} /> : <div className={d.loading ? 'opacity-60' : undefined} aria-busy={d.loading}>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">{data.flojos.slice(0, 3).map((f, i) => <Card key={`${f.diaSemana}-${f.franja}`}><p className="label">{i === 0 ? 'El más flojo' : 'Oportunidad'}</p><h2 className="mt-3">{f.nombre}</h2><p className="muted my-3">Le faltan {Math.ceil(f.pedidosFaltantes)} pedidos para el promedio.</p><Link className="btn btn-secondary" to={diaLink(f.diaSemana)}>Ver mensajes de ese día</Link></Card>)}</div>
      {!data.flojos.length && <Card className="mb-5"><h2>Tus días vienen parejos</h2><p className="muted mt-2">Ningún día abierto cae por debajo del 70% del promedio.</p></Card>}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2>Tu semana, por horarios</h2><p className="muted mt-2">Pedidos promedio por día y franja, en las últimas {data.ventana.semanas} semanas. Tocá un día para ver sus mensajes.</p></div>
          <div className="flex items-center gap-2 text-xs text-ink-3" aria-label="Escala de pedidos"><span>Menos</span><span aria-hidden="true" className="h-2.5 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(255,122,0,.08), rgba(255,122,0,.75))' }} /><span>Más</span></div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-sm">
            <thead><tr className="text-xs text-ink-3">
              <th scope="col" className="p-2 text-left font-medium">Día</th>
              {data.franjas.map(f => <th key={f.id} scope="col" className="p-2 text-center font-medium"><span className="block text-sm text-ink">{f.nombre}</span>{rangoFranja(f.horaInicio, f.horaFin)}</th>)}
              <th scope="col" className="p-2 text-left font-medium">Total del día</th>
            </tr></thead>
            <tbody>{data.dias.map(x => {
              const flojoDia = data.flojos.some(f => f.diaSemana === x.diaSemana && f.franja === null);
              return <tr key={x.diaSemana}>
                <th scope="row" className="p-2 text-left font-semibold whitespace-nowrap"><Link className="inline-flex items-center gap-2 underline-offset-4 hover:underline" to={diaLink(x.diaSemana)}>{x.nombre}{x.diaSemana === hoy && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-white">Hoy</span>}</Link></th>
                {x.franjas.map(f => {
                  const flojo = x.abierto && data.flojos.some(w => w.diaSemana === x.diaSemana && w.franja === f.id);
                  const intensidad = x.abierto ? 0.08 + 0.67 * f.pedidosPromedio / max : 0;
                  return <td key={f.id} className="p-0.5"><Link aria-label={`${x.nombre}, ${f.nombre}: ${x.abierto ? `${dia(f.pedidosPromedio)} pedidos${flojo ? ', flojo' : ''}` : 'cerrado'}`} className={`flex min-h-12 items-center justify-center gap-1 rounded-xl tabular-nums ${flojo ? 'font-semibold ring-2 ring-ink/70' : ''} ${x.abierto ? '' : 'bg-sand text-ink-3'}`} style={x.abierto ? { backgroundColor: `rgba(255,122,0,${intensidad})` } : undefined} to={diaLink(x.diaSemana)}>{x.abierto ? <>{dia(f.pedidosPromedio)}{flojo && <span aria-hidden="true" title="Flojo">↓</span>}</> : 'Cerrado'}</Link></td>;
                })}
                <td className="min-w-40 p-2">{x.abierto ? <div className="flex items-center gap-3"><span className="w-10 shrink-0 font-semibold tabular-nums">{dia(x.pedidosPromedio)}</span><span className="relative block h-2 flex-1 overflow-hidden rounded-full bg-sand" aria-hidden="true"><span className={`block h-full rounded-full ${flojoDia ? 'bg-ink-3' : 'bg-brand'}`} style={{ width: `${Math.max(3, 100 * x.pedidosPromedio / maxDia)}%` }} /></span>{flojoDia && <span className="text-[11px] font-semibold text-ink-2">Flojo</span>}</div> : <span className="text-ink-3">Cerrado</span>}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p className="muted mt-4">Un día es flojo si queda por debajo del 70% del promedio de los días abiertos ({dia(data.promedioDiaAbierto)} pedidos). Las franjas flojas se marcan con ↓.</p>
      </Card>
    </div>)}
  </>;
}
