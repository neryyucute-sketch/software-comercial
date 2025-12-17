import { SyncManager } from "@/components/sync-manager"


export default function SyncPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sincronización de Datos</h1>
          <p className="text-gray-600">Mantén tus datos actualizados con el servidor central</p>
        </div>

        <div className="grid gap-6">
          <SyncManager />

          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">¿Cómo funciona el modo offline?</h3>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>• Los pedidos se guardan localmente cuando no hay conexión</li>
              <li>• Se sincronizan automáticamente al recuperar la conexión</li>
              <li>• Puedes consultar productos y clientes sin internet</li>
              <li>• Los datos se actualizan periódicamente desde el servidor</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
