import { SkyewalletClient } from "../lib/skyewallet.js";
import type { BankResolutionInput } from "../routes/schemas.js";

export class BankService {
  constructor(private readonly skyewallet: SkyewalletClient) {}

  async listBanks(countryCode: string) {
    const response = await this.skyewallet.listBanks(countryCode);
    return response.data.banks;
  }

  async resolveBankAccount(input: BankResolutionInput) {
    let bankCode = input.bankCode;

    if (!bankCode && input.bankName) {
      bankCode = await this.lookupBankCode(input.countryCode ?? "NG", input.bankName);
    }

    if (!bankCode) {
      throw new Error("Unable to determine bank code");
    }

    const resolved = await this.skyewallet.resolveBankAccount({
      country_code: input.countryCode ?? "NG",
      bank_code: bankCode,
      account_number: input.accountNumber
    });

    return {
      accountName: resolved.data.account_name,
      bankCode: resolved.data.bank_code,
      accountNumber: resolved.data.account_number,
      countryCode: input.countryCode ?? "NG"
    };
  }

  private async lookupBankCode(countryCode: string, bankName: string): Promise<string | undefined> {
    const response = await this.skyewallet.listBanks(countryCode);
    const normalized = bankName.toLowerCase().trim();
    const bank = response.data.banks.find(
      (b) =>
        b.name.toLowerCase().trim() === normalized ||
        b.slug.toLowerCase().trim() === normalized ||
        b.code.toLowerCase().trim() === normalized
    );

    return bank?.code;
  }
}
