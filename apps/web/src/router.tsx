import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { authClient } from "./lib/auth-client";
import { AuthPage } from "./routes/auth";
import { AppHomePage } from "./routes/app-home";
import { LandingPage } from "./routes/landing";
import { ProfilePage } from "./routes/profile";
import { ReceivePage } from "./routes/receive";
import { SendPage } from "./routes/send";
import { TransactionPage } from "./routes/transaction";
import { TransactionReceiptPage } from "./routes/transaction-receipt";
import { TransactionsPage } from "./routes/transactions";

function RootLayout() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { data: session } = authClient.useSession();
  const isAuthRoute = pathname === "/auth";
  const isAppRoute = pathname === "/app" || pathname.startsWith("/app/");
  const isProfileRoute = pathname === "/app/profile";
  const isMobileShellRoute = isAuthRoute || isAppRoute;
  const profileLabel = session?.user.email?.slice(0, 2).toUpperCase() ?? "PR";

  return (
    <>
      {isMobileShellRoute ? (
        <div className="mobile-app-shell">
          <div className="mobile-app-frame">
            <header className="mobile-topbar">
              <Link to="/" className="brand">
                <img src="/trassfa-logo.png" alt="trassfa" className="brand-logo" />
              </Link>
              {isAuthRoute ? (
                <Link to="/" className="button button-secondary button-small">
                  Home
                </Link>
              ) : session?.user ? (
                <Link
                  to="/app/profile"
                  className={isProfileRoute ? "profile-chip active" : "profile-chip"}
                >
                  <span className="profile-chip-avatar">{profileLabel}</span>
                  <span className="profile-chip-text">Profile</span>
                </Link>
              ) : (
                <Link to="/auth" className="button button-secondary button-small">
                  Sign in
                </Link>
              )}
            </header>
            <main className="mobile-main">
              <Outlet />
            </main>
            {isAppRoute ? (
              <nav className="mobile-tabbar">
                <Link to="/app" className="tab-link" activeProps={{ className: "tab-link active" }}>
                  Home
                </Link>
                <Link
                  to="/app/send"
                  className="tab-link"
                  activeProps={{ className: "tab-link active" }}
                >
                  Send
                </Link>
                <Link
                  to="/app/receive"
                  className="tab-link"
                  activeProps={{ className: "tab-link active" }}
                >
                  Receive
                </Link>
                <Link
                  to="/app/transactions"
                  className="tab-link"
                  activeProps={{ className: "tab-link active" }}
                >
                  History
                </Link>
              </nav>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="app-shell">
          <header className="site-header">
            <Link to="/" className="brand">
              <img src="/trassfa-logo.png" alt="trassfa" className="brand-logo" />
            </Link>
            <nav className="site-nav">
              <Link to="/" activeProps={{ className: "active" }}>
                Home
              </Link>
              <Link to="/app/send" activeProps={{ className: "active" }}>
                Send
              </Link>
              <Link to="/app/receive" activeProps={{ className: "active" }}>
                Receive
              </Link>
            </nav>
            <div className="header-actions">
              {session?.user ? (
                <>
                  <span className="user-pill">{session.user.email}</span>
                  <Link to="/app" className="button button-secondary">
                    App
                  </Link>
                </>
              ) : (
                <Link to="/auth" className="button button-secondary">
                  Sign in
                </Link>
              )}
            </div>
          </header>
          <main>
            <Outlet />
          </main>
        </div>
      )}
      {import.meta.env.DEV ? <TanStackRouterDevtools /> : null}
    </>
  );
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth",
  component: AuthPage,
});

const appHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  component: AppHomePage,
});

const sendRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/send",
  component: SendPage,
});

const receiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/receive",
  component: ReceivePage,
});

const transactionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/transactions",
  component: TransactionsPage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/profile",
  component: ProfilePage,
});

const transactionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/transactions/$id",
  component: TransactionPage,
});

const transactionReceiptRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/transactions/$id/receipt",
  component: TransactionReceiptPage,
});

const routeTree = rootRoute.addChildren([
  landingRoute,
  authRoute,
  appHomeRoute,
  sendRoute,
  receiveRoute,
  transactionsRoute,
  profileRoute,
  transactionRoute,
  transactionReceiptRoute,
]);

export const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
