interface ItemPedidoLike {
    cantidad: number
    nombreProducto?: string
    precio?: string | number
    precioUnitario?: string | number  // Campo del WebSocket (puede venir como string)
    ingredientesExcluidosNombres?: string[]
    agregados?: any[] | string | null
    categoriaNombre?: string
    /** Marca explícita de la categoría; no se infiere a partir del nombre. */
    categoriaEsBebida?: boolean
    /** Los callers que enriquecen el ítem con el catálogo pueden pasar el producto completo. */
    producto?: { categoriaEsBebida?: boolean | null } | null
    varianteNombre?: string
    varianteSecundariaNombre?: string
    clienteNombre?: string | null
    nota?: string | null
}

// Interface for factura items - includes clienteNombre for grouping
interface ItemFacturaLike extends ItemPedidoLike {
    clienteNombre?: string
}

interface PedidoLike {
    /** Número real del pedido, o "LOCAL-{n}" para comandas sin conexión del POS. */
    id: number | string
    mesaNombre?: string | null
    nombrePedido?: string | null
    total?: string  // Total del pedido para usar como fallback
    tipo?: 'mesa' | 'delivery' | 'takeaway'
    direccion?: string | null
    telefono?: string | null
    deliveryFee?: number
    notas?: string | null
    metodoPago?: string | null
    /** Alias de destino de la transferencia manual, resuelto para la sucursal del pedido. */
    transferenciaAlias?: string | null
    /** Monto descontado por cupón (ya reflejado en total del pedido) */
    montoDescuento?: string | number | null
    /** Texto del cupón aplicado (ej. ALFAJOR10) */
    codigoDescuentoCodigo?: string | null
    sucursalNombre?: string | null
    horarioProgramado?: string | null
    grupal?: boolean | null
}

export const COMANDA_GRANDE_MAYUSCULAS_STORAGE_KEY = 'piru_comanda_grande_mayusculas'

export interface ComandaFormatOptions {
    /** Usa mayúsculas y destaca en tamaño grande sólo productos y detalles. */
    grandeMayusculas?: boolean
}

/** Preferencia local del equipo; los callers antiguos también la respetan. */
export const readComandaGrandeMayusculas = (): boolean => {
    if (typeof window === 'undefined') return false
    try {
        return window.localStorage.getItem(COMANDA_GRANDE_MAYUSCULAS_STORAGE_KEY) === 'true'
    } catch {
        return false
    }
}

const formatMetodoPagoPrinter = (metodoPago: string | null | undefined): string => {
    const m = String(metodoPago || '').trim()
    if (m.includes('mercadopago')) return 'MercadoPago'
    if (m.includes('transferencia_automatica_talo')) return 'Transf. Talo'
    if (m.includes('transferencia_automatica_cucuru')) return 'Transf. Cucuru'
    if (m.includes('manual_transfer') || m === 'transferencia') return 'Transf. Manual'
    if (m === 'cash' || m === 'efectivo') return 'Efectivo'
    return m ? m.toUpperCase() : 'NO ESPECIFICADO'
}

const getMontoDescuentoPedido = (pedido: PedidoLike): number => {
    const raw = pedido.montoDescuento
    if (raw == null || raw === '') return 0
    const n = typeof raw === 'string' ? parseFloat(raw) : raw
    return Number.isFinite(n) && n > 0 ? n : 0
}

// Helper para obtener el precio unitario de un item.
// Para pedidos unificados (precioUnitario), el precio ya incluye los agregados.
// Para el flujo legacy de mesa (precio), se suman los agregados porque el campo
// precio es solo el precio base del producto.
const getItemPrice = (item: ItemPedidoLike): number => {
    if (item.precio !== undefined) {
        const basePrice = typeof item.precio === 'string' ? parseFloat(item.precio) || 0 : item.precio;
        const agregadosTotal = parseAgregadosPedido(item.agregados)
            .reduce((total, ag) => total + (parseFloat(String(ag.precio ?? 0)) || 0), 0)
        return basePrice + agregadosTotal;
    }
    if (item.precioUnitario !== undefined) {
        // precioUnitario ya incluye el precio de los agregados (sumado al crearse el pedido)
        return typeof item.precioUnitario === 'string'
            ? parseFloat(item.precioUnitario) || 0
            : item.precioUnitario;
    }
    return 0;
}

/**
 * Los pedidos anteriores a la normalización conservan `transferencia` como
 * valor legacy. Se considera transferencia manual, pero nunca se confunde con
 * las variantes automáticas de Cucuru o Talo.
 */
export const esTransferenciaManual = (metodoPago: string | null | undefined): boolean => {
    const metodo = String(metodoPago || '').trim().toLowerCase()
    return metodo.includes('manual_transfer') || metodo === 'transferencia'
}

export const parseAgregadosPedido = (raw: ItemPedidoLike['agregados']): Array<{ nombre: string; precio?: string | number }> => {
    let parsed: unknown = raw
    if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw) } catch { return [] }
    }
    if (!Array.isArray(parsed)) return []
    // El backend conserva a propósito el orden y las repeticiones: un mismo
    // extra puede elegirse en ambos grupos o más de una vez y cada aparición
    // forma parte del precio. No deduplicar acá, porque ocultaría unidades en
    // la comanda y, para pedidos legacy, también alteraría el total impreso.
    return parsed.filter((ag: any) => {
        if (!ag || typeof ag !== 'object' || typeof ag.nombre !== 'string' || !ag.nombre.trim()) return false
        return true
    })
}

export const formatNombreProductoConVariantes = (
    nombreProducto: string | null | undefined,
    varianteNombre?: string | null,
    varianteSecundariaNombre?: string | null,
): string => {
    const base = (nombreProducto || 'Producto').trim()
    // Primaria y secundaria son elecciones independientes. Aunque tengan el
    // mismo texto (o coincidan con parte del nombre del producto), las dos se
    // deben imprimir para que cocina vea la configuración completa.
    const variantes = [varianteNombre, varianteSecundariaNombre]
        .map(nombre => nombre?.trim())
        .filter((nombre): nombre is string => !!nombre)
    return variantes.length > 0 ? `${base} (${variantes.join(' · ')})` : base
}

const getNombreProductoConVariantes = (item: ItemPedidoLike): string =>
    formatNombreProductoConVariantes(item.nombreProducto, item.varianteNombre, item.varianteSecundariaNombre)

const formatPrecioComanda = (value: number): string =>
    `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * El nombre de mesa puede venir como "1", "Mesa 1" o con el nombre que el
 * local le haya asignado. La comanda de salón siempre debe identificarla de
 * forma inequívoca y uniforme para cocina.
 */
const formatMesaComanda = (mesaNombre: string | null | undefined): string => {
    const mesa = mesaNombre?.trim()
    if (!mesa) return 'MESA'
    return /^mesa\b/i.test(mesa) ? mesa.toUpperCase() : `MESA ${mesa.toUpperCase()}`
}

export const formatComanda = (
    pedido: PedidoLike,
    items: ItemPedidoLike[],
    restauranteNombre: string,
    options?: ComandaFormatOptions,
) => {
    const ESC = '\x1B';
    const GS = '\x1D';
    const LINE_WIDTH = 32;
    const esComandaMesa = pedido.tipo === 'mesa'
    const grandeMayusculas = options?.grandeMayusculas ?? readComandaGrandeMayusculas()

    // Total consistente con la vista: itemsSubtotal + deliveryFee - descuento
    const itemsSubtotal = items.reduce((acc, item) => acc + (item.cantidad * getItemPrice(item)), 0)
    const totalGeneral = itemsSubtotal + (pedido.deliveryFee || 0) - getMontoDescuentoPedido(pedido)

    const commands = [
        ESC + '@', // Initialize
        ESC + 't' + '\x00', // Table PC437

        // Las comandas de salón tienen una identidad propia: la mesa es el
        // dato prioritario de cocina y reemplaza por completo al local.
        ESC + 'a' + '\x01', // Center
        ESC + '!' + (grandeMayusculas ? '\x08' : '\x30'), // En modo especial, encabezado pequeño y en negrita
        `${(esComandaMesa ? formatMesaComanda(pedido.mesaNombre) : restauranteNombre.toUpperCase())}\n`,

        ESC + '!' + '\x00', // Normal
        esComandaMesa ? '================================\n' : '--------------------------------\n',

        // INFO DEL PEDIDO
        ESC + 'a' + '\x00', // Left
    ];

    // Fecha y Hora
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-AR');
    const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    commands.push(`Fecha: ${dateStr} ${timeStr}\n`);
    if (!esComandaMesa && pedido.sucursalNombre) {
        commands.push(`Sucursal: ${pedido.sucursalNombre}\n`);
    }
    commands.push(esComandaMesa ? '================================\n' : '--------------------------------\n');

    if (esComandaMesa) {
        // No se imprime número de pedido ni método de pago en salón: no son
        // información operativa para cocina y la mesa ya identifica la orden.
        commands.push(ESC + '!' + (grandeMayusculas ? '\x08' : '\x18'));
        commands.push('COMANDA DE COCINA\n');
        commands.push(ESC + '!' + '\x00');
        commands.push('================================\n');
    } else {
        // --- Encabezado tipo pedido: Bold compacto (la cocina no necesita esto gigante) ---
        commands.push(ESC + '!' + '\x08'); // Solo Negrita
        commands.push(`PEDIDO #${pedido.id}\n`);

        if (pedido.tipo === 'delivery') {
            commands.push(`DELIVERY\n`);
        } else if (pedido.tipo === 'takeaway') {
            commands.push(`TAKE AWAY\n`);
        } else if (pedido.mesaNombre) {
            commands.push(`${pedido.mesaNombre.toUpperCase()}\n`);
        }

        commands.push(ESC + '!' + '\x00'); // Normal
        commands.push('--------------------------------\n');
    }

    if (pedido.nombrePedido) {
        commands.push(`Cliente: ${pedido.nombrePedido}\n`);
    }
    if (pedido.telefono && !esComandaMesa) {
        commands.push(`Tel: ${pedido.telefono}\n`);
    }

    if (pedido.tipo === 'delivery' && pedido.direccion) {
        commands.push(ESC + '!' + '\x08'); // Bold
        commands.push(`Dir: ${pedido.direccion}\n`);
        commands.push(ESC + '!' + '\x00'); // Normal
        commands.push('--------------------------------\n');
    }

    if (pedido.notas) {
        // Las notas son información operativa de cocina y se destacan junto a
        // productos, variantes, ingredientes y extras.
        commands.push(ESC + '!' + (grandeMayusculas ? '\x18' : '\x08'));
        commands.push(`NOTAS: ${pedido.notas}\n`);
        commands.push(ESC + '!' + '\x00');
        commands.push('--------------------------------\n');
    }

    if (pedido.horarioProgramado) {
        commands.push(ESC + '!' + '\x08');
        commands.push(`PROGRAMADO: ${pedido.horarioProgramado}\n`);
        commands.push(ESC + '!' + '\x00');
        commands.push('--------------------------------\n');
    }

    if (pedido.metodoPago && !esComandaMesa) {
        const metodoFormateado = formatMetodoPagoPrinter(pedido.metodoPago);
        commands.push(ESC + '!' + '\x08');
        commands.push(`PAGO: ${metodoFormateado}\n`);
        commands.push(ESC + '!' + '\x00');
        // El alias sólo sirve para verificar una transferencia manual. No se
        // imprime para Mercado Pago ni transferencias automáticas, cuyos datos
        // de cobro pertenecen a la operación dinámica del proveedor.
        const alias = pedido.transferenciaAlias?.trim()
        if (esTransferenciaManual(pedido.metodoPago) && alias) {
            commands.push(ESC + '!' + '\x08');
            commands.push(`ALIAS: ${alias}\n`);
            commands.push(ESC + '!' + '\x00');
        }
        commands.push('--------------------------------\n');
    }

    const printItem = (item: ItemPedidoLike, indent = '') => {
        const nombre = getNombreProductoConVariantes(item);
        const esBebida = item.categoriaEsBebida === true || item.producto?.categoriaEsBebida === true;
        const precioUnitarioFinal = getItemPrice(item);
        const subtotalItem = item.cantidad * precioUnitarioFinal;
        const nombreLinea = `${indent}${item.cantidad}x ${nombre}`;
        const precioLinea = formatPrecioComanda(subtotalItem);
        // Bebidas usan doble ancho; el resto conserva ancho normal y doble alto.
        // El cálculo se hace en columnas reales para no forzar un salto feo.
        const anchoNombre = nombreLinea.length * (esBebida ? 2 : 1);
        const precioEnMismaLinea = anchoNombre + 1 + precioLinea.length <= LINE_WIDTH;

        // Bebidas: doble ancho + doble alto + negrita. Resto: doble alto + negrita.
        commands.push(ESC + '!' + (esBebida ? '\x38' : '\x18'));
        commands.push(nombreLinea + (precioEnMismaLinea ? '' : '\n'));
        commands.push(ESC + '!' + '\x00'); // El precio siempre queda pequeño

        if (precioEnMismaLinea) {
            const espacios = Math.max(1, LINE_WIDTH - anchoNombre - precioLinea.length);
            commands.push(`${' '.repeat(espacios)}${precioLinea}\n`);
        } else {
            commands.push(`${indent}  ${precioLinea}\n`);
        }

        const agregados = parseAgregadosPedido(item.agregados);
        if (agregados.length > 0) {
            commands.push(ESC + '!' + '\x10'); // Doble alto
            commands.push(`${indent}  CON:\n`);
            agregados.forEach((a) => {
                commands.push(`${indent}   + ${a.nombre}\n`);
            });
            commands.push(ESC + '!' + '\x00');
        }

        if (item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0) {
            commands.push(ESC + '!' + '\x10'); // Doble alto
            commands.push(`${indent}  SIN:\n`);
            item.ingredientesExcluidosNombres.forEach((n: string) => {
                commands.push(`${indent}   - ${n}\n`);
            });
            commands.push(ESC + '!' + '\x00');
        }
        if (item.nota?.trim()) {
            commands.push(ESC + '!' + '\x18');
            commands.push(`${indent}  NOTA: ${item.nota.trim()}\n`);
            commands.push(ESC + '!' + '\x00');
        }
    };

    // ITEMS — Nombre del producto en DOBLE ALTO + NEGRITA para que la cocina lo lea rápido
    if (pedido.grupal) {
        // Pedido grupal: agrupar items por clienteNombre
        const porCliente = items.reduce((acc, item) => {
            const key = item.clienteNombre || 'Sin nombre';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {} as Record<string, ItemPedidoLike[]>);

        Object.entries(porCliente).forEach(([cliente, clienteItems]) => {
            commands.push(ESC + '!' + '\x08'); // Negrita
            commands.push(`>> ${cliente.toUpperCase()}\n`);
            commands.push(ESC + '!' + '\x00'); // Normal
            clienteItems.forEach(item => printItem(item, '  '));
            commands.push('--------------------------------\n');
        });
    } else {
        items.forEach(item => printItem(item));
    }

    // Delivery Fee explicitly added if requested
    if (pedido.deliveryFee !== undefined && pedido.deliveryFee > 0) {
        commands.push('--------------------------------\n');
        const feeNombre = 'Costo Envio';
        const feeStr = pedido.deliveryFee.toLocaleString('es-AR', { minimumFractionDigits: 2 });
        const espaciosFee = LINE_WIDTH - feeNombre.length - feeStr.length;
        const filaFee = feeNombre + (espaciosFee > 0 ? ' '.repeat(espaciosFee) : ' ') + feeStr;
        commands.push(`${filaFee}\n`);
    }

    const montoDesc = getMontoDescuentoPedido(pedido)
    if (montoDesc > 0) {
        commands.push('--------------------------------\n');
        commands.push(ESC + 'a' + '\x00');
        commands.push(ESC + '!' + '\x08');
        const cupon = pedido.codigoDescuentoCodigo?.trim()
        commands.push(cupon ? `CUPON: ${cupon}\n` : `DESCUENTO (CUPON)\n`);
        commands.push(ESC + '!' + '\x00');
        const descLabel = 'Monto desc.';
        const descStr = `-$${montoDesc.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
        const esp = LINE_WIDTH - descLabel.length - descStr.length;
        commands.push(descLabel + (esp > 0 ? ' '.repeat(esp) : ' ') + descStr + '\n');
    }

    // TOTAL FINAL
    commands.push('--------------------------------\n');
    commands.push(ESC + 'a' + '\x02'); // Right align
    commands.push(ESC + '!' + (grandeMayusculas ? '\x08' : '\x10')); // Total pequeño en el modo especial
    commands.push(`Total : $ ${totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n`);

    commands.push(ESC + '!' + '\x00');
    commands.push(ESC + 'a' + '\x01'); // Center
    commands.push(esComandaMesa ? '\n--- SALON / COCINA ---\n' : '\nGracias por elegirnos.\n');

    commands.push('\n\n\n\n');
    commands.push(GS + 'V' + '\x41' + '\x00'); // Cut

    if (!grandeMayusculas) return commands

    return commands.map((command) => {
        // Los comandos y los textos se agregan en entradas separadas. No se
        // debe aplicar uppercase a ESC + "t", porque cambiaría el comando.
        if (command.startsWith(ESC) || command.startsWith(GS)) return command
        return command.toLocaleUpperCase('es-AR')
    })
};

/**
 * Formatea una FACTURA para el cliente (incluye todos los items, agrupados por usuario)
 * Esta es la factura final, no la comanda de cocina
 */
export const formatFactura = (
    pedido: PedidoLike,
    items: ItemFacturaLike[],
    restauranteNombre: string
) => {
    const ESC = '\x1B';
    const GS = '\x1D';
    const LINE_WIDTH = 32;

    // Total consistente con la vista: itemsSubtotal + deliveryFee - descuento
    const itemsSubtotalFactura = items.reduce((acc, item) => acc + (item.cantidad * getItemPrice(item)), 0)
    const totalGeneral = itemsSubtotalFactura + (pedido.deliveryFee || 0) - getMontoDescuentoPedido(pedido)

    // Agrupar items por cliente
    const itemsPorCliente = items.reduce((acc, item) => {
        const cliente = item.clienteNombre || 'Sin nombre'
        if (!acc[cliente]) acc[cliente] = []
        acc[cliente].push(item)
        return acc
    }, {} as Record<string, ItemFacturaLike[]>)

    const commands = [
        ESC + '@', // Initialize
        ESC + 't' + '\x00', // Table PC437

        // HEADER - FACTURA
        ESC + 'a' + '\x01', // Center
        ESC + '!' + '\x30', // Doble alto y ancho
        `${restauranteNombre.toUpperCase()}\n`,

        ESC + '!' + '\x00', // Normal
        '================================\n',
        ESC + '!' + '\x08', // Bold
        '           FACTURA\n',
        ESC + '!' + '\x00', // Normal
        '================================\n',

        // INFO DEL PEDIDO
        ESC + 'a' + '\x00', // Left
    ];

    // Fecha y Hora
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-AR');
    const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    commands.push(`Fecha: ${dateStr} ${timeStr}\n`);
    commands.push('--------------------------------\n');

    // --- Encabezado tipo pedido: Bold compacto ---
    commands.push(ESC + '!' + '\x08'); // Solo Negrita
    commands.push(`PEDIDO #${pedido.id}\n`);

    if (pedido.tipo === 'delivery') {
        commands.push(`DELIVERY\n`);
    } else if (pedido.tipo === 'takeaway') {
        commands.push(`TAKE AWAY\n`);
    } else if (pedido.tipo === 'mesa') {
        commands.push(`${pedido.mesaNombre?.toUpperCase() || 'MESA'}\n`);
    } else if (pedido.mesaNombre) {
        commands.push(`${pedido.mesaNombre.toUpperCase()}\n`);
    }

    commands.push(ESC + '!' + '\x00'); // Normal
    commands.push('--------------------------------\n');

    if (pedido.nombrePedido) {
        commands.push(`Cliente: ${pedido.nombrePedido}\n`);
    }
    if (pedido.telefono) {
        commands.push(`Tel: ${pedido.telefono}\n`);
    }

    if (pedido.tipo === 'delivery' && pedido.direccion) {
        commands.push(ESC + '!' + '\x08'); // Bold
        commands.push(`Dir: ${pedido.direccion}\n`);
        commands.push(ESC + '!' + '\x00'); // Normal
        commands.push('--------------------------------\n');
    }

    if (pedido.notas) {
        commands.push(ESC + '!' + '\x08');
        commands.push(`NOTAS: ${pedido.notas}\n`);
        commands.push(ESC + '!' + '\x00');
        commands.push('--------------------------------\n');
    }

    if (pedido.metodoPago) {
        const metodoFormateado = formatMetodoPagoPrinter(pedido.metodoPago);
        commands.push(ESC + '!' + '\x08');
        commands.push(`PAGO: ${metodoFormateado}\n`);
        commands.push(ESC + '!' + '\x00');
        commands.push('--------------------------------\n');
    }

    commands.push('--------------------------------\n');

    // ITEMS AGRUPADOS POR CLIENTE
    const clientes = Object.entries(itemsPorCliente);
    clientes.forEach(([cliente, clienteItems], clienteIdx) => {
        commands.push(ESC + '!' + '\x08'); // Bold
        commands.push(`>> ${cliente.toUpperCase()}\n`);
        commands.push(ESC + '!' + '\x00'); // Normal

        let subtotalCliente = 0;
        clienteItems.forEach(item => {
            const pUnit = getItemPrice(item);
            const subtotal = item.cantidad * pUnit;
            subtotalCliente += subtotal;

            // Nombre del producto: DOBLE ALTO + NEGRITA
            const nombre = getNombreProductoConVariantes(item);
            commands.push(ESC + '!' + '\x18'); // Doble alto + Negrita
            commands.push(`  ${item.cantidad}x ${nombre}\n`);
            commands.push(ESC + '!' + '\x00'); // Normal

            // Precio en tamaño normal
            const subtotalStr = `$${subtotal.toFixed(2)}`;
            commands.push(`    ${item.cantidad} x $${pUnit.toFixed(2)} = ${subtotalStr}\n`);

            // Agregados (CON:)
            const agregados = parseAgregadosPedido(item.agregados);
            if (agregados.length > 0) {
                commands.push(ESC + '!' + '\x10'); // Doble alto
                commands.push(`    CON:\n`);
                agregados.forEach((a) => {
                    commands.push(`     + ${a.nombre}\n`);
                });
                commands.push(ESC + '!' + '\x00');
            }

            // Excluidos (SIN:)
            if (item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0) {
                commands.push(ESC + '!' + '\x10'); // Doble alto
                commands.push(`    SIN:\n`);
                item.ingredientesExcluidosNombres.forEach((nombre: string) => {
                    commands.push(`     - ${nombre}\n`);
                });
                commands.push(ESC + '!' + '\x00');
            }
            if (item.nota?.trim()) {
                commands.push(ESC + '!' + '\x18');
                commands.push(`    NOTA: ${item.nota.trim()}\n`);
                commands.push(ESC + '!' + '\x00');
            }
        });

        // Subtotal del cliente
        commands.push(`  ` + '-'.repeat(30) + `\n`);
        commands.push(ESC + '!' + '\x08'); // Bold
        const subtotalLabel = `Subtotal ${cliente}:`;
        const subtotalValue = `$${subtotalCliente.toFixed(2)}`;
        const espaciosSub = LINE_WIDTH - subtotalLabel.length - subtotalValue.length - 2;
        commands.push(`  ${subtotalLabel}${espaciosSub > 0 ? ' '.repeat(espaciosSub) : ' '}${subtotalValue}\n`);
        commands.push(ESC + '!' + '\x00'); // Normal

        // Separador entre clientes
        if (clienteIdx < clientes.length - 1) {
            commands.push('\n');
        }
    });

    // TOTAL FINAL
    commands.push('================================\n');

    // Si hay delivery fee, lo mostramos aparte antes del total final
    if (pedido.deliveryFee !== undefined && pedido.deliveryFee > 0) {
        commands.push(ESC + 'a' + '\x02'); // Right align
        commands.push(`Costo Envio: $${pedido.deliveryFee.toFixed(2)}\n`);
        commands.push('--------------------------------\n');
    }

    const montoDescFactura = getMontoDescuentoPedido(pedido)
    if (montoDescFactura > 0) {
        commands.push(ESC + 'a' + '\x00');
        commands.push(ESC + '!' + '\x08');
        const cuponF = pedido.codigoDescuentoCodigo?.trim()
        commands.push(cuponF ? `CUPON: ${cuponF}\n` : `DESCUENTO (CUPON)\n`);
        commands.push(ESC + '!' + '\x00');
        commands.push(ESC + 'a' + '\x02');
        commands.push(`Descuento: -$${montoDescFactura.toFixed(2)}\n`);
        commands.push('--------------------------------\n');
    }

    commands.push(ESC + 'a' + '\x02'); // Right align
    commands.push(ESC + '!' + '\x18'); // Double height + bold
    commands.push(`TOTAL: $${totalGeneral.toFixed(2)}\n`);

    commands.push(ESC + '!' + '\x00'); // Normal
    commands.push(ESC + 'a' + '\x01'); // Center
    commands.push('================================\n');
    commands.push('\nGracias por su visita\n');
    commands.push('Vuelva pronto!\n');

    commands.push('\n\n\n\n');
    commands.push(GS + 'V' + '\x41' + '\x00'); // Cut

    return commands;
};

/**
 * Convierte un array de comandos ESC/POS (strings) a un array de bytes (números).
 * Preserva los caracteres de control como \x1B, \x1D, etc.
 * @param commands Array de strings con comandos ESC/POS
 * @returns Array de números representando los bytes raw
 */
export const commandsToBytes = (commands: string[]): number[] => {
    const bytes: number[] = [];

    for (const command of commands) {
        for (let i = 0; i < command.length; i++) {
            bytes.push(command.charCodeAt(i));
        }
    }

    return bytes;
};
