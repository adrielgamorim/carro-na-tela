import { useRef, useState } from "react";
import { decodeVin, normalizeVin, vinProblem } from "../catalog/vin";
import type { VinInfo, WmiFile } from "../catalog/vin";
import { requestErrorMessage } from "../services/errors";
import { isAbortError, requestJson } from "../services/http";
import { decodeVinWithVpic } from "../services/vpic";
import type { VpicVehicle } from "../services/vpic";

export interface VinResult {
  info: VinInfo;
  /** null when vPIC does not know the model; "error" when it did not answer. */
  vpic: VpicVehicle | null | "error";
  /** Model year to filter by: vPIC's when it knows the vehicle. */
  modelYear: number | null;
}

export type VinSearchState =
  | { status: "idle" }
  | { status: "loading"; vin: string }
  | { status: "error"; vin: string; message: string }
  | { status: "done"; vin: string; result: VinResult };

const wmiUrl = `${import.meta.env.BASE_URL}catalog/wmi.json`;
let wmiFile: Promise<WmiFile> | undefined;

function loadWmi(): Promise<WmiFile> {
  wmiFile ??= requestJson<WmiFile>("Tabela de fabricantes (WMI)", wmiUrl).catch((cause: unknown) => {
    wmiFile = undefined;
    throw cause;
  });
  return wmiFile;
}

/** Decodes a chassis number: the WMI table locally, then NHTSA vPIC. */
export function useVinSearch(onResult: (result: VinResult) => void) {
  const [state, setState] = useState<VinSearchState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  async function submit(text: string) {
    const vin = normalizeVin(text);
    const problem = vinProblem(vin);
    controller.current?.abort();
    if (problem) {
      setState({ status: "error", vin, message: problem });
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setState({ status: "loading", vin });

    const vpic = decodeVinWithVpic(vin, { signal: current.signal }).catch(
      (cause: unknown) => (isAbortError(cause) ? null : ("error" as const)),
    );
    try {
      const info = decodeVin(await loadWmi(), vin);
      const fromVpic = await vpic;
      if (current.signal.aborted) return;
      const result: VinResult = {
        info,
        vpic: fromVpic,
        modelYear: (fromVpic !== "error" && fromVpic?.modelYear) || info.modelYear,
      };
      setState({ status: "done", vin, result });
      onResult(result);
    } catch (cause) {
      if (current.signal.aborted) return;
      setState({ status: "error", vin, message: requestErrorMessage(cause) });
    }
  }

  function clear() {
    controller.current?.abort();
    setState({ status: "idle" });
  }

  return { state, submit, clear };
}
