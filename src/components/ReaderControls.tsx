import type { AmbientPreset, ReaderPreferences, ReaderTheme } from "../types";

interface ReaderControlsProps {
  visible: boolean;
  settingsOpen: boolean;
  prefs: ReaderPreferences;
  onBack: () => void;
  onToggleSettings: () => void;
  onThemeCycle: () => void;
  onAmbientToggle: () => void;
  onPresetChange: (value: AmbientPreset) => void;
  onFontSizeChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
  onColumnWidthChange: (value: number) => void;
}

function nextThemeLabel(theme: ReaderTheme): string {
  if (theme === "paper") {
    return "Sepia";
  }
  if (theme === "sepia") {
    return "Dark";
  }
  return "Paper";
}

export default function ReaderControls({
  visible,
  settingsOpen,
  prefs,
  onBack,
  onToggleSettings,
  onThemeCycle,
  onAmbientToggle,
  onPresetChange,
  onFontSizeChange,
  onLineHeightChange,
  onColumnWidthChange
}: ReaderControlsProps): JSX.Element {
  const controlsVisible = visible || settingsOpen;

  return (
    <>
      <div
        className={`fixed inset-x-0 top-0 z-40 flex justify-center px-5 pt-5 fade-smooth ${
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex w-full max-w-4xl items-center justify-between rounded-monk bg-paper-strong/60 px-3 py-2 shadow-glass backdrop-blur-[20px]">
          <button
            type="button"
            onClick={onBack}
            className="fade-smooth rounded-monk px-3 py-2 text-sm text-ink-muted hover:bg-paper-strong"
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleSettings}
              className={`fade-smooth rounded-monk px-3 py-2 text-sm ${
                settingsOpen ? "bg-paper-strong text-ink" : "text-ink-muted hover:bg-paper-strong"
              }`}
            >
              Aa
            </button>
            <button
              type="button"
              onClick={onThemeCycle}
              className="fade-smooth rounded-monk px-3 py-2 text-sm text-ink-muted hover:bg-paper-strong"
            >
              Theme: {nextThemeLabel(prefs.theme)}
            </button>
            <button
              type="button"
              onClick={onAmbientToggle}
              className={`fade-smooth rounded-monk px-3 py-2 text-sm ${
                prefs.ambientEnabled ? "bg-paper-strong text-ink" : "text-ink-muted hover:bg-paper-strong"
              }`}
            >
              Sound: {prefs.ambientEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>
      </div>

      {settingsOpen ? (
        <aside className="fixed right-5 top-[84px] z-40 w-[320px] rounded-monk bg-paper-strong/60 p-4 shadow-glass backdrop-blur-[20px]">
          <h3 className="font-reading text-xl text-ink">Reading Settings</h3>

          <div className="mt-4 space-y-4 text-sm text-ink">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-ink-muted">Font Size</span>
              <input
                type="range"
                min={16}
                max={28}
                step={1}
                value={prefs.fontSize}
                onChange={(event) => onFontSizeChange(Number(event.target.value))}
                className="mt-2 w-full"
              />
              <span className="mt-1 block text-xs text-ink-muted">{prefs.fontSize}px</span>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-ink-muted">Line Height</span>
              <input
                type="range"
                min={1.45}
                max={2}
                step={0.05}
                value={prefs.lineHeight}
                onChange={(event) => onLineHeightChange(Number(event.target.value))}
                className="mt-2 w-full"
              />
              <span className="mt-1 block text-xs text-ink-muted">{prefs.lineHeight.toFixed(2)}</span>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-ink-muted">Column Width</span>
              <input
                type="range"
                min={520}
                max={760}
                step={10}
                value={prefs.columnWidth}
                onChange={(event) => onColumnWidthChange(Number(event.target.value))}
                className="mt-2 w-full"
              />
              <span className="mt-1 block text-xs text-ink-muted">{prefs.columnWidth}px</span>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-ink-muted">Ambient Preset</span>
              <select
                value={prefs.ambientPreset}
                onChange={(event) => onPresetChange(event.target.value as AmbientPreset)}
                className="surface-input mt-2 w-full rounded-monk px-3 py-2 text-sm outline-none"
              >
                <option value="rain">Rain</option>
                <option value="cafe">Cafe</option>
                <option value="white">White Noise</option>
              </select>
            </label>
          </div>
        </aside>
      ) : null}
    </>
  );
}
