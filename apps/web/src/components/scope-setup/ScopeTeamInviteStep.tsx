"use client";

import { Search, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ShareTarget } from "@/components/SharePopover";
import { Button } from "@/components/Button";
import { Dropdown } from "@/components/Dropdown";
import { Input } from "@/components/Input";
import { IconButton } from "@/components/IconButton";
import type { PendingTeamInvite } from "@/components/ScopeSetupWizard";
import { isValidInviteEmail, resolvedInvites } from "@/lib/scope-setup/invites";
import "./ScopeTeamInviteStep.css";

const roleOptions = [
  { id: "member", label: "Member" },
  { id: "viewer", label: "Viewer" },
  { id: "admin", label: "Admin" },
];

export type InviteRow = PendingTeamInvite & {
  key: string;
  label?: string;
  userId?: string;
};

type ScopeTeamInviteStepProps = {
  invites: InviteRow[];
  onChange: (invites: InviteRow[]) => void;
};

export function ScopeTeamInviteStep({ invites, onChange }: ScopeTeamInviteStepProps) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<PendingTeamInvite["role"]>("member");
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const added = useMemo(() => resolvedInvites(invites), [invites]);
  const invitedEmails = useMemo(
    () => new Set(added.map((member) => member.email)),
    [added],
  );

  useEffect(() => {
    let cancelled = false;
    const query = search.trim();

    async function loadTargets() {
      setLoadingTargets(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);

        const response = await fetch(`/app/api/share-targets?${params.toString()}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (!cancelled) {
            setError(
              typeof data.error === "string" ? data.error : "Failed to load people",
            );
            setTargets([]);
          }
          return;
        }

        if (!cancelled) {
          setError(null);
          setTargets(
            ((data.targets as ShareTarget[]) ?? []).filter(
              (target) => target.kind === "user",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoadingTargets(false);
      }
    }

    void loadTargets();

    return () => {
      cancelled = true;
    };
  }, [search]);

  const addInvite = useCallback(
    (invite: Omit<InviteRow, "key">) => {
      const email = invite.email.trim().toLowerCase();
      if (!isValidInviteEmail(email) || invitedEmails.has(email)) return;

      onChange([
        ...invites,
        {
          key: crypto.randomUUID(),
          email,
          role: invite.role,
          label: invite.label,
          userId: invite.userId,
        },
      ]);
      setSearch("");
      setError(null);
    },
    [invitedEmails, invites, onChange],
  );

  const addFromTarget = (target: ShareTarget) => {
    const email = target.subtitle.trim().toLowerCase();
    if (!isValidInviteEmail(email)) {
      setError("Could not resolve an email for this person.");
      return;
    }

    addInvite({
      email,
      role,
      label: target.label,
      userId: target.id,
    });
  };

  const addFromSearch = () => {
    const email = search.trim().toLowerCase();
    if (!isValidInviteEmail(email)) {
      setError("Enter a valid email or pick someone from suggestions.");
      return;
    }

    addInvite({ email, role, label: email });
  };

  const updateRole = (key: string, nextRole: PendingTeamInvite["role"]) => {
    onChange(
      invites.map((row) => (row.key === key ? { ...row, role: nextRole } : row)),
    );
  };

  const removeInvite = (key: string) => {
    onChange(invites.filter((row) => row.key !== key));
  };

  const suggestions = targets.filter((target) => {
    const email = target.subtitle.trim().toLowerCase();
    return isValidInviteEmail(email) && !invitedEmails.has(email);
  });

  const showEmailInvite =
    search.trim().length > 0 &&
    isValidInviteEmail(search) &&
    !invitedEmails.has(search.trim().toLowerCase()) &&
    !suggestions.some(
      (target) => target.subtitle.trim().toLowerCase() === search.trim().toLowerCase(),
    );

  return (
    <div className="scope-team-invite">
      <div className="scope-team-invite__form">
        <div className="scope-team-invite__search-row">
          <Input
            value={search}
            onChange={setSearch}
            placeholder="Search name or email…"
            icon={<Search size={15} strokeWidth={1.75} />}
            aria-label="Search people to invite"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addFromSearch();
              }
            }}
          />
          <Dropdown
            variant="field"
            options={roleOptions}
            value={role}
            onChange={(value) => setRole(value as PendingTeamInvite["role"])}
            aria-label="Role for new invite"
          />
        </div>

        {showEmailInvite ? (
          <Button variant="ghost" icon={UserPlus} onClick={addFromSearch}>
            Invite {search.trim()}
          </Button>
        ) : null}
      </div>

      {error ? <p className="scope-team-invite__error caption">{error}</p> : null}

      {search.trim() ? (
        <section className="scope-team-invite__suggestions" aria-label="Suggestions">
          <h4 className="scope-team-invite__section-label">Suggestions</h4>
          {loadingTargets ? (
            <p className="scope-team-invite__hint">Loading…</p>
          ) : suggestions.length === 0 ? (
            <p className="scope-team-invite__hint">
              No matches in your org. Enter an email above to invite someone new.
            </p>
          ) : (
            <ul className="scope-team-invite__suggestion-list">
              {suggestions.map((target) => (
                <li key={target.id}>
                  <button
                    type="button"
                    className="scope-team-invite__suggestion"
                    onClick={() => addFromTarget(target)}
                  >
                    <span className="scope-team-invite__suggestion-name">{target.label}</span>
                    <span className="scope-team-invite__suggestion-email">
                      {target.subtitle}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="scope-team-invite__added" aria-label="Invited members">
        <h4 className="scope-team-invite__section-label">
          {added.length > 0 ? `Invited (${added.length})` : "Invited"}
        </h4>
        {added.length === 0 ? (
          <p className="scope-team-invite__hint">
            No one added yet — search above or skip for now.
          </p>
        ) : (
          <ul className="scope-team-invite__member-list">
            {added.map((member) => {
              const row = invites.find((invite) => invite.key === member.key);
              if (!row) return null;

              return (
                <li key={member.key} className="scope-team-invite__member">
                  <div className="scope-team-invite__member-meta">
                    <span className="scope-team-invite__member-name">{member.label}</span>
                    {member.label !== member.email ? (
                      <span className="scope-team-invite__member-email">{member.email}</span>
                    ) : null}
                  </div>
                  <Dropdown
                    variant="field"
                    options={roleOptions}
                    value={row.role}
                    onChange={(value) =>
                      updateRole(member.key, value as PendingTeamInvite["role"])
                    }
                    aria-label={`Role for ${member.label}`}
                  />
                  <IconButton
                    icon={X}
                    label={`Remove ${member.label}`}
                    onClick={() => removeInvite(member.key)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
