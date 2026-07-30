import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AuthRequired } from "../components/auth-required";
import {
  getPermanentAccount,
  getPermanentAddress,
  getProfile,
  getProfileLimits,
  type PermanentAccount,
  type PermanentAddress,
  type Profile,
  type ProfileLimits,
} from "../lib/api";
import { authClient } from "../lib/auth-client";

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function VerificationPill({ label, verified }: { label: string; verified: boolean }) {
  return (
    <div className={verified ? "verification-pill verified" : "verification-pill pending"}>
      <span>{label}</span>
      <strong>{verified ? "Verified" : "Pending"}</strong>
    </div>
  );
}

function PermissionPill({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className={enabled ? "verification-pill verified" : "verification-pill pending"}>
      <span>{label}</span>
      <strong>{enabled ? "Enabled" : "Locked"}</strong>
    </div>
  );
}

function formatLimitValue(value: unknown) {
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => `${key}: ${String(nestedValue)}`)
      .join(" • ");
  }

  return "--";
}

function formatPermissionLabel(key: string) {
  return key
    .replace(/^allow/, "")
    .replace(/([A-Z])/g, " $1")
    .trim();
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [limits, setLimits] = useState<ProfileLimits | null>(null);
  const [permanentAddress, setPermanentAddress] = useState<PermanentAddress | null>(null);
  const [permanentAccount, setPermanentAccount] = useState<PermanentAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([getProfile(), getProfileLimits(), getPermanentAddress(), getPermanentAccount()])
      .then(([profileResponse, limitsResponse, addressResponse, accountResponse]) => {
        setProfile(profileResponse.profile);
        setLimits(limitsResponse);
        setPermanentAddress(addressResponse.address);
        setPermanentAccount(accountResponse.account);
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [session?.user]);

  if (sessionPending) {
    return <p className="screen-message">Loading...</p>;
  }

  if (!session?.user) {
    return <AuthRequired title="Profile" message="Sign in to view your profile and KYC details." />;
  }

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await authClient.signOut();
      await navigate({ to: "/" });
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="mobile-screen">
      <div className="screen-header">
        <span className="section-label">Profile</span>
        <strong>Account and KYC</strong>
      </div>

      {loading ? <p className="screen-message">Loading profile...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && !error && profile ? (
        <>
          <section className="mobile-card mobile-card-spaced">
            <div className="profile-hero">
              <div className="profile-avatar-large">
                {`${profile.firstName} ${profile.lastName}`.trim().slice(0, 2).toUpperCase()}
              </div>
              <div className="profile-hero-copy">
                <strong>{`${profile.firstName} ${profile.lastName}`.trim()}</strong>
                <span>{profile.email || session.user.email}</span>
                <span>Level {profile.level}</span>
              </div>
            </div>
          </section>

          <section className="mobile-card mobile-card-spaced">
            <span className="section-label">Profile details</span>
            <div className="mobile-summary-list">
              <SettingRow label="Phone" value={profile.phone ?? "Not added"} />
              <SettingRow label="Date of birth" value={profile.dateOfBirth ?? "Not added"} />
              <SettingRow
                label="Address"
                value={
                  profile.address
                    ? [profile.address, profile.city, profile.state, profile.country]
                        .filter(Boolean)
                        .join(", ")
                    : "Not added"
                }
              />
            </div>
          </section>

          <section className="mobile-card mobile-card-spaced">
            <div className="summary-row">
              <span>KYC level</span>
              <strong>Level {profile.level}</strong>
            </div>
            <div className="verification-grid">
              <VerificationPill label="BVN" verified={profile.bvnVerified} />
              <VerificationPill label="NIN" verified={profile.ninVerified} />
              <VerificationPill label="Phone" verified={profile.phoneVerified} />
              <VerificationPill label="Address" verified={profile.addressVerified} />
            </div>
          </section>

          {limits ? (
            <>
              <section className="mobile-card mobile-card-spaced">
                <span className="section-label">Limits</span>
                <div className="mobile-summary-list">
                  {Object.entries(limits.limits).map(([currency, value]) => (
                    <SettingRow key={currency} label={currency} value={formatLimitValue(value)} />
                  ))}
                </div>
              </section>

              <section className="mobile-card mobile-card-spaced">
                <span className="section-label">Access</span>
                <div className="verification-grid">
                  {Object.entries(limits.permissions).map(([permission, enabled]) => (
                    <PermissionPill
                      key={permission}
                      label={formatPermissionLabel(permission)}
                      enabled={enabled}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : null}

          <section className="mobile-card mobile-card-spaced">
            <span className="section-label">Permanent crypto address</span>
            {permanentAddress ? (
              <div className="mobile-summary-list">
                <SettingRow label="Currency" value={permanentAddress.currency} />
                <SettingRow label="Network" value={permanentAddress.network} />
                <SettingRow label="Address" value={permanentAddress.address} />
              </div>
            ) : (
              <p className="screen-message">No permanent crypto address yet.</p>
            )}
          </section>

          <section className="mobile-card mobile-card-spaced">
            <span className="section-label">Permanent bank account</span>
            {permanentAccount ? (
              <div className="mobile-summary-list">
                <SettingRow label="Bank" value={permanentAccount.bankName} />
                <SettingRow label="Account name" value={permanentAccount.accountName} />
                <SettingRow label="Account number" value={permanentAccount.accountNumber} />
              </div>
            ) : (
              <p className="screen-message">No permanent bank account yet.</p>
            )}
          </section>

          <section className="mobile-card mobile-card-spaced">
            <span className="section-label">Session</span>
            <button
              className="button button-secondary button-block"
              type="button"
              onClick={() => {
                void handleSignOut();
              }}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
