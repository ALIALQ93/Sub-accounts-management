import { generateAccountCode } from "@/modules/accounts/utils/generate-account-code";
import { voucherApi } from "@/modules/vouchers/services/voucher-api";
import type { Account } from "@/modules/vouchers/types";

function isDuplicateAccountCodeError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("duplicate key") ||
    message.includes("unique constraint") ||
    message.includes("accounts_code_key") ||
    message.includes("23505")
  );
}

export type CreateAccountPayload = {
  sub_code?: string | null;
  name_ar: string;
  name_en?: string | null;
  currency_id: string;
  is_postable: boolean;
  is_active?: boolean;
};

/**
 * يولّد كود الحساب ويُنشئه مع إعادة المحاولة عند تصادم التزامن (unique على code).
 */
export async function createAccountWithGeneratedCode(
  parent: Account,
  allAccounts: Account[],
  payload: CreateAccountPayload,
  maxAttempts = 8,
): Promise<Account> {
  let workingAccounts = [...allAccounts];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateAccountCode(parent, workingAccounts);
    try {
      return await voucherApi.createAccount({
        code,
        parent_id: parent.id,
        sub_code: payload.sub_code ?? null,
        name_ar: payload.name_ar,
        name_en: payload.name_en ?? null,
        currency_id: payload.currency_id,
        is_postable: payload.is_postable,
        is_active: payload.is_active ?? true,
      });
    } catch (error) {
      if (!isDuplicateAccountCodeError(error) || attempt >= maxAttempts - 1) {
        throw error;
      }
      workingAccounts = [
        ...workingAccounts,
        {
          id: `retry-${attempt}`,
          code,
          parent_id: parent.id,
          name_ar: payload.name_ar,
          currency_id: payload.currency_id,
          is_postable: payload.is_postable,
          is_active: true,
        } as Account,
      ];
    }
  }

  throw new Error("تعذّر توليد كود حساب فريد — حاول مرة أخرى.");
}
