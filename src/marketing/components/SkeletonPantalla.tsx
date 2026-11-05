type Tipo = "hoy" | "dias" | "campanas" | "clientes" | "recompra" | "puntos" | "cupones" | "estadisticas";
function Barra({ className = "w-24" }: { className?: string }) {
  return <div className={`h-3 rounded bg-sand ${className}`} />;
}
function Tabla({ columnas, editable = false }: { columnas: number; editable?: boolean }) {
  return <div className="lista-sombra overflow-x-auto rounded-[20px] bg-surface">
    <div className="min-w-[900px]">
      {[0, 1, 2, 3, 4].map(fila => <div key={fila} className="grid items-center py-4" style={{ gridTemplateColumns: "2fr " + "1fr ".repeat(columnas - 1) }}>
        {Array.from({ length: columnas }, (_, col) => <div key={col} className="px-4">
          {editable && fila > 0 && (col === 1 || col === 2) ? <div className="h-11 w-full max-w-40 rounded-xl bg-sand" /> : <Barra className={col === 0 ? "w-3/4" : "w-2/3"} />}
        </div>)}
      </div>)}
    </div>
  </div>;
}
function Indicadores() {
  return <div className="mb-6 grid gap-3 sm:grid-cols-3">{[1, 2, 3].map(i => <div key={i} className="rounded-[20px] bg-surface p-5"><Barra className="w-32" /><Barra className="mt-5 h-7 w-20" /></div>)}</div>;
}
function Configuracion() {
  return <div className="rounded-[20px] bg-surface p-5">
    <div className="mb-6 flex items-center justify-between gap-4"><Barra className="h-4 w-48" /><div className="h-10 w-32 rounded-full bg-sand" /></div>
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(i => <div key={i}><Barra className="w-24" /><Barra className="mt-3 w-36" /></div>)}</div>
  </div>;
}
/** Mantiene la estructura de cada pantalla mientras llegan sus datos. */
export function SkeletonPantalla({ tipo }: { tipo: Tipo }) {
  return (
    <div role="status" aria-label="Cargando" data-skeleton={tipo} className="animate-pulse" aria-busy="true">
      <div aria-hidden="true">
        {tipo === "estadisticas" ? (
          <>
            <Indicadores />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[20px] bg-surface p-5">
                <Barra className="mb-6 h-4 w-36" />
                {[1, 2].map(i => <div key={i} className="mb-6"><Barra className="w-40" /><Barra className="mt-3 h-7 w-32" /></div>)}
              </div>
              <div className="rounded-[20px] bg-surface p-5">
                <Barra className="mb-5 h-4 w-40" />
                {[1, 2, 3, 4].map(i => <div key={i} className="flex justify-between gap-4 py-4"><Barra className="w-24" /><Barra className="w-20" /></div>)}
              </div>
              <div className="rounded-[20px] bg-surface p-5 sm:col-span-2">
                <Barra className="mb-5 h-4 w-40" />
                {[1, 2, 3, 4].map(i => <div key={i} className="flex items-center justify-between gap-4 py-4"><div><Barra className="w-40" /><Barra className="mt-3 h-2 w-20" /></div><Barra className="w-24" /></div>)}
              </div>
            </div>
          </>
        ) : tipo === "cupones" ? (
          <Tabla columnas={5} />
        ) : tipo === "puntos" ? (
          <>
            <Indicadores />
            <Configuracion />
            <Barra className="mt-6 mb-5 h-4 w-40" />
            <Tabla columnas={4} editable />
            <Barra className="mt-6 mb-4 h-4 w-36" />
            <div className="mb-4 h-11 rounded-xl bg-sand" />
            <Tabla columnas={5} />
            <div className="mt-5 flex justify-between"><div className="h-10 w-24 rounded-full bg-sand" /><Barra className="w-12" /><div className="h-10 w-24 rounded-full bg-sand" /></div>
            <Barra className="mt-6 mb-4 h-4 w-40" />
            <div className="rounded-[20px] bg-surface p-5"><Barra className="w-1/2" /><Barra className="mt-3 w-1/3" /></div>
          </>
        ) : tipo === "recompra" ? (
          <>
            <Indicadores />
            <Barra className="mb-4 h-4 w-32" />
            <Tabla columnas={7} />
            <div className="mt-6"><Configuracion /></div>
            <Barra className="mt-6 mb-4 h-4 w-40" />
            <div className="rounded-[20px] bg-surface p-5">{[1, 2, 3].map(i => <div key={i} className="py-3"><Barra className="w-1/2" /><Barra className="mt-3 w-1/3" /></div>)}</div>
          </>
        ) : tipo === "hoy" ? (
          <>
            <div className="mb-5 flex min-h-20 items-center justify-between gap-4 rounded-[20px] bg-surface p-5"><Barra className="w-1/2" /><Barra className="w-24" /></div>
            <Barra className="mb-5 w-32" />
            <div className="rounded-[20px] bg-surface">
              {[1, 2, 3, 4].map((fila) => (
                <div key={fila} className="p-4 sm:px-5">
                  <div className="flex min-h-9 items-center justify-between gap-4"><Barra className="w-28" /><div className="flex gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-8 w-9 rounded-full bg-sand sm:w-24" />)}</div></div>
                  <Barra className="mt-1 h-2 w-1/2" />
                </div>
              ))}
            </div>
          </>
        ) : tipo === "campanas" || tipo === "clientes" ? (
          <>
            <div className="overflow-x-auto rounded-[20px] bg-surface">
              <div className="min-w-[900px]">
                {[0, 1, 2, 3, 4].map((fila) => <div key={fila} className={`grid py-5 ${tipo === "clientes" ? "grid-cols-[24%_24%_18%_8%_8%_18%]" : "grid-cols-[28%_repeat(5,14.4%)]"}`}>{[0, 1, 2, 3, 4, 5].map((col) => <div key={col} className="px-4"><Barra className={col === 0 ? (fila === 0 ? "w-20" : "w-3/4") : "ml-auto w-3/4"} /></div>)}</div>)}
              </div>
            </div>
            {tipo === "campanas" && <div className="mt-4 flex items-center justify-between rounded-[20px] bg-surface p-5"><Barra className="w-40" /><Barra className="w-24" /></div>}
          </>
        ) : (
          <>
            <div className="mb-5 grid gap-4 sm:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="rounded-[20px] bg-surface p-5"><Barra className="w-20" /><Barra className="mt-5 h-5 w-32" /><Barra className="mt-4 w-3/4" /><div className="mt-5 h-10 w-36 rounded-full bg-sand" /></div>)}</div>
            <div className="rounded-[20px] bg-surface p-5 sm:p-6">
              <Barra className="mb-6 h-4 w-48" />
              <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] gap-2">
                {[0, 1, 2, 3].map((i) => <Barra key={`cab-${i}`} className="mb-2 w-4/5" />)}
                {Array.from({ length: 7 }, (_, fila) => [<div key={`dia-${fila}`} className="flex items-center"><Barra className="w-12" /></div>, ...[1, 2, 3].map((col) => <div key={`${fila}-${col}`} className="h-12 rounded-xl bg-sand" />)])}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
