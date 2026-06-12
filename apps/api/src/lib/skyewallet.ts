const REQUEST_TIMEOUT_MS = 30_000;

type RequestOptions = {
  method?: string;
  body?: Record<string, unknown>;
};

type CustomerInput = {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, string>;
};

type LookupCustomerInput = {
  email?: string;
  reference?: string;
};

type SkyewalletCustomer = {
  id: string;
  business_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  reference: string | null;
  validated_at: string | null;
  bvn_number: string | null;
  bvn_verified_at: string | null;
  metadata: Record<string, string>;
  status: string;
  created_at: string;
  updated_at: string | null;
};

type CreatePayinInput =
  | {
      method: "crypto";
      customer_id: string;
      pay_reference: string;
      type: "static" | "dynamic";
      currency: string;
      network: string;
      amount?: string;
      trx_activation_mode?: "business" | "user";
    }
  | {
      method: "bank_transfer";
      customer_id: string;
      pay_reference: string;
      type: "static" | "dynamic";
      currency: string;
      amount?: string;
      payment_bank_name?: string;
    };

type SkyewalletPayinAccount = {
  id: string;
  owner_type: string;
  owner_id: string;
  customer_id: string | null;
  business_id: string;
  currency_id: string;
  network_id: string;
  type: string;
  address: string;
  wallet_id: string | null;
  status: string;
  expires_at: string | null;
  expected_amount: string | null;
  created_at: string;
  currency_decimals: number;
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
};

type SkyewalletPayin = {
  id: string;
  business_id: string;
  customer_id: string;
  method: string;
  status: string;
  crypto_account_id: string | null;
  virtual_account_id: string | null;
  mobile_money_account_id: string | null;
  transaction_id: string | null;
  amount: string | null;
  currency_code: string;
  network_code: string | null;
  pay_reference: string | null;
  metadata: Record<string, unknown>;
  provider_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
  account: SkyewalletPayinAccount;
};

type QuoteInput = {
  from_currency: string;
  to_currency: string;
  from_amount: string;
};

type PayoutInput =
  | {
      type: "crypto";
      address: string;
      amount: string;
      currency: string;
      network: string;
      pay_reference: string;
    }
  | {
      type: "fiat";
      bank_code: string;
      account_number: string;
      amount: string;
      currency: string;
      pay_reference: string;
      account_name?: string;
    };

type SkyewalletTransaction = {
  id: string;
  type: string;
  status: string;
  amount: string;
  amount_usd: string | null;
  currency: string;
  network: string | null;
  client_reference: string | null;
  flat_fee: string;
  percent_fee: string;
  total_fee: string;
  fee_usd: string | null;
  external_reference: string | null;
  pay_reference: string | null;
  customer_id: string | null;
  customer_name: string | null;
  created_at: string;
  updated_at: string | null;
  related: {
    payin: {
      id: string;
      customer_id: string;
      method: string;
      status: string;
      crypto_account_id: string | null;
      virtual_account_id: string | null;
      mobile_money_account_id: string | null;
      transaction_id: string | null;
      amount: string | null;
      currency_code: string;
      network_code: string | null;
      pay_reference: string | null;
      metadata: Record<string, unknown>;
      provider_metadata: Record<string, unknown>;
      created_at: string;
      updated_at: string | null;
    };
    payout: {
      id: string;
      customer_id: string | null;
      method: string;
      status: string;
      transaction_id: string | null;
      amount: string;
      currency_code: string;
      network_code: string | null;
      destination_account_name: string | null;
      destination_account_number: string | null;
      destination_bank_code: string | null;
      destination_bank_name: string | null;
      destination_address: string | null;
      destination_phone_number: string | null;
      destination_country_code: string | null;
      destination_network: string | null;
      error_reason: string | null;
      error_details: Record<string, unknown>;
      retry_count: string | null;
      last_retried_at: string | null;
      pay_reference: string | null;
      metadata: Record<string, unknown>;
      provider_metadata: Record<string, unknown>;
      created_at: string;
      updated_at: string | null;
    };
    deposit: Record<string, unknown>;
    withdrawal: Record<string, unknown>;
    crypto_account: {
      id: string;
      customer_id: string | null;
      wallet_id: string | null;
      type: string;
      address: string;
      currency: string;
      network: string;
      status: string;
      expires_at: string | null;
      expected_amount: string | null;
      created_at: string;
    };
    virtual_account: {
      id: string;
      wallet_id: string;
      type: string;
      provider: string;
      provider_account_id: string | null;
      account_number: string;
      account_name: string | null;
      bank_name: string | null;
      status: string;
      expires_at: string | null;
      expected_amount: string | null;
      created_at: string;
    };
    mobile_money_account: Record<string, unknown>;
    wallet_address: Record<string, unknown>;
    wallet_virtual_account: Record<string, unknown>;
    wallet_mobile_money_account: Record<string, unknown>;
    bank_settlement_account: Record<string, unknown>;
    crypto_settlement_account: Record<string, unknown>;
    momo_settlement_account: Record<string, unknown>;
  };
};

type SkyewalletClientConfig = {
  apiKey: string;
  baseUrl: string;
};

export class SkyewalletClient {
  constructor(private readonly config: SkyewalletClientConfig) {}

  createCustomer(input: CustomerInput) {
    return this.request<{
      success: boolean;
      data: { customer: SkyewalletCustomer };
    }>("/v1/customers", {
      method: "POST",
      body: input
    });
  }

  lookupCustomer(input: LookupCustomerInput) {
    return this.request<{
      success: boolean;
      data: { customer: SkyewalletCustomer };
    }>("/v1/customers/lookup", {
      method: "POST",
      body: input
    });
  }

  async getOrCreateCustomer(input: CustomerInput & { email: string; phone: string }) {
    try {
      const found = await this.lookupCustomer({ email: input.email });
      if (found.data.customer) {
        if (!found.data.customer.phone && input.phone) {
          return (await this.updateCustomer(found.data.customer.id, { phone: input.phone })).data.customer;
        }
        return found.data.customer;
      }
    } catch {
    }

    const created = await this.createCustomer(input);
    return created.data.customer;
  }

  updateCustomer(customerId: string, input: Partial<CustomerInput>) {
    return this.request<{
      success: boolean;
      data: { customer: SkyewalletCustomer };
    }>(`/v1/customers/${customerId}`, {
      method: "PATCH",
      body: input as Record<string, unknown>
    });
  }

  createPayin(input: CreatePayinInput) {
    return this.request<{
      success: boolean;
      data: { payin: SkyewalletPayin };
    }>("/v1/payin", {
      method: "POST",
      body: input
    });
  }

  getRate(from: string, to: string, type?: string) {
    const params = new URLSearchParams({ from, to });
    if (type) params.set("type", type);
    return this.request<{
      success: boolean;
      data: {
        from: string;
        to: string;
        rate: string;
        type: string;
        timestamp: string;
      };
    }>(`/v1/rates?${params}`);
  }

  getSwapQuote(input: QuoteInput) {
    return this.request<{
      success: boolean;
      data: {
        quote_id: string;
        from_currency: string;
        to_currency: string;
        from_amount: string;
        to_amount: string;
        rate: string;
        fee: string;
        expires_at: string;
      };
    }>("/v1/swap/quote", {
      method: "POST",
      body: input
    });
  }

  executeSwap(quoteId: string) {
    return this.request<{
      success: boolean;
      data: {
        swap_id: string;
        transaction_id: string;
        from_currency: string;
        to_currency: string;
        from_amount: string;
        to_amount: string;
        fee: string;
        rate: string;
        status: string;
      };
    }>("/v1/swap/execute", {
      method: "POST",
      body: {
        quote_id: quoteId
      }
    });
  }

  createPayout(input: PayoutInput) {
    return this.request<{
      success: boolean;
      data: {
        transaction_id: string;
        status: string;
        external_reference: string | null;
        amount: string;
        total_fee: string;
        currency: string;
        network: string | null;
        pay_reference: string | null;
      };
    }>("/v1/payouts", {
      method: "POST",
      body: input
    });
  }

  getTransaction(id: string) {
    return this.request<{
      success: boolean;
      data: { transaction: SkyewalletTransaction };
    }>(`/v1/transactions/${encodeURIComponent(id)}`);
  }

  resolveBankAccount(input: {
    country_code: string;
    bank_code: string;
    account_number: string;
  }) {
    return this.request<{
      success: boolean;
      data: {
        account_name: string;
        bank_code: string;
        account_number: string;
      };
    }>("/v1/resolve-bank-account", {
      method: "POST",
      body: input
    });
  }

  validateAddress(input: { address: string; currency: string; network: string }) {
    return this.request<{
      success: boolean;
      data: {
        valid: boolean;
        address: string;
        currency: string;
        network: string;
      };
      error?: { message: string };
    }>("/v1/validate-address", {
      method: "POST",
      body: input
    });
  }

  listBanks(countryCode: string) {
    return this.request<{
      success: boolean;
      data: {
        banks: Array<{
          code: string;
          name: string;
          slug: string;
        }>;
      };
    }>(`/v1/banks/${countryCode}`);
  }

  private async request<T>(path: string, options: RequestOptions = {}) {
    console.log("[skyewallet] request", options.method ?? "GET", `${this.config.baseUrl}${path}`, options.body ? JSON.stringify(options.body) : "");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload?.error?.message ??
        payload?.message ??
        `Skyewallet request failed with status ${response.status}`;
      const err = new Error(message) as Error & { payload: unknown };
      err.payload = payload;
      throw err;
    }

    return payload as T;
  }
}
