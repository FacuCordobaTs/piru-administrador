interface ItemPedidoLike {
    cantidad: number
    nombreProducto?: string
    precio?: number
    precioUnitario?: string | number  // Campo del WebSocket (puede venir como string)
    ingredientesExcluidosNombres?: string[]
    agregados?: any[]
    categoriaNombre?: string
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
    commands.push('--------------------------------\n');

    // --- TAMAÑO GIGANTE (Doble Alto + Ancho + Negrita) ---
    commands.push(ESC + '!' + '\x38');
    commands.push(`PEDIDO #${pedido.id}\n`);

    if (pedido.tipo === 'delivery') {
        commands.push(`DELIVERY\n`);
    } else if (pedido.tipo === 'takeaway') {
        commands.push(`TAKE AWAY\n`);
    } else if (pedido.mesaNombre) {
        commands.push(`${pedido.mesaNombre.toUpperCase()}\n`);
    }

    // --- VOLVER A NORMAL ---
    commands.push(ESC + '!' + '\x00');
    commands.push('--------------------------------\n');

    if (pedido.nombrePedido) {
        commands.push(`Cliente: ${pedido.nombrePedido}\n`);
    }
    if (pedido.telefono) {
        commands.push(`Tel: ${pedido.telefono}\n`);
    }

    // Address (can be long, we might need to let the printer wrap it if possible, but we'll try to fit it)
    if (pedido.tipo === 'delivery' && pedido.direccion) {
        commands.push(ESC + '!' + '\x08'); // Bold
        commands.push(`Dir: ${pedido.direccion}\n`);
        commands.push(ESC + '!' + '\x00'); // Normal
        commands.push('--------------------------------\n');
    }

    if (pedido.notas) {
        commands.push(ESC + '!' + '\x08'); // Activa Negrita
        commands.push(`NOTAS: ${pedido.notas}\n`);
        commands.push(ESC + '!' + '\x00'); // Desactiva Negrita (Normal)
        commands.push('--------------------------------\n');
    }

    // ITEMS
    items.forEach(item => {
        const pUnit = getItemPrice(item);
        const subtotal = item.cantidad * pUnit;

        // Fila 1: Cantidad x Precio Unitario
        // Formato: 1,000 x 7.800,00
        const cantStr = item.cantidad.toLocaleString('es-AR', { minimumFractionDigits: 3 });
        const pUnitStr = pUnit.toLocaleString('es-AR', { minimumFractionDigits: 2 });
        commands.push(`${cantStr} x ${pUnitStr}\n`);

        // Fila 2: Nombre y Subtotal (Alineado derecha)
        const nombre = (item.nombreProducto || 'Producto').toLowerCase();
        const subtotalStr = subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 });

        const espacios = LINE_WIDTH - nombre.length - subtotalStr.length;
        const filaNombre = nombre + (espacios > 0 ? ' '.repeat(espacios) : ' ') + subtotalStr;

        commands.push(ESC + '!' + '\x08'); // Negrita para el nombre
        commands.push(`${filaNombre}\n`);
        commands.push(ESC + '!' + '\x00'); // Volver a normal

        // Agregados primero (CON:)
        if (item.agregados && item.agregados.length > 0) {
            commands.push(`  CON:\n`);
            item.agregados.forEach(a => {
                commands.push(`    - ${a.nombre}\n`);
            });
        }

        // Excluidos después (SIN:)
        if (item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0) {
            commands.push(`  SIN:\n`);
            item.ingredientesExcluidosNombres.forEach(nombre => {
                commands.push(`    - ${nombre}\n`);
            });
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

    // --- TAMAÑO GIGANTE (Doble Alto + Ancho + Negrita) ---
    commands.push(ESC + '!' + '\x38');
    commands.push(`PEDIDO #${pedido.id}\n`);

    if (pedido.tipo === 'delivery') {
        commands.push(`DELIVERY\n`);
    } else if (pedido.tipo === 'takeaway') {
        commands.push(`TAKE AWAY\n`);
    } else if (pedido.mesaNombre) {
        commands.push(`${pedido.mesaNombre.toUpperCase()}\n`);
    }

    // --- VOLVER A NORMAL ---
    commands.push(ESC + '!' + '\x00');
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
        commands.push(ESC + '!' + '\x08'); // Activa Negrita
        commands.push(`NOTAS: ${pedido.notas}\n`);
        commands.push(ESC + '!' + '\x00'); // Desactiva Negrita (Normal)
        commands.push('--------------------------------\n');
    }

    commands.push('--------------------------------\n');

    // ITEMS AGRUPADOS POR CLIENTE
    const clientes = Object.entries(itemsPorCliente);
    clientes.forEach(([cliente, clienteItems], clienteIdx) => {
        // Nombre del cliente
        commands.push(ESC + '!' + '\x08'); // Bold
        commands.push(`>> ${cliente.toUpperCase()}\n`);
        commands.push(ESC + '!' + '\x00'); // Normal

        // Items del cliente
        let subtotalCliente = 0;
        clienteItems.forEach(item => {
            const pUnit = getItemPrice(item);
            const subtotal = item.cantidad * pUnit;
            subtotalCliente += subtotal;

            // Nombre del producto
            const nombre = (item.nombreProducto || 'Producto');
            const subtotalStr = `$${subtotal.toFixed(2)}`;
            const espacios = LINE_WIDTH - nombre.length - subtotalStr.length - 2; // -2 for indent
            const filaNombre = '  ' + nombre + (espacios > 0 ? ' '.repeat(espacios) : ' ') + subtotalStr;

            // --- APLICAR NEGRITA AL ÍTEM ---
            commands.push(ESC + '!' + '\x08'); // Activar Bold
            commands.push(`${filaNombre}\n`);
            commands.push(ESC + '!' + '\x00'); // Volver a Normal
            // -------------------------------

            // Detalle: cantidad x precio
            commands.push(`    ${item.cantidad} x $${pUnit.toFixed(2)}\n`);

            // Agregados primero (CON:)
            if (item.agregados && item.agregados.length > 0) {
                commands.push(`    CON:\n`);
                item.agregados.forEach((a: any) => {
                    commands.push(`      - ${a.nombre}\n`);
                });
            }

            // Ingredientes excluidos después (SIN:)
            if (item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0) {
                commands.push(`    SIN:\n`);
                item.ingredientesExcluidosNombres.forEach((nombre: string) => {
                    commands.push(`      - ${nombre}\n`);
                });
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