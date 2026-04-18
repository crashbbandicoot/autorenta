import { TutorialSection } from "@/components/tutorial/TutorialSection";
import { TutorialStep } from "@/components/tutorial/TutorialStep";
import { InfoCallout } from "@/components/tutorial/InfoCallout";

export const metadata = {
  title: "Instrucciones Renta — AutoRenta",
};

export default function InstruccionesRentaPage() {
  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Cómo declarar en la Renta
        </h1>
        <p className="mt-2 text-gray-500 text-sm">
          Instrucciones para rellenar la declaración en la sede electrónica de la AEAT.
        </p>
      </div>

      <InfoCallout variant="info" className="mb-8">
        Accede al asistente Renta Web en{" "}
        <a
          href="https://sede.agenciatributaria.gob.es/Sede/Renta.html"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium"
        >
          sede.agenciatributaria.gob.es
        </a>
        . El informe de AutoRenta clasifica tus activos en tres categorías: acciones,
        derivados (opciones/futuros/CFDs/forex) y dividendos.
      </InfoCallout>

      <TutorialSection title="1. Acciones (Transmisiones)">
        <InfoCallout variant="info" className="mb-4">
          Localiza la página <strong>16/53</strong> del asistente, sección{" "}
          <strong>F2. Ganancias y pérdidas patrimoniales</strong>.
        </InfoCallout>

        <TutorialStep
          number={1}
          title="Busca la casilla 0328 — Transmisiones de acciones negociadas en mercados"
        >
          <p>Haz clic en el icono del lápiz para añadir una entrada.</p>
        </TutorialStep>

        <TutorialStep number={2} title="Rellena los campos con los datos del informe">
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li><strong>Entidad emisora:</strong> nombre del broker (ej. Interactive Brokers)</li>
            <li><strong>Valor de transmisión:</strong> importe de ventas totales</li>
            <li><strong>Valor de adquisición:</strong> coste de compra total (sin signo negativo)</li>
          </ul>
        </TutorialStep>

        <TutorialStep
          number={3}
          title="Pérdidas no deducibles (regla de recompra en 2 meses)"
        >
          <InfoCallout variant="warning">
            Si has recomprado el mismo valor dentro de los 2 meses anteriores o posteriores a la
            venta con pérdida, crea una <strong>entrada separada</strong> con estos datos:
          </InfoCallout>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Entidad emisora:</strong> RECOMPRA VALORES</li>
            <li><strong>Valor de transmisión:</strong> 1</li>
            <li><strong>Valor de adquisición:</strong> suma de los valores añadidos</li>
            <li>Activa la <strong>casilla de pérdida no imputable</strong></li>
          </ul>
        </TutorialStep>
      </TutorialSection>

      <TutorialSection title="2. Opciones, Futuros, CFDs y Forex">
        <InfoCallout variant="info" className="mb-4">
          Página <strong>20/53</strong>, sección F2 — transmisiones de otros elementos patrimoniales.
        </InfoCallout>

        <TutorialStep
          number={1}
          title="Selecciona la casilla 1626 y elige 'Otros elementos patrimoniales no afectos a actividades económicas'"
        />

        <TutorialStep number={2} title="En la casilla 1631, introduce los datos del informe">
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li><strong>Fecha de adquisición:</strong> 1/1/AAAA (inicio del ejercicio)</li>
            <li><strong>Fecha de transmisión:</strong> 31/12/AAAA (fin del ejercicio)</li>
            <li><strong>Valor de adquisición:</strong> importe de pérdidas (si las hay)</li>
            <li><strong>Valor de transmisión:</strong> importe de ganancias</li>
          </ul>
        </TutorialStep>
      </TutorialSection>

      <TutorialSection title="3. Dividendos">
        <TutorialStep
          number={1}
          title="Casilla 0029 (página 6) — Rendimientos del capital mobiliario"
        >
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Introduce el <strong>importe bruto de dividendos</strong></li>
            <li>Introduce las <strong>retenciones en origen</strong> practicadas</li>
          </ul>
        </TutorialStep>

        <TutorialStep
          number={2}
          title="Casilla 0588 (página 33) — Deducción por doble imposición internacional"
        >
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Introduce la <strong>renta neta reducida</strong> obtenida en el extranjero</li>
            <li>Introduce el <strong>impuesto pagado en el extranjero</strong></li>
          </ul>
          <InfoCallout variant="info" className="mt-2">
            Esta deducción evita tributar dos veces por los mismos dividendos: una vez en el país
            de origen y otra en España.
          </InfoCallout>
        </TutorialStep>
      </TutorialSection>
    </div>
  );
}
