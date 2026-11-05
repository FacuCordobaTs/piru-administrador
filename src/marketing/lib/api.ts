import { API_URL, handleUnauthorized } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { LocalMarketing } from "./tipos";

const BASE = API_URL.replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code: string | undefined;
  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Opciones = Omit<RequestInit, "body"> & { body?: unknown };

/** Las pantallas de Marketing hablan con la API con la sesión del panel, la del local. */
export async function apiLocal<T>(
  ruta: string,
  opciones: Opciones = {},
): Promise<T> {
  const token = useAuthStore.getState().token;
  const { body, ...init } = opciones;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  const res = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const parsed: unknown = await res.json().catch(() => null);
  if (
    !res.ok ||
    (parsed !== null &&
      typeof parsed === "object" &&
      "success" in parsed &&
      parsed.success === false)
  ) {
    if (res.status === 401 && token === useAuthStore.getState().token)
      handleUnauthorized();
    const o =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    throw new ApiError(
      res.status,
      typeof o.code === "string" ? o.code : undefined,
      typeof o.message === "string"
        ? o.message
        : typeof o.error === "string"
          ? o.error
          : "No pudimos completar la solicitud. Volvé a intentar.",
    );
  }
  return parsed as T;
}

export async function datosLocal<T>(
  ruta: string,
  opciones: Opciones = {},
): Promise<T> {
  return (await apiLocal<{ success: boolean; data: T }>(ruta, opciones)).data;
}

/** La tarjeta del local: ventas, módulos, día más flojo y mensajes de hoy. */
export const localApi = {
  tarjeta: () => apiLocal<LocalMarketing>("/marketing-local"),
};

export function query(
  params: Record<string, string | number | boolean | null | undefined>,
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  return p.size ? `?${p}` : "";
}
