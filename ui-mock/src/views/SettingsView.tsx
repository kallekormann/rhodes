import { ArrowLeft, Lock, Plus, Users } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Button } from "../components/Button";
import { Dropdown } from "../components/Dropdown";
import { Input } from "../components/Input";
import { NavLink } from "../components/NavLink";
import { RadioGroup } from "../components/Radio";
import { SpaceCreateModal } from "../components/SpaceCreateModal";
import type { Theme } from "../context/AppContext";
import "./SettingsView.css";

const navItems = [
  "Profile",
  "Security",
  "Preferences",
  "Spaces",
  "Team",
  "Billing",
  "Privacy",
] as const;

type SettingsSection = (typeof navItems)[number];
type CreateKind = "personal" | "team" | null;
type ThemeMode = "system" | Theme;

const roleLabels = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
} as const;

const languageOptions = [
  { id: "en", label: "English" },
  { id: "de", label: "Deutsch" },
  { id: "es", label: "Español" },
];

function resolveSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function SettingsView() {
  const {
    setView,
    setTheme,
    scopes,
    activeScope,
    setActiveScope,
    createPersonalSpace,
    createTeamSpace,
    canCreatePersonalSpace,
    canCreateTeamSpace,
  } = useApp();
  const [section, setSection] = useState<SettingsSection>("Profile");
  const [createKind, setCreateKind] = useState<CreateKind>(null);
  const [displayName, setDisplayName] = useState("Kalle");
  const [language, setLanguage] = useState("en");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");

  const personalScopes = scopes.filter((s) => s.type === "private");
  const teamScopes = scopes.filter((s) => s.type === "team");

  const handleCreate = (name: string) => {
    if (createKind === "personal") createPersonalSpace(name);
    if (createKind === "team") createTeamSpace(name);
    setCreateKind(null);
  };

  const handleThemeModeChange = (value: string) => {
    const mode = value as ThemeMode;
    setThemeMode(mode);
    if (mode === "system") {
      setTheme(resolveSystemTheme());
      return;
    }
    setTheme(mode);
  };

  return (
    <div className="settings-view">
      <div className="settings-view__topbar">
        <NavLink icon={ArrowLeft} onClick={() => setView("editor")}>
          Settings
        </NavLink>
      </div>

      <div className="settings-view__layout">
        <nav className="settings-nav">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className={`settings-nav__item ${section === item ? "settings-nav__item--active" : ""}`}
              onClick={() => setSection(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {section === "Profile" && (
            <div className="settings-profile">
              <div className="settings-field">
                <label className="settings-field__label" htmlFor="display-name">
                  Display name
                </label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={setDisplayName}
                />
              </div>
              <div className="settings-field">
                <label className="settings-field__label" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value="kalle@example.com"
                  disabled
                />
              </div>
              <div className="settings-field">
                <label className="settings-field__label" htmlFor="language">
                  Language
                </label>
                <Dropdown
                  variant="field"
                  value={language}
                  options={languageOptions}
                  onChange={setLanguage}
                />
              </div>
              <fieldset className="settings-field">
                <legend className="settings-field__label">Theme</legend>
                <RadioGroup
                  name="settings-theme"
                  value={themeMode}
                  onChange={handleThemeModeChange}
                  options={[
                    { value: "system", label: "System" },
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ]}
                />
              </fieldset>
            </div>
          )}

          {section === "Spaces" && (
            <div className="settings-spaces">
              <header className="settings-spaces__header">
                <div>
                  <h2 className="settings-spaces__title">Spaces</h2>
                  <p className="settings-spaces__desc">
                    Personal spaces are private to you. Team spaces are shared with members.
                  </p>
                </div>
              </header>

              <section className="settings-spaces__group">
                <div className="settings-spaces__group-head">
                  <h3 className="settings-spaces__group-title">
                    <Lock size={14} strokeWidth={1.75} />
                    Personal
                  </h3>
                  {canCreatePersonalSpace && (
                    <Button variant="ghost" onClick={() => setCreateKind("personal")}>
                      <Plus size={16} strokeWidth={1.75} />
                      New personal space
                    </Button>
                  )}
                </div>
                <ul className="settings-spaces__list">
                  {personalScopes.map((scope) => (
                    <li key={scope.id} className="settings-spaces__row">
                      <div className="settings-spaces__row-main">
                        <span className="settings-spaces__row-name">{scope.name}</span>
                        <span className="settings-spaces__row-meta">Personal · Owner</span>
                      </div>
                      {activeScope.id === scope.id ? (
                        <span className="settings-spaces__active">Active</span>
                      ) : (
                        <button
                          type="button"
                          className="settings-spaces__switch"
                          onClick={() => setActiveScope(scope.id)}
                        >
                          Switch
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="settings-spaces__group">
                <div className="settings-spaces__group-head">
                  <h3 className="settings-spaces__group-title">
                    <Users size={14} strokeWidth={1.75} />
                    Team
                  </h3>
                  {canCreateTeamSpace && (
                    <Button variant="ghost" onClick={() => setCreateKind("team")}>
                      <Plus size={16} strokeWidth={1.75} />
                      New team space
                    </Button>
                  )}
                </div>
                <ul className="settings-spaces__list">
                  {teamScopes.map((scope) => (
                    <li key={scope.id} className="settings-spaces__row">
                      <div className="settings-spaces__row-main">
                        <span className="settings-spaces__row-name">{scope.name}</span>
                        <span className="settings-spaces__row-meta">
                          Team · {roleLabels[scope.role]}
                        </span>
                      </div>
                      {activeScope.id === scope.id ? (
                        <span className="settings-spaces__active">Active</span>
                      ) : (
                        <button
                          type="button"
                          className="settings-spaces__switch"
                          onClick={() => setActiveScope(scope.id)}
                        >
                          Switch
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {section !== "Profile" && section !== "Spaces" && (
            <p className="settings-placeholder caption">
              {section} settings — mock placeholder.
            </p>
          )}
        </div>
      </div>

      <SpaceCreateModal
        open={createKind === "personal"}
        title="New personal space"
        placeholder="e.g. Book draft, Research notes"
        onClose={() => setCreateKind(null)}
        onSubmit={handleCreate}
      />
      <SpaceCreateModal
        open={createKind === "team"}
        title="New team space"
        placeholder="e.g. Growth Engine"
        onClose={() => setCreateKind(null)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
