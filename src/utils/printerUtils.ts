interface ItemPedidoLike {
    cantidad: number
    nombreProducto?: string
    precio?: number
    ingredientesExcluidosNombres?: string[]
    categoriaNombre?: string
}

interface PedidoLike {
    id: number
    mesaNombre?: string | null
    nombrePedido?: string | null
}
export const formatComanda = (
    pedido: PedidoLike,
    items: ItemPedidoLike[],
    restauranteNombre: string
) => {
    const ESC = '\x1B';
    const GS = '\x1D';
    const LINE_WIDTH = 32;

    // Calculamos el total primero para tenerlo disponible
    const totalGeneral = items.reduce((acc, item) => acc + (item.cantidad * (item.precio || 0)), 0);

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
        ESC + '!' + '\x08', // Bold
        `Pedido: #${pedido.id}\n`,
        ESC + '!' + '\x00', // Normal
    ];

    // Fecha y Hora (Nuevo, como en la imagen)
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-AR');
    const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    commands.push(`Fecha: ${dateStr} ${timeStr}\n`);

    if (pedido.mesaNombre) {
        commands.push(`Mesa: ${pedido.mesaNombre}\n`);
    }
    if (pedido.nombrePedido) {
        commands.push(`Sr/a: ${pedido.nombrePedido}\n`);
    }

    commands.push('--------------------------------\n');

    // ITEMS
    items.forEach(item => {
        const pUnit = item.precio || 0;
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

        if (item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0) {
            commands.push(`  SIN: ${item.ingredientesExcluidosNombres.join(', ')}\n`);
        }
    });

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