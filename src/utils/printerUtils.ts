
interface ItemPedidoLike {
    cantidad: number
    nombreProducto?: string
    ingredientesExcluidosNombres?: string[]
    categoriaNombre?: string
    // nota?: string (si tuviéramos notas)
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

    const commands = [
        ESC + '@', // Initialize
        ESC + 't' + '\x00', // Character code table (PC437)

        // Header
        ESC + 'a' + '\x01', // Center align
        ESC + '!' + '\x10', // Double height
        'COCINA\n',
        ESC + '!' + '\x00', // Normal text
        `${restauranteNombre}\n`,
        '--------------------------------\n',

        // Order Info
        ESC + 'a' + '\x00', // Left align
        ESC + '!' + '\x08', // Emphasis (Bold)
        `Pedido: #${pedido.id}\n`,
    ];

    if (pedido.mesaNombre) {
        commands.push(`Mesa: ${pedido.mesaNombre}\n`);
    }
    if (pedido.nombrePedido) {
        commands.push(`Cliente: ${pedido.nombrePedido}\n`);
    }

    // Time
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    commands.push(`Hora: ${timeString}\n`);

    commands.push(ESC + '!' + '\x00'); // Normal text
    commands.push('--------------------------------\n');

    // Group items by category
    const itemsByCategory: Record<string, ItemPedidoLike[]> = {};

    items.forEach(item => {
        const category = item.categoriaNombre || 'OTROS';
        if (!itemsByCategory[category]) {
            itemsByCategory[category] = [];
        }
        itemsByCategory[category].push(item);
    });

    // Print items grouped
    Object.keys(itemsByCategory).forEach((category) => {
        // Category Header
        commands.push(ESC + 'a' + '\x01'); // Center
        commands.push(ESC + '!' + '\x08'); // Bold
        commands.push(`--- ${category.toUpperCase()} ---\n`);
        commands.push(ESC + '!' + '\x00'); // Normal
        commands.push(ESC + 'a' + '\x00'); // Left align

        // Items in this category
        itemsByCategory[category].forEach(item => {
            commands.push(ESC + '!' + '\x08'); // Bold
            commands.push(`${item.cantidad} x ${item.nombreProducto || 'Producto'}\n`);
            commands.push(ESC + '!' + '\x00'); // Normal

            // Excluded ingredients
            if (item.ingredientesExcluidosNombres && item.ingredientesExcluidosNombres.length > 0) {
                commands.push(`   SIN: ${item.ingredientesExcluidosNombres.join(', ')}\n`);
            }

            // Space between items
            commands.push('\n');
        });

        // Extra space between categories if not the last one
        // if (index < array.length - 1) {
        //    commands.push('\n');
        // }
    });

    commands.push('--------------------------------\n');
    commands.push('\n\n\n\n');
    commands.push(GS + 'V' + '\x41' + '\x00'); // Cut

    return commands;
};
