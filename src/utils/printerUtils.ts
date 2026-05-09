interface ItemPedidoLike {
    cantidad: number
    nombreProducto?: string
    precio?: number
    precioUnitario?: string | number  // Campo del WebSocket (puede venir como string)
    ingredientesExcluidosNombres?: string[]
    agregados?: any[]
    categoriaNombre?: string
    varianteNombre?: string
}

// Interface for factura items - includes clienteNombre for grouping
interface ItemFacturaLike extends ItemPedidoLike {
    clienteNombre?: string
}

interface PedidoLike {
    id: number
    mesaNombre?: string | null
    nombrePedido?: string | null
    total?: string  // Total del pedido para usar como fallback
    tipo?: 'mesa' | 'delivery' | 'takeaway'
    direccion?: string | null
    telefono?: string | null
    deliveryFee?: number
    notas?: string | null // <-- AGREGA ESTA LÍNEA
    metodoPago?: string | null
    /** Monto descontado por cupón (ya reflejado en total del pedido) */
    montoDescuento?: string | number | null
    /** Texto del cupón aplicado (ej. ALFAJOR10) */
    codigoDescuentoCodigo?: string | null
    sucursalNombre?: string | null
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

// Helper para obtener el precio unitario de un item (INCLUYENDO AGREGADOS)
const getItemPrice = (item: ItemPedidoLike): number => {
    let basePrice = 0;
    if (item.precio !== undefined) {
        basePrice = item.precio;
    } else if (item.precioUnitario !== undefined) {
        basePrice = typeof item.precioUnitario === 'string'
            ? parseFloat(item.precioUnitario) || 0
            : item.precioUnitario;
    }

    let agregadosTotal = 0;
    if (item.agregados) {
        let arr: any[] = [];
        // Intentamos parsear por si viene como JSON string o directamente Array
        if (typeof item.agregados === 'string') {
            try { arr = JSON.parse(item.agregados) } catch (e) { }
        } else if (Array.isArray(item.agregados)) {
            arr = item.agregados;
        }

        arr.forEach((ag: any) => {
            agregadosTotal += parseFloat(ag.precio || '0');
        });
    }

    return basePrice + agregadosTotal;
}

export const formatComanda = (
    pedido: PedidoLike,
    items: ItemPedidoLike[],
    restauranteNombre: string
) => {
    const ESC = '\x1B';
    const GS = '\x1D';
    const LINE_WIDTH = 32;

    // Calculamos el total (usamos el total del pedido si está disponible, sino calculamos)
    const calculatedTotal = items.reduce((acc, item) => acc + (item.cantidad * getItemPrice(item)), 0);
    const totalGeneral = pedido.total ? parseFloat(pedido.total) : calculatedTotal;

    const commands = [
        ESC + '@', // Initialize
        ESC + 't' + '\x00', // Table PC437

        // HEADER - Igual al original pero con estilo de la imagen
        ESC + 'a' + '\x01', // Center
        ESC + '!' + '\x30', // Doble alto y ancho (Mayúsculas)
        `${restauranteNombre.toUpperCase()}\n`,

        ESC + '!' + '\x00', // Normal
        '--------------------------------\n',

        // INFO DEL PEDIDO
        ESC + 'a' + '\x00', // Left
    ];

    // Fecha y Hora
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-AR');
    const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    commands.push(`Fecha: ${dateStr} ${timeStr}\n`);
    if (pedido.sucursalNombre) {
        commands.push(`Sucursal: ${pedido.sucursalNombre}\n`);
    }
    commands.push('--------------------------------\n');

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

    // ITEMS — Nombre del producto en DOBLE ALTO + NEGRITA para que la cocina lo lea rápido
    items.forEach(item => {
        // Nombre del producto: GRANDE (Doble alto + Negrita)
        const sufijoVariante = item.varianteNombre ? ` (${item.varianteNombre})` : '';
        const nombre = `${item.nombreProducto || 'Producto'}${sufijoVariante}`;
        commands.push(ESC + '!' + '\x18'); // Doble alto + Negrita
        commands.push(`${item.cantidad}x ${nombre}\n`);
        commands.push(ESC + '!' + '\x00'); // Normal


        // Agregados (CON:)
        if (item.agregados && item.agregados.length > 0) {
            commands.push(ESC + '!' + '\x10'); // Doble alto
            commands.push(`  CON:\n`);
            item.agregados.forEach(a => {
                commands.push(`   + ${a.nombre}\n`);
            });
            commands.push(ESC + '!' + '\x00');
        }

        // Excluidos (SIN:)
        if (item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0) {
            commands.push(ESC + '!' + '\x10'); // Doble alto
            commands.push(`  SIN:\n`);
            item.ingredientesExcluidosNombres.forEach(nombre => {
                commands.push(`   - ${nombre}\n`);
            });
            commands.push(ESC + '!' + '\x00');
        }
    });

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
    commands.push(ESC + '!' + '\x10'); // Double height
    commands.push(`Total : $ ${totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2 })}\n`);

    commands.push(ESC + '!' + '\x00');
    commands.push(ESC + 'a' + '\x01'); // Center
    commands.push('\nGracias por elegirnos.\n');

    commands.push('\n\n\n\n');
    commands.push(GS + 'V' + '\x41' + '\x00'); // Cut

    return commands;
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

    // Calculamos el total
    const calculatedTotal = items.reduce((acc, item) => acc + (item.cantidad * getItemPrice(item)), 0);
    const totalGeneral = pedido.total ? parseFloat(pedido.total) : calculatedTotal;

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
            const sufijoVariante = item.varianteNombre ? ` (${item.varianteNombre})` : '';
            const nombre = `${item.nombreProducto || 'Producto'}${sufijoVariante}`;
            commands.push(ESC + '!' + '\x18'); // Doble alto + Negrita
            commands.push(`  ${item.cantidad}x ${nombre}\n`);
            commands.push(ESC + '!' + '\x00'); // Normal

            // Precio en tamaño normal
            const subtotalStr = `$${subtotal.toFixed(2)}`;
            commands.push(`    ${item.cantidad} x $${pUnit.toFixed(2)} = ${subtotalStr}\n`);

            // Agregados (CON:)
            if (item.agregados && item.agregados.length > 0) {
                commands.push(ESC + '!' + '\x10'); // Doble alto
                commands.push(`    CON:\n`);
                item.agregados.forEach((a: any) => {
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