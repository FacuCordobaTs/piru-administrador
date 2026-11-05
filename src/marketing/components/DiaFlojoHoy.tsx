import { useState } from 'react';
import { Link } from 'react-router';
import { Card, Button, Estado, accion } from './ui';
import { useLocal } from './Layout';
import { datosLocal, query } from '../lib/api';
import { useDatos } from '../lib/useDatos';
import { hoyArgentina, pesos, segmentoNombre } from '../lib/formato';
import type { DiasFlojos } from '../lib/tipos';
import { MARKETING } from "../lib/rutas";

interface Oportunidad {
  clienteId: number; nombre: string; segmento: string; ticketPromedio: number; motivo: string; mensaje: string;
}
export function DiaFlojoHoy({ fecha, onSumados }: { fecha: string; onSumados: () => void }) {
  const l = useLocal();
  const dia = new Date(`${fecha}T12:00:00-03:00`).getUTCDay();
  const [ver, setVer] = useState(false);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const analisis = useDatos(() => datosLocal<DiasFlojos>('/clientes/dias-flojos'), [l.restauranteId]);
  const oportunidades = useDatos(async () => ver
    ? datosLocal<{ candidatos: Oportunidad[] }>(`/clientes/recompra/oportunidades-dia${query({ dia })}`)
    : null, [l.restauranteId, dia, ver]);
  const flojos = analisis.data?.flojos.filter(f => f.diaSemana === dia) ?? [];
  if (!analisis.data?.suficientesDatos || !flojos.length) return <Estado loading={analisis.loading} error={analisis.error} reintentar={analisis.recargar} />;
  const d = analisis.data.dias.find(d => d.diaSemana === dia)!;
  const esHoy = fecha === hoyArgentina();
  // El día entero es flojo sólo si él mismo cae bajo el 70% del promedio; si no, lo flojo son algunas franjas.
  const diaFlojo = flojos.some(f => f.franja === null);
  const franjas = flojos.filter(f => f.franja !== null).map(f => f.nombre.split(' · ').pop());
  const cuando = esHoy ? 'Hoy' : d.nombre;
  return <Card className="mb-5 border border-brand/30">
    <p className="label">Oportunidad de la semana</p>
    <h2 className="mt-2">{diaFlojo ? `${cuando} es un día flojo` : `${cuando} vende bien, pero hay horarios flojos`}</h2>
    <p className="muted mt-2">En las últimas {analisis.data.ventana.semanas} semanas, {d.nombre.toLowerCase()} tuvo {d.pedidosPromedio.toFixed(1)} pedidos por día, frente a {analisis.data.promedioDiaAbierto.toFixed(1)} de promedio en los días abiertos.</p>
    <p className="muted mt-2">{diaFlojo ? 'Está por debajo del 70% del promedio.' : `El día en total va bien; lo que queda corto es: ${franjas.join(', ')}.`} Los mensajes habituales siguen abajo.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <Link className="btn btn-secondary" to={`${MARKETING}/campanas${query({ nuevo: 1, diaSemana: dia })}`}>Crear link exclusivo de los {d.nombre.toLowerCase()}</Link>
      {esHoy && <Button variant="secondary" onClick={() => { setVer(!ver); setElegidos([]); }}>Sumar clientes a Hoy</Button>}
    </div>
    {ver && esHoy && <div className="mt-5">
      <h3 className="font-semibold">Las mejores oportunidades, sin descuento</h3>
      <p className="muted mt-2">Activos y VIP que suelen comprar este día. Respetamos las 48 horas de descanso, las bajas y el máximo de contactos.</p>
      <Estado loading={oportunidades.loading} error={oportunidades.error} reintentar={oportunidades.recargar} />
      {oportunidades.data && <>
        {!oportunidades.data.candidatos.length && <p className="muted mt-4">No hay clientes disponibles para sumar hoy.</p>}
        {!!oportunidades.data.candidatos.length && <Button className="mt-4" variant="ghost" onClick={() => setElegidos(elegidos.length ? [] : oportunidades.data!.candidatos.map(c => c.clienteId))}>{elegidos.length ? 'Quitar selección' : 'Seleccionar todos'}</Button>}
        <div className="max-h-96 overflow-y-auto">
          {oportunidades.data.candidatos.map(c => <label key={c.clienteId} className="flex items-start gap-3 border-b border-line py-4">
            <input type="checkbox" className="size-5 min-h-0 w-5 shrink-0" checked={elegidos.includes(c.clienteId)} onChange={e => setElegidos(ids => e.target.checked ? [...ids, c.clienteId] : ids.filter(id => id !== c.clienteId))} />
            <span><strong>{c.nombre} · {segmentoNombre[c.segmento] ?? c.segmento}</strong><span className="muted block">{c.motivo} · Ticket {pesos(c.ticketPromedio)}</span><span className="muted mt-1 block">{c.mensaje.replaceAll('{nombre}', c.nombre).replaceAll('{local}', l.nombre).replaceAll('{favorito}', 'tu pedido de siempre').replaceAll('{link}', '[link personal]')}</span></span>
          </label>)}
        </div>
        {!!elegidos.length && <Button className="mt-4" disabled={busy} onClick={async () => {
          setBusy(true);
          await accion(async () => {
            const resultado = await datosLocal<{ agregados: number; ignorados: number[] }>('/clientes/recompra/sumar-hoy', { method: 'POST', body: { clienteIds: elegidos } });
            setVer(false); setElegidos([]); onSumados();
            if (resultado.ignorados.length) oportunidades.recargar();
          }, 'Clientes sumados a Hoy');
          setBusy(false);
        }}>{busy ? 'Sumando…' : `Sumar ${elegidos.length} clientes sin descuento`}</Button>}
      </>}
    </div>}
  </Card>;
}
