import { Link } from "@tanstack/react-router";

const storySteps = [
  {
    title: "You start with crypto",
    text: "Your money lives on-chain and is ready to move.",
  },
  {
    title: "Real life asks for fiat",
    text: "A merchant, POS agent, or friend still wants a bank transfer.",
  },
  {
    title: "trassfa bridges both",
    text: "The sender pays one way and the receiver gets value the way they prefer.",
  },
];

const flows = [
  {
    title: "Pay out from your wallet",
    text: "Create a route that starts in crypto and lands as a bank transfer.",
  },
  {
    title: "Turn bank transfers into crypto",
    text: "Accept fiat and settle directly into a wallet without a manual swap.",
  },
  {
    title: "Share a crypto route for any bank account",
    text: "Let someone send crypto while the bank account owner receives fiat.",
  },
  {
    title: "Create a bank account for any wallet",
    text: "Generate a virtual account that receives fiat and pays out in crypto.",
  },
];

const scenarios = [
  {
    title: "Dinner bill",
    text: "You hold stablecoins. The restaurant wants a transfer. trassfa closes the bill cleanly.",
  },
  {
    title: "POS cash-out",
    text: "Move from wallet balance to cash through familiar local rails.",
  },
  {
    title: "Urgent send",
    text: "When someone needs money fast, create the route that fits the moment.",
  },
  {
    title: "Urgent receive",
    text: "Take a bank transfer and collect the value in crypto instead.",
  },
  {
    title: "Bank details, crypto outcome",
    text: "Share a normal account destination and settle the result to a wallet.",
  },
  {
    title: "Crypto address, bank outcome",
    text: "Receive from crypto and deliver the final value into a bank account.",
  },
];

const supportGroups = [
  {
    title: "Networks",
    text: "Built for the chains people already move with.",
    items: ["TRON", "Solana"],
  },
  {
    title: "Currencies",
    text: "The current rails cover both crypto assets and local fiat settlement.",
    items: ["USDT", "USDC", "TRX", "SOL", "NGN"],
  },
];

const faqs = [
  {
    question: "What story does trassfa solve?",
    answer:
      "It solves the awkward moment when one side has crypto and the other side wants fiat, or the reverse. trassfa creates the route between both.",
  },
  {
    question: "Can I start from either a wallet or a bank transfer?",
    answer:
      "Yes. You can begin from crypto and settle to bank, or begin from bank and settle to crypto.",
  },
  {
    question: "Who is this built for?",
    answer:
      "It fits everyday payment moments: merchants, quick transfers, POS cash-out, family support, and direct wallet settlement.",
  },
  {
    question: "What rails are live in the current scope?",
    answer:
      "The current product supports TRON and Solana flows, with USDT, USDC, TRX, SOL, and NGN in scope.",
  },
];

export function LandingPage() {
  return (
    <div className="page landing-page">
      <section className="landing-hero">
        <div className="hero-intro">
          <span className="eyebrow">From wallet to real life</span>
          <h1>Your crypto should still work when the other side wants fiat.</h1>
          <p className="hero-text">
            A dinner bill. A POS cash-out. An urgent transfer. trassfa turns these everyday moments
            into simple routes between on-chain wallets and bank rails.
          </p>
          <div className="hero-actions">
            <Link to="/app/send" className="button button-primary">
              Spend from crypto
            </Link>
            <Link to="/app/receive" className="button button-secondary">
              Receive into crypto
            </Link>
          </div>
          <div className="hero-summary">
            <span>Wallet to bank</span>
            <span>Bank to wallet</span>
            <span>TRON + Solana</span>
            <span>USDT, USDC, TRX, SOL, NGN</span>
          </div>
        </div>

        <div className="hero-stage">
          <div className="floating-note note-top">Pay with USDT. Deliver NGN.</div>
          <div className="floating-note note-bottom">Receive fiat. Collect crypto.</div>

          <div className="mockup-shell">
            <div className="mockup-topbar">
              <span />
              <span />
              <span />
            </div>

            <div className="mockup-body">
              <div className="mockup-story">
                <span className="label">Scenario</span>
                <h2>Restaurant payout</h2>
                <p>
                  The customer pays from a wallet. The merchant receives a normal bank transfer.
                </p>
              </div>

              <div className="mockup-route">
                <div className="mockup-node">
                  <span className="node-label">Source</span>
                  <strong>Wallet</strong>
                  <small>USDT / USDC</small>
                </div>
                <div className="mockup-arrow" />
                <div className="mockup-node active">
                  <span className="node-label">Route</span>
                  <strong>trassfa</strong>
                  <small>conversion + settlement</small>
                </div>
                <div className="mockup-arrow" />
                <div className="mockup-node">
                  <span className="node-label">Destination</span>
                  <strong>Bank</strong>
                  <small>NGN payout</small>
                </div>
              </div>

              <div className="mockup-grid">
                <article className="mockup-card mockup-card-a">
                  <span className="label">Live uses</span>
                  <strong>POS cash-out</strong>
                  <p>Turn wallet value into spendable local money.</p>
                </article>
                <article className="mockup-card mockup-card-b">
                  <span className="label">Also works</span>
                  <strong>Urgent send</strong>
                  <p>Choose the route that matches how the receiver wants to collect.</p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="storyline-section">
        {storySteps.map((step, index) => (
          <article key={step.title} className="storyline-card">
            <span className="storyline-index">0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </section>

      <section className="section-block">
        <div className="section-copy">
          <span className="eyebrow">What changes with trassfa</span>
          <h2>Instead of forcing people into one payment rail, the product adapts to the story.</h2>
        </div>
        <div className="flow-grid">
          {flows.map((item, index) => (
            <article key={item.title} className="flow-card">
              <span className="flow-number">0{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-copy">
          <span className="eyebrow">Moments it fits</span>
          <h2>Not abstract finance. Everyday situations where the payout format matters.</h2>
        </div>
        <div className="scenario-grid">
          {scenarios.map((item) => (
            <article key={item.title} className="scenario-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block coverage-section">
        <div className="section-copy">
          <span className="eyebrow">Current coverage</span>
          <h2>The rails available right now.</h2>
        </div>
        <div className="coverage-grid">
          {supportGroups.map((group) => (
            <article key={group.title} className="coverage-card">
              <h3>{group.title}</h3>
              <p>{group.text}</p>
              <div className="pill-row">
                {group.items.map((item) => (
                  <span key={item} className="support-pill">
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-copy">
          <span className="eyebrow">FAQ</span>
          <h2>Short answers before someone starts the flow.</h2>
        </div>
        <div className="faq-list">
          {faqs.map((item) => (
            <details key={item.question} className="faq-item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta-panel">
        <div>
          <span className="eyebrow">Start the route</span>
          <h2>Choose where value starts and where it should land.</h2>
          <p>
            trassfa handles the bridge so the sender and receiver do not have to think about the
            mismatch between crypto and fiat.
          </p>
        </div>
        <div className="cta-actions">
          <Link to="/app/send" className="button button-primary">
            Crypto to bank
          </Link>
          <Link to="/app/receive" className="button button-secondary">
            Bank to crypto
          </Link>
        </div>
      </section>
    </div>
  );
}
