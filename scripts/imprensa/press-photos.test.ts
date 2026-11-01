import { describe, expect, it } from "vitest";
import { namesBrand, notACarOnSale, pressAngle, pressFileName, pressModel, pressYears } from "./press-photos.ts";

const jeep = [
  { id: "Q1", label: "Jeep Commander (2021)" },
  { id: "Q2", label: "Jeep Renegade" },
  { id: "Q3", label: "Jeep Compass" },
];

describe("press photos", () => {
  it("finds the model, the original name's before the line it was filed under", () => {
    expect(pressModel("00150-Jeep-Commander-Renegade_700mil-0539ebec7253.jpg", jeep)?.id).toBe("Q2");
    expect(pressModel("00160-Jeep-Commander-Frame-01-0539ebec7253.jpg", jeep)?.id).toBe("Q1");
    expect(pressModel("Compass 2025/frente.jpg", jeep)?.id).toBe("Q3");
    const duster = [
      { id: "D", label: "Dacia Duster" },
      { id: "O", label: "Renault Duster Oroch" },
    ];
    expect(pressModel("Duster Oroch 2024/lateral.jpg", duster)?.id).toBe("O");
    expect(pressModel("Duster 2024/lateral.jpg", duster)?.id).toBe("D");
    // Written together, or with the "%20" of a link.
    expect(pressModel("00002-Fiat-002_FiatStrada-ab12cd34ef56.jpg", [{ id: "S", label: "Fiat Strada" }])?.id).toBe("S");
    expect(pressModel("00001-Ford-Ford-20Ranger-20social-ea65caa439d3.jpg", [{ id: "R", label: "Ford Ranger" }])?.id).toBe("R");
    // The label's last word alone, when only one model has it.
    expect(pressModel("00005-Citroen-Aircross-x-ab12cd34ef56.jpg", [{ id: "A", label: "Citroën C3 Aircross" }])?.id).toBe("A");
    expect(pressModel("00001-Ram-Dakota-x-ab12cd34ef56.jpg", [{ id: "R", label: "Ram 1500 (DT)" }])).toBeUndefined();
  });

  it("finds a model by FIPE's line when its label does not say it", () => {
    const ram = [
      { id: "P", label: "Ram pickup", families: ["2500"] },
      { id: "D", label: "Ram 1500 (DT)", families: ["1500"] },
    ];
    expect(pressModel("00044-Ram-Ram-2500-Laramie-Night-Edition-1-5d7a39c7b0f7.jpg", ram)?.id).toBe("P");
    // The label still comes first.
    expect(pressModel("00001-Ram-Ram-1500-Rebel-ab12cd34ef56.jpg", ram)?.id).toBe("D");
  });

  it("does not take ordinary words or a thousand for a model", () => {
    const fiat = [
      { id: "U", label: "Fiat Uno Turbo" },
      { id: "P", label: "Fiat Pulse" },
      { id: "5", label: "Fiat 500" },
      { id: "T", label: "Fiat Toro" },
    ];
    expect(pressModel("00119-Fiat-Pulse-Impetus-Turbo-200-Flex-Automatico-229ecb4a4d38.jpg", fiat)?.id).toBe("P");
    expect(pressModel("00504-Fiat-Titano-500.000-Toro-em-Goiana-87bd0a838573.jpg", fiat)?.id).toBe("T");
    const toyota = [
      { id: "C", label: "Toyota Corolla" },
      { id: "V", label: "Toyota Previa" },
    ];
    expect(pressModel("00058-Toyota-Corolla-pfz_ampliacao_previa-04c966b4a353.jpg", toyota)?.id).toBe("C");
  });

  it("reads the years, the angle and what is not a car on sale", () => {
    // An image's size is not a year.
    expect(pressYears("00014-Toyota-RAV4-2048x1365-44731ac7d692.jpg")).toBeUndefined();
    expect(notACarOnSale("00478-Fiat-Titano-Premio-Lotus-2025-f6ca12a625b8.jpg")).toBe(true);
    expect(pressYears("Kwid 2023-2025/frente.jpg")).toEqual([2023, 2025]);
    expect(pressYears("00764-Fiat-A-cronos-drive-my26-01-290be82ac122.jpg")).toEqual([2026, 2026]);
    expect(pressYears("00007-Chevrolet-Captiva-1770049809434-44aff3e4bd08.jpg")).toBeUndefined();
    expect(pressAngle("Ford-Transit-Furgao-branca-visao-dianteira")).toBe("frente");
    expect(pressAngle("interior painel.jpg")).toBe("interior");
    expect(pressAngle("Frame-01")).toBe("outra");
    expect(notACarOnSale("00001-Peugeot-PEUGEOT-9x8-ALLURE-NASCIDO-PARA-CORRIDA-292e74af26d2.jpg")).toBe(true);
    expect(notACarOnSale("00001-Chevrolet-Captiva-Cadillac-Formula-1-Team-e1844d313022.jpg")).toBe(true);
    expect(notACarOnSale("00002-Chevrolet-Captiva-1773073421938-7d73197cc636.jpg")).toBe(false);
  });

  it("names the brand and the file", () => {
    expect(namesBrand("Volkswagen", "VW - VolksWagen")).toBe(true);
    expect(namesBrand("Chevrolet", "GM - Chevrolet")).toBe(true);
    expect(namesBrand("Citroen", "Citroën")).toBe(true);
    expect(namesBrand("Ram", "Rely")).toBe(false);
    expect(pressFileName("Duster 2025/IMG 001 Frente.JPG")).toBe("duster-2025-img-001-frente.webp");
  });
});
