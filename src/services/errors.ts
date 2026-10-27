import { HttpError } from "./http";

/** User-facing message for a failed request, from its typed error. */
export function requestErrorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    const source = error.provider === "FIPE" ? "a FIPE" : error.provider;
    switch (error.kind) {
      case "rate-limit":
        return "O limite diário de consultas foi atingido. Tente novamente mais tarde.";
      case "network":
        return `Não foi possível conectar ${source === "a FIPE" ? "à FIPE" : `a ${source}`}. Verifique a conexão e tente novamente.`;
      case "timeout":
        return `${source === "a FIPE" ? "A FIPE" : source} demorou demais para responder. Tente novamente.`;
      case "http":
        if (error.status === 404) return "Esse item não foi encontrado na tabela FIPE.";
        if (error.status !== null && error.status >= 500) {
          return `${source === "a FIPE" ? "A FIPE" : source} está instável no momento. Tente novamente em instantes.`;
        }
        return "Não foi possível concluir a consulta. Tente novamente.";
      case "parse":
        return "A resposta da consulta veio num formato inesperado. Tente novamente.";
      case "aborted":
        return "";
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return "Não foi possível concluir a consulta. Tente novamente.";
}
