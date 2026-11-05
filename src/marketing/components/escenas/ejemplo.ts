/**
 * Datos de ejemplo de las escenas del recorrido y de la guía. Son los del local inventado que
 * recorre la landing (`landing/src/data/demo.ts`): Brasa, Martina y la historia
 * del martes. No son métricas de ningún local real, y cada escena lo aclara.
 */
export const LOCAL_EJEMPLO = "Brasa";

export const CLIENTA = {
  nombre: "Martina González",
  corto: "Martina",
  iniciales: "MG",
  telefono: "+54 9 341 555-0182",
  pedidos: 7,
  gastado: 86400,
  cadencia: 12,
  favorito: "Smash burger",
  llego: "Historia de Instagram",
};

/** El ranking de links de Brasa por ventas cobradas, y lo que vendió sin campaña. */
export const CAMPANAS_EJEMPLO = [
  { nombre: "Historia del finde", canal: "Historias de Instagram", pedidos: 38, ventas: 486200 },
  { nombre: "QR en las bolsas", canal: "Volantes y packaging", pedidos: 29, ventas: 402600 },
  { nombre: "Reel de papas", canal: "Reels y TikTok", pedidos: 9, ventas: 118700 },
];
export const ORGANICO_EJEMPLO = { pedidos: 198, ventas: 2630700 };

/** Pedidos promedio por día y franja de las últimas 8 semanas. El lunes cierra. */
export const FRANJAS_EJEMPLO = ["Mediodía", "Tarde", "Noche"];
export const SEMANA_EJEMPLO = [
  { dia: "Lun", abierto: false, franjas: [0, 0, 0] },
  { dia: "Mar", abierto: true, franjas: [3.1, 1.0, 6.4] },
  { dia: "Mié", abierto: true, franjas: [4.0, 1.2, 8.9] },
  { dia: "Jue", abierto: true, franjas: [4.6, 1.5, 11.8] },
  { dia: "Vie", abierto: true, franjas: [5.2, 2.1, 19.6] },
  { dia: "Sáb", abierto: true, franjas: [6.8, 2.9, 22.4] },
  { dia: "Dom", abierto: true, franjas: [7.1, 2.3, 16.5] },
];
