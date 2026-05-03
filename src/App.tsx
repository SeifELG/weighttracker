import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  deleteEntry,
  getEntries,
  getSetting,
  replaceEntries,
  saveEntry,
  setSetting,
  type Unit,
  type WeightEntry,
} from './storage';
import { formatMeasuredAt, formatShortDate, fromDatetimeLocal, toDatetimeLocal } from './time';

const units: Unit[] = ['kg', 'lb'];

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function normalizeEntry(entry: Partial<WeightEntry>): WeightEntry | null {
  if (!entry.id || typeof entry.value !== 'number' || !Number.isFinite(entry.value)) {
    return null;
  }

  if (entry.unit !== 'kg' && entry.unit !== 'lb') {
    return null;
  }

  const measuredAt = entry.measuredAt ? new Date(entry.measuredAt) : null;
  if (!measuredAt || Number.isNaN(measuredAt.getTime())) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: entry.id,
    value: entry.value,
    unit: entry.unit,
    measuredAt: measuredAt.toISOString(),
    createdAt: entry.createdAt ?? now,
    updatedAt: entry.updatedAt ?? now,
  };
}

function App() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<Unit>('kg');
  const [measuredAt, setMeasuredAt] = useState(() => toDatetimeLocal(new Date()));
  const [showTime, setShowTime] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getEntries().then(setEntries);
    getSetting<Unit>('unit', 'kg').then(setUnit);
  }, []);

  const sortedAsc = useMemo(
    () => [...entries].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)),
    [entries]
  );

  const latest = entries[0];
  const previous = entries[1];
  const delta = latest && previous ? latest.value - previous.value : null;

  async function refreshEntries() {
    setEntries(await getEntries());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 700) {
      setStatus('Enter a realistic weight.');
      return;
    }

    const now = new Date().toISOString();
    const entry: WeightEntry = {
      id: editingId ?? createId(),
      value: Math.round(parsed * 10) / 10,
      unit,
      measuredAt: fromDatetimeLocal(measuredAt),
      createdAt: entries.find((item) => item.id === editingId)?.createdAt ?? now,
      updatedAt: now,
    };

    await saveEntry(entry);
    await setSetting('unit', unit);
    await refreshEntries();
    setValue('');
    setMeasuredAt(toDatetimeLocal(new Date()));
    setEditingId(null);
    setShowTime(false);
    setStatus(editingId ? 'Entry updated.' : 'Entry saved.');
  }

  function startEdit(entry: WeightEntry) {
    setEditingId(entry.id);
    setValue(String(entry.value));
    setUnit(entry.unit);
    setMeasuredAt(toDatetimeLocal(new Date(entry.measuredAt)));
    setShowTime(true);
    setStatus('');
  }

  function cancelEdit() {
    setEditingId(null);
    setValue('');
    setMeasuredAt(toDatetimeLocal(new Date()));
    setShowTime(false);
    setStatus('');
  }

  async function removeEntry(id: string) {
    await deleteEntry(id);
    await refreshEntries();
    if (editingId === id) {
      cancelEdit();
    }
    setStatus('Entry deleted.');
  }

  function exportBackup() {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `weight-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Backup exported.');
  }

  async function importBackup(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as { entries?: Partial<WeightEntry>[] };
      const imported = (parsed.entries ?? []).map(normalizeEntry).filter((entry): entry is WeightEntry => !!entry);
      if (imported.length === 0) {
        setStatus('No valid entries found.');
        return;
      }
      await replaceEntries(imported);
      await refreshEntries();
      setStatus(`Imported ${imported.length} entries.`);
    } catch {
      setStatus('Could not read that backup.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <main className="app-shell">
      <section className="entry-panel" aria-labelledby="entry-title">
        <div className="topbar">
          <div>
            <p className="eyebrow">Local first</p>
            <h1 id="entry-title">Weight Tracker</h1>
          </div>
          <button className="icon-button" type="button" aria-label="Export backup" onClick={exportBackup}>
            <Download size={20} />
          </button>
        </div>

        <form className="entry-form" onSubmit={handleSubmit}>
          <label className="weight-field">
            <span>Weight</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="72.4"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
            />
          </label>

          <div className="unit-toggle" role="group" aria-label="Unit">
            {units.map((item) => (
              <button
                className={item === unit ? 'selected' : ''}
                key={item}
                type="button"
                onClick={() => setUnit(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <button className="time-toggle" type="button" onClick={() => setShowTime((current) => !current)}>
            <Settings size={17} />
            {showTime ? 'Hide time' : 'Change time'}
          </button>

          {showTime && (
            <label className="time-field">
              <span>Measured at</span>
              <input
                type="datetime-local"
                value={measuredAt}
                onChange={(event) => setMeasuredAt(event.target.value)}
              />
            </label>
          )}

          <div className="form-actions">
            {editingId && (
              <button className="secondary-button" type="button" onClick={cancelEdit} aria-label="Cancel edit">
                <X size={18} />
                Cancel
              </button>
            )}
            <button className="primary-button" type="submit">
              {editingId ? <Save size={20} /> : <Plus size={20} />}
              {editingId ? 'Save' : 'Add'}
            </button>
          </div>
        </form>

        {status && <p className="status">{status}</p>}
      </section>

      <section className="summary-band" aria-label="Summary">
        <div>
          <span>Latest</span>
          <strong>{latest ? `${latest.value.toFixed(1)} ${latest.unit}` : '--'}</strong>
        </div>
        <div>
          <span>Change</span>
          <strong className={delta && delta > 0 ? 'up' : delta && delta < 0 ? 'down' : ''}>
            {delta === null ? '--' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${latest?.unit}`}
          </strong>
        </div>
        <div>
          <span>Entries</span>
          <strong>{entries.length}</strong>
        </div>
      </section>

      <section className="chart-section" aria-labelledby="trend-title">
        <div className="section-heading">
          <h2 id="trend-title">Trend</h2>
          <button className="text-button" type="button" onClick={() => setMeasuredAt(toDatetimeLocal(new Date()))}>
            <RefreshCw size={16} />
            Now
          </button>
        </div>
        <TrendChart entries={sortedAsc} />
      </section>

      <section className="history-section" aria-labelledby="history-title">
        <div className="section-heading">
          <h2 id="history-title">History</h2>
          <div className="backup-actions">
            <button className="icon-button subtle" type="button" aria-label="Import backup" onClick={() => fileInputRef.current?.click()}>
              <Upload size={18} />
            </button>
            <input
              ref={fileInputRef}
              className="hidden-input"
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void importBackup(file);
                }
              }}
            />
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="empty-state">No entries yet.</p>
        ) : (
          <ol className="entry-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.value.toFixed(1)} {entry.unit}</strong>
                  <span>{formatMeasuredAt(entry.measuredAt)}</span>
                </div>
                <div className="row-actions">
                  <button className="icon-button subtle" type="button" aria-label="Edit entry" onClick={() => startEdit(entry)}>
                    <Pencil size={17} />
                  </button>
                  <button className="icon-button danger" type="button" aria-label="Delete entry" onClick={() => void removeEntry(entry.id)}>
                    <Trash2 size={17} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

function TrendChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) {
    return (
      <div className="chart-empty">
        <span>Add two entries to see the line.</span>
      </div>
    );
  }

  const width = 640;
  const height = 240;
  const padding = 34;
  const values = entries.map((entry) => entry.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const points = entries.map((entry, index) => {
    const x = padding + (index / Math.max(entries.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((entry.value - min) / range) * (height - padding * 2);
    return { x, y, entry };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const first = entries[0];
  const last = entries[entries.length - 1];

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weight trend chart">
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} />
        <path d={path} />
        {points.map((point) => (
          <circle key={point.entry.id} cx={point.x} cy={point.y} r="5">
            <title>{`${point.entry.value.toFixed(1)} ${point.entry.unit}, ${formatMeasuredAt(point.entry.measuredAt)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-labels">
        <span>{formatShortDate(first.measuredAt)}</span>
        <span>{`${min.toFixed(1)}-${max.toFixed(1)} ${last.unit}`}</span>
        <span>{formatShortDate(last.measuredAt)}</span>
      </div>
    </div>
  );
}

export default App;
