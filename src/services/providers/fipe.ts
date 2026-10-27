import type { FipePriceHistory } from "../../types/vehicle";
import { fetchVehiclePriceHistory } from "../fipe";
import type { Provider } from "./types";

/** Monthly FIPE prices of the vehicle up to its reference month. */
export const fipeHistoryProvider: Provider<FipePriceHistory[]> = {
  id: "fipe-history",
  async lookup(vehicle, signal) {
    const history = await fetchVehiclePriceHistory(
      vehicle.category,
      vehicle.codeFipe,
      vehicle.yearCode,
      vehicle.referenceCode,
      signal,
    );
    return history.length > 0
      ? { source: "fipe", confidence: "exact", data: history }
      : null;
  },
};
