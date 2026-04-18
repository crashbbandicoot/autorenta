import Link from "next/link";
import { TutorialSection } from "@/components/tutorial/TutorialSection";
import { TutorialStep } from "@/components/tutorial/TutorialStep";
import { InfoCallout } from "@/components/tutorial/InfoCallout";

export const metadata = {
  title: "Obtener extractos — AutoRenta",
};

export default function ObtenerExtractosPage() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Cómo descargar tus extractos de IBKR
        </h1>
        <p className="mt-2 text-gray-500 text-sm">
          Compatible con Interactive Brokers, Mexem e iBroker.
        </p>
      </div>

      <InfoCallout variant="info" className="mb-8">
        Para AutoRenta necesitas el <strong>histórico completo</strong> desde la apertura de tu cuenta.
        IBKR permite exportar un máximo de <strong>365 días por consulta</strong>, por lo que
        deberás repetir el proceso para cada año.
      </InfoCallout>

      <InfoCallout variant="warning" className="mb-8">
        <strong>Cuentas migradas (2020–2021):</strong> Si tu cuenta fue migrada o recibiste
        transferencias entre cuentas IBKR, debes activar el filtro <em>&quot;Migrated&quot;</em> en las
        consultas para acceder al historial anterior a la migración.
      </InfoCallout>

      <TutorialSection title="1. Extracto de Transacciones (Operaciones)">
        <TutorialStep number={1} title='Accede al Client Portal y ve a "Performance &amp; Statements" → "Flex Queries"' />
        <TutorialStep number={2} title='Crea una nueva query llamada "Operaciones Autodeclaro"' />
        <TutorialStep number={3} title='Selecciona las tres secciones: "Operaciones", "Acciones Corporativas" y "Transferencias"' />
        <TutorialStep number={4} title="Selecciona todos los campos de cada sección, excepto Account ID y Account Alias" />
        <TutorialStep number={5} title="Configura el formato de salida como CSV con cabeceras de columnas activadas" />
        <TutorialStep number={6} title="Ejecuta la query para el rango de fechas deseado y descarga el CSV resultante">
          <InfoCallout variant="info">
            Ejemplo de rangos: 2026-01-01 a 2026-03-01, luego 2025-01-01 a 2025-12-31, y así
            sucesivamente hacia atrás hasta el año de apertura de tu cuenta.
          </InfoCallout>
        </TutorialStep>
        <TutorialStep number={7} title="Repite el paso anterior para cada año, descargando un CSV por período" />
      </TutorialSection>

      <TutorialSection title="2. Extracto de Dividendos">
        <InfoCallout variant="info" className="mb-4">
          Desde mayo de 2024 se usa el <strong>Informe de Dividendos</strong> (Tax Documents) en lugar
          de Flex Queries, ya que este último omitía algunos dividendos históricamente.
        </InfoCallout>
        <TutorialStep number={1} title='Accede a "Performance &amp; Statements" → "Tax Documents"' />
        <TutorialStep number={2} title="Selecciona el año fiscal que deseas descargar" />
        <TutorialStep number={3} title='Descarga el "Dividend Report" en formato CSV' />
        <TutorialStep
          number={4}
          title="Renombra el archivo: elimina el código de identificación y añade el año"
        >
          <InfoCallout variant="code">
            Ejemplo: U1234567_dividendos.csv → <strong>dividendos_2023.csv</strong>
          </InfoCallout>
          <p>Repite para cada año que necesites declarar.</p>
        </TutorialStep>
      </TutorialSection>

      <TutorialSection title="3. Preparar el ZIP">
        <TutorialStep number={1} title="Reúne todos los CSVs descargados en una misma carpeta" />
        <TutorialStep number={2} title="Comprueba que los nombres siguen el formato correcto">
          <InfoCallout variant="code">
            dividendos_2023.csv · dividendos_2024.csv · operaciones_2023.csv · operaciones_2024.csv ...
          </InfoCallout>
        </TutorialStep>
        <TutorialStep number={3} title="Selecciona todos los archivos CSV y comprímellos en un único archivo .zip" />
      </TutorialSection>

      <div className="mt-8 pt-6 border-t border-gray-100">
        <Link
          href="/subir-extractos"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          Continuar: Subir extractos →
        </Link>
      </div>
    </div>
  );
}
