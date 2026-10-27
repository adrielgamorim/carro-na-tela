import { parseModelName } from "../../catalog/modelName";
import type { ModelNameAttributes } from "../../catalog/modelName";
import type { Provider } from "./types";

/** Engine, transmission, body… read from the FIPE model name itself. */
export const modelNameProvider: Provider<ModelNameAttributes> = {
  id: "fipe-name",
  async lookup(vehicle) {
    const attributes = parseModelName(vehicle.model);
    return Object.keys(attributes).length > 0
      ? { source: "fipe-name", confidence: "exact", data: attributes }
      : null;
  },
};
