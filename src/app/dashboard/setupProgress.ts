/**
 * Marcas de progresso da configuração inicial que NÃO dá pra deduzir do
 * estado atual do sistema (diferente de "tem música cadastrada?", que é só
 * olhar a lista). São coisas que aconteceram uma vez e não deixam rastro
 * permanente: abrir a Projeção, usar a Bíblia, disparar um timer.
 *
 * Fica em localStorage de propósito: é orientação pra quem está operando
 * neste computador, não dado da igreja. Se o navegador limpar, o pior que
 * acontece é o checklist reaparecer — nada se perde.
 */

export const SETUP_FLAG = {
  projection: "arauto-setup-projection",
  stage: "arauto-setup-stage",
  bible: "arauto-setup-bible",
  timer: "arauto-setup-timer",
  dismissed: "arauto-setup-dismissed",
} as const;

export type SetupFlagKey = (typeof SETUP_FLAG)[keyof typeof SETUP_FLAG];

export function readSetupFlag(key: SetupFlagKey): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markSetupFlag(key: SetupFlagKey, value = true) {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* modo privado/armazenamento bloqueado — o checklist só reaparece, sem quebrar nada */
  }
}
