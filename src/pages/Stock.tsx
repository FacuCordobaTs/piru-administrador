import { StockPanel } from '@/components/stock/StockPanel'
import { useAuthStore } from '@/store/authStore'

/** Control de stock: insumos, compras y recetas por producto. */
export default function Stock() {
  const token = useAuthStore((state) => state.token)

  return (
    <div className="min-h-full bg-[#FFFBF0] py-8 dark:bg-background">
      <StockPanel token={token} />
    </div>
  )
}
